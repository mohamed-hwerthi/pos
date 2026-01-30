import { apiClient } from "@/lib/api.config";

export interface StoreData {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  siret?: string;
  vatNumber?: string;
  currency?: string;
}

export const invoiceService = {
  /**
   * Generate and download invoice PDF for an order
   * @param orderId - Order UUID
   * @param storeData - Store information for invoice header
   * @returns Blob containing the PDF file
   */
  async generateOrderInvoice(
    orderId: string,
    storeData: StoreData
  ): Promise<Blob> {
    const { data } = await apiClient.post(
      `/invoices/orders/${orderId}/invoice`,
      storeData,
      {
        responseType: "blob",
      }
    );
    return data;
  },
};
