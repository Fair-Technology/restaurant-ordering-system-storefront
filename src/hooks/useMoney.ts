import { useAppSelector } from '../store/hooks';
import { initialMenuLanguage } from '../utils/menuLanguage';
import { formatCents, formatMoney } from '../utils/money';

/** Money formatters bound to the active shop's currency and the visitor's menu language. */
export function useMoney() {
  const currency = useAppSelector((state) => state.shop.currency) ?? 'EUR';
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const language = storedLanguage ?? initialMenuLanguage(navigator.language);
  return {
    major: (n: number) => formatMoney(n, currency, language),
    cents: (n: number) => formatCents(n, currency, language),
  };
}
