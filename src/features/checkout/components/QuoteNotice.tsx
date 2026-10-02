import React from 'react';
import type { QuoteLineDto } from '../../../api/orderEndpoints';
import type { CartItem } from '../../../store/slices/cartSlice';
import type { OrderCopy } from '../../../utils/orderCopy';

interface QuoteNoticeProps {
  lines: QuoteLineDto[];
  cartItems: CartItem[];
  copy: OrderCopy;
  formatCents: (cents: number) => string;
  onUpdate: () => void;
}

/** Lists every basket line the server flagged, with one button to accept the changes. */
const QuoteNotice: React.FC<QuoteNoticeProps> = ({ lines, cartItems, copy, formatCents, onUpdate }) => {
  const flagged = lines.filter((l) => l.status !== 'ok');
  if (flagged.length === 0) return null;

  const sentence = (l: QuoteLineDto): string => {
    const name = l.name ?? cartItems[l.index]?.name ?? '';
    if (l.status === 'unavailable') return copy.lineUnavailable(name);
    if (l.status === 'invalid_options') return copy.lineInvalidOptions(name);
    return copy.linePriceChanged(
      name,
      formatCents(l.unitPriceCents ?? 0),
      formatCents(l.expectedUnitPriceCents ?? 0),
    );
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-2">
      <p className="font-semibold">{copy.basketChangedTitle}</p>
      <ul className="list-disc pl-5 space-y-1">
        {flagged.map((l) => (
          <li key={l.index}>{sentence(l)}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onUpdate}
        className="rounded-lg bg-amber-900 px-3 py-1.5 text-white text-sm font-medium hover:opacity-90"
      >
        {copy.updateBasket}
      </button>
    </div>
  );
};

export default QuoteNotice;
