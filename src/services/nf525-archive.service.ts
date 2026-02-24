import {
  NF525OrderIntegrity,
  NF525PeriodicClosing,
  NF525PeriodicClosingType,
  NF525Archive,
  NF525SessionClosing,
} from "@/models/nf525.model";
import { sha256, GENESIS_HASH } from "@/utils/nf525-hash";
import { nf525IntegrityService } from "@/services/nf525-integrity.service";
import { calculateExclTax, calculateVatAmount } from "@/utils/vat-helpers";

const STORAGE_KEY = "nf525_archives";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persistClosings(closings: NF525PeriodicClosing[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(closings));
}

function filterChainByPeriod(
  chain: NF525OrderIntegrity[],
  type: NF525PeriodicClosingType,
  periodIdentifier: string
): NF525OrderIntegrity[] {
  return chain.filter((entry) => {
    const ts = entry.timestamp;
    switch (type) {
      case "daily":
        return ts.startsWith(periodIdentifier); // "2026-02-23"
      case "monthly":
        return ts.startsWith(periodIdentifier); // "2026-02"
      case "yearly":
        return ts.startsWith(periodIdentifier); // "2026"
    }
  });
}

function defaultPeriodIdentifier(type: NF525PeriodicClosingType): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  switch (type) {
    case "daily":
      return `${yyyy}-${mm}-${dd}`;
    case "monthly":
      return `${yyyy}-${mm}`;
    case "yearly":
      return yyyy;
  }
}

export const nf525ArchiveService = {
  // ── Reading ──────────────────────────────────────────────

  getArchiveHistory(): NF525PeriodicClosing[] {
    return readJSON<NF525PeriodicClosing[]>(STORAGE_KEY, []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getClosingsByType(type: NF525PeriodicClosingType): NF525PeriodicClosing[] {
    return this.getArchiveHistory().filter((c) => c.type === type);
  },

  getLastClosingOfType(type: NF525PeriodicClosingType): NF525PeriodicClosing | undefined {
    const closings = this.getClosingsByType(type);
    return closings.length > 0 ? closings[0] : undefined; // already sorted desc
  },

  hasClosingForPeriod(type: NF525PeriodicClosingType, periodIdentifier: string): boolean {
    return this.getArchiveHistory().some(
      (c) => c.type === type && c.periodIdentifier === periodIdentifier
    );
  },

  // ── Generation ───────────────────────────────────────────

  async generateClosing(
    type: NF525PeriodicClosingType,
    periodIdentifier?: string
  ): Promise<NF525PeriodicClosing> {
    const period = periodIdentifier || defaultPeriodIdentifier(type);

    if (this.hasClosingForPeriod(type, period)) {
      throw new Error(`Une clôture ${type} existe déjà pour la période ${period}`);
    }

    const chain = nf525IntegrityService.getChain();
    const sorted = [...chain].sort((a, b) => a.sequentialNumber - b.sequentialNumber);
    const periodEntries = filterChainByPeriod(sorted, type, period);

    // Compute totals
    let totalTTC = 0;
    for (let i = 0; i < periodEntries.length; i++) {
      const entry = periodEntries[i];
      // Find this entry's index in the full sorted chain
      const fullIndex = sorted.findIndex(
        (e) => e.sequentialNumber === entry.sequentialNumber
      );
      if (fullIndex === 0) {
        totalTTC += entry.grandTotal;
      } else {
        totalTTC += entry.grandTotal - sorted[fullIndex - 1].grandTotal;
      }
    }
    totalTTC = Math.round(totalTTC * 100) / 100;

    const defaultRate = 20;
    const totalHT = Math.round(calculateExclTax(totalTTC, defaultRate) * 100) / 100;
    const totalVAT = Math.round(calculateVatAmount(totalTTC, defaultRate) * 100) / 100;

    // Compute digest from concatenated hashes of the period
    const concatenatedHashes = periodEntries.map((e) => e.hash).join("");
    const digest = concatenatedHashes.length > 0
      ? await sha256(concatenatedHashes)
      : await sha256(`${type}|${period}|empty`);

    // Chain to previous closing of same type
    const lastClosing = this.getLastClosingOfType(type);
    const previousClosingDigest = lastClosing?.digest || GENESIS_HASH;

    const perpetualGrandTotal = periodEntries.length > 0
      ? periodEntries[periodEntries.length - 1].grandTotal
      : nf525IntegrityService.getGrandTotal();

    const closing: NF525PeriodicClosing = {
      id: crypto.randomUUID(),
      type,
      periodIdentifier: period,
      createdAt: new Date().toISOString(),
      firstSequentialNumber: periodEntries.length > 0 ? periodEntries[0].sequentialNumber : 0,
      lastSequentialNumber: periodEntries.length > 0 ? periodEntries[periodEntries.length - 1].sequentialNumber : 0,
      orderCount: periodEntries.length,
      totalTTC,
      totalHT,
      totalVAT,
      perpetualGrandTotal,
      digest,
      previousClosingDigest,
    };

    // Persist
    const all = readJSON<NF525PeriodicClosing[]>(STORAGE_KEY, []);
    all.push(closing);
    persistClosings(all);

    // NF525 Phase 4 : journal periodic closing
    try {
      const { nf525EventJournalService } = await import("@/services/nf525-event-journal.service");
      const eventType = { daily: 'DAILY_CLOSING' as const, monthly: 'MONTHLY_CLOSING' as const, yearly: 'YEARLY_CLOSING' as const }[type];
      await nf525EventJournalService.logPeriodicClosing(eventType, {
        closingId: closing.id,
        periodIdentifier: period,
        orderCount: closing.orderCount,
        totalTTC: closing.totalTTC,
        digest: closing.digest,
      });
    } catch (e) { console.warn(`NF525: journal ${type}_CLOSING`, e); }

    return closing;
  },

  async generateDailyClosing(dateStr?: string): Promise<NF525PeriodicClosing> {
    return this.generateClosing("daily", dateStr);
  },

  async generateMonthlyClosing(monthStr?: string): Promise<NF525PeriodicClosing> {
    return this.generateClosing("monthly", monthStr);
  },

  async generateYearlyClosing(yearStr?: string): Promise<NF525PeriodicClosing> {
    return this.generateClosing("yearly", yearStr);
  },

  // ── Export ───────────────────────────────────────────────

  async exportArchiveJSON(): Promise<string> {
    const chain = nf525IntegrityService.getChain();
    const closings = this.getArchiveHistory();
    const sessions = readJSON<NF525SessionClosing[]>("nf525_closed_sessions", []);

    const storeRaw = localStorage.getItem("storeInfo");
    const storeInfo = storeRaw
      ? JSON.parse(storeRaw)
      : { name: "EasyPOS Store", siret: "", vatNumber: "", address: "" };

    const archive: NF525Archive = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      softwareName: "EasyPOS",
      softwareVersion: "1.0.0",
      storeInfo: {
        name: storeInfo.name || "EasyPOS Store",
        siret: storeInfo.siret || "",
        vatNumber: storeInfo.vatNumber || "",
        address: storeInfo.address || "",
      },
      chain,
      periodicClosings: closings,
      sessionClosings: sessions,
      grandTotal: nf525IntegrityService.getGrandTotal(),
      lastHash: nf525IntegrityService.getLastHash(),
      counter: nf525IntegrityService.getNextSequentialNumber(),
    };

    // Phase 4: include event journal
    try {
      const { nf525EventJournalService } = await import("@/services/nf525-event-journal.service");
      archive.eventJournal = nf525EventJournalService.getJournal();
      archive.eventJournalLastDigest = nf525EventJournalService.getLastDigest();
    } catch (e) { console.warn('NF525: journal inclusion in export', e); }

    return JSON.stringify(archive, null, 2);
  },

  exportArchiveCSV(): string {
    const chain = nf525IntegrityService.getChain();
    const sorted = [...chain].sort((a, b) => a.sequentialNumber - b.sequentialNumber);

    const BOM = "\uFEFF";
    const header = "N_Seq;N_Ticket;Date;Total_TTC;Total_HT;Total_TVA;Mode_Paiement;Hash;Hash_Precedent;Grand_Total";
    const defaultRate = 20;

    const rows = sorted.map((entry, i) => {
      const ttc = i === 0
        ? entry.grandTotal
        : Math.round((entry.grandTotal - sorted[i - 1].grandTotal) * 100) / 100;
      const ht = Math.round(calculateExclTax(ttc, defaultRate) * 100) / 100;
      const vat = Math.round(calculateVatAmount(ttc, defaultRate) * 100) / 100;

      return [
        entry.sequentialNumber,
        entry.orderNumber,
        entry.timestamp,
        ttc.toFixed(2).replace(".", ","),
        ht.toFixed(2).replace(".", ","),
        vat.toFixed(2).replace(".", ","),
        entry.paymentMethod || "CASH",
        entry.hash,
        entry.previousHash,
        entry.grandTotal.toFixed(2).replace(".", ","),
      ].join(";");
    });

    return BOM + [header, ...rows].join("\n");
  },

  async downloadJSON(): Promise<void> {
    const content = await this.exportArchiveJSON();
    const today = new Date().toISOString().split("T")[0];
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nf525-archive-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadCSV(): void {
    const content = this.exportArchiveCSV();
    const today = new Date().toISOString().split("T")[0];
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nf525-export-fiscal-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Verification ─────────────────────────────────────────

  async verifyArchiveIntegrity(): Promise<{
    valid: boolean;
    errors: string[];
    checkedClosings: number;
  }> {
    const closings = readJSON<NF525PeriodicClosing[]>(STORAGE_KEY, []);
    const chain = nf525IntegrityService.getChain();
    const sorted = [...chain].sort((a, b) => a.sequentialNumber - b.sequentialNumber);
    const errors: string[] = [];

    // Group closings by type and sort by creation date
    const byType: Record<NF525PeriodicClosingType, NF525PeriodicClosing[]> = {
      daily: [],
      monthly: [],
      yearly: [],
    };

    for (const c of closings) {
      byType[c.type].push(c);
    }

    for (const type of ["daily", "monthly", "yearly"] as NF525PeriodicClosingType[]) {
      const typedClosings = byType[type].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (let i = 0; i < typedClosings.length; i++) {
        const closing = typedClosings[i];

        // Verify digest: recompute from chain entries
        const periodEntries = filterChainByPeriod(sorted, closing.type, closing.periodIdentifier);
        const concatenatedHashes = periodEntries.map((e) => e.hash).join("");
        const expectedDigest = concatenatedHashes.length > 0
          ? await sha256(concatenatedHashes)
          : await sha256(`${closing.type}|${closing.periodIdentifier}|empty`);

        if (closing.digest !== expectedDigest) {
          errors.push(
            `Clôture ${type} ${closing.periodIdentifier}: digest incorrect (attendu ${expectedDigest.slice(0, 16)}..., trouvé ${closing.digest.slice(0, 16)}...)`
          );
        }

        // Verify chaining
        const expectedPrev = i === 0 ? GENESIS_HASH : typedClosings[i - 1].digest;
        if (closing.previousClosingDigest !== expectedPrev) {
          errors.push(
            `Clôture ${type} ${closing.periodIdentifier}: chaînage rompu (previousClosingDigest incorrect)`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      checkedClosings: closings.length,
    };
  },
};
