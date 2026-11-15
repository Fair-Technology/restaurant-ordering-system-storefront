// The checkout details a diner typed (name, email, phone, notes, addresses), remembered for this
// browser tab only, so a trip back to the menu does not wipe them. Cleared when the tab closes and
// as soon as an order is placed. sessionStorage is strictly necessary storage (spec section 15),
// so no consent banner is needed.
import type { CustomerAddress } from '../api/orderEndpoints';

export const CHECKOUT_DETAILS_TTL_MS = 7_200_000;

export interface CheckoutDetailsDraft {
  slug: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  address: CustomerAddress;
  countryEdited: boolean;
  billingOpen: boolean;
  deliveryStreet: string;
  deliveryCity: string;
  savedAt: number;
}

export function checkoutDetailsKey(slug: string): string {
  return `checkout_details_v1:${slug}`;
}

function isAddress(a: unknown): a is CustomerAddress {
  if (typeof a !== 'object' || a === null) return false;
  const o = a as Partial<CustomerAddress>;
  return (
    typeof o.street === 'string' &&
    typeof o.postcode === 'string' &&
    typeof o.city === 'string' &&
    typeof o.country === 'string'
  );
}

export function readCheckoutDetails(slug: string, nowMs: number): CheckoutDetailsDraft | null {
  try {
    const raw = sessionStorage.getItem(checkoutDetailsKey(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<CheckoutDetailsDraft> | null;
    const ok =
      typeof s === 'object' &&
      s !== null &&
      s.slug === slug &&
      typeof s.name === 'string' &&
      typeof s.email === 'string' &&
      typeof s.phone === 'string' &&
      typeof s.notes === 'string' &&
      isAddress(s.address) &&
      typeof s.countryEdited === 'boolean' &&
      typeof s.billingOpen === 'boolean' &&
      typeof s.deliveryStreet === 'string' &&
      typeof s.deliveryCity === 'string' &&
      typeof s.savedAt === 'number' &&
      Number.isFinite(s.savedAt) &&
      nowMs - s.savedAt < CHECKOUT_DETAILS_TTL_MS;
    if (!ok) {
      sessionStorage.removeItem(checkoutDetailsKey(slug));
      return null;
    }
    const a = s.address as CustomerAddress;
    return {
      slug,
      name: s.name as string,
      email: s.email as string,
      phone: s.phone as string,
      notes: s.notes as string,
      address: { street: a.street, postcode: a.postcode, city: a.city, country: a.country },
      countryEdited: s.countryEdited as boolean,
      billingOpen: s.billingOpen as boolean,
      deliveryStreet: s.deliveryStreet as string,
      deliveryCity: s.deliveryCity as string,
      savedAt: s.savedAt as number,
    };
  } catch {
    return null;
  }
}

export function writeCheckoutDetails(draft: CheckoutDetailsDraft): void {
  try {
    sessionStorage.setItem(checkoutDetailsKey(draft.slug), JSON.stringify(draft));
  } catch {
    // private mode: the details just aren't remembered
  }
}

export function clearCheckoutDetails(slug: string): void {
  try {
    sessionStorage.removeItem(checkoutDetailsKey(slug));
  } catch {
    // nothing to clear
  }
}
