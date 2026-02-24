import {
  NF525AuditEvent,
  NF525EventType,
  NF525EventActor,
} from "@/models/nf525.model";
import { sha256, GENESIS_HASH } from "@/utils/nf525-hash";

const STORAGE_KEYS = {
  journal: "nf525_event_journal",
  counter: "nf525_event_counter",
  lastDigest: "nf525_event_lastDigest",
  interventionMode: "nf525_intervention_mode",
} as const;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function stableStringify(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

export const nf525EventJournalService = {
  // ── Reading ──────────────────────────────────────────────

  getJournal(): NF525AuditEvent[] {
    return readJSON<NF525AuditEvent[]>(STORAGE_KEYS.journal, []);
  },

  getEventCount(): number {
    return readJSON<number>(STORAGE_KEYS.counter, 0);
  },

  getNextSequentialNumber(): number {
    return this.getEventCount() + 1;
  },

  getLastDigest(): string {
    return localStorage.getItem(STORAGE_KEYS.lastDigest) || GENESIS_HASH;
  },

  isInterventionMode(): boolean {
    return readJSON<boolean>(STORAGE_KEYS.interventionMode, false);
  },

  getCurrentActor(): NF525EventActor {
    try {
      const raw = localStorage.getItem("cashier");
      if (raw) {
        const cashier = JSON.parse(raw);
        return {
          cashierId: cashier.id || "",
          cashierName: cashier.name || cashier.email || "",
        };
      }
    } catch {
      // fall through
    }
    return { cashierId: "", cashierName: "Système" };
  },

  // ── Core ─────────────────────────────────────────────────

  async logEvent(
    eventType: NF525EventType,
    details: Record<string, unknown>,
    actor?: NF525EventActor
  ): Promise<NF525AuditEvent> {
    const resolvedActor = actor || this.getCurrentActor();
    const seqNum = this.getNextSequentialNumber();
    const previousDigest = this.getLastDigest();
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();

    const serialized = [
      id,
      eventType,
      timestamp,
      seqNum.toString(),
      resolvedActor.cashierId,
      resolvedActor.cashierName,
      stableStringify(details),
      previousDigest,
    ].join("|");

    const digest = await sha256(serialized);

    const event: NF525AuditEvent = {
      id,
      eventType,
      timestamp,
      actor: resolvedActor,
      details,
      digest,
      previousEventDigest: previousDigest,
      sequentialNumber: seqNum,
      technicalIntervention: this.isInterventionMode(),
    };

    // Persist
    const journal = this.getJournal();
    journal.push(event);
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(journal));
    localStorage.setItem(STORAGE_KEYS.counter, JSON.stringify(seqNum));
    localStorage.setItem(STORAGE_KEYS.lastDigest, digest);

    return event;
  },

  // ── Typed wrappers ───────────────────────────────────────

  async logOrderCreated(details: {
    orderId: string;
    orderNumber: string;
    total: number;
    paymentMethod: string;
    nf525Hash: string;
    sequentialNumber: number;
  }): Promise<NF525AuditEvent> {
    return this.logEvent("ORDER_CREATED", details as unknown as Record<string, unknown>);
  },

  async logSessionOpened(details: {
    sessionId: string;
    sessionNumber: string;
    initialAmount: number;
  }): Promise<NF525AuditEvent> {
    return this.logEvent("SESSION_OPENED", details as unknown as Record<string, unknown>);
  },

  async logSessionClosed(details: {
    sessionId: string;
    sessionNumber: string;
    totalSales: number;
    actualCash: number;
    cashDifference: number;
    sessionDigest?: string;
  }): Promise<NF525AuditEvent> {
    return this.logEvent("SESSION_CLOSED", details as unknown as Record<string, unknown>);
  },

  async logPeriodicClosing(
    eventType: NF525EventType,
    details: {
      closingId: string;
      periodIdentifier: string;
      orderCount: number;
      totalTTC: number;
      digest: string;
    }
  ): Promise<NF525AuditEvent> {
    return this.logEvent(eventType, details as unknown as Record<string, unknown>);
  },

  async logChainVerified(details: {
    valid: boolean;
    checkedCount: number;
    errorCount: number;
  }): Promise<NF525AuditEvent> {
    return this.logEvent("CHAIN_VERIFIED", details as unknown as Record<string, unknown>);
  },

  async logArchiveExported(details: {
    format: string;
    fileName: string;
    recordCount: number;
  }): Promise<NF525AuditEvent> {
    return this.logEvent("ARCHIVE_EXPORTED", details as unknown as Record<string, unknown>);
  },

  async logTechnicalInterventionStart(reason: string): Promise<NF525AuditEvent> {
    localStorage.setItem(STORAGE_KEYS.interventionMode, JSON.stringify(true));
    return this.logEvent("TECHNICAL_INTERVENTION_START", { reason });
  },

  async logTechnicalInterventionEnd(): Promise<NF525AuditEvent> {
    const event = await this.logEvent("TECHNICAL_INTERVENTION_END", {});
    localStorage.setItem(STORAGE_KEYS.interventionMode, JSON.stringify(false));
    return event;
  },

  // ── Verification ─────────────────────────────────────────

  async verifyJournal(): Promise<{
    valid: boolean;
    checkedCount: number;
    errors: string[];
  }> {
    const journal = this.getJournal();
    const errors: string[] = [];

    for (let i = 0; i < journal.length; i++) {
      const event = journal[i];

      // Check sequential number
      if (event.sequentialNumber !== i + 1) {
        errors.push(
          `Événement #${i + 1}: numéro séquentiel incorrect (attendu ${i + 1}, trouvé ${event.sequentialNumber})`
        );
      }

      // Check chaining
      const expectedPrev = i === 0 ? GENESIS_HASH : journal[i - 1].digest;
      if (event.previousEventDigest !== expectedPrev) {
        errors.push(
          `Événement #${event.sequentialNumber}: chaînage rompu (previousEventDigest incorrect)`
        );
      }

      // Recompute digest
      const serialized = [
        event.id,
        event.eventType,
        event.timestamp,
        event.sequentialNumber.toString(),
        event.actor.cashierId,
        event.actor.cashierName,
        stableStringify(event.details),
        event.previousEventDigest,
      ].join("|");

      const expectedDigest = await sha256(serialized);
      if (event.digest !== expectedDigest) {
        errors.push(
          `Événement #${event.sequentialNumber} (${event.eventType}): digest incorrect`
        );
      }
    }

    return {
      valid: errors.length === 0,
      checkedCount: journal.length,
      errors,
    };
  },

  // ── Export ───────────────────────────────────────────────

  exportJournalJSON(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        eventCount: this.getEventCount(),
        lastDigest: this.getLastDigest(),
        journal: this.getJournal(),
      },
      null,
      2
    );
  },
};
