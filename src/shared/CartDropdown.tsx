import React, { useEffect, useState } from 'react';
import { ArrowRight, Bike, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectCartItems,
  selectCartTotal,
  incrementItem,
  decrementItem,
  removeItem,
  clearCart,
} from '../store/slices/cartSlice';
import { useMoney } from '../hooks/useMoney';
import { orderCopy } from '../utils/orderCopy';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import type { FulfilmentMode } from '../store/slices/shopSlice';

/** What the shop page knows about how this order will be handed over, for the line at the top. */
export interface CartContext {
  mode: FulfilmentMode;
  /** Delivery only: the chosen postcode */
  postcode?: string | null;
  /** Delivery only, major units: the zone's minimum order and fee */
  minOrder?: number | null;
  fee?: number | null;
  /** Dine in only */
  table?: string | null;
  /** Prep (or delivery) time in minutes, if known */
  minutes?: number | null;
}

interface CartDropdownProps {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  /** Position below the cart button; ignored on phones, where the cart is a bottom sheet */
  style: React.CSSProperties;
  onClose: () => void;
  onCheckout?: () => void;
  context?: CartContext;
}

const PHONE_QUERY = '(max-width: 639px)';

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE_QUERY);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return !!phone;
}

/**
 * CartDropdown — the cart opened from the top bar.
 *
 * From sm up it is a card hanging below the cart button. On phones (where a 400px card would
 * spill off the screen) it is a bottom sheet over a dimmed page instead, with "Checkout" pinned.
 * Each line has a − / + stepper; at one item the − turns into a bin. Emptying the cart asks once,
 * inline. On delivery, a bar shows how far the order is from the zone's minimum.
 */
const CartDropdown: React.FC<CartDropdownProps> = ({ dropdownRef, style, onClose, onCheckout, context }) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const cartTotal = useAppSelector(selectCartTotal);
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = orderCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const money = useMoney();
  const phone = useIsPhone();
  const [askClear, setAskClear] = useState(false);

  const count = cartItems.reduce((n, i) => n + i.quantity, 0);
  const empty = cartItems.length === 0;

  // Close on Escape; on phones also keep the page behind the sheet still
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    let previousOverflow: string | undefined;
    if (phone) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow;
    };
  }, [onClose, phone]);

  const delivery = context?.mode === 'delivery';
  const minOrder = delivery ? (context?.minOrder ?? 0) : 0;
  const belowMin = minOrder > 0 && cartTotal < minOrder;

  let modeLine: { icon: React.ReactNode; text: string } | null = null;
  if (context?.mode === 'dine_in' && context.table) {
    modeLine = { icon: <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />, text: copy.cartTableLine(context.table) };
  } else if (delivery && context?.postcode) {
    modeLine = { icon: <Bike className="h-4 w-4" aria-hidden="true" />, text: copy.cartDeliveryLine(context.postcode, context.minutes ?? null) };
  } else if (context?.mode === 'collection') {
    modeLine = { icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />, text: copy.cartCollectionLine(context.minutes ?? null) };
  }

  const header = (
    <div className={`flex items-center justify-between ${phone ? 'px-5 pb-2.5 pt-2' : 'px-5 pb-3 pt-4'}`}>
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[22px] font-semibold">{copy.cartTitle}</h2>
        {!empty && <span className="text-[13px] text-gray-500">{copy.cartItems(count)}</span>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={copy.productClose}
        className={`flex items-center justify-center rounded-full bg-[#f4efe9] text-gray-700 hover:bg-[#ebe4dc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${phone ? 'h-11 w-11' : 'h-9 w-9'}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  const clearControl = askClear ? (
    <div className="flex items-center justify-center gap-2 text-[13px]">
      <span className="font-semibold text-gray-700">{copy.cartClearAsk}</span>
      <button
        type="button"
        onClick={() => {
          dispatch(clearCart());
          setAskClear(false);
        }}
        className="min-h-9 rounded-full px-3 font-semibold text-[#a8380c] hover:bg-[#fdeee6]"
      >
        {copy.cartClearYes}
      </button>
      <button
        type="button"
        onClick={() => setAskClear(false)}
        className="min-h-9 rounded-full px-3 font-semibold text-gray-600 hover:bg-gray-100"
      >
        {copy.basketKeep}
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setAskClear(true)}
      className={`self-center text-[13px] font-semibold text-gray-500 underline underline-offset-[3px] hover:text-gray-800 ${phone ? 'min-h-11' : 'min-h-9'}`}
    >
      {copy.cartClear}
    </button>
  );

  const lines = (
    <ul className={phone ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5' : 'max-h-[min(380px,calc(100vh-340px))] overflow-y-auto overscroll-contain px-5'}>
      {cartItems.map((item) => {
        const isOne = item.quantity <= 1;
        return (
          <li key={item.key} className="flex gap-3 border-b border-[#f1ebe4] py-3.5">
            <div className="flex h-[45px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f6f1eb]">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UtensilsCrossed className="h-5 w-5 text-[#b9ada2]" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[15px] font-bold">{item.name}</span>
                    {item.comboChoices?.length ? (
                      <span className="rounded-full bg-gray-900 px-[7px] py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                        {copy.comboBadge}
                      </span>
                    ) : null}
                  </div>
                  {item.detail && <span className="line-clamp-2 text-[13px] leading-snug text-gray-500">{item.detail}</span>}
                </div>
                <span className="whitespace-nowrap text-[15px] font-bold">{money.major(item.quantity * item.price)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className={`flex items-center rounded-full border border-[#e3d9ce] px-0.5 ${phone ? 'h-11' : 'h-9'}`}>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch(isOne ? removeItem({ key: item.key }) : decrementItem({ key: item.key }))
                    }
                    aria-label={isOne ? copy.basketRemoveItem(item.name) : copy.basketLess(item.name)}
                    className={`flex items-center justify-center rounded-full hover:bg-gray-100 ${phone ? 'h-10 w-10' : 'h-8 w-8'}`}
                  >
                    {isOne ? (
                      <Trash2 className="h-[15px] w-[15px]" aria-hidden="true" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                    )}
                  </button>
                  <span aria-live="polite" className="min-w-[22px] text-center text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch(incrementItem({ key: item.key }))}
                    aria-label={copy.basketMore(item.name)}
                    className={`flex items-center justify-center rounded-full hover:bg-gray-100 ${phone ? 'h-10 w-10' : 'h-8 w-8'}`}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
                {!isOne && <span className="text-xs text-gray-400">{copy.basketEach(money.major(item.price))}</span>}
              </div>
            </div>
          </li>
        );
      })}
      {phone && <li className="flex justify-center py-1.5">{clearControl}</li>}
    </ul>
  );

  const footer = (
    <div
      className={`flex flex-col gap-3 bg-white ${
        phone
          ? 'border-t border-[#efe7de] px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(0,0,0,0.05)]'
          : 'border-t border-[#efe7de] px-5 pb-[18px] pt-3.5'
      }`}
    >
      <div className={`flex items-baseline justify-between ${phone ? 'px-1' : ''}`}>
        <span className="text-[15px] font-semibold">{copy.cartSubtotal}</span>
        <span className="text-[17px] font-bold">{money.major(cartTotal)}</span>
      </div>
      {belowMin && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#f1ebe4]">
            <div
              className="h-full rounded-full bg-[var(--brand-accent)]"
              style={{ width: `${Math.min(100, Math.round((cartTotal / minOrder) * 100))}%` }}
            />
          </div>
          <span className="text-[13px] font-semibold text-[#a8380c]">
            {copy.cartMinLeft(money.major(minOrder - cartTotal), money.major(minOrder))}
          </span>
        </div>
      )}
      {delivery && !belowMin && (context?.fee ?? 0) > 0 && (
        <span className="text-xs text-gray-500">{copy.cartFeeNote(money.major(context!.fee!))}</span>
      )}
      <button
        type="button"
        onClick={() => {
          onClose();
          onCheckout?.();
        }}
        className="flex h-[52px] items-center justify-between gap-2 rounded-full bg-[var(--brand-accent)] px-[22px] text-base font-bold text-[var(--brand-on-accent)] shadow-sm transition-transform active:scale-[0.98]"
      >
        <span>{copy.cartCheckout}</span>
        <span className="flex items-center gap-2">
          {!phone && money.major(cartTotal)}
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
        </span>
      </button>
      {!phone && clearControl}
    </div>
  );

  const emptyState = (
    <div className={`flex flex-col items-center gap-2.5 text-center ${phone ? 'px-7 pb-10 pt-5' : 'px-7 pb-7 pt-4'}`}>
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#efe7de] bg-[#faf6f1] text-[#b9ada2]">
        <ShoppingBag className="h-[30px] w-[30px]" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="pt-1 text-[17px] font-bold">{copy.cartEmptyTitle}</div>
      <p className="max-w-[280px] text-sm leading-relaxed text-gray-500">{copy.cartEmptyText}</p>
      <button
        type="button"
        onClick={onClose}
        className={`mt-2 rounded-full border-[1.5px] border-gray-900 bg-white px-[22px] text-sm font-bold text-gray-900 hover:bg-gray-50 ${phone ? 'h-12' : 'h-11'}`}
      >
        {copy.cartToMenu}
      </button>
    </div>
  );

  const body = (
    <>
      {header}
      {empty ? (
        emptyState
      ) : (
        <>
          {modeLine && (
            <div className="mx-5 mb-1 flex items-center gap-2 rounded-[10px] bg-[#faf6f1] px-3 py-2 text-[13px] text-gray-700">
              {modeLine.icon}
              <span>{modeLine.text}</span>
            </div>
          )}
          {lines}
          {footer}
        </>
      )}
    </>
  );

  if (phone) {
    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/45" onClick={onClose} aria-hidden="true" />
        <div
          ref={dropdownRef}
          role="dialog"
          aria-modal="true"
          aria-label={copy.cartTitle}
          className={`fixed inset-x-0 bottom-0 z-[9999] flex flex-col rounded-t-[22px] bg-white text-gray-900 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] ${
            empty ? '' : 'h-[min(640px,85dvh)]'
          }`}
        >
          <div className="flex justify-center pb-0.5 pt-2.5" aria-hidden="true">
            <span className="h-[5px] w-10 rounded-full bg-[#ddd4ca]" />
          </div>
          {body}
        </div>
      </>
    );
  }

  return (
    <div ref={dropdownRef} role="dialog" aria-label={copy.cartTitle} style={style}>
      <div className="relative flex flex-col rounded-[20px] border border-[#efe7de] bg-white text-gray-900 shadow-[0_24px_60px_rgba(31,26,23,0.18),0_2px_8px_rgba(31,26,23,0.06)]">
        {/* Little pointer up to the cart button */}
        <span
          aria-hidden="true"
          className="absolute -top-[7px] right-[60px] h-3.5 w-3.5 rotate-45 border-l border-t border-[#efe7de] bg-white"
        />
        {body}
      </div>
    </div>
  );
};

export default CartDropdown;
