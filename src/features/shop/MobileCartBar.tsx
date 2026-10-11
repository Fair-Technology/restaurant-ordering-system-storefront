import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { selectCartCount, selectCartTotal } from '../../store/slices/cartSlice';
import { useMoney } from '../../hooks/useMoney';
import type { OrderCopy } from '../../utils/orderCopy';

interface MobileCartBarProps {
  onCheckout: () => void;
  copy: OrderCopy;
}

/**
 * MobileCartBar — floating "View cart" pill pinned to the bottom of the shop page on phones
 * (hidden from sm up, where the nav bar's cart is close at hand). Shown only once the cart
 * holds something.
 */
const MobileCartBar: React.FC<MobileCartBarProps> = ({ onCheckout, copy }) => {
  const count = useAppSelector(selectCartCount);
  const total = useAppSelector(selectCartTotal);
  const money = useMoney();
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 sm:hidden">
      <button
        type="button"
        onClick={onCheckout}
        className="flex h-14 w-full items-center justify-between gap-3 rounded-full bg-gray-900 pl-5 pr-2 text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(31,26,23,0.28)] active:scale-[0.99]"
      >
        <span className="truncate">{copy.viewCart}</span>
        <span className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--brand-accent)] px-4 text-[var(--brand-on-accent)]">
          <span>{copy.cartItems(count)}</span>
          <span aria-hidden="true">·</span>
          <span>{money.major(total)}</span>
        </span>
      </button>
    </div>
  );
};

export default MobileCartBar;
