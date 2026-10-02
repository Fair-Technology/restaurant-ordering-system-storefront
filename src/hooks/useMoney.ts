import { useAppSelector } from '../store/hooks';
import { initialMenuLanguage } from '../utils/menuLanguage';
import { formatCents, formatMoney } from '../utils/money';

/**
 * Money formatters bound to the active shop's currency and the language its menu is shown in.
 * Pass a language when the page already knows it (e.g. the order's own language).
 */
export function useMoney(languageOverride?: string | null) {
  const currency = useAppSelector((state) => state.shop.currency) ?? 'EUR';
  const resolvedLanguage = useAppSelector((state) => state.shop.resolvedMenuLanguage);
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  // Prices follow the language the menu is shown in, so a German menu reads "10,50 €"
  const language = languageOverride ?? resolvedLanguage ?? storedLanguage ?? initialMenuLanguage(navigator.language);
  return {
    major: (n: number) => formatMoney(n, currency, language),
    cents: (n: number) => formatCents(n, currency, language),
  };
}
