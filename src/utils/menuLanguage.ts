/**
 * Derives the visitor's initial menu language from their browser's
 * language setting (e.g. `navigator.language`).
 *
 * Only the first two letters are used, lower-cased, so a region-qualified
 * tag like "en-US" or "DE-at" still resolves to "en" / "de". The catalog
 * request sends this as `lang`; the backend falls back to the shop's
 * original language if it isn't offered.
 */
export function initialMenuLanguage(navigatorLanguage: string | undefined): string {
  return (navigatorLanguage ?? 'de').slice(0, 2).toLowerCase();
}
