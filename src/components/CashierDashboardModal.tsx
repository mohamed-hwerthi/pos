import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CashierDashboardDTO,
  DashboardPeriod,
  RecentOrderDTO,
} from "@/models/cashier-dashboard.model";
import { cashierDashboardService } from "@/services/cashier-dashboard.service";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Clock,
  DollarSign,
  Target,
  Trophy,
  Star,
  RefreshCw,
  X,
  Loader2,
  CreditCard,
  Banknote,
  History,
} from "lucide-react";

interface CashierDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierId: string;
  currencySymbol?: string;
}

const CashierDashboardModal = ({
  isOpen,
  onClose,
  cashierId,
  currencySymbol = "€",
}: CashierDashboardModalProps) => {
  const [dashboard, setDashboard] = useState<CashierDashboardDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("today");

  const formatPrice = (value: number | null | undefined) => {
    const amount = value ?? 0;
    return `${amount.toFixed(2)} ${currencySymbol}`;
  };

  const formatHours = (hours: number | null | undefined) => {
    const h = hours ?? 0;
    return `${h.toFixed(1)}h`;
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getProgressPercentage = () => {
    if (!dashboard || !dashboard.monthlyTarget || dashboard.monthlyTarget === 0)
      return 0;
    return Math.min(
      (dashboard.monthlyAchieved / dashboard.monthlyTarget) * 100,
      100
    );
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toUpperCase()) {
      case "CASH":
        return <Banknote className="w-4 h-4 text-green-600" />;
      case "CLICK_TO_PAY":
      case "STRIPE":
      case "PAYPAL":
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return "default";
      case "PENDING":
        return "secondary";
      case "REFUNDED":
        return "destructive";
      default:
        return "outline";
    }
  };

  const fetchDashboard = async () => {
    if (!cashierId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await cashierDashboardService.getCashierDashboard(
        cashierId,
        period
      );
      setDashboard(data);
    } catch (err: any) {
      console.error("Error fetching dashboard:", err);
      setError("Impossible de charger le dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && cashierId) {
      fetchDashboard();
    }
  }, [isOpen, cashierId, period]);

  // Auto-refresh every 30 seconds when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      fetchDashboard();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen, cashierId, period]);

  const salesChange = dashboard
    ? calculatePercentageChange(dashboard.salesToday, dashboard.salesYesterday)
    : 0;
  const ordersChange = dashboard
    ? dashboard.ordersToday - dashboard.ordersYesterday
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Target className="w-6 h-6 text-blue-600" />
              {dashboard
                ? `Bonjour ${dashboard.cashierFirstName} !`
                : "Mon Dashboard"}
              {dashboard?.currentSession && (
                <Badge variant="outline" className="ml-2">
                  Session #{dashboard.currentSession.sessionNumber}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDashboard}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Actualiser
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading && !dashboard ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchDashboard}>
              Réessayer
            </Button>
          </div>
        ) : dashboard ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              {/* Ventes aujourd'hui */}
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">
                    Ventes Aujourd'hui
                  </span>
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatPrice(dashboard.salesToday)}
                </div>
                <div
                  className={`flex items-center text-sm mt-1 ${
                    salesChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {salesChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {salesChange >= 0 ? "+" : ""}
                  {salesChange.toFixed(1)}% vs hier
                </div>
              </Card>

              {/* Commandes aujourd'hui */}
              <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">
                    Commandes Aujourd'hui
                  </span>
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {dashboard.ordersToday}
                </div>
                <div
                  className={`flex items-center text-sm mt-1 ${
                    ordersChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {ordersChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {ordersChange >= 0 ? "+" : ""}
                  {ordersChange} vs hier
                </div>
              </Card>

              {/* Panier moyen */}
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-700">
                    Panier Moyen
                  </span>
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {formatPrice(dashboard.averageOrderValue)}
                </div>
                <div className="text-sm text-purple-600 mt-1">Par commande</div>
              </Card>

              {/* Heures travaillées */}
              <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-700">
                    Heures Travaillées
                  </span>
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-orange-900">
                  {formatHours(dashboard.hoursWorked)}
                </div>
                <div className="text-sm text-orange-600 mt-1">
                  {period === "today"
                    ? "Aujourd'hui"
                    : period === "week"
                    ? "Cette semaine"
                    : "Ce mois"}
                </div>
              </Card>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Statistiques période */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">
                    Statistiques Période
                  </h3>
                  <Tabs
                    value={period}
                    onValueChange={(v) => setPeriod(v as DashboardPeriod)}
                  >
                    <TabsList className="h-8">
                      <TabsTrigger value="today" className="text-xs px-3">
                        Aujourd'hui
                      </TabsTrigger>
                      <TabsTrigger value="week" className="text-xs px-3">
                        Semaine
                      </TabsTrigger>
                      <TabsTrigger value="month" className="text-xs px-3">
                        Mois
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Ventes totales</span>
                    <span className="font-semibold">
                      {formatPrice(dashboard.totalSales)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Nombre commandes</span>
                    <span className="font-semibold">{dashboard.totalOrders}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Remboursements</span>
                    <span className="font-semibold text-red-600">
                      {formatPrice(dashboard.totalRefunds)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Ventes nettes</span>
                    <span className="font-bold text-green-600">
                      {formatPrice(dashboard.netSales)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Meilleure heure</span>
                    <span className="font-semibold">
                      {dashboard.bestHour} ({formatPrice(dashboard.bestHourSales)})
                    </span>
                  </div>
                </div>
              </Card>

              {/* Session actuelle */}
              <Card className="p-4">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Session Actuelle
                </h3>

                {dashboard.currentSession ? (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Ouverture</span>
                      <span className="font-semibold">
                        {formatTime(dashboard.currentSession.startTime)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Fond initial</span>
                      <span className="font-semibold">
                        {formatPrice(dashboard.currentSession.openingBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Ventes session</span>
                      <span className="font-semibold">
                        {formatPrice(dashboard.currentSession.totalSales)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Remboursements</span>
                      <span className="font-semibold text-red-600">
                        {formatPrice(dashboard.currentSession.totalRefunds)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 bg-blue-50 -mx-4 px-4 rounded">
                      <span className="text-blue-700 font-medium">
                        Espèces en caisse
                      </span>
                      <span className="font-bold text-blue-900">
                        {formatPrice(dashboard.currentCashInDrawer)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune session active</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Dernières transactions */}
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Dernières Transactions
              </h3>

              {dashboard.recentOrders && dashboard.recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-2 font-medium">N° Commande</th>
                        <th className="pb-2 font-medium">Heure</th>
                        <th className="pb-2 font-medium">Articles</th>
                        <th className="pb-2 font-medium">Total</th>
                        <th className="pb-2 font-medium">Paiement</th>
                        <th className="pb-2 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentOrders.map(
                        (order: RecentOrderDTO, index: number) => (
                          <tr
                            key={order.id || index}
                            className="border-b last:border-b-0 hover:bg-gray-50"
                          >
                            <td className="py-3 font-medium">
                              #{order.orderNumber}
                            </td>
                            <td className="py-3 text-gray-600">
                              {formatTime(order.createdAt)}
                            </td>
                            <td className="py-3">
                              {order.itemCount} article{order.itemCount > 1 ? "s" : ""}
                            </td>
                            <td className="py-3 font-semibold">
                              {formatPrice(order.total)}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                {getPaymentMethodIcon(order.paymentMethod)}
                                <span className="text-sm capitalize">
                                  {order.paymentMethod?.toLowerCase() || "N/A"}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <Badge
                                variant={getStatusBadgeVariant(order.status)}
                              >
                                {order.status === "COMPLETED"
                                  ? "Payé"
                                  : order.status === "PENDING"
                                  ? "En attente"
                                  : order.status === "REFUNDED"
                                  ? "Remboursé"
                                  : order.status || "N/A"}
                              </Badge>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune transaction récente</p>
                </div>
              )}
            </Card>

            {/* Performance et Classement */}
            <div className="grid grid-cols-2 gap-6">
              {/* Performance */}
              <Card className="p-4">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Mes Performances
                </h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Ce mois</span>
                      <span className="font-semibold">
                        {formatPrice(dashboard.monthlyAchieved)}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Objectif</span>
                      <span className="font-semibold">
                        {formatPrice(dashboard.monthlyTarget)}
                      </span>
                    </div>
                    <Progress
                      value={getProgressPercentage()}
                      className="h-3 mt-3"
                    />
                    <div className="text-center mt-2 text-sm text-gray-600">
                      {getProgressPercentage().toFixed(0)}% de l'objectif atteint
                    </div>
                  </div>
                </div>
              </Card>

              {/* Classement */}
              <Card className="p-4">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                  Classement
                </h3>

                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-blue-600">
                      #{dashboard.rankAmongCashiers}
                    </div>
                    <div className="text-gray-600 mt-1">
                      sur {dashboard.totalCashiers} caissier
                      {dashboard.totalCashiers > 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span className="text-gray-600">
                        Top produit vendu:
                      </span>
                    </div>
                    <div className="font-semibold mt-1 text-lg">
                      {dashboard.topSellingProduct || "N/A"}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default CashierDashboardModal;
