import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe } from '@stripe/stripe-js';

const loaders = new Map<string, Promise<Stripe | null>>();

/**
 * Stripe.js bound to the restaurant's connected account. The payment lives on that
 * account, so loading Stripe without its id makes every confirmation fail.
 * One loader per account id: Stripe must not be re-created on every render.
 * Pure import: the Stripe script (and its fraud cookies) loads only when the payment step
 * calls this, never on import.
 */
export function stripeForAccount(connectedAccountId: string): Promise<Stripe | null> {
  const known = loaders.get(connectedAccountId);
  if (known) return known;
  const loader = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? '', {
    stripeAccount: connectedAccountId,
  });
  loaders.set(connectedAccountId, loader);
  return loader;
}
