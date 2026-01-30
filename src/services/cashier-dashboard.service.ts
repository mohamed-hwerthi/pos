import { apiClient } from "@/lib/api.config";
import { CashierDashboardDTO, DashboardPeriod } from "@/models/cashier-dashboard.model";

/**
 * Service for fetching cashier dashboard data
 */
export const cashierDashboardService = {
  /**
   * Get cashier dashboard with statistics and performance metrics
   * GET /api/cashier-sessions/dashboard/{cashierId}?period=today|week|month
   */
  async getCashierDashboard(
    cashierId: string,
    period: DashboardPeriod = "today"
  ): Promise<CashierDashboardDTO> {
    const { data } = await apiClient.get(
      `/cashier-sessions/dashboard/${cashierId}`,
      { params: { period } }
    );
    return data;
  },
};
