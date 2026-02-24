import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { API_UPLOADS_URL } from "@/lib/api.config";
import { ClientProduct } from "@/models/client/client-product-detail-model";
import { ClientStore } from "@/models/client/client-store-model";
import { UserDTO } from "@/models/user.model";
import {
  selectCartItems,
  selectCartTotal,
  selectCartTotalExclTax,
  selectCartVatTotal,
} from "@/redux/selectors/cart-selector";
import {
  addToCart as addToCartAction,
  removeFromCart as removeFromCartAction,
  updateQuantity,
} from "@/redux/slices/cartSlice";
import { setCurrency } from "@/redux/slices/storeCurrencySlice";
import { clientProductService } from "@/services/client/client-product-service";
import { clientStoreService } from "@/services/client/client-store-service";
import { cashierSessionService } from "@/services/cahier-session.service";
import { nf525IntegrityService } from "@/services/nf525-integrity.service";
import { nf525ArchiveService } from "@/services/nf525-archive.service";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";
import {
  Clock,
  DollarSign,
  History,
  Home,
  Minus,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Grid3x3,
  Keyboard,
  ScanBarcode,
  LayoutDashboard,
  AlertTriangle,
  Archive,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shortcuts } from "@/utils/constants/constants";
import PaymentModal from "./Payment-modal";
import ProductVariantModal from "@/components/ProductVariantModal";
import QuickScanMode from "@/components/QuickScanMode";
import CashierDashboardModal from "@/components/CashierDashboardModal";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  inStock: boolean;
  imageUrl?: string;
  barcode?: string;
  hasVariants: boolean;
  clientProduct: ClientProduct; // Keep full product data for variant modal
}

const convertClientProductToProduct = (
  clientProduct: ClientProduct
): Product => {
  const hasVariants = !!(clientProduct.variants && clientProduct.variants.length > 0);
  const hasOptionGroups = !!(clientProduct.optionGroups && clientProduct.optionGroups.length > 0);

  return {
    id: clientProduct.id,
    name: clientProduct.title,
    price: clientProduct.discountedPrice || clientProduct.basePrice,
    stock: clientProduct.quantity,
    inStock: clientProduct.inStock,
    imageUrl: clientProduct.mediasUrls?.[0],
    hasVariants: hasVariants || hasOptionGroups, // Show modal if has variants OR supplements
    clientProduct: clientProduct, // Keep full data for modal
  };
};

const POS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const cartTotal = useSelector(selectCartTotal);
  const cartTotalExclTax = useSelector(selectCartTotalExclTax);
  const cartVatTotal = useSelector(selectCartVatTotal);
  const currencySymbol = useSelector(
    (state: any) => state.storeCurrency.currencySymbol
  );
  const params = useParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<ClientProduct | null>(null);
  const [showQuickScanMode, setShowQuickScanMode] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showClosingWarning, setShowClosingWarning] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const subtotal = cartTotal;
  const total = subtotal;

  const [cashier, setCashier] = useState<UserDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [session, setSession] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    const storedCashier = localStorage.getItem("cashier");
    const currentSession = localStorage.getItem("currentSession");

    if (!storedCashier) {
      navigate("/login");
      return;
    }

    if (!currentSession) {
      navigate("/cash-register-opening");
      return;
    }

    setCashier(JSON.parse(storedCashier));
    setSession(JSON.parse(currentSession));
  }, [navigate]);

  useEffect(() => {
    const fetchStoreAndCurrency = async () => {
      const getSlugFromUrl = (): string | null => {
        const currentUrl = window.location.hostname;
        if (currentUrl.includes(".localhost")) {
          const parts = currentUrl.split(".");
          return parts[0];
        }
        if (currentUrl.includes(".goodshop.fr")) {
          const parts = currentUrl.split(".");
          return parts[0];
        }
        return params.slug as string;
      };

      try {
        const slug = getSlugFromUrl();
        if (!slug) {
          console.error("No slug found in URL");
          return;
        }

        const storeData: ClientStore = await clientStoreService.getBySlug(slug);
        if (storeData.currencySymbol) {
          dispatch(setCurrency(storeData.currencySymbol));
        }
      } catch (err: any) {
        console.error("Failed to fetch store or currency:", err);
      }
    };

    fetchStoreAndCurrency();
  }, [dispatch, params.slug]);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoadingProducts(true);
        const response = await clientProductService.getAll({
          limit: 200,
        });
        const convertedProducts = response.items.map(
          convertClientProductToProduct
        );
        setProducts(convertedProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les produits",
          variant: "destructive",
        });
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [toast]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showShortcuts && e.key !== "F12" && e.key !== "Escape") {
        return;
      }
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          setSearchQuery("");
          searchInputRef.current?.focus();
        }
        return;
      }

      if (e.key === "F1" && cartItems.length > 0) {
        e.preventDefault();
        navigate("/payment", {
          state: { cart: cartItems, total, subtotal },
        });
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        navigate("/sales-history");
        return;
      }

      if (e.key === "F3") {
        e.preventDefault();
        navigate("/cash-register-closing");
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        navigate("/tables");
        return;
      }

      if (e.key === "F5" && cartItems.length > 0) {
        e.preventDefault();
        clearCart();
        return;
      }

      if (e.key === "F6") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "F7" && filteredProducts.length > 0) {
        e.preventDefault();
        addToCart(filteredProducts[0]);
        return;
      }

      if (e.key === "F8") {
        e.preventDefault();
        window.location.reload();
        return;
      }

      if (e.key === "F9") {
        e.preventDefault();
        setShowDashboardModal(true);
        return;
      }

      if (e.key === "F10") {
        e.preventDefault();
        setShowClosingWarning(true);
        return;
      }

      if (e.key === "F11") {
        e.preventDefault();
        setShowQuickScanMode(true);
        return;
      }

      if (e.key === "F12") {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      if (e.key === "Delete" && cartItems.length > 0) {
        e.preventDefault();
        const lastItem = cartItems[cartItems.length - 1];
        removeFromCart(lastItem.itemId);
        return;
      }

      if (
        e.ctrlKey &&
        e.key === "a" &&
        document.activeElement === searchInputRef.current
      ) {
        return;
      }

      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        clearCart();
        setSearchQuery("");
        searchInputRef.current?.focus();
        return;
      }

      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        toast({
          title: "Impression",
          description: "Utilisez F1 pour aller au paiement et imprimer",
        });
        return;
      }

      if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        navigate("/sales-history");
        return;
      }

      if (e.key === "+" && cartItems.length > 0) {
        e.preventDefault();
        const lastItem = cartItems[cartItems.length - 1];
        handleUpdateQuantity(lastItem.itemId, lastItem.itemQuantity + 1);
        return;
      }

      if (e.key === "-" && cartItems.length > 0) {
        e.preventDefault();
        const lastItem = cartItems[cartItems.length - 1];
        handleUpdateQuantity(lastItem.itemId, lastItem.itemQuantity - 1);
        return;
      }

      if (e.key === "Enter" && searchQuery && filteredProducts.length > 0) {
        e.preventDefault();
        addToCart(filteredProducts[0]);
        setSearchQuery("");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    cartItems,
    total,
    navigate,
    subtotal,
    showShortcuts,
    searchQuery,
    filteredProducts,
  ]);

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      dispatch(removeFromCartAction(id));
      return;
    }

    // Extract base product ID from composite itemId (format: productId_variantIds-optionIds)
    const baseProductId = id.split('_')[0];
    const product = products.find((p) => p.id === baseProductId || p.id === id);

    if (product && quantity > product.stock) {
      toast({
        title: "Stock insuffisant",
        description: `Max: ${product.stock}`,
        variant: "destructive",
      });
      return;
    }

    dispatch(updateQuantity({ itemId: id, quantity: quantity }));
  };

  const addToCart = (product: Product) => {
    if (!product.inStock || product.stock <= 0) {
      toast({
        title: "Indisponible",
        variant: "destructive",
      });
      return;
    }

    // If product has variants or supplements, open the variant modal
    if (product.hasVariants) {
      setSelectedProductForVariant(product.clientProduct);
      setShowVariantModal(true);
      return;
    }

    // Product without variants - add directly to cart
    const existingItem = cartItems.find((item) => item.itemId === product.id);
    if (existingItem) {
      if (existingItem.itemQuantity + 1 > product.stock) {
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
      dispatch(addToCartAction({ product: product.clientProduct, quantity: 1 }));
    }
  };

  const removeFromCart = (id: string) => {
    dispatch(removeFromCartAction(id));
  };

  const clearCart = () => {
    cartItems.forEach((item) => {
      dispatch(removeFromCartAction(item.itemId));
    });
    toast({
      title: "Panier vidé",
    });
  };

  const formatPrice = (price: number) => {
    const symbol = currencySymbol || "€";
    return `${price.toFixed(2)} ${symbol}`;
  };

  // Calculate expected cash for closing
  const expectedCash = session?.totalCash || 0;
  const cashDifference = actualCash ? parseFloat(actualCash) - expectedCash : 0;

  // Handle closing cash register and going home
  const handleCloseRegisterAndGoHome = async () => {
    if (!actualCash) {
      toast({
        title: "Erreur",
        description: "Veuillez compter les espèces avant de clôturer",
        variant: "destructive",
      });
      return;
    }

    setIsClosing(true);
    try {
      // Call the API to close the session
      const closedSession = await cashierSessionService.closeSession(
        session.id,
        parseFloat(actualCash)
      );

      // Update local storage
      const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
      const updatedSession = {
        ...session,
        ...closedSession,
        actualCash: parseFloat(actualCash),
        cashDifference: cashDifference,
        status: "closed",
      };

      sessions.push(updatedSession);
      localStorage.setItem("sessions", JSON.stringify(sessions));

      // NF525: compute and archive session integrity before clearing session
      try {
        const orderIds = (session.sales || [])
          .map((s: any) => s.orderId)
          .filter(Boolean);
        const sessionIntegrity = await nf525IntegrityService.generateSessionClosing(
          session.id,
          session.sessionNumber || session.id,
          orderIds
        );
        nf525IntegrityService.archiveSessionClosing(sessionIntegrity);

        // NF525: log SESSION_CLOSED event
        await nf525EventJournalService.logSessionClosed({
          sessionId: session.id,
          sessionNumber: session.sessionNumber || session.id,
          totalSales: session.totalSales || 0,
          actualCash: parseFloat(actualCash),
          cashDifference: cashDifference,
          sessionDigest: sessionIntegrity.sessionDigest,
        });
      } catch (e) { console.warn('NF525: session closing from POS', e); }

      // NF525: auto-trigger daily closing
      try {
        const today = new Date().toISOString().split("T")[0];
        if (!nf525ArchiveService.hasClosingForPeriod("daily", today)) {
          await nf525ArchiveService.generateDailyClosing(today);
        }
      } catch (e) { console.warn('NF525: daily closing from POS', e); }

      // NF525: sync all data to backend before clearing session
      try {
        const { nf525SyncService } = await import("@/services/nf525-sync.service");
        await nf525SyncService.syncAll();
      } catch (e) { console.warn('NF525: sync at POS close', e); }

      localStorage.removeItem("currentSession");

      toast({
        title: "Caisse clôturée avec succès",
        description:
          cashDifference === 0
            ? "Pas d'écart de caisse"
            : `Écart: ${cashDifference.toFixed(2)} €`,
        variant: cashDifference === 0 ? "default" : "destructive",
      });

      setShowClosingWarning(false);
      setActualCash("");
      setTimeout(() => navigate("/login"), 1000);
    } catch (error) {
      console.error("Error closing cashier session:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la fermeture de la caisse",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header compact */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClosingWarning(true)}
            className="gap-1"
          >
            <Home className="w-4 h-4" />
            Accueil
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/tables")}
            className="gap-1"
          >
            <Grid3x3 className="w-4 h-4" />
            Tables
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/sales-history")}
            className="gap-1"
          >
            <History className="w-4 h-4" />
            Historique
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/cash-register-closing")}
            className="gap-1"
          >
            <DollarSign className="w-4 h-4" />
            Clôture
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/nf525-archive")}
            className="gap-1"
          >
            <Archive className="w-4 h-4" />
            Archives
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowDashboardModal(true)}
            className="gap-1 bg-blue-600 hover:bg-blue-700"
          >
            <LayoutDashboard className="w-4 h-4" />
            Mon Dashboard (F9)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShortcuts(true)}
            className="gap-1"
          >
            <Keyboard className="w-4 h-4" />
            Raccourcis (F12)
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowQuickScanMode(true)}
            className="gap-1 bg-green-600 hover:bg-green-700"
          >
            <ScanBarcode className="w-4 h-4" />
            Scan Rapide (F11)
          </Button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="text-gray-600">
            {cashier?.firstName} {cashier?.lastName}
          </div>
          <div className="font-medium">
            {formatPrice(session?.totalCash || 0)}
          </div>
          <div className="text-gray-500">
            {new Date().toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone produits */}
        <div className="flex-1 flex flex-col p-4">
          {/* Recherche */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un produit... (F6)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Grille de produits */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingProducts ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Chargement...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Aucun produit</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
                      product.hasVariants ? "ring-2 ring-orange-400" : ""
                    }`}
                  >
                    <div className="aspect-square mb-2 relative">
                      {product.imageUrl ? (
                        <img
                          src={`${API_UPLOADS_URL}${product.imageUrl}`}
                          alt={product.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                          <ShoppingCart className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {(!product.inStock || product.stock <= 0) && (
                        <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                          <Badge variant="destructive">ÉPUISÉ</Badge>
                        </div>
                      )}
                      {product.inStock && product.stock > 0 && (
                        <Badge className="absolute top-1 right-1 bg-blue-500">
                          {product.stock}
                        </Badge>
                      )}
                      {/* Variant indicator */}
                      {product.hasVariants && (
                        <Badge className="absolute top-1 left-1 bg-orange-500">
                          Options
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-lg font-bold">
                      {formatPrice(product.price)}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panier */}
        <div className="w-96 bg-white border-l flex flex-col">
          {/* Header panier */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
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

          {/* Liste des articles */}
          <div className="flex-1 overflow-y-auto p-4">
            {cartItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Panier vide
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item) => {
                  // Extract base product ID from composite itemId
                  const baseProductId = item.itemId.split('_')[0];
                  const product = products.find((p) => p.id === baseProductId || p.id === item.itemId);
                  return (
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
                            disabled={
                              product && item.itemQuantity >= product.stock
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Résumé et paiement */}
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Total HT:</span>
              <span>{formatPrice(cartTotalExclTax)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>TVA:</span>
              <span>{formatPrice(cartVatTotal)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>TOTAL TTC:</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Button
              onClick={() => setShowPaymentModal(true)}
              disabled={cartItems.length === 0}
              className="w-full h-14 text-lg"
            >
              PAYER (F1)
            </Button>
          </div>
        </div>
      </div>
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
        }}
        onAddToCart={() => {
          toast({
            title: "Produit ajouté",
            description: "Le produit a été ajouté au panier",
          });
        }}
      />

      {/* Quick Scan Mode */}
      <QuickScanMode
        isOpen={showQuickScanMode}
        onClose={() => setShowQuickScanMode(false)}
        currencySymbol={currencySymbol}
      />

      {/* Cashier Dashboard Modal */}
      {cashier && (
        <CashierDashboardModal
          isOpen={showDashboardModal}
          onClose={() => setShowDashboardModal(false)}
          cashierId={cashier.id}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Modal Raccourcis */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Keyboard className="w-6 h-6" />
              Raccourcis Clavier
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="font-semibold text-lg mb-3 text-blue-600">
                  {category}
                </h3>
                <div className="grid gap-2">
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                    >
                      <span className="text-gray-700">
                        {shortcut.description}
                      </span>
                      <Badge variant="outline" className="font-mono">
                        {shortcut.key}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t text-sm text-gray-500 text-center">
            Appuyez sur F12 ou ESC pour fermer cette fenêtre
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Avertissement Clôture */}
      <Dialog open={showClosingWarning} onOpenChange={(open) => {
        if (!isClosing) {
          setShowClosingWarning(open);
          if (!open) setActualCash("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-orange-600">
              <AlertTriangle className="w-6 h-6" />
              Attention - Clôture de caisse requise
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-800">
                Pour retourner à l'accueil, vous devez d'abord clôturer votre session de caisse.
                Les données de clôture seront enregistrées.
              </p>
            </div>

            {/* Résumé de la session */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Résumé de la session</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Caissier:</span>
                    <span className="font-medium">{session?.cashier || `${cashier?.firstName} ${cashier?.lastName}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ouverture:</span>
                    <span className="font-medium">
                      {session?.openedAt ? new Date(session.openedAt).toLocaleTimeString("fr-FR") : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fond initial:</span>
                    <span className="font-medium">{(session?.initialAmount || 0).toFixed(2)} €</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nombre de ventes:</span>
                    <span className="font-medium">{session?.sales?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total ventes:</span>
                    <span className="font-medium text-green-600">{(session?.totalSales || 0).toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Encaissements */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Encaissements</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Espèces:</span>
                  <span className="font-medium">{(session?.totalCash || 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Carte bancaire:</span>
                  <span className="font-medium">{(session?.totalCard || 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Chèque:</span>
                  <span className="font-medium">{(session?.totalCheck || 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Virement:</span>
                  <span className="font-medium">{(session?.totalTransfer || 0).toFixed(2)} €</span>
                </div>
              </div>
            </Card>

            {/* Comptage des espèces */}
            <Card className="p-4 border-2 border-blue-200 bg-blue-50">
              <h3 className="font-semibold mb-3">Comptage des espèces</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="actualCashClosing">Montant total compté en espèces (€) *</Label>
                  <Input
                    id="actualCashClosing"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="mt-1 text-lg bg-white"
                    autoFocus
                  />
                </div>

                {actualCash && (
                  <div className="bg-white rounded p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Espèces attendues:</span>
                      <span className="font-semibold">{expectedCash.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Espèces comptées:</span>
                      <span className="font-semibold">{parseFloat(actualCash).toFixed(2)} €</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Écart:</span>
                      <span className={cashDifference === 0 ? "text-green-600" : "text-red-600"}>
                        {cashDifference > 0 ? "+" : ""}{cashDifference.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Boutons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowClosingWarning(false);
                  setActualCash("");
                }}
                disabled={isClosing}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={handleCloseRegisterAndGoHome}
                disabled={!actualCash || isClosing}
              >
                {isClosing ? "Clôture en cours..." : "Clôturer et quitter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
