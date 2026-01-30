export interface ClientProductVariantOption {
  variantId: string;
  variantValue: string;
  variantPrice: number;
  inStock: boolean;
  quantity: number;
  sku?: string;
  barcode?: string;
}
