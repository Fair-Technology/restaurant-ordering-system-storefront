// Text for the pages outside a single restaurant: the home list, "not found" and the sub-processor page.
// The platform name comes from the backend where it is known; this is the fallback.
export const PLATFORM_NAME = 'Fair Technology';

export interface SiteCopy {
  homeTitle: string;
  homeLead: string;
  homeSearch: string;
  homeRestaurants: string;
  homeCount: (n: number) => string;
  homeLoading: string;
  homeError: string;
  homeEmpty: string;
  homeNoMatch: (q: string) => string;
  homeOpen: string;
  homeOpenUntil: (time: string) => string;
  homeClosed: string;
  homePaused: string;
  shopMissingTitle: string;
  shopMissingText: string;
  allRestaurants: string;
  pageMissingTitle: string;
  pageMissingText: string;
  toHome: string;
  back: string;
  subTitle: string;
  subEyebrow: string;
  subLead: (platform: string) => string;
  subProvider: string;
  subPurpose: string;
  subLocation: string;
  subOperator: string;
  subDpa: string;
  subDpaVersion: (v: string) => string;
  subDraft: string;
  subEuRep: string;
  loading: string;
  loadError: string;
}

const en: SiteCopy = {
  homeTitle: 'Order straight from the restaurant.',
  homeLead: 'Pick a restaurant, put your meal together and collect it – or have it delivered.',
  homeSearch: 'Search restaurant or town',
  homeRestaurants: 'Restaurants',
  homeCount: (n) => (n === 1 ? '1 restaurant' : `${n} restaurants`),
  homeLoading: 'Loading restaurants…',
  homeError: 'The restaurants could not be loaded. Please try again shortly.',
  homeEmpty: 'No restaurants yet.',
  homeNoMatch: (q) => `No restaurant matches “${q}”.`,
  homeOpen: 'Open now',
  homeOpenUntil: (t) => `Open until ${t}`,
  homeClosed: 'Closed right now',
  homePaused: 'Ordering paused',
  shopMissingTitle: 'We can’t find this restaurant',
  shopMissingText:
    'There may be a typo in the link, or the restaurant no longer orders through us. Check the address or ask the restaurant for the right link.',
  allRestaurants: 'See all restaurants',
  pageMissingTitle: 'This page doesn’t exist',
  pageMissingText: 'The link is not (or no longer) valid. The home page lists all restaurants.',
  toHome: 'Go to the home page',
  back: 'Back',
  subTitle: 'Sub-processors',
  subEyebrow: 'Data protection',
  subLead: (p) => `These providers process personal data on behalf of ${p} so that online ordering works.`,
  subProvider: 'Provider',
  subPurpose: 'Purpose',
  subLocation: 'Where data is processed',
  subOperator: 'Operator',
  subDpa: 'Data processing agreement',
  subDpaVersion: (v) => `Current version: ${v}`,
  subDraft: 'Draft – not yet legally reviewed.',
  subEuRep: 'EU representative',
  loading: 'Loading…',
  loadError: 'This page could not be loaded.',
};

const de: SiteCopy = {
  homeTitle: 'Direkt beim Restaurant bestellen.',
  homeLead: 'Wählen Sie ein Restaurant, stellen Sie Ihr Essen zusammen und holen Sie es ab – oder lassen Sie es liefern.',
  homeSearch: 'Restaurant oder Ort suchen',
  homeRestaurants: 'Restaurants',
  homeCount: (n) => (n === 1 ? '1 Restaurant' : `${n} Restaurants`),
  homeLoading: 'Restaurants werden geladen…',
  homeError: 'Die Restaurants konnten nicht geladen werden. Bitte versuchen Sie es gleich noch einmal.',
  homeEmpty: 'Noch keine Restaurants.',
  homeNoMatch: (q) => `Kein Restaurant passt zu „${q}“.`,
  homeOpen: 'Jetzt geöffnet',
  homeOpenUntil: (t) => `Geöffnet bis ${t}`,
  homeClosed: 'Gerade geschlossen',
  homePaused: 'Bestellungen pausiert',
  shopMissingTitle: 'Dieses Restaurant finden wir nicht',
  shopMissingText:
    'Vielleicht hat sich im Link ein Tippfehler eingeschlichen, oder das Restaurant bestellt nicht mehr über uns. Prüfen Sie die Adresse oder fragen Sie beim Restaurant nach dem richtigen Link.',
  allRestaurants: 'Alle Restaurants ansehen',
  pageMissingTitle: 'Diese Seite gibt es nicht',
  pageMissingText: 'Der Link ist nicht (mehr) gültig. Über die Startseite finden Sie alle Restaurants.',
  toHome: 'Zur Startseite',
  back: 'Zurück',
  subTitle: 'Unterauftragsverarbeiter',
  subEyebrow: 'Datenschutz',
  subLead: (p) => `Diese Dienstleister verarbeiten im Auftrag von ${p} personenbezogene Daten, damit Online-Bestellungen funktionieren.`,
  subProvider: 'Dienstleister',
  subPurpose: 'Zweck',
  subLocation: 'Standort der Verarbeitung',
  subOperator: 'Betreiber',
  subDpa: 'Auftragsverarbeitungsvertrag',
  subDpaVersion: (v) => `Aktuelle Fassung: ${v}`,
  subDraft: 'Entwurfsfassung – noch nicht rechtlich geprüft.',
  subEuRep: 'EU-Vertreter',
  loading: 'Wird geladen…',
  loadError: 'Diese Seite konnte nicht geladen werden.',
};

export function siteCopy(lang: string): SiteCopy {
  return lang === 'de' ? de : en;
}
