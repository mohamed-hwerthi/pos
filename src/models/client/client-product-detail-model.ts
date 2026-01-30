import { ClientProductOptionGroup } from "./ClientProductOptionGroup";
import { ClientProductVariants } from "./ClientProductVariants";

export interface ClientProduct {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  quantity: number;
  discountedPrice?: number;
  isPromoted?: string;
  reviewCount?: number;
  averageRating?: number;
  inStock: boolean;
  mediasUrls?: string[];
  categoryName?: string;
  variants?: ClientProductVariants[];
  optionGroups?: ClientProductOptionGroup[];
  // Populated when product is found via barcode scan (for variants)
  scannedVariantId?: string;
  scannedVariantBarcode?: string;
}
