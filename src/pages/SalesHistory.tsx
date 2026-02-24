import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, Printer, RotateCcw, Eye, FileText, ShieldCheck, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClientOrder } from "@/models/client/client-order.model";
import { ClientStore } from "@/models/client/client-store-model";
import { NF525VerificationResult } from "@/models/nf525.model";
import { clientOrderService } from "@/services/client/client-order.service";
import { nf525IntegrityService } from "@/services/nf525-integrity.service";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";
import { invoiceService } from "@/services/invoice.service";
import { buildNF525Receipt } from "@/utils/receipt-builder";

const SalesHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [sales, setSales] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<ClientOrder | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [verificationResult, setVerificationResult] = useState<NF525VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const session = JSON.parse(localStorage.getItem("currentSession") || "{}");
  const sessionId = session?.id;
  const storeData: Partial<ClientStore> = JSON.parse(localStorage.getItem("storeData") || "{}");

  useEffect(() => {
    const fetchSales = async () => {
      if (!sessionId) {
        toast({
          title: "Erreur",
          description: "Aucune session de caisse active trouvée.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await clientOrderService.getBySessionId(sessionId, {
          page: 0,
          size: 50,
        });
        setSales(response.items || []);
      } catch (error: any) {
        console.error("Erreur lors du chargement des ventes:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les ventes depuis le serveur.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [sessionId]);

  const filteredSales = sales.filter((sale) =>
    sale.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const result = await nf525IntegrityService.verifyFullChain(sales);
      setVerificationResult(result);

      // NF525 Phase 4 : journal CHAIN_VERIFIED
      try {
        await nf525EventJournalService.logChainVerified({
          valid: result.valid,
          checkedCount: result.checkedCount,
          errorCount: result.errors.length,
        });
      } catch (e) { console.warn('NF525: journal CHAIN_VERIFIED', e); }
    } catch (error) {
      console.error("Erreur vérification chaîne NF525:", error);
      toast({
        title: "Erreur",
        description: "Impossible de vérifier la chaîne d'intégrité.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const buildTicket = (sale: ClientOrder): string => {
    const integrity = sale.id ? nf525IntegrityService.getByOrderId(sale.id) : undefined;
    const integrityInfo = integrity
      ? {
          sequentialNumber: integrity.sequentialNumber,
          shortHash: integrity.shortHash,
          grandTotal: integrity.grandTotal,
        }
      : undefined;
    return buildNF525Receipt(sale, storeData, { cashier: session.cashier }, integrityInfo);
  };

  const handlePrint = (sale: ClientOrder) => {
    const ticket = buildTicket(sale);
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket ${sale.orderNumber}</title>
            <style>
              body {
                font-family: monospace;
                white-space: pre;
                font-size: 13px;
                margin: 10px;
              }
              @media print {
                @page { margin: 0; }
              }
            </style>
          </head>
          <body>
            <pre>${ticket}</pre>
            <script>
              window.onload = () => {
                window.print();
                window.onafterprint = () => window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    toast({
      title: "Ticket imprimé",
      description: `Ticket ${sale.orderNumber} en cours d'impression.`,
    });
  };

  const handleViewTicket = (sale: ClientOrder) => {
    setSelectedSale(sale);
    setShowTicket(true);
  };

  const handleRefund = (sale: ClientOrder) => {
    toast({
      title: "Remboursement",
      description: `Remboursement du ticket ${sale.orderNumber} (en développement)`,
    });
  };

  const handleDownloadInvoice = async (sale: ClientOrder) => {
    try {
      toast({
        title: "Génération en cours",
        description: "La facture est en cours de génération...",
      });

      // Get store data from localStorage
      const storeData = JSON.parse(localStorage.getItem("storeData") || "{}");

      const blob = await invoiceService.generateOrderInvoice(sale.id, storeData);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `facture-${sale.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Facture générée",
        description: `La facture ${sale.orderNumber} a été téléchargée.`,
      });
    } catch (error: any) {
      console.error("Erreur lors de la génération de la facture:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la facture. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/pos")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au POS
          </Button>
          <h1 className="text-3xl font-bold">Historique des ventes</h1>
          <p className="text-muted-foreground">
            Session en cours - {sales.length} vente(s)
          </p>
        </div>

        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro de ticket..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleVerifyChain}
            disabled={isVerifying || sales.length === 0}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {isVerifying ? "Vérification..." : "Vérifier la chaîne"}
          </Button>
        </div>

        {verificationResult && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              verificationResult.valid
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold mb-1">
              {verificationResult.valid ? (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  Chaîne intègre — {verificationResult.checkedCount} ticket(s) vérifiés
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  Chaîne compromise — {verificationResult.errors.length} erreur(s) détectée(s)
                </>
              )}
            </div>
            {!verificationResult.valid && (
              <ul className="mt-2 text-sm space-y-1">
                {verificationResult.errors.map((err, i) => (
                  <li key={i}>
                    Ticket #{err.orderNumber || err.sequentialNumber} : {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loading ? (
          <Card className="p-8 text-center">
            <p>Chargement des ventes...</p>
          </Card>
        ) : filteredSales.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Aucune vente trouvée</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSales.map((sale) => (
              <Card key={sale.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      Ticket #{sale.orderNumber}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.createdAt || "").toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {sale.status || "Inconnu"}
                    </Badge>
                    <Badge className="bg-success text-white">
                      {sale.total?.toFixed(2)} €
                    </Badge>
                    {(() => {
                      const integrity = sale.id ? nf525IntegrityService.getByOrderId(sale.id) : undefined;
                      return integrity ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          #{integrity.sequentialNumber} | {integrity.shortHash}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div className="border-t pt-4 mb-4">
                  <div className="space-y-2">
                    {sale.orderItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="font-semibold">
                          {(item.quantity * item.unitPrice).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewTicket(sale)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir le ticket
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint(sale)}
                    className="flex-1"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(sale)}
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Facture
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefund(sale)}
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rembourser
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Ticket Preview Modal */}
      <Dialog open={showTicket} onOpenChange={setShowTicket}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ticket #{selectedSale?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto bg-muted p-4 rounded font-mono text-sm whitespace-pre-wrap">
            {selectedSale
              ? buildTicket(selectedSale)
              : "Chargement du ticket..."}
          </div>
          <DialogFooter className="mt-4 flex justify-between">
            <Button variant="secondary" onClick={() => setShowTicket(false)}>
              Fermer
            </Button>
            {selectedSale && (
              <Button onClick={() => handlePrint(selectedSale)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesHistory;
