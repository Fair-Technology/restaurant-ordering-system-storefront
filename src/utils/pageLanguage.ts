import { initialMenuLanguage } from './menuLanguage';

/** Languages the page's own fixed text (buttons, checkout, order page) is written in. */
export const PAGE_LANGUAGES = ['de', 'en'] as const;
export type PageLanguage = (typeof PAGE_LANGUAGES)[number];

/** The page language for a diner's language choice: de or en, anything else reads English. */
export function pageLanguageOf(choice: string | null | undefined): PageLanguage {
  return choice === 'de' ? 'de' : 'en';
}

/** The diner's choice, or the browser's language on a first visit (de/en, else en for the page). */
export function currentChoice(storedChoice: string | null | undefined, navigatorLanguage: string | undefined): string {
  return storedChoice ?? initialMenuLanguage(navigatorLanguage);
}

/** Languages the picker offers: the page languages plus the shop's menu languages, in that order. */
export function pickerLanguages(menuLanguages: readonly string[] | undefined): string[] {
  return [...new Set<string>([...PAGE_LANGUAGES, ...(menuLanguages ?? [])])];
}

/**
 * Which picker button is highlighted: the diner's choice if the picker offers it,
 * otherwise the page language they are reading.
 */
export function pickerCurrent(choice: string, offered: readonly string[]): string {
  return offered.includes(choice) ? choice : pageLanguageOf(choice);
}
