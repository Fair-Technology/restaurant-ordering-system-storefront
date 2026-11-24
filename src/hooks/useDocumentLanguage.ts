import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';

/**
 * Keeps <html lang> in sync with the page language (de/en), so screen readers
 * use the right voice. Mutates `document.documentElement.lang` only.
 */
export function useDocumentLanguage(): void {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const pageLanguage = pageLanguageOf(currentChoice(storedLanguage, navigator.language));

  useEffect(() => {
    document.documentElement.lang = pageLanguage;
  }, [pageLanguage]);
}
