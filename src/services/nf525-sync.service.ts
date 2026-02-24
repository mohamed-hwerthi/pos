import { apiClient } from "@/lib/api.config";
import {
  NF525OrderIntegrity,
  NF525PeriodicClosing,
  NF525SessionClosing,
  NF525AuditEvent,
  NF525SyncResult,
  NF525SyncState,
  NF525BackendChainStatus,
  NF525BackendVerificationResult,
  NF525BackendAttestationDTO,
} from "@/models/nf525.model";
import { nf525IntegrityService } from "@/services/nf525-integrity.service";
import { nf525ArchiveService } from "@/services/nf525-archive.service";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";

const SYNC_STATE_KEY = "nf525_sync_state";

function readSyncState(): NF525SyncState {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }
  return {
    lastSyncAt: null,
    lastSyncResult: null,
    isSyncing: false,
    chainSyncedUpTo: 0,
    eventsSyncedUpTo: 0,
    closingsSyncedIds: [],
    sessionsSyncedIds: [],
  };
}

function persistSyncState(state: NF525SyncState): void {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
}

// ── Mappers: Frontend → Backend DTO ─────────────────────

function mapChainEntryToDTO(entry: NF525OrderIntegrity) {
  return {
    orderId: entry.orderId,
    orderNumber: entry.orderNumber,
    sequentialNumber: entry.sequentialNumber,
    hash: entry.hash,
    previousHash: entry.previousHash,
    grandTotal: entry.grandTotal,
    timestamp: entry.timestamp,
    shortHash: entry.shortHash,
    hashPayload: entry.hashPayload || null,
  };
}

function mapClosingToDTO(closing: NF525PeriodicClosing) {
  return {
    id: closing.id,
    type: closing.type.toUpperCase(),
    periodIdentifier: closing.periodIdentifier,
    firstSequentialNumber: closing.firstSequentialNumber,
    lastSequentialNumber: closing.lastSequentialNumber,
    orderCount: closing.orderCount,
    totalTtc: closing.totalTTC,
    totalHt: closing.totalHT,
    totalVat: closing.totalVAT,
    perpetualGrandTotal: closing.perpetualGrandTotal,
    digest: closing.digest,
    previousClosingDigest: closing.previousClosingDigest,
    createdAt: closing.createdAt,
  };
}

function mapSessionClosingToDTO(session: NF525SessionClosing) {
  return {
    sessionId: session.sessionId,
    sessionNumber: session.sessionNumber,
    closingTimestamp: session.closingTimestamp,
    firstSequentialNumber: session.firstSequentialNumber,
    lastSequentialNumber: session.lastSequentialNumber,
    orderCount: session.orderCount,
    perpetualGrandTotal: session.perpetualGrandTotal,
    lastHash: session.lastHash,
    sessionDigest: session.sessionDigest,
  };
}

function mapAuditEventToDTO(event: NF525AuditEvent) {
  return {
    id: event.id,
    eventType: event.eventType,
    sequentialNumber: event.sequentialNumber,
    timestamp: event.timestamp,
    cashierId: event.actor.cashierId,
    cashierName: event.actor.cashierName,
    details: JSON.stringify(event.details),
    digest: event.digest,
    previousEventDigest: event.previousEventDigest,
    technicalIntervention: event.technicalIntervention,
  };
}

// ── Service ─────────────────────────────────────────────

export const nf525SyncService = {
  // ── State ─────────────────────────────────────────────

  getSyncState(): NF525SyncState {
    return readSyncState();
  },

  // ── Full sync ─────────────────────────────────────────

  async syncAll(): Promise<NF525SyncResult> {
    const state = readSyncState();
    state.isSyncing = true;
    persistSyncState(state);

    const result: NF525SyncResult = {
      success: true,
      syncedChain: 0,
      syncedClosings: 0,
      syncedSessions: 0,
      syncedEvents: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Sync chain
      const chainResult = await this.syncChain();
      result.syncedChain = chainResult.count;
      if (chainResult.error) result.errors.push(chainResult.error);

      // 2. Sync periodic closings
      const closingsResult = await this.syncClosings();
      result.syncedClosings = closingsResult.count;
      if (closingsResult.error) result.errors.push(closingsResult.error);

      // 3. Sync session closings
      const sessionsResult = await this.syncSessionClosings();
      result.syncedSessions = sessionsResult.count;
      if (sessionsResult.error) result.errors.push(sessionsResult.error);

      // 4. Sync events
      const eventsResult = await this.syncEvents();
      result.syncedEvents = eventsResult.count;
      if (eventsResult.error) result.errors.push(eventsResult.error);
    } catch (e: any) {
      result.errors.push(`Erreur générale: ${e.message || e}`);
    }

    result.success = result.errors.length === 0;

    // Persist state
    const updatedState = readSyncState();
    updatedState.isSyncing = false;
    updatedState.lastSyncAt = result.timestamp;
    updatedState.lastSyncResult = result;
    persistSyncState(updatedState);

    return result;
  },

  // ── Chain sync ────────────────────────────────────────

  async syncChain(): Promise<{ count: number; error?: string }> {
    try {
      const state = readSyncState();
      const chain = nf525IntegrityService.getChain();
      const unsyncedEntries = chain.filter(
        (e) => e.sequentialNumber > state.chainSyncedUpTo
      );

      if (unsyncedEntries.length === 0) return { count: 0 };

      const payload = {
        entries: unsyncedEntries.map(mapChainEntryToDTO),
      };

      const { data } = await apiClient.post("/nf525/chain/sync", payload);

      // Update sync state
      const newState = readSyncState();
      const maxSeq = Math.max(...unsyncedEntries.map((e) => e.sequentialNumber));
      newState.chainSyncedUpTo = maxSeq;
      persistSyncState(newState);

      return { count: data.length || unsyncedEntries.length };
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Erreur sync chaîne";
      return { count: 0, error: `Chaîne: ${msg}` };
    }
  },

  // ── Closings sync ─────────────────────────────────────

  async syncClosings(): Promise<{ count: number; error?: string }> {
    try {
      const state = readSyncState();
      const closings = nf525ArchiveService.getArchiveHistory();
      const unsynced = closings.filter(
        (c) => !state.closingsSyncedIds.includes(c.id)
      );

      if (unsynced.length === 0) return { count: 0 };

      let syncedCount = 0;
      const syncedIds: string[] = [];

      for (const closing of unsynced) {
        try {
          await apiClient.post("/nf525/closings", mapClosingToDTO(closing));
          syncedIds.push(closing.id);
          syncedCount++;
        } catch (e: any) {
          // 409 Conflict = already exists on server, consider it synced
          if (e.response?.status === 409) {
            syncedIds.push(closing.id);
            continue;
          }
          throw e;
        }
      }

      // Update sync state
      const newState = readSyncState();
      newState.closingsSyncedIds = [
        ...new Set([...newState.closingsSyncedIds, ...syncedIds]),
      ];
      persistSyncState(newState);

      return { count: syncedCount };
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Erreur sync clôtures";
      return { count: 0, error: `Clôtures: ${msg}` };
    }
  },

  // ── Session closings sync ─────────────────────────────

  async syncSessionClosings(): Promise<{ count: number; error?: string }> {
    try {
      const state = readSyncState();
      const raw = localStorage.getItem("nf525_closed_sessions");
      const sessions: NF525SessionClosing[] = raw ? JSON.parse(raw) : [];
      const unsynced = sessions.filter(
        (s) => !state.sessionsSyncedIds.includes(s.sessionId)
      );

      if (unsynced.length === 0) return { count: 0 };

      let syncedCount = 0;
      const syncedIds: string[] = [];

      for (const session of unsynced) {
        try {
          await apiClient.post(
            "/nf525/session-closings",
            mapSessionClosingToDTO(session)
          );
          syncedIds.push(session.sessionId);
          syncedCount++;
        } catch (e: any) {
          if (e.response?.status === 409) {
            syncedIds.push(session.sessionId);
            continue;
          }
          throw e;
        }
      }

      // Update sync state
      const newState = readSyncState();
      newState.sessionsSyncedIds = [
        ...new Set([...newState.sessionsSyncedIds, ...syncedIds]),
      ];
      persistSyncState(newState);

      return { count: syncedCount };
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Erreur sync sessions";
      return { count: 0, error: `Sessions: ${msg}` };
    }
  },

  // ── Events sync ───────────────────────────────────────

  async syncEvents(): Promise<{ count: number; error?: string }> {
    try {
      const state = readSyncState();
      const journal = nf525EventJournalService.getJournal();
      const unsyncedEvents = journal.filter(
        (e) => e.sequentialNumber > state.eventsSyncedUpTo
      );

      if (unsyncedEvents.length === 0) return { count: 0 };

      // Send in batches of 100
      const BATCH_SIZE = 100;
      let totalSynced = 0;
      let maxSeq = state.eventsSyncedUpTo;

      for (let i = 0; i < unsyncedEvents.length; i += BATCH_SIZE) {
        const batch = unsyncedEvents.slice(i, i + BATCH_SIZE);
        const payload = {
          events: batch.map(mapAuditEventToDTO),
        };

        const { data } = await apiClient.post("/nf525/events/sync", payload);
        totalSynced += data.length || batch.length;
        maxSeq = Math.max(maxSeq, ...batch.map((e) => e.sequentialNumber));
      }

      // Update sync state
      const newState = readSyncState();
      newState.eventsSyncedUpTo = maxSeq;
      persistSyncState(newState);

      return { count: totalSynced };
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Erreur sync événements";
      return { count: 0, error: `Événements: ${msg}` };
    }
  },

  // ── Backend queries ───────────────────────────────────

  async getChainStatus(): Promise<NF525BackendChainStatus> {
    const { data } = await apiClient.get("/nf525/chain/status");
    return data;
  },

  async verifyChainOnServer(): Promise<NF525BackendVerificationResult> {
    const { data } = await apiClient.post("/nf525/chain/verify");
    return data;
  },

  async verifyClosingsOnServer(): Promise<NF525BackendVerificationResult> {
    const { data } = await apiClient.post("/nf525/closings/verify");
    return data;
  },

  async verifyJournalOnServer(): Promise<NF525BackendVerificationResult> {
    const { data } = await apiClient.post("/nf525/events/verify");
    return data;
  },

  async generateServerAttestation(): Promise<NF525BackendAttestationDTO> {
    const { data } = await apiClient.post("/nf525/attestation/generate");
    return data;
  },

  async getLatestServerAttestation(): Promise<NF525BackendAttestationDTO | null> {
    try {
      const { data } = await apiClient.get("/nf525/attestation/latest");
      return data;
    } catch (e: any) {
      if (e.response?.status === 204) return null;
      throw e;
    }
  },

  async downloadServerAttestation(attestationId: string): Promise<string> {
    const { data } = await apiClient.get(
      `/nf525/attestation/${attestationId}/download`
    );
    return data;
  },

  async exportServerJson(): Promise<string> {
    const { data } = await apiClient.get("/nf525/export/json");
    return data;
  },

  async exportServerCsv(): Promise<string> {
    const { data } = await apiClient.get("/nf525/export/csv");
    return data;
  },

  // ── Pending counts ────────────────────────────────────

  getPendingCounts(): {
    chain: number;
    closings: number;
    sessions: number;
    events: number;
    total: number;
  } {
    const state = readSyncState();

    const chain = nf525IntegrityService.getChain();
    const pendingChain = chain.filter(
      (e) => e.sequentialNumber > state.chainSyncedUpTo
    ).length;

    const closings = nf525ArchiveService.getArchiveHistory();
    const pendingClosings = closings.filter(
      (c) => !state.closingsSyncedIds.includes(c.id)
    ).length;

    const raw = localStorage.getItem("nf525_closed_sessions");
    const sessions: NF525SessionClosing[] = raw ? JSON.parse(raw) : [];
    const pendingSessions = sessions.filter(
      (s) => !state.sessionsSyncedIds.includes(s.sessionId)
    ).length;

    const journal = nf525EventJournalService.getJournal();
    const pendingEvents = journal.filter(
      (e) => e.sequentialNumber > state.eventsSyncedUpTo
    ).length;

    return {
      chain: pendingChain,
      closings: pendingClosings,
      sessions: pendingSessions,
      events: pendingEvents,
      total: pendingChain + pendingClosings + pendingSessions + pendingEvents,
    };
  },
};
