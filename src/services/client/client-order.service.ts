import { apiClient } from "@/lib/api.config";
import { ClientOrder } from "@/models/client/client-order.model";
import { PaginatedResponse } from "@/models/paginationResponse";

export const clientOrderService = {
  /**
   * Place a new order for the client.
   * @param order - Order object to be submitted
   * @returns The created Order with read-only fields like id, status, createdAt
   */
  async placeOrder(order: ClientOrder): Promise<ClientOrder> {
    const { data } = await apiClient.post("/client/orders", order);
    return data;
  },

  /**
   * Place a POS order with cashier session information
   * @param order - Order object with POS-specific fieldsy
   * @param cashierSessionId - UUID of the current cashier session
   * @param cashReceived - Amount of cash received from customer
   * @param changeGiven - Change given back to customer
   * @returns The created Order
   */
  async placePOSOrder(
    order: Omit<
      ClientOrder,
      "cashierSessionId" | "cashReceived" | "changeGiven" | "source"
    >,
    cashierSessionId: string,
    cashReceived?: number,
    changeGiven?: number,
    paymentMethod?: string
  ): Promise<ClientOrder> {
    const posOrder: ClientOrder = {
      ...order,
      source: "POS" as any, // OrderSource.POS
      cashierSessionId,
      cashReceived,
      changeGiven,
      paymentMethod,
    };
    const { data } = await apiClient.post("/client/orders", posOrder);
    return data;
  },

  /**
   * Get all client orders (paginated)
   * @param params - Query parameters for pagination
   * @returns PaginatedResponse<Order>
   */
  async getAll(
    params: { page?: number; limit?: number; query?: string } = {}
  ): Promise<PaginatedResponse<ClientOrder>> {
    const { data } = await apiClient.get("/client/orders", { params });
    return data;
  },

  /**
   * Get a specific order by ID
   * @param id - Order UUID
   * @returns Order object
   */
  async getById(id: string): Promise<ClientOrder> {
    const { data } = await apiClient.get(`/client/orders/${id}`);
    return data;
  },

  /**
   * Get orders for the currently authenticated client
   * @returns Array of ClientOrder objects
   */
  async getMyOrders(): Promise<ClientOrder[]> {
    const { data } = await apiClient.get("/client/orders/my-orders");
    return data;
  },

  /**
   * Get orders by cashier session ID
   * @param sessionId - UUID of the cashier session
   * @returns Array of ClientOrder objects for that session
   */
  async getOrdersBySession(sessionId: string): Promise<ClientOrder[]> {
    const { data } = await apiClient.get("/client/orders", {
      params: { cashierSessionId: sessionId },
    });
    return data;
  },

  /**
   * Get orders for the current active cashier session from localStorage
   * @returns Array of ClientOrder objects for current session
   */
  async getCurrentSessionOrders(): Promise<ClientOrder[]> {
    const session = localStorage.getItem("currentSession");
    if (!session) {
      throw new Error("No active cashier session found");
    }
    const { id } = JSON.parse(session);
    return this.getOrdersBySession(id);
  },

  /**
   * Get all client orders for a specific cashier session (paginated)
   * @param sessionId - The UUID of the cashier session
   * @param params - Pagination parameters (page, size)
   * @returns PaginatedResponse<ClientOrder>
   */
  async getBySessionId(
    sessionId: string,
    params: { page?: number; size?: number } = {}
  ): Promise<PaginatedResponse<ClientOrder>> {
    const { data } = await apiClient.get(
      `/client/orders/session/${sessionId}`,
      { params }
    );
    return data;
  },

  /**
   * Get orders by table and cashier session
   * @param tableId - UUID of the restaurant table
   * @param cashierSessionId - UUID of the cashier session
   * @returns Array of ClientOrder objects
   */
  async getOrdersByTableAndSession(
    tableId: string,
    cashierSessionId: string
  ): Promise<ClientOrder[]> {
    const { data } = await apiClient.get(
      "/client/orders/by-table-and-session",
      {
        params: {
          tableId,
          cashierSessionId,
        },
      }
    );

    return data;
  },
};
