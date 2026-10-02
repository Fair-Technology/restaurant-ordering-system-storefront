export const centsToDollars = (value?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value / 100;
};

/**
 * Formats a major-unit amount (e.g. 10.5) in the shop's currency and the
 * visitor's language: de + EUR → "10,50 €", en + EUR → "€10.50".
 */
export const formatMoney = (value: number | undefined, currency: string, language: string): string => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain amount with the code.
    return `${amount.toFixed(2)} ${currency}`;
  }
};

/** Same as formatMoney, for integer cents as the API sends them. */
export const formatCents = (cents: number | undefined, currency: string, language: string): string =>
  formatMoney(centsToDollars(cents), currency, language);
