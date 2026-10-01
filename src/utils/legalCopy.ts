export type LegalDoc = 'impressum' | 'terms' | 'withdrawal' | 'privacy';

export interface LegalCopy {
  footerImpressum: string;
  footerTerms: string;
  footerWithdrawal: string;
  footerPrivacy: string;
  orderingBy: (platform: string) => string;
  heading: Record<LegalDoc, string>;
  subProcessors: string;
  notPublished: string;
  draftNotice: string;
  backToMenu: string;
  loading: string;
  loadError: string;
  sellerStatement: (legalName: string, platform: string) => string;
  acceptPrefix: (legalName: string) => string;
  acceptMiddle: (legalName: string) => string;
  acceptAnd: string;
  acceptEnd: string;
  allergyLine: (legalName: string, phone: string) => string;
  allergyLineNoPhone: string;
  notesLabel: string;
  notesPlaceholder: string;
}

const en: LegalCopy = {
  footerImpressum: 'Legal notice',
  footerTerms: 'Terms',
  footerWithdrawal: 'Withdrawal policy',
  footerPrivacy: 'Privacy',
  orderingBy: (n) => `Ordering by ${n}`,
  heading: {
    impressum: 'Legal notice',
    terms: 'Terms and conditions',
    withdrawal: 'Withdrawal policy',
    privacy: 'Privacy notice',
  },
  subProcessors: 'Sub-processors',
  notPublished: 'This restaurant has not published this page yet.',
  draftNotice: 'Draft wording — not yet legally reviewed.',
  backToMenu: 'Back to the menu',
  loading: 'Loading…',
  loadError: 'This page could not be loaded.',
  sellerStatement: (l, p) =>
    `This order is a contract between you and ${l}. ${p} provides the ordering software.`,
  acceptPrefix: (l) => `By ordering you accept the `,
  acceptMiddle: (l) => ` of ${l}. Please read the `,
  acceptAnd: ' and the ',
  acceptEnd: '.',
  allergyLine: (l, ph) =>
    `Allergies or intolerances? Please call ${l} on ${ph} before ordering. Do not put allergy information in the notes.`,
  allergyLineNoPhone: 'Allergies or intolerances? Please contact the restaurant before ordering.',
  notesLabel: 'Kitchen requests (e.g. no onions) — not for allergies',
  notesPlaceholder: 'e.g. extra crispy, no onions',
};

const de: LegalCopy = {
  footerImpressum: 'Impressum',
  footerTerms: 'AGB',
  footerWithdrawal: 'Widerrufsbelehrung',
  footerPrivacy: 'Datenschutz',
  orderingBy: (n) => `Online-Bestellung über ${n}`,
  heading: {
    impressum: 'Impressum',
    terms: 'AGB',
    withdrawal: 'Widerrufsbelehrung',
    privacy: 'Datenschutzerklärung',
  },
  subProcessors: 'Unterauftragsverarbeiter',
  notPublished: 'Dieses Restaurant hat diese Seite noch nicht veröffentlicht.',
  draftNotice: 'Entwurfsfassung – noch nicht rechtlich geprüft.',
  backToMenu: 'Zurück zur Speisekarte',
  loading: 'Wird geladen…',
  loadError: 'Diese Seite konnte nicht geladen werden.',
  sellerStatement: (l, p) =>
    `Diese Bestellung ist ein Vertrag zwischen Ihnen und ${l}. ${p} stellt nur die Bestellsoftware bereit.`,
  acceptPrefix: () => 'Mit Ihrer Bestellung akzeptieren Sie die ',
  acceptMiddle: (l) => ` von ${l}. Bitte lesen Sie die `,
  acceptAnd: ' und die ',
  acceptEnd: '.',
  allergyLine: (l, ph) =>
    `Allergien oder Unverträglichkeiten? Bitte rufen Sie ${l} vor der Bestellung unter ${ph} an. Bitte keine Allergie-Angaben in die Anmerkungen.`,
  allergyLineNoPhone:
    'Allergien oder Unverträglichkeiten? Bitte kontaktieren Sie das Restaurant vor der Bestellung.',
  notesLabel: 'Wünsche an die Küche (z. B. ohne Zwiebeln) – nicht für Allergien',
  notesPlaceholder: 'z. B. extra knusprig, ohne Zwiebeln',
};

export function legalCopy(lang: string): LegalCopy {
  return lang === 'de' ? de : en;
}
