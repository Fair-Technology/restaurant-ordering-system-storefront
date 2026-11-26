import type { BasketQuoteDto, CheckoutItemDto, QuoteBasketRequestDto } from '../../api/endpoints';
import type { CartItem } from '../../store/slices/cartSlice';
import { toComboChoiceDtos } from '../../utils/combo';

export type QuoteFn = (arg: QuoteBasketRequestDto) => Promise<BasketQuoteDto>;

export const toQuoteItem = (i: CartItem): CheckoutItemDto => ({
  productId: i.id,
  quantity: i.quantity,
  selectedVariantOptionId: i.variantId,
  selectedAddonOptionIds: i.addonOptionIds,
  expectedUnitPriceCents: i.price,
  ...(i.comboChoices ? { comboChoices: toComboChoiceDtos(i.comboChoices) } : {}),
});

/**
 * Which basket lines would not be served at `at` (an ISO instant), or right now when `at` is null.
 * Uses the same server quote as checkout. Rejects when the quote fails or the time cannot be booked,
 * so the caller never applies a time it could not verify.
 */
export async function unservedLines(
  quote: QuoteFn,
  base: Omit<QuoteBasketRequestDto, 'items' | 'scheduledFor'>,
  items: readonly CartItem[],
  at: string | null,
): Promise<CartItem[]> {
  if (items.length === 0) return [];
  const whole = await quote({ ...base, ...(at ? { scheduledFor: at } : {}), items: items.map(toQuoteItem) });
  if (!at) {
    // "now": the server says per line whether it is served right now
    const bad = new Set((whole.timeLimited ?? []).filter((l) => !l.servedNow).map((l) => l.index));
    return items.filter((_, idx) => bad.has(idx));
  }
  if (whole.slotAvailable !== false) return [];
  // The server judges the chosen time for the whole basket; ask line by line to name the culprits
  const each = await Promise.all(
    items.map((it) => quote({ ...base, scheduledFor: at, items: [toQuoteItem(it)] })),
  );
  const bad = items.filter((_, idx) => each[idx].slotAvailable === false);
  if (bad.length === 0) throw new Error('time not bookable');
  return bad;
}
