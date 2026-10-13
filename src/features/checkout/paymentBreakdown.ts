import type { CardCheckoutResult } from '../../api/orderEndpoints';

/** The fee and discount the order was placed with: exactly what was sent as expectedDeliveryFeeCents / expectedDiscountCents. */
export interface SentCharges {
  deliveryFeeCents: number | null; // null = not a delivery order
  discount: { code: string; cents: number } | null; // null = no discount sent
}

/** What the payment step shows right above the order button. */
export interface PaymentBreakdown {
  itemsCents: number; // result.subtotalCents
  deliveryFeeCents: number | null; // null → no delivery-fee line
  discount: { code: string; cents: number } | null; // null → no discount line
  totalCents: number; // result.totalCents ?? result.subtotalCents: what the card is reserved for
  adds: boolean; // false → items + fee − discount ≠ total: show the Total line only
}

/**
 * The server answers 409 when the sent fee or discount differs from its own, so the sent values
 * are what it charges. If they still do not add up to its total, only the total is shown.
 */
export function paymentBreakdown(result: CardCheckoutResult, sent: SentCharges): PaymentBreakdown {
  const totalCents = result.totalCents ?? result.subtotalCents;
  const adds = result.subtotalCents + (sent.deliveryFeeCents ?? 0) - (sent.discount?.cents ?? 0) === totalCents;
  if (!adds) {
    console.error('Payment step: items, fee and discount do not add up to the charged total; showing the total only', { result, sent });
  }
  return { itemsCents: result.subtotalCents, deliveryFeeCents: sent.deliveryFeeCents, discount: sent.discount, totalCents, adds };
}
