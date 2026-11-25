import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, Minus, Plus, UtensilsCrossed, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addItem, removeItem, selectCartCount } from '../../store/slices/cartSlice';
import { OPEN_CART_EVENT } from '../../constants/cart';
import { MAX_LINE_QUANTITY } from '../../utils/cartLimits';
import { useModalFocus } from '../../hooks/useModalFocus';
import { toCents } from '../../utils/money';
import { useMoney } from '../../hooks/useMoney';
import { useDismissClickGuard } from '../../hooks/useDismissClickGuard';
import { menuLabels } from '../../utils/menuLabels';
import { orderCopy } from '../../utils/orderCopy';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { groupExtrasByCategory, nextAction, planDish, toggleExtra, unmetRequired } from '../../utils/dishSteps';
import { DISH_IMAGE } from '../../constants/image-shapes';
import { chosenOptions, combinedDeclaration, optionsDeclareAnything } from '../../utils/declaration';
import type { CatalogAdditive, CatalogLabel } from '../../types/Product';

type VariantOption = {
  id: string;
  label: string;
  priceDelta?: number;
  imageURL?: string;
  allergens?: CatalogLabel[];
  additives?: CatalogAdditive[];
};
type VariantGroup = { id: string; label: string; variants: VariantOption[] };
type AddonOption = {
  id: string;
  label: string;
  priceDelta?: number;
  imageURL?: string;
  /** Heading the extra is grouped under; absent = its add-on group's name. */
  category?: string;
  allergens?: CatalogLabel[];
  additives?: CatalogAdditive[];
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
  /** Orders are paused: the dish can be looked at, not added */
  disabled?: boolean;
  // Edit mode — pre-fills selections and replaces the existing cart item on confirm
  editItemKey?: string;
  initialVariantId?: string;
  initialAddonIds?: string[];
  initialQuantity?: number;
}

/** Soft tint behind selected option tiles. */
const SELECTED_BG = '#f6f1e9';
const DESKTOP_QUERY = '(min-width: 768px)';

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return;
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

// The dish photo area is always 4:3 (the stored shape), on the desktop left panel and the phone header
const dishRatioStyle = { '--dish-ratio': DISH_IMAGE.ratio } as React.CSSProperties;

interface ChoiceRowProps {
  label: string;
  price: string;
  checked: boolean;
  multi: boolean;
  blocked?: boolean;
  name: string;
  onChange: () => void;
}

/** One option as a full-width row: round radio for single choice, square checkbox for multiple. */
const ChoiceRow: React.FC<ChoiceRowProps> = ({ label, price, checked, multi, blocked, name, onChange }) => (
  <label
    className={`flex min-h-[48px] items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-1.5 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] ${
      checked ? 'border-gray-900' : 'border-[#e3d9ce] bg-white hover:border-gray-400'
    } ${blocked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
    style={checked ? { backgroundColor: SELECTED_BG } : undefined}
  >
    <input
      type={multi ? 'checkbox' : 'radio'}
      name={name}
      checked={checked}
      disabled={blocked}
      onChange={onChange}
      className="sr-only"
    />
    <span
      aria-hidden="true"
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} ${
        checked ? 'border-gray-900' : 'border-gray-500'
      } ${multi && checked ? 'bg-gray-900' : 'bg-white'}`}
    >
      {checked &&
        (multi ? (
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-gray-900" />
        ))}
    </span>
    <span className="min-w-0 flex-1 text-[15px] font-semibold">{label}</span>
    <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-gray-700">{price}</span>
  </label>
);

/**
 * ProductModal — product detail and customisation overlay.
 *
 * One component, two shapes:
 * - Desktop (md and up), and any dish with no required choice: a one-page dialog. Dish info on the left;
 *   on the right the required choices, then an "Add extras" row that opens the extras grouped by
 *   category. The add button carries the price and says what to do next until the required choice is made.
 * - Phone, for a dish with a required choice: a guided sheet. Step 1 required choices (and a size, if any),
 *   step 2 extras (skipped when the dish has none), step 3 review with Change links and quantity,
 *   then an "Added to your order" confirmation.
 *
 * Required add-on groups (min picks > 0) have no default; variants default to their first option.
 * Rendered via createPortal to document.body so it overlays the full viewport.
 */
const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  shopId,
  disabled,
  editItemKey,
  initialVariantId: initialVariantIdProp,
  initialAddonIds: initialAddonIdsProp,
  initialQuantity: initialQuantityProp,
}) => {
  const dispatch = useAppDispatch();
  const money = useMoney();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const cartCount = useAppSelector(selectCartCount);
  const copy = orderCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const labels = menuLabels(product.language);
  const titleId = useId();
  const isDesktop = useIsDesktop();
  // Focus trap, scroll lock and Escape-to-close live in useModalFocus. Escape calls onClose directly,
  // so a keyboard close never arms the click guard below.
  const dialogRef = useModalFocus(isOpen, onClose);
  const guardDismissClick = useDismissClickGuard();
  const scrollRef = useRef<HTMLDivElement>(null);
  // When the confirmation appeared: the stray second click of a double-click must not hit its buttons
  const addedAt = useRef(0);

  // Pointer closes arm the click guard first, so a double-click's stray second click cannot hit the
  // page underneath. Escape does not arm it: a keyboard close is not followed by a second click.
  const dismiss = useCallback(() => {
    guardDismissClick();
    onClose();
  }, [onClose, guardDismissClick]);

  // Fall back to the slug segment from the URL if shopId is not provided
  const urlParts =
    typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
  const effectiveShopId = shopId ?? urlParts[1];

  // Only the first size group is priced and stored (the cart line holds a single variantId)
  const plan = useMemo(
    () => planDish(product.addons, product.variantTypes?.slice(0, 1)),
    [product.addons, product.variantTypes],
  );
  const variantGroup = plan.variants[0];
  const defaultVariantId = variantGroup?.variants[0]?.id;
  const wizard = !isDesktop && plan.guided;
  // Wizard steps: pick, extras (only when the dish has extras), review
  const stepKeys = useMemo(
    () => ['pick', ...(plan.extras.length > 0 ? ['extras'] : []), 'review'] as const,
    [plan.extras.length],
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    initialVariantIdProp ?? defaultVariantId,
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(
    new Set(initialAddonIdsProp ?? []),
  );
  const [quantity, setQuantity] = useState<number>(initialQuantityProp ?? 1);
  const [stepIdx, setStepIdx] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [done, setDone] = useState(false);

  // Reset selections to the incoming initial values each time the modal opens.
  // useState initialises only once on mount, so toggling isOpen without
  // unmounting the component would show stale selections without this effect.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedVariantId(initialVariantIdProp ?? defaultVariantId);
    setSelectedAddonIds(new Set(initialAddonIdsProp ?? []));
    setQuantity(initialQuantityProp ?? 1);
    // Editing a cart line on a phone starts on the review step
    setStepIdx(editItemKey ? stepKeys.length - 1 : 0);
    setNudge(false);
    setExtrasOpen(false);
    setDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const stepKey = stepKeys[Math.min(stepIdx, stepKeys.length - 1)];

  // Each step starts at the top
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [stepIdx, done]);

  // Flat lookup maps for fast variant/addon option access by ID
  const variantLookup = useMemo(() => {
    const map = new Map<string, VariantOption>();
    product.variantTypes?.forEach((group) => group.variants.forEach((v) => map.set(v.id, v)));
    return map;
  }, [product]);

  const addonLookup = useMemo(() => {
    const map = new Map<string, AddonOption>();
    product.addons?.forEach((group) => group.options.forEach((o) => map.set(o.id, o)));
    return map;
  }, [product]);

  // Unit price = base price + selected variant delta + sum of selected addon deltas.
  // All values are in major units (already converted from cents by mapApiProductToProduct).
  const unitPrice = useMemo(() => {
    const base = product.price || 0;
    const variantDelta = selectedVariantId ? variantLookup.get(selectedVariantId)?.priceDelta || 0 : 0;
    const addonsDelta = Array.from(selectedAddonIds).reduce(
      (sum, id) => sum + (addonLookup.get(id)?.priceDelta || 0),
      0,
    );
    return +(base + variantDelta + addonsDelta).toFixed(2);
  }, [product.price, selectedVariantId, selectedAddonIds, variantLookup, addonLookup]);

  const allGroups = product.addons ?? [];
  const toggleAddon = (id: string) => setSelectedAddonIds((prev) => toggleExtra(allGroups, prev, id));

  const unmet = unmetRequired(plan, selectedAddonIds);
  const firstUnmet = unmet[0];
  const showNudge = nudge && unmet.length > 0;
  const extrasChosen = plan.extras.flatMap((g) => g.options).filter((o) => selectedAddonIds.has(o.id));
  const extraSections = useMemo(() => groupExtrasByCategory(plan.extras), [plan.extras]);
  const extrasTotal = extrasChosen.reduce((sum, o) => sum + (o.priceDelta || 0), 0);

  const declaration = useMemo(
    () => combinedDeclaration(product, chosenOptions(product, selectedVariantId, selectedAddonIds)),
    [product, selectedVariantId, selectedAddonIds],
  );
  const declarationVaries = useMemo(() => optionsDeclareAnything(product), [product]);

  const chosenIn = <O extends { id: string }>(g: { options: O[] }): O[] =>
    g.options.filter((o) => selectedAddonIds.has(o.id));
  const chosenVariant = selectedVariantId ? variantLookup.get(selectedVariantId) : undefined;
  const variantIsDefault = !variantGroup || selectedVariantId === defaultVariantId;

  // One-line recap of the current choices
  const summaryParts: string[] = [
    ...plan.required.flatMap((g) => chosenIn(g).map((o) => o.label)),
    ...(chosenVariant && !variantIsDefault ? [chosenVariant.label] : []),
    ...extrasChosen.map((o) => o.label),
  ];
  const summary = summaryParts.join(' · ');

  function commit() {
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
          price: toCents(unitPrice),
          quantity,
          variantId: selectedVariantId,
          addonOptionIds: Array.from(selectedAddonIds),
        },
      }),
    );
    onAddToCart?.({
      id: product.id,
      name: product.label,
      unitPrice,
      quantity,
      variantId: selectedVariantId,
      addonOptionIds: Array.from(selectedAddonIds),
    });
    if (editItemKey) {
      dismiss();
    } else {
      addedAt.current = Date.now();
      setDone(true);
    }
  }

  /** The required choice is missing: say so and bring it into view. */
  function demandRequired() {
    setNudge(true);
    if (wizard) setStepIdx(0);
    document.getElementById('dish-required')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  function tryAdd() {
    if (disabled) return;
    if (unmet.length > 0) {
      demandRequired();
      return;
    }
    commit();
  }

  const justAdded = () => Date.now() - addedAt.current < 600;

  function continueOrdering() {
    if (justAdded()) return;
    setQuantity(1);
    dismiss();
  }

  function viewCart() {
    if (justAdded()) return;
    setQuantity(1);
    dismiss();
    window.dispatchEvent(new Event(OPEN_CART_EVENT));
  }

  function goNext() {
    if (stepKey === 'pick' && unmet.length > 0) {
      setNudge(true);
      return;
    }
    setStepIdx((i) => Math.min(stepKeys.length - 1, i + 1));
  }

  if (!isOpen) return null;
  const canUseDom = typeof document !== 'undefined';

  const { allergens, additives } = declaration;
  const hasOptions = plan.variants.length > 0 || (product.addons?.length ?? 0) > 0;
  const requiredLabel = firstUnmet?.label ?? plan.required[0]?.label ?? '';
  const priceOf = (delta?: number) => (delta ? `+ ${money.major(delta)}` : copy.productIncluded);

  const closeButton = (className: string) => (
    <button
      type="button"
      onClick={dismiss}
      aria-label={copy.productClose}
      className={`h-11 w-11 items-center justify-center rounded-full text-gray-800 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${className}`}
    >
      <X className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  const requiredBadge = (hot: boolean, text: string) => (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        hot ? 'bg-orange-800 text-white' : 'bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] text-orange-900'
      }`}
    >
      {text}
    </span>
  );

  const declarationBlock = (
    <section className="flex flex-col gap-1.5 text-[13px] leading-[19px] text-gray-600">
      <p>
        <span className="font-semibold text-gray-900">{labels.allergens}:</span>{' '}
        <span data-testid="dish-allergens">
          {allergens.length ? allergens.map((a) => a.label).join(', ') : labels.noAllergens}
        </span>
      </p>
      <p>
        <span className="font-semibold text-gray-900">{labels.additives}:</span>{' '}
        <span data-testid="dish-additives">
          {additives.length ? additives.map((a) => `${a.code} ${a.label}`).join(', ') : labels.noAdditives}
        </span>
      </p>
      {declarationVaries && (
        <p data-testid="dish-declaration-varies" className="text-gray-500">
          {labels.variesWithOptions}
        </p>
      )}
    </section>
  );

  const quantityStepper = (
    <div
      role="group"
      aria-label={copy.productQuantity}
      className="flex h-14 shrink-0 items-center rounded-full border-[1.5px] border-gray-400 px-1"
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
      <span aria-live="polite" className="min-w-[28px] text-center text-lg font-bold">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
        disabled={quantity >= MAX_LINE_QUANTITY}
        aria-label={copy.productIncrease}
        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );

  const accentButton = 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)]';
  const outlineButton = 'border-2 border-[var(--brand-accent)] bg-white text-[var(--brand-accent)]';
  const doneButtons = (
    <div className="flex flex-col gap-2.5 md:flex-row md:gap-3">
      <button
        type="button"
        onClick={continueOrdering}
        className={`h-14 rounded-full px-6 text-[17px] font-bold md:flex-1 ${accentButton}`}
      >
        {copy.dishContinueOrdering}
      </button>
      <button
        type="button"
        onClick={viewCart}
        className="h-[52px] rounded-full border-[1.5px] border-gray-400 bg-white px-6 text-base font-semibold text-gray-900 md:h-14 md:flex-1"
      >
        {copy.dishViewCart(cartCount)}
      </button>
    </div>
  );

  const doneText = `${quantity} × ${product.label}${summary ? ` · ${summary}` : ''}`;

  // ── Extras: grouped by category, shown as checkbox rows ──
  const extrasList = (columns: boolean) => (
    <div className="flex flex-col gap-5">
      {extraSections.map((section) => (
        <div key={section.label} className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-600">{section.label}</div>
          <div className={columns ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2'}>
            {section.options.map((option) => {
              const group = plan.extras.find((g) => g.id === option.groupId)!;
              const checked = selectedAddonIds.has(option.id);
              const full = group.maxSelectable > 1 && chosenIn(group).length >= group.maxSelectable;
              return (
                <ChoiceRow
                  key={option.id}
                  name={`addon-${group.id}`}
                  label={option.label}
                  price={priceOf(option.priceDelta)}
                  checked={checked}
                  multi={group.maxSelectable !== 1}
                  blocked={full && !checked}
                  onChange={() => toggleAddon(option.id)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Required choice and size ──
  const requiredGroups = (pills: boolean) => (
    <>
      {plan.required.map((group) => {
        const multi = group.maxSelectable !== 1;
        const groupUnmet = unmet.some((g) => g.id === group.id);
        const hot = showNudge && groupUnmet;
        return (
          <fieldset key={group.id} id={group === plan.required[0] ? 'dish-required' : undefined} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <legend className="float-left text-[17px] font-bold md:text-[17px] max-md:text-[22px]">{group.label}</legend>
              {requiredBadge(hot, copy.productRequired)}
              <span className="ml-auto text-[13px] text-gray-600">
                {multi ? copy.productChooseUpTo(group.maxSelectable) : copy.productChooseOne}
              </span>
            </div>
            {hot && (
              <p role="alert" className="text-sm font-semibold text-orange-800">
                {copy.dishPleaseChoose(group.label)}
              </p>
            )}
            {pills && !multi ? (
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const checked = selectedAddonIds.has(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-5 text-[15px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] has-[:focus-visible]:ring-offset-2 ${
                        checked
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : `${hot ? 'border-orange-800' : 'border-gray-400'} bg-white text-gray-900 hover:border-gray-600`
                      }`}
                    >
                      <input
                        type="radio"
                        name={`addon-${group.id}`}
                        checked={checked}
                        onChange={() => toggleAddon(option.id)}
                        className="sr-only"
                      />
                      <span>{option.label}</span>
                      {option.priceDelta ? (
                        <span className={`text-[13px] font-medium ${checked ? 'text-gray-300' : 'text-gray-600'}`}>
                          {priceOf(option.priceDelta)}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {group.options.map((option) => {
                  const checked = selectedAddonIds.has(option.id);
                  const full = multi && chosenIn(group).length >= group.maxSelectable;
                  return (
                    <ChoiceRow
                      key={option.id}
                      name={`addon-${group.id}`}
                      label={option.label}
                      price={option.priceDelta ? priceOf(option.priceDelta) : ''}
                      checked={checked}
                      multi={multi}
                      blocked={full && !checked}
                      onChange={() => toggleAddon(option.id)}
                    />
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </>
  );

  const variantSection = (grid: boolean) =>
    variantGroup ? (
      <fieldset id="dish-variant" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <legend className="float-left text-[17px] font-bold">{variantGroup.label}</legend>
          <span className="text-[13px] text-gray-600">{copy.productOptional}</span>
        </div>
        <div className={grid ? 'grid grid-cols-3 gap-2.5' : 'flex flex-col gap-2'}>
          {variantGroup.variants.map((variant) => (
            <ChoiceRow
              key={variant.id}
              name={`variant-${variantGroup.id}`}
              label={variant.label}
              price={priceOf(variant.priceDelta)}
              checked={selectedVariantId === variant.id}
              multi={false}
              onChange={() => setSelectedVariantId(variant.id)}
            />
          ))}
        </div>
      </fieldset>
    ) : null;

  // ── Review rows (wizard step 3) ──
  const reviewRows = [
    ...plan.required.map((g) => {
      const picked = chosenIn(g);
      const sum = picked.reduce((s, o) => s + (o.priceDelta || 0), 0);
      return { label: g.label, value: picked.map((o) => o.label).join(', ') || '—', price: priceOf(sum), step: 0 };
    }),
    ...(variantGroup && chosenVariant
      ? [{ label: variantGroup.label, value: chosenVariant.label, price: priceOf(chosenVariant.priceDelta), step: 0 }]
      : []),
    ...(plan.extras.length > 0
      ? [
          {
            label: copy.dishStepExtras,
            value: extrasChosen.length ? extrasChosen.map((o) => o.label).join(', ') : copy.dishNone,
            price: extrasChosen.length ? `+ ${money.major(extrasTotal)}` : '',
            step: 1,
          },
        ]
      : []),
  ];

  const dishThumb = (size: string, radius: string) =>
    product.imageURL ? (
      <img src={product.imageURL} alt={product.label} className={`${size} ${radius} shrink-0 object-cover`} />
    ) : (
      <div className={`${size} ${radius} flex shrink-0 items-center justify-center bg-[#f6f1eb] text-gray-400`}>
        <UtensilsCrossed className="h-8 w-8" aria-hidden="true" />
      </div>
    );

  // ════════════════ Phone: guided steps ════════════════
  if (wizard) {
    const stepNames: Record<string, string> = {
      pick: copy.dishStepYour(plan.required[0]?.label ?? ''),
      extras: copy.dishStepExtras,
      review: copy.dishStepReview,
    };
    const action = nextAction(
      stepKey === 'pick' ? 1 : stepKey === 'extras' ? 2 : 3,
      unmet.length,
      extrasChosen.length,
    );
    const mainLabel =
      action === 'choose' ? copy.dishChooseYour(requiredLabel) : action === 'skip' ? copy.dishSkipExtras : copy.dishNext;

    const wizardContent = (
      <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45">
        <div className="absolute inset-0" onClick={dismiss} aria-hidden="true" />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="relative z-[1001] flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-gray-900 shadow-2xl focus:outline-hidden"
        >
          <header className="flex h-16 shrink-0 items-center gap-1 px-3">
            {stepIdx > 0 && !done ? (
              <button
                type="button"
                aria-label={copy.dishBack}
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
            ) : (
              <div className="w-2" />
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-[17px] font-bold leading-[22px]">
                {product.label}
              </h2>
              {!done && (
                <div className="text-[13px] leading-[18px] text-gray-600">
                  {copy.dishStepOf(stepIdx + 1, stepKeys.length, stepNames[stepKey])}
                </div>
              )}
            </div>
            {closeButton('flex bg-[#f3ece1]')}
          </header>

          {!done && (
            <div className="flex shrink-0 gap-1.5 px-5 pb-3" aria-hidden="true">
              {stepKeys.map((k, i) => (
                <div key={k} className={`h-1 flex-1 rounded-full ${i <= stepIdx ? 'bg-gray-900' : 'bg-[#e6d9c6]'}`} />
              ))}
            </div>
          )}

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain border-t border-[#f1e7d8] px-5 pb-8 pt-5">
            {done ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 pt-6 text-center">
                {dishThumb('h-[140px] w-[140px]', 'rounded-3xl')}
                <div className="-mt-10 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white bg-[#3f5b3a]">
                  <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-bold leading-[30px]">{copy.dishAdded}</h3>
                <p className="max-w-[300px] text-[15px] leading-[22px] text-gray-600">{doneText}</p>
              </div>
            ) : stepKey === 'pick' ? (
              <>
                {requiredGroups(false)}
                {variantSection(false)}
                {declarationBlock}
              </>
            ) : stepKey === 'extras' ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[22px] font-bold leading-7">{copy.dishAnythingExtra}</h3>
                    <span className="text-[13px] text-gray-600">{copy.productOptional}</span>
                  </div>
                  <p className="text-sm text-gray-600">{copy.dishTapToAdd}</p>
                </div>
                {extrasList(false)}
              </>
            ) : (
              <>
                <h3 className="text-[22px] font-bold leading-7">{copy.dishReviewTitle}</h3>
                <div className="flex items-center gap-3.5">
                  {dishThumb('h-[84px] w-[84px]', 'rounded-2xl')}
                  <div>
                    <div className="text-lg font-bold">{product.label}</div>
                    <div className="text-sm text-gray-600">{copy.dishPerDish(money.major(unitPrice))}</div>
                  </div>
                </div>
                <div className="flex flex-col">
                  {reviewRows.map((row) => (
                    <div key={row.label} className="flex items-start gap-3 border-t border-[#f1e7d8] py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-600">{row.label}</span>
                        <span className="text-[15px] font-semibold">{row.value}</span>
                        <button
                          type="button"
                          onClick={() => setStepIdx(row.step)}
                          className="min-h-11 self-start text-sm font-semibold text-[var(--brand-accent)] underline"
                        >
                          {copy.dishChange}
                        </button>
                      </div>
                      <span className="text-sm font-semibold">{row.price}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#f1e7d8] pt-3">{declarationBlock}</div>
              </>
            )}
          </div>

          <footer className="shrink-0 border-t border-[#e6d9c6] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
            {done ? (
              doneButtons
            ) : stepKey === 'review' ? (
              <div className="flex items-center gap-2.5">
                {quantityStepper}
                <button
                  type="button"
                  onClick={tryAdd}
                  disabled={disabled}
                  className={`flex h-14 min-w-0 flex-1 items-center justify-between rounded-full px-5 text-[17px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${accentButton}`}
                >
                  <span>{editItemKey ? copy.productUpdateOrder : copy.productAddToOrder}</span>
                  <span>{money.major(unitPrice * quantity)}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex min-w-[72px] shrink-0 flex-col">
                  <span className="text-xs text-gray-600">{copy.dishTotal}</span>
                  <span className="text-[22px] font-bold leading-7">{money.major(unitPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={goNext}
                  className={`h-14 flex-1 rounded-full px-5 text-[17px] font-bold ${action === 'choose' ? outlineButton : `border-2 border-[var(--brand-accent)] ${accentButton}`}`}
                >
                  {mainLabel}
                </button>
              </div>
            )}
          </footer>
        </div>
      </div>
    );
    return canUseDom ? createPortal(wizardContent, document.body) : wizardContent;
  }

  // ════════════════ One page: desktop, and dishes with no required choice ════════════════
  const addLabel =
    unmet.length > 0
      ? copy.dishChooseYour(requiredLabel)
      : editItemKey
        ? copy.productUpdateOrder
        : copy.productAddToOrder;
  let footerLine = summary;
  if (done) footerLine = `${copy.dishAdded} · ${doneText}`;
  else if (unmet.length > 0) footerLine = showNudge ? copy.dishPleaseChoose(requiredLabel) : copy.dishStartByChoosing(requiredLabel);

  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  const navItem = (id: string, label: string, value: string, hot = false) => (
    <button
      type="button"
      onClick={() => jumpTo(id)}
      className="flex min-w-0 flex-1 flex-col gap-px rounded-xl px-3 py-1.5 text-left hover:bg-[#faf6f0]"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-600">{label}</span>
      <span className={`truncate text-sm font-semibold ${hot ? 'text-orange-800' : ''}`}>{value}</span>
    </button>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-black/45" onClick={dismiss} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-[1001] flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-gray-900 shadow-2xl focus:outline-hidden md:grid md:rounded-2xl ${
          hasOptions
            ? 'md:h-[min(720px,90vh)] md:max-w-[1040px] md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-[auto_auto_minmax(0,1fr)_auto]'
            : 'md:max-h-[90vh] md:max-w-[480px] md:grid-cols-[1fr] md:grid-rows-[minmax(0,1fr)_auto]'
        }`}
      >
        {/* Phone: this wrapper is the single scroll area. md+: it dissolves (display: contents) into the grid. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:contents">
          {/* ── Dish info ── */}
          <aside
            className={`border-b-8 border-[#f6f1eb] md:col-start-1 md:row-start-1 md:overflow-y-auto md:border-b-0 ${
              hasOptions ? 'md:row-span-4 md:bg-[#faf6f0]' : ''
            }`}
          >
            <div className="relative">
              {product.imageURL ? (
                <img
                  src={product.imageURL}
                  alt={product.label}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-[var(--dish-ratio)] w-full object-cover"
                  style={dishRatioStyle}
                />
              ) : (
                <div
                  className="flex aspect-[var(--dish-ratio)] w-full items-center justify-center bg-[#f6f1eb] text-gray-400"
                  style={dishRatioStyle}
                >
                  <UtensilsCrossed className="h-10 w-10" aria-hidden="true" />
                </div>
              )}
              {/* Without an options header, the close button stays on the photo on desktop too */}
              {closeButton(`absolute right-4 top-4 flex bg-white shadow-md ${hasOptions ? 'md:hidden' : ''}`)}
            </div>

            <div className="flex flex-col gap-3 px-5 pb-5 pt-5 md:px-7 md:pt-6">
              <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-start md:gap-2">
                <h2 id={titleId} className="text-[28px] font-bold leading-tight md:text-[32px]">
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
              <div className="md:mt-1 md:border-t md:border-[#e6d9c6] md:pt-4">{declarationBlock}</div>
            </div>
          </aside>

          {hasOptions && (
            <>
              {/* ── Options header (md+ only; phones use the floating close button) ── */}
              <div className="hidden items-center justify-between px-7 py-3.5 md:col-start-2 md:row-start-1 md:flex">
                <span className="text-lg font-bold">{copy.productCustomise}</span>
                {closeButton('flex bg-[#f3ece1] hover:bg-[#ebe4dc]')}
              </div>

              {/* ── Jump strip (md+, dishes with a required choice) ── */}
              {plan.guided && (
                <nav
                  aria-label={copy.productCustomise}
                  className="hidden gap-2 border-y border-[#f1e7d8] px-5 py-2 md:col-start-2 md:row-start-2 md:flex"
                >
                  {navItem(
                    'dish-required',
                    `1 · ${plan.required[0].label}`,
                    unmet.length === 0 ? chosenIn(plan.required[0]).map((o) => o.label).join(', ') : copy.productChooseOne,
                    unmet.length > 0,
                  )}
                  {variantGroup && navItem('dish-variant', `2 · ${variantGroup.label}`, chosenVariant?.label ?? '')}
                  {plan.extras.length > 0 &&
                    navItem(
                      'dish-extras',
                      `${variantGroup ? 3 : 2} · ${copy.dishStepExtras}`,
                      extrasChosen.length ? copy.productSelected(extrasChosen.length) : copy.dishNone,
                    )}
                </nav>
              )}

              {/* ── Options ── */}
              <div className="flex flex-col gap-7 px-5 py-6 md:col-start-2 md:row-start-3 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:px-7">
                {requiredGroups(isDesktop)}
                {variantSection(isDesktop)}

                {plan.extras.length > 0 && (
                  <div id="dish-extras" className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => setExtrasOpen((o) => !o)}
                      aria-expanded={extrasOpen}
                      className="flex min-h-16 w-full items-center gap-3 rounded-[14px] border-[1.5px] border-[#e6d9c6] bg-white px-4 py-2.5 text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="flex items-center gap-2.5">
                          <span className="text-[17px] font-bold">{copy.dishAddExtras}</span>
                          <span className="text-[13px] text-gray-600">{copy.productOptional}</span>
                        </span>
                        <span className="truncate text-[13px] text-gray-600">
                          {extrasChosen.length
                            ? extrasChosen.map((o) => o.label).join(', ')
                            : extraSections.map((s) => s.label).join(', ')}
                        </span>
                      </span>
                      {extrasChosen.length > 0 && (
                        <span className="min-w-6 rounded-full bg-gray-900 px-2 text-center text-[13px] font-semibold leading-6 text-white">
                          {extrasChosen.length}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 transition-transform ${extrasOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {extrasOpen && extrasList(isDesktop)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Pinned footer: recap, quantity, add ── */}
        <div
          className={`flex flex-col gap-2.5 border-t border-[#e6d9c6] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(0,0,0,0.05)] ${
            hasOptions ? 'md:col-start-2 md:row-start-4' : 'md:col-start-1 md:row-start-2'
          } md:px-7 md:pb-5 md:shadow-none`}
        >
          {footerLine && (
            <div
              className={`truncate text-[13px] ${showNudge && !done ? 'font-semibold text-orange-800' : 'text-gray-600'}`}
              role={showNudge && !done ? 'alert' : undefined}
            >
              {footerLine}
            </div>
          )}
          {done ? (
            doneButtons
          ) : (
            <div className="flex items-center gap-2.5 md:gap-3">
              {quantityStepper}
              <button
                type="button"
                onClick={tryAdd}
                disabled={disabled}
                className={`flex h-14 min-w-0 flex-1 items-center rounded-full px-6 text-[17px] font-bold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                  unmet.length > 0 ? `justify-center ${outlineButton}` : `justify-between border-2 border-[var(--brand-accent)] ${accentButton}`
                }`}
              >
                <span>{addLabel}</span>
                {unmet.length === 0 && <span>{money.major(unitPrice * quantity)}</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return canUseDom ? createPortal(modalContent, document.body) : modalContent;
};

export default ProductModal;
