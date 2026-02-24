import { ClientOrder } from "@/models/client/client-order.model";
import { ClientStore } from "@/models/client/client-store-model";
import {
  calculateExclTax,
  calculateVatAmount,
  calculateVatBreakdown,
  formatVatRate,
} from "./vat-helpers";

interface SessionInfo {
  cashier?: string;
}

export interface NF525IntegrityInfo {
  sequentialNumber: number;
  shortHash: string;
  grandTotal: number;
}

/**
 * Build an NF525-compliant receipt string for thermal printer output.
 */
export function buildNF525Receipt(
  order: ClientOrder,
  storeData: Partial<ClientStore>,
  sessionInfo?: SessionInfo,
  integrityInfo?: NF525IntegrityInfo
): string {
  const storeName = storeData.legalName || storeData.name || "Commerce";
  const storeAddress = storeData.address || "";
  const storePostal = storeData.postalCode || "";
  const storeCity = storeData.city || "";
  const siret = storeData.siret || "Non renseigné";
  const vatNumber = storeData.vatNumber || "Non renseigné";
  const currency = storeData.currencySymbol || "€";

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString("fr-FR")
    : new Date().toLocaleString("fr-FR");

  const cashierName = sessionInfo?.cashier || "N/A";

  // --- Header ---
  const lines: string[] = [];
  lines.push("================================");
  lines.push(center(storeName));
  if (storeAddress) lines.push(center(storeAddress));
  if (storePostal || storeCity) lines.push(center(`${storePostal} ${storeCity}`.trim()));
  lines.push(center(`SIRET: ${siret}`));
  lines.push(center(`TVA Intracom: ${vatNumber}`));
  lines.push("================================");
  lines.push("");

  // --- Ticket info ---
  lines.push(`Ticket N°: ${order.orderNumber || "---"}`);
  lines.push(`Date: ${orderDate}`);
  lines.push(`Caissier: ${cashierName}`);
  lines.push("");

  // --- Articles ---
  lines.push("--------------------------------");
  lines.push("ARTICLES");
  lines.push("--------------------------------");

  for (const item of order.orderItems) {
    const qty = item.quantity;
    const unitPriceTTC = item.unitPrice ?? 0;
    const lineTotalTTC = item.totalPrice;
    const vatRate = item.vatRate ?? 20;
    const unitHT = calculateExclTax(unitPriceTTC, vatRate);

    lines.push(`${item.productName || "Article"}`);
    lines.push(
      `  ${qty} x ${unitHT.toFixed(2)} ${currency} HT (TVA ${formatVatRate(vatRate)})  ${lineTotalTTC.toFixed(2)} ${currency}`
    );
  }

  lines.push("");

  // --- VAT Breakdown ---
  const vatItems = order.orderItems.map((item) => ({
    totalPrice: item.totalPrice,
    vatRate: item.vatRate ?? 20,
  }));
  const breakdown = calculateVatBreakdown(vatItems);

  lines.push("--------------------------------");
  lines.push("VENTILATION TVA");
  lines.push("--------------------------------");
  lines.push(padBoth("Taux", "Base HT", "TVA", "TTC"));

  for (const line of breakdown) {
    lines.push(
      padBoth(
        formatVatRate(line.vatRate),
        `${line.baseAmount.toFixed(2)}`,
        `${line.vatAmount.toFixed(2)}`,
        `${line.totalAmount.toFixed(2)}`
      )
    );
  }

  lines.push("");

  // --- Totals ---
  const totalTTC = order.total ?? 0;
  const totalExclTax = breakdown.reduce((s, l) => s + l.baseAmount, 0);
  const totalVat = breakdown.reduce((s, l) => s + l.vatAmount, 0);

  lines.push("--------------------------------");
  lines.push(padLine("Total HT:", `${totalExclTax.toFixed(2)} ${currency}`));
  lines.push(padLine("Total TVA:", `${totalVat.toFixed(2)} ${currency}`));
  lines.push(padLine("TOTAL TTC:", `${totalTTC.toFixed(2)} ${currency}`));
  lines.push("--------------------------------");

  // --- Payment ---
  const paymentLabel = getPaymentLabel(order.paymentMethod);
  lines.push(`Paiement: ${paymentLabel}`);

  if (
    (!order.paymentMethod || order.paymentMethod === "CASH") &&
    order.cashReceived != null
  ) {
    lines.push(padLine("Reçu:", `${order.cashReceived.toFixed(2)} ${currency}`));
    const changeGiven = order.changeGiven ?? order.cashReceived - totalTTC;
    lines.push(padLine("Monnaie:", `${changeGiven.toFixed(2)} ${currency}`));
  }

  // --- NF525 Integrity ---
  if (integrityInfo) {
    lines.push("");
    lines.push("--------------------------------");
    lines.push(center("DONNÉES DE CONTRÔLE NF525"));
    lines.push(`N° séq.: ${integrityInfo.sequentialNumber}`);
    lines.push(`Empreinte: ${integrityInfo.shortHash}`);
    lines.push(`GT: ${integrityInfo.grandTotal.toFixed(2)} ${currency}`);
    lines.push("--------------------------------");
  }

  lines.push("");
  lines.push(center("Merci de votre visite !"));
  lines.push("================================");

  return lines.join("\n");
}

// --- Helpers ---

function center(text: string, width = 32): string {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text;
}

function padLine(label: string, value: string, width = 32): string {
  const gap = width - label.length - value.length;
  return label + " ".repeat(Math.max(1, gap)) + value;
}

function padBoth(
  col1: string,
  col2: string,
  col3: string,
  col4: string,
  width = 32
): string {
  // Simple 4-column layout for thermal receipt
  const c1 = col1.padEnd(8);
  const c2 = col2.padStart(8);
  const c3 = col3.padStart(7);
  const c4 = col4.padStart(7);
  return `${c1}${c2}${c3}${c4}`.slice(0, width);
}

function getPaymentLabel(method?: string): string {
  switch (method) {
    case "CASH":
      return "Espèces";
    case "CARD":
      return "Carte bancaire";
    case "CHECK":
      return "Chèque";
    case "TRANSFER":
      return "Virement";
    default:
      return "Espèces";
  }
}
