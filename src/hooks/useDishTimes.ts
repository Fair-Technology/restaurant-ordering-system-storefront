import { useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import { useGetCatalogQuery } from '../api/endpoints';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { dishTimesText } from '../utils/categoryTimes';
import { orderCopy } from '../utils/orderCopy';
import type { CatalogCategoryWithTimes } from '../utils/catalogMapper';

/**
 * "Only Fridays 17:00–21:00" for a basket line, or null when the dish is served any time. Reads the
 * catalog the menu already loaded (same request, so it is shared from the cache).
 */
export function useDishTimes(): (productId: string) => string | null {
  const shopId = useAppSelector((state) => state.shop.activeShopId) ?? '';
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = currentChoice(storedLanguage, navigator.language);
  const { data } = useGetCatalogQuery({ shopId, lang }, { skip: !shopId });
  const pageLanguage = pageLanguageOf(lang);
  const categories = (data?.categories ?? []) as CatalogCategoryWithTimes[];
  return useCallback(
    (productId: string) => {
      const when = dishTimesText(productId, categories, pageLanguage);
      return when === null ? null : orderCopy(pageLanguage).onlyWhen(when);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, pageLanguage],
  );
}
