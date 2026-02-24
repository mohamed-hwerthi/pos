import { VatBreakdownLine } from "@/models/client/client-order.model";

/**
 * Calculate the price excluding tax from a TTC (tax-included) price.
 * Formula: HT = TTC / (1 + vatRate/100)
 */
export function calculateExclTax(priceTTC: number, vatRate: number): number {
  return priceTTC / (1 + vatRate / 100);
}

/**
 * Calculate the VAT amount from a TTC price.
 * Formula: VAT = TTC - HT
 */
export function calculateVatAmount(priceTTC: number, vatRate: number): number {
  return priceTTC - calculateExclTax(priceTTC, vatRate);
}

/**
 * Build a VAT breakdown table from an array of items (with totalPrice and vatRate).
 * Groups items by vatRate and sums base (HT), VAT, and total (TTC) amounts.
 */
export function calculateVatBreakdown(
  items: { totalPrice: number; vatRate: number }[]
): VatBreakdownLine[] {
  const map = new Map<number, { base: number; vat: number; total: number }>();

  for (const item of items) {
    const rate = item.vatRate;
    const base = calculateExclTax(item.totalPrice, rate);
    const vat = item.totalPrice - base;

    const existing = map.get(rate);
    if (existing) {
      existing.base += base;
      existing.vat += vat;
      existing.total += item.totalPrice;
    } else {
      map.set(rate, { base, vat, total: item.totalPrice });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([vatRate, { base, vat, total }]) => ({
      vatRate,
      baseAmount: Math.round(base * 100) / 100,
      vatAmount: Math.round(vat * 100) / 100,
      totalAmount: Math.round(total * 100) / 100,
    }));
}

/**
 * Format a VAT rate for display (French locale).
 * Example: 20 → "20,0%"
 */
export function formatVatRate(rate: number): string {
  return `${rate.toFixed(1).replace(".", ",")}%`;
}
