import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ClientProduct } from "@/models/client/client-product-detail-model";
import {
  selectCartItems,
  selectCartTotal,
} from "@/redux/selectors/cart-selector";
import {
  addToCart as addToCartAction,
  removeFromCart as removeFromCartAction,
  updateQuantity,
} from "@/redux/slices/cartSlice";
import { clientProductService } from "@/services/client/client-product-service";
import {
  Camera,
  Minus,
  ShoppingCart,
  Trash2,
  X,
  Keyboard,
  ScanBarcode,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import PaymentModal from "@/pages/Payment-modal";
import ProductVariantModal from "@/components/ProductVariantModal";

interface QuickScanModeProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
}

const QuickScanMode = ({ isOpen, onClose, currencySymbol }: QuickScanModeProps) => {
  const { toast } = useToast();
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const cartTotal = useSelector(selectCartTotal);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<ClientProduct | null>(null);
  const [preselectedVariantId, setPreselectedVariantId] = useState<string | undefined>(undefined);

  const subtotal = cartTotal;
  const total = subtotal;

  // Focus barcode input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPaymentModal) {
          setShowPaymentModal(false);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "F1" && cartItems.length > 0) {
        e.preventDefault();
        setShowPaymentModal(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isOpen, cartItems, showPaymentModal, onClose]);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setIsScanning(true);
    try {
      const product = await clientProductService.getByBarcode(barcodeInput.trim());

      if (!product.inStock) {
        toast({
          title: "Produit indisponible",
          description: "Ce produit est en rupture de stock",
          variant: "destructive",
        });
        return;
      }

      // Check if product has variants or options
      const hasVariants = !!(product.variants && product.variants.length > 0);
      const hasOptionGroups = !!(product.optionGroups && product.optionGroups.length > 0);

      if (hasVariants || hasOptionGroups) {
        // If scanned a variant barcode, preselect it
        setPreselectedVariantId(product.scannedVariantId);
        setSelectedProductForVariant(product);
        setShowVariantModal(true);
      } else {
        // Add directly to cart
        const existingItem = cartItems.find((item) => item.itemId === product.id);
        if (existingItem) {
          if (existingItem.itemQuantity + 1 > product.quantity) {
            toast({
              title: "Stock insuffisant",
              variant: "destructive",
            });
            return;
          }
          dispatch(
            updateQuantity({
              itemId: product.id,
              quantity: existingItem.itemQuantity + 1,
            })
          );
        } else {
          dispatch(addToCartAction({ product, quantity: 1 }));
        }

        toast({
          title: "Produit ajout",
          description: product.title,
        });
      }
    } catch (error: any) {
      toast({
        title: "Produit non trouv",
        description: "Aucun produit avec ce code-barres",
        variant: "destructive",
      });
    } finally {
      setBarcodeInput("");
      setIsScanning(false);
      barcodeInputRef.current?.focus();
    }
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      dispatch(removeFromCartAction(id));
      return;
    }
    dispatch(updateQuantity({ itemId: id, quantity: quantity }));
  };

  const removeFromCart = (id: string) => {
    dispatch(removeFromCartAction(id));
  };

  const clearCart = () => {
    cartItems.forEach((item) => {
      dispatch(removeFromCartAction(item.itemId));
    });
    toast({
      title: "Panier vid",
    });
  };

  const formatPrice = (price: number) => {
    const symbol = currencySymbol || "";
    return `${price.toFixed(2)} ${symbol}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScanBarcode className="w-6 h-6 text-green-400" />
          <span className="font-semibold text-lg">Mode Scan Rapide</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-300 flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            <span>ESC: Quitter | F1: Payer</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Scanner area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-800 p-8">
          <div className="w-full max-w-md space-y-6">
            {/* Barcode input */}
            <form onSubmit={handleBarcodeSubmit} className="space-y-4">
              <div className="relative">
                <Camera className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scannez ou entrez le code-barres..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="pl-14 h-16 text-xl bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                  disabled={isScanning}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                disabled={isScanning || !barcodeInput.trim()}
              >
                {isScanning ? "Recherche..." : "Ajouter au panier"}
              </Button>
            </form>

            {/* Instructions */}
            <div className="text-center text-gray-400 space-y-2">
              <p className="text-lg">Scannez le code-barres du produit</p>
              <p className="text-sm">Le produit sera automatiquement ajout au panier</p>
            </div>

            {/* Visual scanner indicator */}
            <div className="relative w-64 h-64 mx-auto">
              <div className="absolute inset-0 border-4 border-green-500 rounded-lg opacity-50"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 animate-pulse"></div>
              <div className="absolute inset-4 border-2 border-dashed border-gray-500 rounded flex items-center justify-center">
                <ScanBarcode className="w-16 h-16 text-gray-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Cart sidebar */}
        <div className="w-96 bg-white flex flex-col">
          {/* Cart header */}
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              <span className="font-semibold">Panier ({cartItems.length})</span>
            </div>
            {cartItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p>Panier vide</p>
                <p className="text-sm">Scannez un produit pour commencer</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <Card key={item.itemId} className="p-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-sm">
                        {item.itemTitle}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.itemId)}
                        className="h-6 w-6 p-0 text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Show selected variants if any */}
                    {item.selectedVariants && item.selectedVariants.length > 0 && (
                      <div className="text-xs text-blue-600 mb-1">
                        {item.selectedVariants.map((variant, idx) => (
                          <span key={variant.variantId}>
                            {variant.variantName}: {variant.variantValue}
                            {idx < item.selectedVariants!.length - 1 ? " | " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Show supplements/options if any */}
                    {item.itemOptions && item.itemOptions.length > 0 && (
                      <div className="text-xs text-gray-500 mb-2">
                        + {item.itemOptions.map((opt, idx) => (
                          <span key={opt.optionId}>
                            {opt.optionName}
                            {idx < item.itemOptions!.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateQuantity(
                              item.itemId,
                              item.itemQuantity - 1
                            )
                          }
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.itemQuantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateQuantity(
                              item.itemId,
                              item.itemQuantity + 1
                            )
                          }
                          className="h-7 w-7 p-0"
                        >
                          +
                        </Button>
                      </div>
                      <span className="font-bold">
                        {formatPrice(item.itemTotalPrice)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Payment section */}
          <div className="border-t p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between text-xl font-bold">
              <span>TOTAL:</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Button
              onClick={() => setShowPaymentModal(true)}
              disabled={cartItems.length === 0}
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
            >
              PAYER (F1)
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          cartItems={cartItems}
          total={total}
          subtotal={subtotal}
        />
      )}

      {/* Product Variant Modal */}
      <ProductVariantModal
        product={selectedProductForVariant}
        isOpen={showVariantModal}
        onClose={() => {
          setShowVariantModal(false);
          setSelectedProductForVariant(null);
          setPreselectedVariantId(undefined);
          barcodeInputRef.current?.focus();
        }}
        onAddToCart={() => {
          toast({
            title: "Produit ajout",
            description: "Le produit a t ajout au panier",
          });
          barcodeInputRef.current?.focus();
        }}
        preselectedVariantId={preselectedVariantId}
      />
    </div>
  );
};

export default QuickScanMode;
