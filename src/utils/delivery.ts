// The postcode a diner chose for delivery, remembered for this browser tab only.
// sessionStorage is strictly necessary storage (spec section 15), so no consent banner is needed.
import type { FulfilmentMode } from '../store/slices/shopSlice';
import type { DeliveryZoneDto } from '../api/orderEndpoints';

export const DELIVERY_SESSION_TTL_MS = 7_200_000;

/** Same tidy-up the backend applies: no spaces, upper case. */
export function normalisePostcode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function zoneFor(zones: readonly DeliveryZoneDto[], raw: string): DeliveryZoneDto | null {
  const p = normalisePostcode(raw);
  return p ? (zones.find((z) => z.postcode === p) ?? null) : null;
}

export interface DeliverySession {
  slug: string;
  postcode: string;
  savedAt: number;
}

export function deliverySessionKey(slug: string): string {
  return `delivery_session_v1:${slug}`;
}

export function readDeliverySession(slug: string, nowMs: number): DeliverySession | null {
  try {
    const raw = sessionStorage.getItem(deliverySessionKey(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<DeliverySession>;
    const ok =
      s.slug === slug &&
      typeof s.postcode === 'string' &&
      s.postcode !== '' &&
      normalisePostcode(s.postcode) === s.postcode &&
      s.postcode.length <= 10 &&
      typeof s.savedAt === 'number' &&
      Number.isFinite(s.savedAt) &&
      nowMs - s.savedAt < DELIVERY_SESSION_TTL_MS;
    if (!ok) {
      sessionStorage.removeItem(deliverySessionKey(slug));
      return null;
    }
    return { slug, postcode: s.postcode as string, savedAt: s.savedAt as number };
  } catch {
    return null;
  }
}

export function writeDeliverySession(s: DeliverySession): void {
  try {
    sessionStorage.setItem(deliverySessionKey(s.slug), JSON.stringify(s));
  } catch {
    // private mode: the postcode just isn't remembered
  }
}

export function clearDeliverySession(slug: string): void {
  try {
    sessionStorage.removeItem(deliverySessionKey(slug));
  } catch {
    // nothing to clear
  }
}

/** Table first, then a remembered delivery postcode while delivery is offered, else collection. */
export function chosenMode(input: {
  table: string | null;
  deliveryPostcode: string | null;
  modes: readonly FulfilmentMode[];
}): FulfilmentMode {
  if (input.table) return 'dine_in';
  if (input.deliveryPostcode && input.modes.includes('delivery')) return 'delivery';
  return 'collection';
}
