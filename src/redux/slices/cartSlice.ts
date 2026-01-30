import { ClientProduct } from "@/models/client/client-product-detail-model";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CartOption {
  optionId: string;
  optionName?: string;
  optionPrice?: number;
}

export interface SelectedVariantInfo {
  variantId: string;
  variantName: string;  // e.g., "Size", "Color"
  variantValue: string; // e.g., "Large", "Red"
  variantPrice: number;
  variantSku?: string;
  variantBarcode?: string;
}

export interface CartItem {
  itemId: string;
  itemTitle: string;
  itemPrice: number;
  itemImage?: string;
  itemQuantity: number;
  itemOptions?: CartOption[];
  itemTotalPrice: number;
  selectedVariants?: SelectedVariantInfo[]; // Store all selected variant details
}

interface CartState {
  items: CartItem[];
}

const initialState: CartState = {
  items: [],
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (
      state,
      action: PayloadAction<{
        product: ClientProduct;
        quantity?: number;
        options?: CartOption[];
        selectedVariantId?: string;
        selectedVariants?: SelectedVariantInfo[];
      }>
    ) => {
      const {
        product,
        quantity = 1,
        options = [],
        selectedVariantId,
        selectedVariants = [],
      } = action.payload;

      // Create unique itemId: combine all variant IDs + supplement IDs for uniqueness
      let itemId: string;
      if (selectedVariants && selectedVariants.length > 0) {
        // Sort variant IDs for consistent key generation
        const variantIds = selectedVariants.map(v => v.variantId).sort().join('-');
        const optionIds = options.length > 0
          ? '-' + options.map(o => o.optionId).sort().join('-')
          : '';
        itemId = `${product.id}_${variantIds}${optionIds}`;
      } else if (selectedVariantId) {
        // Fallback for backward compatibility
        const optionIds = options.length > 0
          ? '-' + options.map(o => o.optionId).sort().join('-')
          : '';
        itemId = `${product.id}_${selectedVariantId}${optionIds}`;
      } else {
        // No variants - use product ID + supplements
        const optionIds = options.length > 0
          ? '_' + options.map(o => o.optionId).sort().join('-')
          : '';
        itemId = `${product.id}${optionIds}`;
      }
      const existingItem = state.items.find((item) => item.itemId === itemId);

      if (existingItem) {
        existingItem.itemQuantity += quantity;
        let basePrice = product.basePrice;

        // Use selectedVariants for price if available, fallback to selectedVariantId
        if (selectedVariants && selectedVariants.length > 0) {
          // Use the first variant's price (variant prices are typically on the first attribute)
          basePrice = selectedVariants[0].variantPrice;
        } else if (selectedVariantId && product.variants) {
          for (const group of product.variants) {
            const variantOption = group.options.find(
              (opt) => opt.variantId === selectedVariantId
            );
            if (variantOption) {
              basePrice = variantOption.variantPrice;
              break;
            }
          }
        }

        const supplementsTotal = options.reduce(
          (sum, opt) => sum + (opt.optionPrice || 0),
          0
        );

        existingItem.itemPrice = basePrice;
        existingItem.itemTotalPrice =
          (basePrice + supplementsTotal) * existingItem.itemQuantity;

        return;
      }

      let price = product.basePrice;

      // Use selectedVariants for price if available, fallback to selectedVariantId
      if (selectedVariants && selectedVariants.length > 0) {
        // Use the first variant's price (variant prices are typically on the first attribute)
        price = selectedVariants[0].variantPrice;
      } else if (selectedVariantId && product.variants) {
        for (const group of product.variants) {
          const variantOption = group.options.find(
            (opt) => opt.variantId === selectedVariantId
          );
          if (variantOption) {
            price = variantOption.variantPrice;
            break;
          }
        }
      }

      const supplementsTotal = options.reduce(
        (sum, opt) => sum + (opt.optionPrice || 0),
        0
      );

      const totalItemPrice = (price + supplementsTotal) * quantity;

      state.items.push({
        itemId,
        itemTitle: product.title,
        itemPrice: price,
        itemImage: product.mediasUrls?.[0],
        itemQuantity: quantity,
        itemOptions: options,
        itemTotalPrice: totalItemPrice,
        selectedVariants: selectedVariants.length > 0 ? selectedVariants : undefined,
      });
    },

    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(
        (item) => item.itemId !== action.payload
      );
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ itemId: string; quantity: number }>
    ) => {
      const { itemId, quantity } = action.payload;
      const item = state.items.find((i) => i.itemId === itemId);

      if (item) {
        item.itemQuantity = quantity;

        const optionsTotal =
          item.itemOptions?.reduce(
            (sum, opt) => sum + (opt.optionPrice || 0),
            0
          ) || 0;

        item.itemTotalPrice =
          (item.itemPrice + optionsTotal) * item.itemQuantity;

        if (item.itemQuantity <= 0) {
          state.items = state.items.filter((i) => i.itemId !== itemId);
        }
      }
    },

    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart } =
  cartSlice.actions;

export default cartSlice.reducer;
