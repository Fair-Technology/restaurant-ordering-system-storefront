// The table a diner scanned, remembered for this browser tab only. sessionStorage is
// strictly necessary storage (spec section 15), so no consent banner is needed.
export const TABLE_SESSION_TTL_MS = 7_200_000;
export const TABLE_NUMBER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} -]{0,9}$/u;

/** The tidied table number, or null when it is not 1-10 letters, digits, spaces or dashes. */
export function normaliseTableNumber(raw: string): string | null {
  const t = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  return TABLE_NUMBER_PATTERN.test(t) ? t : null;
}

export interface TableSession {
  slug: string;
  label: string;
  boundAt: number;
}

export function tableSessionKey(slug: string): string {
  return `table_session_v1:${slug}`;
}

export function readTableSession(slug: string, nowMs: number): TableSession | null {
  try {
    const raw = sessionStorage.getItem(tableSessionKey(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<TableSession>;
    const ok =
      s.slug === slug &&
      typeof s.label === 'string' &&
      normaliseTableNumber(s.label) === s.label &&
      typeof s.boundAt === 'number' &&
      Number.isFinite(s.boundAt) &&
      nowMs - s.boundAt < TABLE_SESSION_TTL_MS;
    if (!ok) {
      sessionStorage.removeItem(tableSessionKey(slug));
      return null;
    }
    return { slug, label: s.label as string, boundAt: s.boundAt as number };
  } catch {
    return null;
  }
}

export function writeTableSession(s: TableSession): void {
  try {
    sessionStorage.setItem(tableSessionKey(s.slug), JSON.stringify(s));
  } catch {
    // private mode: the table just isn't remembered
  }
}

export function clearTableSession(slug: string): void {
  try {
    sessionStorage.removeItem(tableSessionKey(slug));
  } catch {
    // nothing to clear
  }
}
