import { RootState } from "../store";
import { createSelector } from "@reduxjs/toolkit";
import {
  calculateExclTax,
  calculateVatAmount,
  calculateVatBreakdown,
} from "@/utils/vat-helpers";

export const selectCartItems = (state: RootState) => state.cart.items;

export const selectCartTotal = createSelector([selectCartItems], (items) =>
  items.reduce((sum, item) => sum + (item.itemTotalPrice || 0), 0)
);

export const selectCartTotalExclTax = createSelector(
  [selectCartItems],
  (items) =>
    items.reduce(
      (sum, item) =>
        sum + calculateExclTax(item.itemTotalPrice || 0, item.vatRate ?? 20),
      0
    )
);

export const selectCartVatTotal = createSelector([selectCartItems], (items) =>
  items.reduce(
    (sum, item) =>
      sum + calculateVatAmount(item.itemTotalPrice || 0, item.vatRate ?? 20),
    0
  )
);

export const selectCartVatBreakdown = createSelector(
  [selectCartItems],
  (items) =>
    calculateVatBreakdown(
      items.map((item) => ({
        totalPrice: item.itemTotalPrice || 0,
        vatRate: item.vatRate ?? 20,
      }))
    )
);
