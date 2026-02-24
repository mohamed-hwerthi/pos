import { NF525HashPayload, NF525VerificationResult, NF525OrderIntegrity } from "@/models/nf525.model";
import { ClientOrder } from "@/models/client/client-order.model";
import { calculateExclTax, calculateVatAmount } from "./vat-helpers";

export const GENESIS_HASH = "0".repeat(64);

export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortHash(fullHash: string): string {
  return fullHash.slice(0, 8).toUpperCase();
}

export async function computeItemsDigest(order: ClientOrder): Promise<string> {
  const sortedItems = [...order.orderItems]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((item) => `${item.productId}:${item.quantity}:${item.totalPrice.toFixed(2)}`)
    .join(";");
  return sha256(sortedItems);
}

export async function buildHashPayload(
  order: ClientOrder,
  sequentialNumber: number,
  grandTotal: number,
  previousHash: string
): Promise<NF525HashPayload> {
  const totalTTC = order.total ?? 0;

  const vatItems = order.orderItems.map((item) => ({
    totalPrice: item.totalPrice,
    vatRate: item.vatRate ?? 20,
  }));

  let totalHT = 0;
  let totalVAT = 0;
  for (const item of vatItems) {
    totalHT += calculateExclTax(item.totalPrice, item.vatRate);
    totalVAT += calculateVatAmount(item.totalPrice, item.vatRate);
  }

  const itemsDigest = await computeItemsDigest(order);

  return {
    sequentialNumber,
    orderNumber: order.orderNumber || "",
    timestamp: order.createdAt || new Date().toISOString(),
    totalTTC: totalTTC.toFixed(2),
    totalHT: totalHT.toFixed(2),
    totalVAT: totalVAT.toFixed(2),
    paymentMethod: order.paymentMethod || "CASH",
    itemsDigest,
    grandTotal: grandTotal.toFixed(2),
    previousHash,
  };
}

export function serializePayload(payload: NF525HashPayload): string {
  return [
    payload.sequentialNumber,
    payload.orderNumber,
    payload.timestamp,
    payload.totalTTC,
    payload.totalHT,
    payload.totalVAT,
    payload.paymentMethod,
    payload.itemsDigest,
    payload.grandTotal,
    payload.previousHash,
  ].join("|");
}

export async function computeOrderHash(
  order: ClientOrder,
  sequentialNumber: number,
  grandTotal: number,
  previousHash: string
): Promise<{ hash: string; payload: NF525HashPayload }> {
  const payload = await buildHashPayload(order, sequentialNumber, grandTotal, previousHash);
  const serialized = serializePayload(payload);
  const hash = await sha256(serialized);
  return { hash, payload };
}

export async function verifyHashChain(
  chain: NF525OrderIntegrity[],
  orders: ClientOrder[]
): Promise<NF525VerificationResult> {
  const errors: NF525VerificationResult["errors"] = [];
  const sorted = [...chain].sort((a, b) => a.sequentialNumber - b.sequentialNumber);

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Check sequence continuity
    if (i > 0 && entry.sequentialNumber !== sorted[i - 1].sequentialNumber + 1) {
      errors.push({
        sequentialNumber: entry.sequentialNumber,
        orderNumber: entry.orderNumber,
        expectedHash: "",
        actualHash: "",
        errorType: "SEQUENCE_GAP",
        message: `Rupture de séquence: attendu ${sorted[i - 1].sequentialNumber + 1}, trouvé ${entry.sequentialNumber}`,
      });
    }

    // Check previous hash link
    const expectedPrevHash = i === 0 ? GENESIS_HASH : sorted[i - 1].hash;
    if (entry.previousHash !== expectedPrevHash) {
      errors.push({
        sequentialNumber: entry.sequentialNumber,
        orderNumber: entry.orderNumber,
        expectedHash: expectedPrevHash,
        actualHash: entry.previousHash,
        errorType: "MISSING_PREVIOUS",
        message: `Hash précédent incorrect pour le ticket ${entry.orderNumber}`,
      });
    }

    // Recompute hash if we have the matching order
    const order = orders.find(
      (o) => o.id === entry.orderId || o.orderNumber === entry.orderNumber
    );
    if (order) {
      const { hash: recomputed } = await computeOrderHash(
        order,
        entry.sequentialNumber,
        entry.grandTotal,
        entry.previousHash
      );
      if (recomputed !== entry.hash) {
        errors.push({
          sequentialNumber: entry.sequentialNumber,
          orderNumber: entry.orderNumber,
          expectedHash: recomputed,
          actualHash: entry.hash,
          errorType: "HASH_MISMATCH",
          message: `Hash incohérent pour le ticket ${entry.orderNumber}`,
        });
      }
    }

    // Check grand total monotonicity
    if (i > 0 && entry.grandTotal < sorted[i - 1].grandTotal) {
      errors.push({
        sequentialNumber: entry.sequentialNumber,
        orderNumber: entry.orderNumber,
        expectedHash: "",
        actualHash: "",
        errorType: "GRAND_TOTAL_MISMATCH",
        message: `Grand total non monotone: ${entry.grandTotal} < ${sorted[i - 1].grandTotal}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    checkedCount: sorted.length,
    errors,
  };
}
