export interface NF525OrderIntegrity {
  sequentialNumber: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  grandTotal: number;
  orderId: string;
  orderNumber: string;
  shortHash: string;
  hashPayload?: string; // Phase 9: serialized payload for server-side hash recomputation
  paymentMethod?: string; // Phase 9: stored for accurate CSV export
}

export interface NF525HashPayload {
  sequentialNumber: number;
  orderNumber: string;
  timestamp: string;
  totalTTC: string;
  totalHT: string;
  totalVAT: string;
  paymentMethod: string;
  itemsDigest: string;
  grandTotal: string;
  previousHash: string;
}

export interface NF525SessionClosing {
  sessionId: string;
  sessionNumber: string;
  closingTimestamp: string;
  firstSequentialNumber: number;
  lastSequentialNumber: number;
  orderCount: number;
  perpetualGrandTotal: number;
  lastHash: string;
  sessionDigest: string;
}

export interface NF525VerificationResult {
  valid: boolean;
  checkedCount: number;
  errors: NF525VerificationError[];
}

export interface NF525VerificationError {
  sequentialNumber: number;
  orderNumber: string;
  expectedHash: string;
  actualHash: string;
  errorType: 'HASH_MISMATCH' | 'SEQUENCE_GAP' | 'GRAND_TOTAL_MISMATCH' | 'MISSING_PREVIOUS';
  message: string;
}

export interface NF525OrderIntegrityDTO {
  orderId: string;
  orderNumber: string;
  sequentialNumber: number;
  hash: string;
  previousHash: string;
  grandTotal: number;
  timestamp: string;
}

export interface NF525VerifyRequestDTO {
  sessionId: string;
  chain: NF525OrderIntegrity[];
}

export interface NF525VerifyResponseDTO {
  valid: boolean;
  serverHash: string;
  errors: string[];
}

export type NF525PeriodicClosingType = 'daily' | 'monthly' | 'yearly';

export interface NF525PeriodicClosing {
  id: string;
  type: NF525PeriodicClosingType;
  periodIdentifier: string;            // "2026-02-23" | "2026-02" | "2026"
  createdAt: string;                   // ISO-8601
  firstSequentialNumber: number;
  lastSequentialNumber: number;
  orderCount: number;
  totalTTC: number;
  totalHT: number;
  totalVAT: number;
  perpetualGrandTotal: number;
  digest: string;                      // SHA-256 of concatenated hashes for the period
  previousClosingDigest: string;       // Digest of the previous closing of the same type (chaining)
}

export interface NF525Archive {
  version: string;
  exportedAt: string;
  softwareName: string;
  softwareVersion: string;
  storeInfo: {
    name: string;
    siret: string;
    vatNumber: string;
    address: string;
  };
  chain: NF525OrderIntegrity[];
  periodicClosings: NF525PeriodicClosing[];
  sessionClosings: NF525SessionClosing[];
  grandTotal: number;
  lastHash: string;
  counter: number;
  eventJournal?: NF525AuditEvent[];
  eventJournalLastDigest?: string;
}

// ── Phase 4: Journal d'événements ──────────────────

export type NF525EventType =
  | 'ORDER_CREATED'
  | 'SESSION_OPENED'
  | 'SESSION_CLOSED'
  | 'DAILY_CLOSING'
  | 'MONTHLY_CLOSING'
  | 'YEARLY_CLOSING'
  | 'CHAIN_VERIFIED'
  | 'ARCHIVE_EXPORTED'
  | 'TECHNICAL_INTERVENTION_START'
  | 'TECHNICAL_INTERVENTION_END';

export interface NF525EventActor {
  cashierId: string;
  cashierName: string;
}

export interface NF525AuditEvent {
  id: string;
  eventType: NF525EventType;
  timestamp: string;
  actor: NF525EventActor;
  details: Record<string, unknown>;
  digest: string;
  previousEventDigest: string;
  sequentialNumber: number;
  technicalIntervention: boolean;
}

export interface NF525Attestation {
  generatedAt: string;
  softwareName: string;
  softwareVersion: string;
  storeInfo: { name: string; siret: string; vatNumber: string; address: string };
  complianceFeatures: string[];
  integrityStatus: {
    chainValid: boolean;
    journalValid: boolean;
    orderCount: number;
    closingsCount: number;
    eventCount: number;
    grandTotal: number;
    lastOrderHash: string;
    lastEventDigest: string;
  };
  attestationDigest: string;
}

// ── Phase 6: Sync with backend ──────────────────────

export interface NF525SyncResult {
  success: boolean;
  syncedChain: number;
  syncedClosings: number;
  syncedSessions: number;
  syncedEvents: number;
  errors: string[];
  timestamp: string;
}

export interface NF525SyncState {
  lastSyncAt: string | null;
  lastSyncResult: NF525SyncResult | null;
  isSyncing: boolean;
  chainSyncedUpTo: number;     // last sequentialNumber synced for chain
  eventsSyncedUpTo: number;    // last sequentialNumber synced for events
  closingsSyncedIds: string[]; // IDs of closings already synced
  sessionsSyncedIds: string[]; // IDs of session closings already synced
}

export interface NF525BackendChainStatus {
  counter: number;
  grandTotal: number;
  lastHash: string;
  eventCount: number;
  lastEventDigest: string;
}

export interface NF525BackendVerificationResult {
  valid: boolean;
  checkedCount: number;
  errors: string[];
}

export interface NF525BackendAttestationDTO {
  id: string;
  generatedAt: string;
  chainValid: boolean;
  journalValid: boolean;
  orderCount: number;
  closingsCount: number;
  eventCount: number;
  grandTotal: number;
  lastOrderHash: string;
  lastEventDigest: string;
  attestationDigest: string;
  content: string;
}
