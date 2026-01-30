import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Banknote, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clientOrderService } from "@/services/client/client-order.service";
import { clearCart } from "@/redux/slices/cartSlice";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  total: number;
  subtotal: number;
}

const PaymentModal = ({
  isOpen,
  onClose,
  cartItems,
  total,
  subtotal,
}: PaymentModalProps) => {
  const { toast } = useToast();
  const dispatch = useDispatch();
  const [cashReceived, setCashReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const change = parseFloat(cashReceived || "0") - total;

  // Gérer la saisie clavier rapide
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // ESC pour fermer
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Entrée pour valider si montant suffisant
      if (e.key === "Enter" && parseFloat(cashReceived) >= total) {
        e.preventDefault();
        handlePayment();
        return;
      }

      // Chiffres pour saisie directe
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        // Si vide ou 0, remplacer, sinon ajouter
        if (!cashReceived || cashReceived === "0.00" || cashReceived === "0") {
          setCashReceived(e.key + ".00");
        } else {
          const current = parseFloat(cashReceived);
          const newValue = current * 10 + parseInt(e.key);
          setCashReceived(newValue.toFixed(2));
        }
        return;
      }

      // Backspace pour effacer dernier chiffre
      if (e.key === "Backspace") {
        e.preventDefault();
        if (cashReceived && cashReceived !== "0.00") {
          const current = parseFloat(cashReceived);
          const newValue = Math.floor(current / 10);
          setCashReceived(newValue > 0 ? newValue.toFixed(2) : "0.00");
        }
        return;
      }

      // C pour clear
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setCashReceived("");
        return;
      }

      // + pour ajouter 1 euro
      if (e.key === "+") {
        e.preventDefault();
        const current = parseFloat(cashReceived || "0");
        setCashReceived((current + 1).toFixed(2));
        return;
      }

      // - pour retirer 1 euro
      if (e.key === "-") {
        e.preventDefault();
        const current = parseFloat(cashReceived || "0");
        if (current > 1) {
          setCashReceived((current - 1).toFixed(2));
        }
        return;
      }

      // Point/virgule pour décimale
      if (e.key === "." || e.key === ",") {
        e.preventDefault();
        if (cashReceived && !cashReceived.includes(".")) {
          setCashReceived(cashReceived + ".00");
        }
        return;
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
    }
  }, [isOpen, cashReceived, total]);

  const handlePayment = async () => {
    if (parseFloat(cashReceived) < total) {
      toast({
        title: "Montant insuffisant",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const currentSession = JSON.parse(
        localStorage.getItem("currentSession") || "{}"
      );

      const orderItems = cartItems.map((item) => {
        // Extract base product ID from composite itemId (format: productId_variantIds-optionIds)
        const baseProductId = item.itemId.split('_')[0];

        // Get variant details from selectedVariants if available
        const firstVariant = item.selectedVariants?.[0];

        return {
          productId: baseProductId,
          productName: item.itemTitle,
          unitPrice: item.itemPrice,
          quantity: item.itemQuantity,
          totalPrice: item.itemTotalPrice,
          options: item.itemOptions,
          // Variant details for accurate order history
          variantId: firstVariant?.variantId,
          variantSku: firstVariant?.variantSku,
          variantBarcode: firstVariant?.variantBarcode,
          variantValue: firstVariant?.variantValue,
        };
      });

      const cashReceivedAmount = parseFloat(cashReceived);
      const changeGivenAmount = cashReceivedAmount - total;

      await clientOrderService.placePOSOrder(
        {
          orderItems,
          total,
          subTotal: subtotal,
        },
        currentSession.id,
        cashReceivedAmount,
        changeGivenAmount
      );

      // Mettre à jour la session
      if (currentSession.id) {
        const sale = {
          id: Date.now().toString().slice(-6),
          date: new Date().toISOString(),
          total,
          paymentMethod: "cash",
        };

        currentSession.sales = currentSession.sales || [];
        currentSession.sales.push(sale);
        currentSession.totalSales = (currentSession.totalSales || 0) + total;
        currentSession.totalCash = (currentSession.totalCash || 0) + total;
        localStorage.setItem("currentSession", JSON.stringify(currentSession));
      }

      // Vider le panier
      dispatch(clearCart());

      toast({
        title: "Paiement accepté",
        description: `Ticket #${Date.now()
          .toString()
          .slice(-6)} • Monnaie: ${changeGivenAmount.toFixed(2)} €`,
      });

      // Fermer après succès
      setTimeout(() => {
        onClose();
        setCashReceived("");
      }, 800);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.response?.data?.message || "Paiement échoué",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* En-tête simple */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-bold">PAIEMENT</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Contenu minimal */}
        <div className="p-6">
          {/* Total bien visible */}
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500">À PAYER</div>
            <div className="text-6xl font-bold text-green-600 my-3">
              {total.toFixed(2)} €
            </div>
          </div>

          {/* Champ de saisie */}
          <div className="mb-6">
            <div className="text-sm font-medium mb-2">MONTANT REÇU</div>
            <Input
              type="number"
              step="0.01"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="text-4xl h-16 text-center font-bold border-2"
              placeholder="0.00"
              autoFocus
            />
            <div className="flex justify-between mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCashReceived(total.toFixed(2))}
                className="h-7 text-xs"
              >
                Montant exact
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCashReceived("")}
                className="h-7 text-xs"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Monnaie à rendre */}
          {cashReceived && (
            <div
              className={`p-4 rounded-lg mb-6 border text-center ${
                change >= 0
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <div className="text-sm font-medium">
                {change >= 0 ? "MONNAIE À RENDRE" : "MANQUE"}
              </div>
              <div className="text-3xl font-bold mt-1">
                {Math.abs(change).toFixed(2)} €
              </div>
            </div>
          )}

          {/* Bouton principal */}
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handlePayment}
            disabled={
              !cashReceived || parseFloat(cashReceived) < total || isProcessing
            }
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span>
                TRAITEMENT...
              </span>
            ) : (
              <>
                <Check className="mr-2 h-5 w-5" />
                VALIDER (ENTRÉE)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
