import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_UPLOADS_URL } from "@/lib/api.config";
import { ClientProduct } from "@/models/client/client-product-detail-model";
import { addToCart, CartOption, SelectedVariantInfo } from "@/redux/slices/cartSlice";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

interface ProductVariantModalProps {
  product: ClientProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: () => void;
  preselectedVariantId?: string; // For barcode scanning - preselect variant
}

export function ProductVariantModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  preselectedVariantId,
}: Readonly<ProductVariantModalProps>) {
  const dispatch = useDispatch();
  const currencySymbol = useSelector(
    (state: any) => state.storeCurrency.currencySymbol
  );

  const [quantity, setQuantity] = useState(1);
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<{
    [key: string]: string;
  }>({});
  const [variantErrors, setVariantErrors] = useState<{
    [key: string]: boolean;
  }>({});
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Reset state when modal opens with a new product
  useEffect(() => {
    if (isOpen && product) {
      setQuantity(1);
      setSelectedSupplements([]);
      setCurrentPrice(product.basePrice || 0);

      // Initialize variant errors and handle preselected variant
      if (product.variants && product.variants.length > 0) {
        const initialErrors: { [key: string]: boolean } = {};
        const initialVariants: { [key: string]: string } = {};

        product.variants.forEach((group, index) => {
          // Check if preselectedVariantId matches any option in this group
          if (preselectedVariantId) {
            const matchingOption = group.options.find(
              (opt) => opt.variantId === preselectedVariantId
            );
            if (matchingOption) {
              initialVariants[index] = matchingOption.variantId;
              initialErrors[index] = false;
              // Update price to the variant price
              setCurrentPrice(matchingOption.variantPrice);
            } else {
              initialErrors[index] = true;
            }
          } else {
            initialErrors[index] = true;
          }
        });

        setSelectedVariants(initialVariants);
        setVariantErrors(initialErrors);
      } else {
        setSelectedVariants({});
        setVariantErrors({});
      }
    }
  }, [isOpen, product, preselectedVariantId]);

  const toggleSupplement = (supplementId: string) => {
    setSelectedSupplements((prev) =>
      prev.includes(supplementId)
        ? prev.filter((id) => id !== supplementId)
        : [...prev, supplementId]
    );
  };

  const handleVariantSelect = (groupIdIndex: number, optionId: string) => {
    setSelectedVariants((prev) => {
      const newSelectedVariants: any = { ...prev, [groupIdIndex]: optionId };

      updatePriceBasedOnVariants(newSelectedVariants);

      if (product?.variants) {
        const newVariantErrors = { ...variantErrors };

        product.variants.forEach((_, index) => {
          if (!newSelectedVariants[index]) {
            newVariantErrors[index] = true;
          } else {
            newVariantErrors[index] = false;
          }
        });

        setVariantErrors(newVariantErrors);
      }

      return newSelectedVariants;
    });
  };

  const updatePriceBasedOnVariants = (variants: { [key: string]: string }) => {
    if (!product?.variants || product.variants.length === 0) {
      setCurrentPrice(product?.basePrice || 0);
      return;
    }

    if (Object.keys(variants).length === 0) {
      setCurrentPrice(product.basePrice || 0);
      return;
    }

    const firstSelectedVariant = Object.values(variants)[0];
    const variantGroup = product.variants.find((group) =>
      group.options.some((option) => option.variantId === firstSelectedVariant)
    );

    const selectedOption = variantGroup?.options.find(
      (option) => option.variantId === firstSelectedVariant
    );

    if (selectedOption && selectedOption.variantPrice !== undefined) {
      setCurrentPrice(selectedOption.variantPrice);
    } else {
      setCurrentPrice(product.basePrice || 0);
    }
  };

  const areAllVariantsSelected = (): boolean => {
    if (!product?.variants || product.variants.length === 0) return true;
    return product.variants.every((_, index) => selectedVariants[index]);
  };

  const canAddToCart = (): boolean => {
    if (product?.inStock === false) return false;
    if (product?.variants && product.variants.length > 0) {
      return areAllVariantsSelected();
    }
    return true;
  };

  const calculateTotal = (): number => {
    if (!product) return 0;

    let total = currentPrice;

    // Add supplements prices
    selectedSupplements.forEach((id) => {
      if (!product?.optionGroups) return;

      const group = product.optionGroups.find((g) =>
        g.options.some((opt) => opt.optionId === id)
      );
      const option = group?.options.find((opt) => opt.optionId === id);
      if (option && option.optionPrice) {
        total += option.optionPrice;
      }
    });

    return total * quantity;
  };

  const handleAddToCart = () => {
    if (!product || !canAddToCart()) return;

    // Prepare options (supplements)
    const cartOptions: CartOption[] = [];
    selectedSupplements.forEach((supplementId) => {
      if (!product?.optionGroups) return;

      const group = product.optionGroups.find((g) =>
        g.options.some((opt) => opt.optionId === supplementId)
      );
      const option = group?.options.find(
        (opt) => opt.optionId === supplementId
      );
      if (option) {
        cartOptions.push({
          optionId: option.optionId,
          optionName: option.optionName,
          optionPrice: option.optionPrice,
        });
      }
    });

    // Build complete variant info for all selected variants
    const selectedVariantInfos: SelectedVariantInfo[] = [];

    if (product.variants && product.variants.length > 0) {
      Object.entries(selectedVariants).forEach(([groupIndex, variantId]) => {
        const group = product.variants![parseInt(groupIndex)];
        if (group) {
          const option = group.options.find(opt => opt.variantId === variantId);
          if (option) {
            selectedVariantInfos.push({
              variantId: option.variantId,
              variantName: group.variantName,
              variantValue: option.variantValue,
              variantPrice: option.variantPrice,
              variantSku: option.sku,
              variantBarcode: option.barcode,
            });
          }
        }
      });
    }

    // For backward compatibility, also set the first variant ID
    const firstSelectedVariantId = selectedVariantInfos.length > 0
      ? selectedVariantInfos[0].variantId
      : undefined;

    dispatch(
      addToCart({
        product,
        quantity,
        options: cartOptions,
        selectedVariantId: firstSelectedVariantId,
        selectedVariants: selectedVariantInfos,
      })
    );

    onAddToCart();
    onClose();
  };

  const formatPrice = (price: number) => {
    const symbol = currencySymbol || "€";
    return `${price.toFixed(2)} ${symbol}`;
  };

  const productImage =
    product?.mediasUrls && product?.mediasUrls.length > 0
      ? `${API_UPLOADS_URL}${product.mediasUrls[0]}`
      : null;

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {product.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product image and basic info */}
          <div className="flex gap-4">
            {productImage && (
              <div className="w-24 h-24 flex-shrink-0">
                <img
                  src={productImage}
                  alt={product.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">{product.description}</p>
              <p className="text-xl font-bold text-blue-600">
                {formatPrice(currentPrice)}
              </p>
            </div>
          </div>

          {/* Variants Selection */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">
                Choisissez une option:
              </h3>
              {product.variants.map((variantGroup, index) => (
                <div key={index}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-700">
                      {variantGroup.variantName}
                    </span>
                    {variantErrors[index] && (
                      <span className="text-sm text-red-500">* Requis</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {variantGroup.options.map((option) => {
                      const isSelected =
                        selectedVariants[index] === option.variantId;
                      const isOutOfStock = !option.inStock;

                      return (
                        <Card
                          key={option.variantId}
                          onClick={() =>
                            !isOutOfStock &&
                            handleVariantSelect(index, option.variantId)
                          }
                          className={`cursor-pointer p-3 flex items-center justify-between transition ${
                            isOutOfStock
                              ? "opacity-50 cursor-not-allowed bg-gray-100"
                              : isSelected
                              ? "bg-blue-50 border-blue-600 ring-2 ring-blue-600"
                              : variantErrors[index]
                              ? "border-red-300 bg-red-50 hover:border-red-400"
                              : "border-gray-200 hover:border-blue-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? "bg-blue-600 border-blue-600"
                                  : "border-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium">
                              {option.variantValue}
                            </span>
                          </div>
                          <span className="font-semibold text-blue-600">
                            {formatPrice(option.variantPrice)}
                          </span>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Supplements */}
          {product.optionGroups && product.optionGroups.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">
                Suppléments (optionnels)
              </h3>
              {product.optionGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  <span className="font-medium text-gray-700 mb-2 block">
                    {group.name}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((option) => {
                      const isSelected = selectedSupplements.includes(
                        option.optionId
                      );
                      const isOutOfStock = !option.inStock;

                      return (
                        <Card
                          key={option.optionId}
                          onClick={() =>
                            !isOutOfStock && toggleSupplement(option.optionId)
                          }
                          className={`cursor-pointer p-3 flex items-center justify-between transition ${
                            isOutOfStock
                              ? "opacity-50 cursor-not-allowed bg-gray-100"
                              : isSelected
                              ? "bg-blue-50 border-blue-600 ring-1 ring-blue-600"
                              : "border-gray-200 hover:border-blue-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? "bg-blue-600 border-blue-600"
                                  : "border-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span>{option.optionName}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            +{formatPrice(option.optionPrice)}
                          </span>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quantity */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Quantité</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="h-10 w-10"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-20 text-center h-10"
                min="1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(quantity + 1)}
                disabled={product.inStock === false}
                className="h-10 w-10"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Total and Add to Cart */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total:</span>
              <span className="text-blue-600">{formatPrice(calculateTotal())}</span>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleAddToCart}
              disabled={!canAddToCart()}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              {!canAddToCart()
                ? product.inStock === false
                  ? "Rupture de stock"
                  : "Sélectionnez une option"
                : "Ajouter au panier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductVariantModal;
