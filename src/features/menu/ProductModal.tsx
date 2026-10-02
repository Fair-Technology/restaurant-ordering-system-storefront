import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../shared/Button';
import TickCheckbox from '../../shared/TickCheckbox';
import { useAppDispatch } from '../../store/hooks';
import { addItem, removeItem } from '../../store/slices/cartSlice';
import { useMoney } from '../../hooks/useMoney';
import { menuLabels } from '../../utils/menuLabels';
import { orderCopy } from '../../utils/orderCopy';
import { toggleAddonSelection, unmetAddonGroups } from '../../utils/addonSelection';
import type { CatalogAdditive, CatalogLabel } from '../../types/Product';

type VariantOption = {
  id: string;
  label: string;
  priceDelta?: number;
  imageURL?: string;
};
type VariantGroup = { id: string; label: string; variants: VariantOption[] };
type AddonOption = {
  id: string;
  label: string;
  priceDelta?: number;
  imageURL?: string;
};
type AddonGroup = {
  id: string;
  label: string;
  minSelectable: number;
  maxSelectable: number;
  options: AddonOption[];
};

export type Product = {
  id: string;
  label: string;
  imageURL?: string;
  description?: string;
  price: number;
  variantTypes?: VariantGroup[];
  addons?: AddonGroup[];
  allergens?: CatalogLabel[];
  additives?: CatalogAdditive[];
  dietaryTags?: CatalogLabel[];
  spice?: CatalogLabel | null;
  language?: string;
};

interface ProductModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (payload: any) => void;
  shopId?: string; // Used to scope cart storage to the correct shop
  // Edit mode — pre-fills selections and replaces the existing cart item on confirm
  editItemKey?: string;
  initialVariantId?: string;
  initialAddonIds?: string[];
  initialQuantity?: number;
}

/**
 * ProductModal — Full product detail overlay.
 *
 * Manages selection of variant (single-select) and addons (multi-select),
 * quantity, and price calculation before dispatching to the Redux cart.
 *
 * Rendered via createPortal to document.body so it overlays the full viewport
 * regardless of the parent component's stacking context.
 */
const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  shopId,
  editItemKey,
  initialVariantId: initialVariantIdProp,
  initialAddonIds: initialAddonIdsProp,
  initialQuantity: initialQuantityProp,
}) => {
  const dispatch = useAppDispatch();
  const money = useMoney();

  // Fall back to the slug segment from the URL if shopId is not provided
  const urlParts =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean)
      : [];
  const effectiveShopId = shopId ?? urlParts[1];

  const defaultVariantId = product.variantTypes?.[0]?.variants?.[0]?.id;
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    initialVariantIdProp ?? defaultVariantId,
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(
    new Set(initialAddonIdsProp ?? []),
  );
  const [quantity, setQuantity] = useState<number>(initialQuantityProp ?? 1);

  // Reset selections to the incoming initial values each time the modal opens.
  // useState initialises only once on mount, so toggling isOpen without
  // unmounting the component would show stale selections without this effect.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedVariantId(initialVariantIdProp ?? defaultVariantId);
    setSelectedAddonIds(new Set(initialAddonIdsProp ?? []));
    setQuantity(initialQuantityProp ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Flat lookup maps for fast variant/addon option access by ID
  const variantLookup = useMemo(() => {
    const map = new Map<string, VariantOption>();
    product.variantTypes?.forEach((group) =>
      group.variants.forEach((variant) => map.set(variant.id, variant))
    );
    return map;
  }, [product]);

  const addonLookup = useMemo(() => {
    const map = new Map<string, AddonOption>();
    product.addons?.forEach((group) =>
      group.options.forEach((option) => map.set(option.id, option))
    );
    return map;
  }, [product]);

  // Unit price = base price + selected variant delta + sum of selected addon deltas.
  // All values are in dollars (already converted from cents by mapApiProductToProduct).
  const unitPrice = useMemo(() => {
    const base = product.price || 0;
    const variantDelta = selectedVariantId
      ? variantLookup.get(selectedVariantId)?.priceDelta || 0
      : 0;
    const addonsDelta = Array.from(selectedAddonIds).reduce(
      (sum, id) => sum + (addonLookup.get(id)?.priceDelta || 0),
      0
    );
    return +(base + variantDelta + addonsDelta).toFixed(2);
  }, [product.price, selectedVariantId, selectedAddonIds, variantLookup, addonLookup]);

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => toggleAddonSelection(product.addons ?? [], prev, id));
  }

  const addonsIncomplete = unmetAddonGroups(product.addons ?? [], selectedAddonIds).length > 0;

  function handleAddToCart() {
    // In edit mode, remove the old cart item before adding the updated one
    if (editItemKey) {
      dispatch(removeItem({ key: editItemKey }));
    }
    dispatch(
      addItem({
        shopId: effectiveShopId,
        item: {
          id: product.id,
          name: product.label,
          imageUrl: product.imageURL,
          price: unitPrice,
          quantity,
          variantId: selectedVariantId,
          addonOptionIds: Array.from(selectedAddonIds),
        },
      })
    );
    const payload = {
      id: product.id,
      name: product.label,
      unitPrice,
      quantity,
      variantId: selectedVariantId,
      addonOptionIds: Array.from(selectedAddonIds),
    };
    onAddToCart?.(payload);
    setQuantity(1);
    onClose();
  }

  if (!isOpen) return null;
  const canUseDom = typeof document !== 'undefined';

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="relative z-[1001] bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">{product.label}</h3>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
            <img
              src={product.imageURL || 'https://via.placeholder.com/320x240'}
              alt={product.label}
              className="w-full h-48 object-cover rounded"
            />
          </div>

          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-4">{product.description}</p>

            {/* Dietary tag and spiciness chips */}
            {((product.dietaryTags?.length ?? 0) > 0 || product.spice) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {product.dietaryTags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700"
                  >
                    {tag.label}
                  </span>
                ))}
                {product.spice && (
                  <span className="rounded-full px-2 py-0.5 text-xs bg-orange-100 text-orange-700">
                    {product.spice.label}
                  </span>
                )}
              </div>
            )}

            {/* Mandatory allergen and additive declaration */}
            {(() => {
              const labels = menuLabels(product.language);
              const allergens = product.allergens ?? [];
              const additives = product.additives ?? [];
              return (
                <section className="mb-4 text-xs text-gray-600">
                  <p>
                    <span className="font-semibold">{labels.allergens}:</span>{' '}
                    {allergens.length
                      ? allergens.map((a) => a.label).join(', ')
                      : labels.noAllergens}
                  </p>
                  <p>
                    <span className="font-semibold">{labels.additives}:</span>{' '}
                    {additives.length
                      ? additives.map((a) => `${a.code} ${a.label}`).join(', ')
                      : labels.noAdditives}
                  </p>
                </section>
              );
            })()}

            {/* Variant groups — single select per group */}
            {product.variantTypes?.map((group) => (
              <div key={group.id} className="mb-3">
                <div className="font-medium text-sm mb-2">{group.label}</div>
                <div className="flex gap-2 flex-wrap">
                  {group.variants.map((variant) => (
                    <label
                      key={variant.id}
                      className={`px-3 py-1 border rounded cursor-pointer text-sm ${
                        selectedVariantId === variant.id
                          ? 'border-gray-900 bg-gray-50'
                          : 'bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`variant-${group.id}`}
                        value={variant.id}
                        checked={selectedVariantId === variant.id}
                        onChange={() => setSelectedVariantId(variant.id)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <span>{variant.label}</span>
                        {variant.priceDelta ? (
                          <span className="text-xs text-gray-500">
                            +{money.major(variant.priceDelta)}
                          </span>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Addon groups — multi-select using TickCheckbox */}
            {product.addons?.map((group) => (
              <div key={group.id} className="mb-3">
                <div className="font-medium text-sm mb-2">
                  {group.label}
                  {group.minSelectable > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {orderCopy(product.language ?? '').addonChooseAtLeast(group.minSelectable)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {group.options.map((option) => (
                    <TickCheckbox
                      key={option.id}
                      checked={selectedAddonIds.has(option.id)}
                      onChange={() => toggleAddon(option.id)}
                      label={option.label}
                      hint={
                        option.priceDelta
                          ? `+ ${money.major(option.priceDelta)}`
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center border rounded">
                <button
                  className="px-3 py-1 text-lg"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  -
                </button>
                <div className="px-4">{quantity}</div>
                <button
                  className="px-3 py-1 text-lg"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>

              <div className="ml-auto text-right">
                <div className="text-sm text-gray-500">Unit</div>
                <div className="text-xl font-semibold">
                  {money.major(unitPrice)}
                </div>
                <div className="text-sm text-gray-500">
                  Total {money.major(unitPrice * quantity)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button className="flex-1" onClick={handleAddToCart} disabled={addonsIncomplete}>
                {editItemKey ? 'Update Order' : 'Add To Order'}
              </Button>
              <Button variant="outline" className="px-4" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return canUseDom ? createPortal(modalContent, document.body) : modalContent;
};

export default ProductModal;
