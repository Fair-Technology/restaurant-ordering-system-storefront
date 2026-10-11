import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, Plus, UtensilsCrossed, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addItem, removeItem } from '../../store/slices/cartSlice';
import { useMoney } from '../../hooks/useMoney';
import { menuLabels } from '../../utils/menuLabels';
import { orderCopy } from '../../utils/orderCopy';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
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
  regularPrice?: number;
  offerLabel?: string;
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

/** Soft tint of the shop's accent colour, used behind selected option tiles. */
const ACCENT_TINT = 'color-mix(in srgb, var(--brand-accent) 9%, white)';

/**
 * ProductModal — product detail and customisation overlay.
 *
 * Layout (one component, two shapes):
 * - Phone: a full-screen sheet. Photo, dish info and all options scroll as one page;
 *   the quantity + add button bar stays pinned at the bottom.
 * - md and up: a two-panel dialog. Dish info on the left, a scrolling options column
 *   on the right with a pinned header and footer.
 *
 * Variant groups are single-select chips. Addon groups render as option rows/tiles:
 * round radio indicators for single-choice groups (max 1), square checkboxes otherwise.
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
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = orderCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const labels = menuLabels(product.language);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

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

  // While open: lock page scroll behind the sheet, close on Escape, move focus into the dialog
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

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
  // All values are in major units (already converted from cents by mapApiProductToProduct).
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

  const unmetGroups = unmetAddonGroups(product.addons ?? [], selectedAddonIds);
  const addonsIncomplete = unmetGroups.length > 0;

  // One-line recap of the current choices, shown above the add button
  const summary = useMemo(() => {
    const parts: string[] = [];
    const variant = selectedVariantId ? variantLookup.get(selectedVariantId) : undefined;
    if (variant && (product.variantTypes?.[0]?.variants.length ?? 0) > 1) parts.push(variant.label);
    const addonNames = Array.from(selectedAddonIds)
      .map((id) => addonLookup.get(id)?.label)
      .filter(Boolean);
    if (addonNames.length) parts.push(`+ ${addonNames.join(', ')}`);
    return parts.join(' · ');
  }, [selectedVariantId, selectedAddonIds, variantLookup, addonLookup, product.variantTypes]);

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

  const allergens = product.allergens ?? [];
  const additives = product.additives ?? [];
  const hasOptions = (product.variantTypes?.length ?? 0) > 0 || (product.addons?.length ?? 0) > 0;

  const closeButton = (className: string) => (
    <button
      type="button"
      onClick={onClose}
      aria-label={copy.productClose}
      className={`h-11 w-11 items-center justify-center rounded-full text-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${className}`}
    >
      <X className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  const sectionHeading = (title: string, badge: React.ReactNode) => (
    <div className="mb-3 flex items-center justify-between gap-3 md:justify-start">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {badge}
    </div>
  );

  const requiredBadge = (text: string) => (
    <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] px-2.5 py-0.5 text-xs font-semibold text-gray-900">
      {text}
    </span>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-[1001] flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-gray-900 shadow-2xl focus:outline-none md:grid md:h-[min(720px,90vh)] md:max-w-[980px] md:grid-cols-[340px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)_auto] md:rounded-2xl"
      >
        {/* Phone: this wrapper is the single scroll area. md+: it dissolves (display: contents) into the grid. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:contents">
          {/* ── Dish info ── */}
          <aside className="border-b-8 border-[#f6f1eb] md:col-start-1 md:row-span-3 md:row-start-1 md:overflow-y-auto md:border-b-0 md:border-r md:border-r-[#efe7de] md:bg-[#faf6f1]">
            <div className="relative">
              {product.imageURL ? (
                <img
                  src={product.imageURL}
                  alt={product.label}
                  className="block h-60 w-full object-cover md:h-[280px]"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-[#f6f1eb] text-gray-400 md:h-[280px]">
                  <UtensilsCrossed className="h-10 w-10" aria-hidden="true" />
                </div>
              )}
              {closeButton('absolute right-4 top-4 flex bg-white shadow-md md:hidden')}
            </div>

            <div className="flex flex-col gap-3 px-5 pb-5 pt-5 md:px-7 md:pt-6">
              <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-start md:gap-2">
                <h2 id={titleId} className="text-[28px] font-bold leading-tight md:text-3xl">
                  {product.label}
                </h2>
                <div className="whitespace-nowrap text-lg font-bold md:text-xl">
                  {product.regularPrice !== undefined && (
                    <span className="mr-1.5 text-sm font-normal text-gray-500 line-through">
                      {money.major(product.regularPrice + (unitPrice - product.price))}
                    </span>
                  )}
                  {money.major(unitPrice)}
                </div>
              </div>

              {product.description && (
                <p className="text-[15px] leading-relaxed text-gray-600">{product.description}</p>
              )}

              {((product.dietaryTags?.length ?? 0) > 0 || product.spice) && (
                <div className="flex flex-wrap gap-1.5">
                  {product.dietaryTags?.map((tag) => (
                    <span key={tag.id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                      {tag.label}
                    </span>
                  ))}
                  {product.spice && (
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs text-orange-800">
                      {product.spice.label}
                    </span>
                  )}
                </div>
              )}

              {/* Mandatory allergen and additive declaration */}
              <section className="flex flex-col gap-2 text-xs text-gray-600 md:mt-1 md:border-t md:border-[#ebe2d8] md:pt-4">
                <p>
                  <span className="font-semibold text-gray-700">{labels.allergens}:</span>{' '}
                  <span>
                    {allergens.length ? allergens.map((a) => a.label).join(', ') : labels.noAllergens}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-gray-700">{labels.additives}:</span>{' '}
                  {additives.length
                    ? additives.map((a) => `${a.code} ${a.label}`).join(', ')
                    : labels.noAdditives}
                </p>
              </section>
            </div>
          </aside>

          {/* ── Options header (md+ only; phones use the floating close button) ── */}
          <div className="hidden items-center justify-between border-b border-[#f1ebe4] px-7 py-3.5 md:col-start-2 md:row-start-1 md:flex">
            <span className="text-[17px] font-bold">{hasOptions ? copy.productCustomise : product.label}</span>
            {closeButton('flex bg-[#f4efe9] hover:bg-[#ebe4dc]')}
          </div>

          {/* ── Options ── */}
          <div className="md:col-start-2 md:row-start-2 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:px-7 md:py-5">
            {/* Variant groups — single select per group, shown as chips */}
            {product.variantTypes?.map((group) => (
              <fieldset
                key={group.id}
                className="border-b-8 border-[#f6f1eb] px-5 py-5 md:mb-6 md:border-b-0 md:p-0"
              >
                <legend className="sr-only">{group.label}</legend>
                {sectionHeading(group.label, requiredBadge(copy.productRequired))}
                <div className="flex flex-wrap gap-2">
                  {group.variants.map((variant) => {
                    const selected = selectedVariantId === variant.id;
                    return (
                      <label
                        key={variant.id}
                        className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] has-[:focus-visible]:ring-offset-2 ${
                          selected
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-[#e3d9ce] bg-white text-gray-900 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`variant-${group.id}`}
                          value={variant.id}
                          checked={selected}
                          onChange={() => setSelectedVariantId(variant.id)}
                          className="sr-only"
                        />
                        <span>{variant.label}</span>
                        {variant.priceDelta ? (
                          <span className="text-xs font-medium opacity-75">
                            +{money.major(variant.priceDelta)}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {/* Addon groups — rows on phones, two-column tiles on md+ */}
            {product.addons?.map((group, index) => {
              const single = group.maxSelectable === 1;
              const chosenCount = group.options.filter((o) => selectedAddonIds.has(o.id)).length;
              const full = !single && chosenCount >= group.maxSelectable;
              const isLast = index === (product.addons?.length ?? 0) - 1;

              let badge: React.ReactNode;
              if (group.minSelectable > 0) {
                badge = requiredBadge(
                  single ? copy.productChooseOne : orderCopy(product.language ?? '').addonChooseAtLeast(group.minSelectable),
                );
              } else {
                const limit =
                  group.maxSelectable < group.options.length && !single
                    ? ` · ${copy.productChooseUpTo(group.maxSelectable)}`
                    : '';
                badge = (
                  <span className="text-xs text-gray-500">
                    {copy.productOptional}
                    {limit}
                    {chosenCount > 0 ? ` · ${copy.productSelected(chosenCount)}` : ''}
                  </span>
                );
              }

              return (
                <fieldset
                  key={group.id}
                  className={`px-5 pb-3 pt-5 md:mb-6 md:p-0 ${isLast ? 'pb-6' : 'border-b-8 border-[#f6f1eb] md:border-b-0'}`}
                >
                  <legend className="sr-only">{group.label}</legend>
                  {sectionHeading(group.label, badge)}
                  <div className="grid grid-cols-1 md:grid-cols-2 md:gap-2">
                    {group.options.map((option) => {
                      const checked = selectedAddonIds.has(option.id);
                      const blocked = full && !checked;
                      return (
                        <label
                          key={option.id}
                          style={checked ? { backgroundColor: ACCENT_TINT } : undefined}
                          className={`flex min-h-[52px] items-center gap-3.5 border-b border-[#f1ebe4] text-[15px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] md:rounded-xl md:border-[1.5px] md:px-3.5 md:py-2.5 md:text-sm ${
                            checked
                              ? 'md:border-[var(--brand-accent)] max-md:!bg-transparent'
                              : 'md:border-[#ebe2d8] md:hover:border-gray-300'
                          } ${blocked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                        >
                          <input
                            type={single && group.minSelectable > 0 ? 'radio' : 'checkbox'}
                            name={`addon-${group.id}`}
                            checked={checked}
                            disabled={blocked}
                            onChange={() => toggleAddon(option.id)}
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center border-[1.5px] md:h-5 md:w-5 ${
                              single ? 'rounded-full' : 'rounded-md'
                            } ${
                              checked
                                ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-on-accent)]'
                                : 'border-gray-400 bg-white'
                            }`}
                          >
                            {checked &&
                              (single ? (
                                <span className="h-2 w-2 rounded-full bg-[var(--brand-on-accent)]" />
                              ) : (
                                <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                              ))}
                          </span>
                          <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                          <span className="whitespace-nowrap text-sm text-gray-600 md:font-semibold">
                            {option.priceDelta ? `+ ${money.major(option.priceDelta)}` : copy.productIncluded}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>

        {/* ── Pinned footer: recap, quantity, add ── */}
        <div className="flex flex-col gap-2.5 border-t border-[#efe7de] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(0,0,0,0.05)] md:col-start-2 md:row-start-3 md:px-7 md:pb-[18px] md:shadow-none">
          {(summary || addonsIncomplete || quantity > 1) && (
            <div className="flex items-baseline justify-between gap-3 text-[13px] text-gray-600">
              <span className="min-w-0 truncate">
                {addonsIncomplete
                  ? copy.productStillToChoose(unmetGroups.map((g) => g.label).join(', '))
                  : summary}
              </span>
              {quantity > 1 && (
                <span className="shrink-0 whitespace-nowrap">{copy.productPerItem(money.major(unitPrice))}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5 md:gap-3.5">
            <div
              role="group"
              aria-label={copy.productQuantity}
              className="flex h-[52px] items-center rounded-full border border-[#e3d9ce] px-0.5"
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label={copy.productDecrease}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Minus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </button>
              <span aria-live="polite" className="min-w-[24px] text-center text-[17px] font-bold">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label={copy.productIncrease}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addonsIncomplete}
              className="flex h-[52px] min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-[var(--brand-accent)] px-5 text-[15px] font-bold text-[var(--brand-on-accent)] shadow-sm transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:text-base"
            >
              <span className="truncate">{editItemKey ? copy.productUpdateOrder : copy.productAddToOrder}</span>
              <span className="shrink-0">{money.major(unitPrice * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return canUseDom ? createPortal(modalContent, document.body) : modalContent;
};

export default ProductModal;
