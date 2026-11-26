// The "other time" a diner chose to order for, remembered for this browser tab only. Same convention as
// tableSession.ts / delivery.ts: sessionStorage (strictly necessary storage, spec section 15, so no consent
// banner), keyed by shop slug, so it survives a reload during the visit but not a new tab or a later visit.
// It also holds the entry (category or dish) it was picked for, so "Change" can reopen the day/time step.
import type { OtherTimeEntry } from './otherTimes';

export interface OtherTimeChoice {
  slug: string;
  /** The chosen moment, an ISO instant on a quarter hour */
  iso: string;
  entry: OtherTimeEntry;
}

export function otherTimeKey(slug: string): string {
  return `other_time_v1:${slug}`;
}

/** The stored choice, or null when missing, malformed, or its moment has passed (it is then removed). */
export function readOtherTime(slug: string, nowMs: number): OtherTimeChoice | null {
  try {
    const raw = sessionStorage.getItem(otherTimeKey(slug));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<OtherTimeChoice>;
    const ok =
      c.slug === slug &&
      typeof c.iso === 'string' &&
      Number.isFinite(Date.parse(c.iso)) &&
      Date.parse(c.iso) > nowMs &&
      !!c.entry &&
      typeof c.entry.id === 'string' &&
      typeof c.entry.name === 'string' &&
      !!c.entry.schedule &&
      typeof c.entry.schedule === 'object';
    if (!ok) {
      sessionStorage.removeItem(otherTimeKey(slug));
      return null;
    }
    return c as OtherTimeChoice;
  } catch {
    return null;
  }
}

export function writeOtherTime(c: OtherTimeChoice): void {
  try {
    sessionStorage.setItem(otherTimeKey(c.slug), JSON.stringify(c));
  } catch {
    // private mode: the time just isn't remembered across a reload
  }
}

export function clearOtherTime(slug: string): void {
  try {
    sessionStorage.removeItem(otherTimeKey(slug));
  } catch {
    // nothing to clear
  }
}
