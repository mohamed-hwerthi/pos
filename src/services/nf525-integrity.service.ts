import {
  NF525OrderIntegrity,
  NF525OrderIntegrityDTO,
  NF525SessionClosing,
  NF525VerificationResult,
} from "@/models/nf525.model";
import { ClientOrder } from "@/models/client/client-order.model";
import {
  computeOrderHash,
  shortHash,
  verifyHashChain,
  sha256,
  serializePayload,
  GENESIS_HASH,
} from "@/utils/nf525-hash";

const STORAGE_KEYS = {
  chain: "nf525_chain",
  counter: "nf525_counter",
  grandTotal: "nf525_grandTotal",
  lastHash: "nf525_lastHash",
  closedSessions: "nf525_closed_sessions",
} as const;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const nf525IntegrityService = {
  getChain(): NF525OrderIntegrity[] {
    return readJSON<NF525OrderIntegrity[]>(STORAGE_KEYS.chain, []);
  },

  getNextSequentialNumber(): number {
    return readJSON<number>(STORAGE_KEYS.counter, 1);
  },

  getGrandTotal(): number {
    return readJSON<number>(STORAGE_KEYS.grandTotal, 0);
  },

  getLastHash(): string {
    return localStorage.getItem(STORAGE_KEYS.lastHash) || GENESIS_HASH;
  },

  getByOrderId(orderId: string): NF525OrderIntegrity | undefined {
    return this.getChain().find((e) => e.orderId === orderId);
  },

  getByOrderNumber(orderNumber: string): NF525OrderIntegrity | undefined {
    return this.getChain().find((e) => e.orderNumber === orderNumber);
  },

  async processOrder(order: ClientOrder): Promise<NF525OrderIntegrity> {
    const sequentialNumber = this.getNextSequentialNumber();
    const previousHash = this.getLastHash();
    const previousGrandTotal = this.getGrandTotal();
    const grandTotal = Math.round((previousGrandTotal + (order.total ?? 0)) * 100) / 100;

    const { hash, payload } = await computeOrderHash(order, sequentialNumber, grandTotal, previousHash);

    const integrity: NF525OrderIntegrity = {
      sequentialNumber,
      hash,
      previousHash,
      timestamp: order.createdAt || new Date().toISOString(),
      grandTotal,
      orderId: order.id || "",
      orderNumber: order.orderNumber || "",
      shortHash: shortHash(hash),
      hashPayload: serializePayload(payload),
      paymentMethod: order.paymentMethod || "CASH",
    };

    // Persist to localStorage
    const chain = this.getChain();
    chain.push(integrity);
    localStorage.setItem(STORAGE_KEYS.chain, JSON.stringify(chain));
    localStorage.setItem(STORAGE_KEYS.counter, JSON.stringify(sequentialNumber + 1));
    localStorage.setItem(STORAGE_KEYS.grandTotal, JSON.stringify(grandTotal));
    localStorage.setItem(STORAGE_KEYS.lastHash, hash);

    return integrity;
  },

  async verifyFullChain(orders: ClientOrder[]): Promise<NF525VerificationResult> {
    const chain = this.getChain();
    return verifyHashChain(chain, orders);
  },

  async generateSessionClosing(
    sessionId: string,
    sessionNumber: string,
    orderIds: string[]
  ): Promise<NF525SessionClosing> {
    const chain = this.getChain();
    const sessionEntries = chain.filter((e) => orderIds.includes(e.orderId));

    if (sessionEntries.length === 0) {
      return {
        sessionId,
        sessionNumber,
        closingTimestamp: new Date().toISOString(),
        firstSequentialNumber: 0,
        lastSequentialNumber: 0,
        orderCount: 0,
        perpetualGrandTotal: this.getGrandTotal(),
        lastHash: this.getLastHash(),
        sessionDigest: await sha256(`${sessionId}|empty`),
      };
    }

    const sorted = [...sessionEntries].sort(
      (a, b) => a.sequentialNumber - b.sequentialNumber
    );

    const concatenatedHashes = sorted.map((e) => e.hash).join("");
    const sessionDigest = await sha256(concatenatedHashes);

    return {
      sessionId,
      sessionNumber,
      closingTimestamp: new Date().toISOString(),
      firstSequentialNumber: sorted[0].sequentialNumber,
      lastSequentialNumber: sorted[sorted.length - 1].sequentialNumber,
      orderCount: sorted.length,
      perpetualGrandTotal: this.getGrandTotal(),
      lastHash: sorted[sorted.length - 1].hash,
      sessionDigest,
    };
  },

  toDTO(integrity: NF525OrderIntegrity): NF525OrderIntegrityDTO {
    return {
      orderId: integrity.orderId,
      orderNumber: integrity.orderNumber,
      sequentialNumber: integrity.sequentialNumber,
      hash: integrity.hash,
      previousHash: integrity.previousHash,
      grandTotal: integrity.grandTotal,
      timestamp: integrity.timestamp,
    };
  },

  exportChain(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        counter: this.getNextSequentialNumber(),
        grandTotal: this.getGrandTotal(),
        lastHash: this.getLastHash(),
        chain: this.getChain(),
      },
      null,
      2
    );
  },

  archiveSessionClosing(closing: NF525SessionClosing): void {
    const sessions = readJSON<NF525SessionClosing[]>(STORAGE_KEYS.closedSessions, []);
    sessions.push(closing);
    localStorage.setItem(STORAGE_KEYS.closedSessions, JSON.stringify(sessions));
  },
};
