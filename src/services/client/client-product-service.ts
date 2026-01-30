import { apiClient } from "@/lib/api.config";
import { ClientProduct } from "@/models/client/client-product-detail-model";
import { PaginatedResponse } from "@/models/paginationResponse";

export const clientProductService = {
  /**
   * Get all products (paginated) for storefront.
   * Supports optional filters: categoryFilter, sorting, and priceSortDirection.
   *
   * @param params - Query parameters for pagination and sorting.
   * @returns PaginatedResponse<ClientProduct>
   */
  async getAll(
    params: {
      page?: number;
      limit?: number;
      query?: string;
      categoryFilter?: string;
      priceSortDirection?: string;
    } = {}
  ): Promise<PaginatedResponse<ClientProduct>> {
    const { data } = await apiClient.get("/client/products", { params });
    return data;
  },

  /**
   * Get detailed product information by ID for storefront.
   * @param id - Product UUID
   * @returns ClientProduct with detailed product information
   */
  async getById(id: string): Promise<ClientProduct> {
    const { data } = await apiClient.get(`/client/products/${id}`);
    return data;
  },
  /**
   * Get all products by category ID for storefront.
   * @param categoryId - Category UUID
   * @returns Array of ClientProduct
   */
  async getByCategory(categoryId: string): Promise<ClientProduct[]> {
    const { data } = await apiClient.get(
      `/client/products/by-category/${categoryId}`
    );
    return data;
  },

  /**
   * Get product by barcode for POS scanning.
   * @param barcode - Product barcode or QR code
   * @returns ClientProduct with scannedVariantId if it's a variant
   */
  async getByBarcode(barcode: string): Promise<ClientProduct> {
    const { data } = await apiClient.get(`/client/products/barcode/${barcode}`);
    return data;
  },
};
