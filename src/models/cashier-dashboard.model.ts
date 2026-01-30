import { CashierSessionResponseDTO } from "./cashier-session.model";

export interface RecentOrderDTO {
  id: string;
  orderNumber: string;
  createdAt: string;
  itemCount: number;
  total: number;
  paymentMethod: string;
  status: string;
}

export interface CashierDashboardDTO {
  // Cashier info
  cashierFirstName: string;
  cashierLastName: string;

  // KPIs du jour
  salesToday: number;
  salesYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  averageOrderValue: number;

  // Statistiques période (configurable: today, week, month)
  totalSales: number;
  totalOrders: number;
  totalRefunds: number;
  netSales: number;
  hoursWorked: number;

  // Session actuelle
  currentSession: CashierSessionResponseDTO | null;
  currentCashInDrawer: number;

  // Transactions récentes
  recentOrders: RecentOrderDTO[];

  // Performance
  monthlyTarget: number;
  monthlyAchieved: number;
  rankAmongCashiers: number;
  totalCashiers: number;
  topSellingProduct: string;

  // Analyse horaire
  bestHour: string;
  bestHourSales: number;
}

export type DashboardPeriod = "today" | "week" | "month";
