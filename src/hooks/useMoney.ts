import { useAppSelector } from '../store/hooks';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { formatCents, formatMoney } from '../utils/money';

/**
 * Money formatters bound to the active shop's currency and the language the page is shown in.
 * Pass a language when the page already knows it (e.g. the order's own language).
 */
export function useMoney(languageOverride?: string | null) {
  const currency = useAppSelector((state) => state.shop.currency) ?? 'EUR';
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  // Prices follow the page language, so a German page reads "10,50 €"
  const language = languageOverride ?? pageLanguageOf(currentChoice(storedLanguage, navigator.language));
  return {
    major: (n: number) => formatMoney(n, currency, language),
    cents: (n: number) => formatCents(n, currency, language),
  };
}
