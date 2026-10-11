import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, Plus, UtensilsCrossed, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addItem } from '../../store/slices/cartSlice';
import { useMoney } from '../../hooks/useMoney';
import { menuLabels } from '../../utils/menuLabels';
import { orderCopy } from '../../utils/orderCopy';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { toggleAddonSelection, unmetAddonGroups } from '../../utils/addonSelection';
import {
  comboCartChoices,
  comboDetail,
  comboReady,
  comboUnitPrice,
  optionOf,
  type ComboPick,
  type ComboPicks,
} from '../../utils/combo';
import { DISH_IMAGE } from '../../constants/image-shapes';
import type { ComboChoiceGroup, Product } from '../../types/Product';

interface ComboModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
}

/** A group with exactly one dish starts picked; the others start empty. */
function initialPicks(product: Product): ComboPicks {
  const picks: ComboPicks = {};
  for (const g of product.combo ?? []) {
    if (g.options.length === 1) {
      const o = g.options[0];
      picks[g.id] = { productId: o.id, variantId: o.variantTypes[0]?.variants[0]?.id, addonIds: [] };
    }
  }
  return picks;
}

/** The picked dish of a group, with its size and extras, as one short line ("Pomodoro · Rigatoni + Mozzarella"). */
function pickLine(o: Product, pick: ComboPick): string {
  const variant = o.variantTypes.flatMap((t) => t.variants).find((v) => v.id === pick.variantId);
  const showVariant = variant && o.variantTypes.some((t) => t.variants.length > 1);
  const extras = o.addons
    .flatMap((a) => a.options)
    .filter((x) => pick.addonIds.includes(x.id))
    .map((x) => x.label);
  return [o.label, showVariant ? variant.label : null].filter(Boolean).join(' · ') + (extras.length ? ` + ${extras.join(', ')}` : '');
}

/** Soft tint of the shop's accent colour, used behind selected tiles (same as the dish popup). */
const ACCENT_TINT = 'color-mix(in srgb, var(--brand-accent) 9%, white)';
const dishRatioStyle = { '--dish-ratio': DISH_IMAGE.ratio } as React.CSSProperties;

/**
 * ComboModal — picker for a combo ("Menü"): one dish per group, plus that dish's own size and extras.
 *
 * Same two shapes as the dish popup: a full-screen sheet on phones, a two-panel dialog from md up
 * (combo info and a live recap of the picks on the left, the numbered groups on the right).
 * Groups whose dishes have photos show photo tiles; the others show pills. The picked dish's
 * sizes and extras open right under its group. While a group is still open, the add button
 * stays muted; pressing it scrolls to the first open group and highlights it.
 * Sizes and extras that cost extra are added on top of the combo price. The combo goes into the
 * basket as one line; the server splits it into its dishes.
 */
const ComboModal: React.FC<ComboModalProps> = ({ product, isOpen, onClose, shopId }) => {
  const dispatch = useAppDispatch();
  const money = useMoney();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = orderCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const labels = menuLabels(product.language);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const urlParts =
    typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
  const effectiveShopId = shopId ?? urlParts[1];

  const [picks, setPicks] = useState<ComboPicks>(() => initialPicks(product));
  const [quantity, setQuantity] = useState(1);
  const [nudge, setNudge] = useState(false);

  // Reset on every open, as ProductModal does
  useEffect(() => {
    if (!isOpen) return;
    setPicks(initialPicks(product));
    setQuantity(1);
    setNudge(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // While open: lock page scroll, close on Escape, move focus into the dialog
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

  // Allergens and additives of every dish on offer in the combo
  const { allergens, additives } = useMemo(() => {
    const options = (product.combo ?? []).flatMap((g) => g.options);
    const byId = <T extends { id: string }>(list: T[]) => [...new Map(list.map((x) => [x.id, x])).values()];
    return {
      allergens: byId([...product.allergens, ...options.flatMap((o) => o.allergens)]),
      additives: byId([...product.additives, ...options.flatMap((o) => o.additives)]),
    };
  }, [product]);

  const groups = product.combo ?? [];
  const ready = comboReady(product, picks);
  const unit = comboUnitPrice(product, picks);

  /** A group is done once it has a dish and that dish's required extras are chosen. */
  function groupDone(g: ComboChoiceGroup): boolean {
    const pick = picks[g.id];
    const o = pick && optionOf(product, g.id, pick.productId);
    return !!o && unmetAddonGroups(o.addons, new Set(pick.addonIds)).length === 0;
  }
  const doneCount = groups.filter(groupDone).length;
  const openCount = groups.length - doneCount;

  function pickOption(groupId: string, o: Product) {
    setPicks((prev) =>
      prev[groupId]?.productId === o.id
        ? prev
        : { ...prev, [groupId]: { productId: o.id, variantId: o.variantTypes[0]?.variants[0]?.id, addonIds: [] } },
    );
  }

  function updatePick(groupId: string, change: Partial<ComboPick>) {
    setPicks((prev) => ({ ...prev, [groupId]: { ...prev[groupId], ...change } }));
  }

  function handleAdd() {
    if (!ready) {
      // Show where the gap is instead of doing nothing
      setNudge(true);
      const first = groups.find((g) => !groupDone(g));
      if (first) document.getElementById(`combo-group-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    dispatch(
      addItem({
        shopId: effectiveShopId,
        item: {
          id: product.id,
          name: product.label,
          imageUrl: product.imageURL,
          price: unit,
          quantity,
          comboChoices: comboCartChoices(product, picks),
          detail: comboDetail(product, picks),
        },
      }),
    );
    setQuantity(1);
    onClose();
  }

  if (!isOpen) return null;
  const canUseDom = typeof document !== 'undefined';

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

  const progress = (className: string) => (
    <div className={`items-center gap-1.5 ${className}`}>
      {groups.map((g) => (
        <span
          key={g.id}
          aria-hidden="true"
          className={`h-[5px] w-8 rounded-full ${groupDone(g) ? 'bg-[#2f8a4c]' : 'bg-[#ebe2d8]'}`}
        />
      ))}
      <span className="ml-1.5 whitespace-nowrap text-xs text-gray-500">
        {copy.comboProgress(doneCount, groups.length)}
      </span>
    </div>
  );

  const declaration = (
    <section className="flex flex-col gap-1.5 text-xs leading-relaxed text-gray-600">
      <p>
        <span className="font-semibold text-gray-700">{labels.allergens}:</span>{' '}
        {allergens.length ? allergens.map((a) => a.label).join(', ') : labels.noAllergens}
      </p>
      <p>
        <span className="font-semibold text-gray-700">{labels.additives}:</span>{' '}
        {additives.length ? additives.map((a) => `${a.code} ${a.label}`).join(', ') : labels.noAdditives}
      </p>
    </section>
  );

  const radioInput = (group: ComboChoiceGroup, o: Product, checked: boolean) => (
    <input
      type="radio"
      name={`combo-${group.id}`}
      aria-label={o.label}
      checked={checked}
      onChange={() => pickOption(group.id, o)}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
    />
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
        className="relative z-[1001] flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-gray-900 shadow-2xl focus:outline-none md:grid md:h-[min(760px,90vh)] md:max-w-[980px] md:grid-cols-[340px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)_auto] md:rounded-2xl"
      >
        {/* Phone: this wrapper is the single scroll area. md+: it dissolves (display: contents) into the grid. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:contents">
          {/* ── Combo info ── */}
          <aside className="border-b-8 border-[#f6f1eb] md:col-start-1 md:row-span-3 md:row-start-1 md:overflow-y-auto md:border-b-0 md:border-r md:border-r-[#efe7de] md:bg-[#faf6f1]">
            <div className="relative">
              {product.imageURL ? (
                <img
                  src={product.imageURL}
                  alt={product.label}
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
              <span className="absolute left-4 top-[22px] rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white md:top-4">
                {copy.comboBadge}
              </span>
              {closeButton('absolute right-4 top-4 flex bg-white shadow-md md:hidden')}
            </div>

            <div className="flex flex-col gap-3 px-5 pb-5 pt-5 md:px-7 md:pt-6">
              <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-start md:gap-2">
                <h2 id={titleId} className="font-display text-[28px] font-semibold leading-tight md:text-[32px]">
                  {product.label}
                </h2>
                <div className="whitespace-nowrap text-lg font-bold md:order-last md:text-[22px]">
                  {money.major(unit)}
                </div>
                {product.description && (
                  <p className="hidden text-[15px] leading-relaxed text-gray-600 md:block">{product.description}</p>
                )}
              </div>
              {product.description && (
                <p className="text-[15px] leading-relaxed text-gray-600 md:hidden">{product.description}</p>
              )}
              {progress('flex md:hidden')}

              {/* Live recap of the picks (md+) */}
              <div className="hidden flex-col border-t border-[#ebe2d8] pt-4 md:flex">
                <div className="pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">{copy.comboYours}</div>
                {groups.map((g) => {
                  const pick = picks[g.id];
                  const o = pick && optionOf(product, g.id, pick.productId);
                  const done = groupDone(g);
                  return (
                    <div key={g.id} className="flex items-start gap-2.5 py-1.5">
                      <span
                        aria-hidden="true"
                        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          done ? 'bg-[#2f8a4c] text-white' : 'border-[1.5px] border-dashed border-[#b9ada2]'
                        }`}
                      >
                        {done && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13px] text-gray-500">{g.label}</span>
                        <span className={`text-sm leading-snug ${o ? 'font-semibold text-gray-900' : 'italic text-gray-400'}`}>
                          {o ? pickLine(o, pick) : copy.comboNotChosen}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="md:border-t md:border-[#ebe2d8] md:pt-4">{declaration}</div>
            </div>
          </aside>

          {/* ── Groups header (md+ only) ── */}
          <div className="hidden items-center justify-between gap-4 border-b border-[#f1ebe4] px-7 py-3.5 md:col-start-2 md:row-start-1 md:flex">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[17px] font-bold">{copy.comboBuild}</span>
              {progress('flex')}
            </div>
            {closeButton('flex shrink-0 bg-[#f4efe9] hover:bg-[#ebe4dc]')}
          </div>

          {/* ── Groups ── */}
          <div className="md:col-start-2 md:row-start-2 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:px-7 md:py-5">
            {groups.map((group, index) => {
              const pick = picks[group.id];
              const chosen = pick ? optionOf(product, group.id, pick.productId) : undefined;
              const done = groupDone(group);
              const single = group.options.length === 1;
              const withPhotos = group.options.some((o) => o.imageURL);
              const isLast = index === groups.length - 1;
              const hasOwnOptions =
                !!chosen && (chosen.variantTypes.some((t) => t.variants.length > 1) || chosen.addons.length > 0);
              const tagText = done ? (single ? copy.comboIncluded : copy.comboChosen) : copy.comboPickOne;

              return (
                <fieldset
                  key={group.id}
                  id={`combo-group-${group.id}`}
                  className={`scroll-mt-4 px-5 py-5 md:mb-7 md:p-0 ${isLast ? 'pb-7' : 'border-b-8 border-[#f6f1eb] md:border-b-0'}`}
                >
                  <legend className="sr-only">{group.label}</legend>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? 'bg-[#2f8a4c] text-white' : 'bg-[#f4efe9] text-gray-700'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <h3 className="flex-1 text-base font-bold md:flex-none">{group.label}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        done
                          ? 'bg-[#e6f3ea] text-[#1d5a32]'
                          : `bg-[#fdeee6] text-[#a8380c] ${nudge ? 'ring-2 ring-[var(--brand-accent)]' : ''}`
                      }`}
                    >
                      {tagText}
                    </span>
                  </div>

                  {withPhotos ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {group.options.map((o) => {
                        const checked = pick?.productId === o.id;
                        return (
                          <label
                            key={o.id}
                            style={checked ? { backgroundColor: ACCENT_TINT } : undefined}
                            className={`relative flex min-h-[62px] items-center gap-3 rounded-xl border-[1.5px] py-2 pl-2 pr-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] ${
                              checked ? 'border-[var(--brand-accent)]' : 'border-[#ebe2d8] hover:border-gray-300'
                            }`}
                          >
                            {radioInput(group, o, checked)}
                            {o.imageURL ? (
                              <img src={o.imageURL} alt="" className="h-[42px] w-14 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="flex h-[42px] w-14 shrink-0 items-center justify-center rounded-lg bg-[#f6f1eb] text-[#b9ada2]">
                                <UtensilsCrossed className="h-[18px] w-[18px]" aria-hidden="true" />
                              </span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-sm font-semibold">{o.label}</span>
                              {o.description && <span className="truncate text-xs text-gray-500">{o.description}</span>}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`h-5 w-5 shrink-0 rounded-full ${
                                checked ? 'border-[6px] border-[var(--brand-accent)]' : 'border-[1.5px] border-gray-400'
                              }`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((o) => {
                        const checked = pick?.productId === o.id;
                        return (
                          <label
                            key={o.id}
                            className={`relative inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] has-[:focus-visible]:ring-offset-2 ${
                              checked ? 'border-gray-900 bg-gray-900 text-white' : 'border-[#e3d9ce] bg-white hover:border-gray-400'
                            }`}
                          >
                            {radioInput(group, o, checked)}
                            {o.label}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* The picked dish's own sizes and extras */}
                  {chosen && pick && hasOwnOptions && (
                    <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-[#efe7de] bg-[#faf6f1] p-4">
                      <div className="text-[13px] text-gray-600">
                        {copy.comboFor('')}
                        <strong className="text-gray-900">{chosen.label}</strong>
                      </div>
                      {chosen.variantTypes
                        .filter((vt) => vt.variants.length > 1)
                        .map((vt) => (
                          <div key={vt.id} className="flex flex-col gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{vt.label}</div>
                            <div className="flex flex-wrap gap-2">
                              {vt.variants.map((variant) => {
                                const on = pick.variantId === variant.id;
                                return (
                                  <button
                                    key={variant.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => updatePick(group.id, { variantId: variant.id })}
                                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${
                                      on ? 'border-gray-900 bg-gray-900 text-white' : 'border-[#e3d9ce] bg-white hover:border-gray-400'
                                    }`}
                                  >
                                    <span>{variant.label}</span>
                                    {variant.priceDelta ? (
                                      <span className="text-xs font-medium opacity-75">+{money.major(variant.priceDelta)}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      {chosen.addons.map((ag) => (
                        <div key={ag.id} className="flex flex-col gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                            {ag.label}
                            <span className="ml-1 font-medium normal-case tracking-normal">
                              ·{' '}
                              {ag.minSelectable > 0
                                ? orderCopy(product.language ?? '').addonChooseAtLeast(ag.minSelectable)
                                : copy.productOptional.toLowerCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {ag.options.map((option) => {
                              const on = pick.addonIds.includes(option.id);
                              return (
                                <label
                                  key={option.id}
                                  className={`relative flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] bg-white px-3 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] ${
                                    on ? 'border-[var(--brand-accent)]' : 'border-[#ebe2d8] hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() =>
                                      updatePick(group.id, {
                                        addonIds: [...toggleAddonSelection(chosen.addons, new Set(pick.addonIds), option.id)],
                                      })
                                    }
                                    className="sr-only"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] ${
                                      on
                                        ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-on-accent)]'
                                        : 'border-gray-400 bg-white'
                                    }`}
                                  >
                                    {on && <Check className="h-3 w-3" strokeWidth={3.5} />}
                                  </span>
                                  <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-[13px] font-semibold">{option.label}</span>
                                    <span className="text-xs text-gray-500">
                                      {option.priceDelta ? `+ ${money.major(option.priceDelta)}` : copy.productIncluded}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </div>

        {/* ── Pinned footer: state, quantity, add ── */}
        <div className="flex flex-col gap-2.5 border-t border-[#efe7de] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(0,0,0,0.05)] md:col-start-2 md:row-start-3 md:px-7 md:pb-[18px] md:shadow-none">
          <div aria-live="polite" className={`text-[13px] ${ready ? 'text-[#1d5a32]' : 'font-semibold text-[#a8380c]'}`}>
            {ready
              ? `${copy.comboComplete} ${copy.comboTotal(money.major(unit * quantity))}` +
                (quantity > 1 ? ` · ${copy.productPerItem(money.major(unit))}` : '')
              : copy.comboIncomplete}
          </div>

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

            {/* aria-disabled rather than disabled: a press while incomplete shows the open group */}
            <button
              type="button"
              onClick={handleAdd}
              aria-disabled={!ready}
              className={`flex h-[52px] min-w-0 flex-1 items-center justify-between gap-2 rounded-full px-5 text-[15px] font-bold transition-transform md:px-6 md:text-base ${
                ready
                  ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-sm active:scale-[0.98]'
                  : 'bg-[#efe9e2] text-[#6b6058]'
              }`}
            >
              {/* On narrow phones an incomplete combo shows only what's open; the label stays for screen readers */}
              <span className={`truncate ${ready ? '' : 'max-[420px]:sr-only'}`}>{copy.comboAdd}</span>
              <span className="shrink-0">{ready ? money.major(unit * quantity) : copy.comboOpen(openCount)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return canUseDom ? createPortal(modalContent, document.body) : modalContent;
};

export default ComboModal;
