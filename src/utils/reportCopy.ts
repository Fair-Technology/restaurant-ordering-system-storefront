/** The content-report categories the backend accepts (POST /shops/{shopId}/content-reports). */
export const REPORT_CATEGORIES = [
  'illegal_goods',
  'fraud_or_scam',
  'hate_or_harassment',
  'copyright_or_trademark',
  'personal_data',
  'other',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface ReportCopy {
  link: string;
  eyebrow: string;
  title: string;
  backToMenu: string;
  lead: string;
  privacyNote: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  categoryOptions: Record<ReportCategory, string>;
  reasonLabel: string;
  reasonHint: string;
  contentUrlLabel: string;
  reporterNameLabel: string;
  reporterEmailLabel: string;
  optionalNote: string;
  submit: string;
  submitting: string;
  receiptTitle: string;
  receiptBody: string;
  receiptIdLabel: string;
  receiptReceivedAt: (date: string) => string;
  receiptKeep: string;
  formErrorTitle: string;
  shopUnknown: string;
  categoryRequiredError: string;
  reasonRequiredError: string;
  urlInvalidError: string;
  genericSubmitError: string;
}

const en: ReportCopy = {
  link: 'Report illegal content',
  eyebrow: 'Legal',
  title: 'Report illegal content',
  backToMenu: 'Back to the menu',
  lead: 'Report illegal content on this restaurant’s storefront to the platform. You do not need an account.',
  privacyNote: 'Your name and email are optional. The platform uses them only to follow up on this report.',
  categoryLabel: 'What is the problem?',
  categoryPlaceholder: 'Please choose…',
  categoryOptions: {
    illegal_goods: 'Illegal goods or services',
    fraud_or_scam: 'Fraud or scam',
    hate_or_harassment: 'Hate speech or harassment',
    copyright_or_trademark: 'Copyright or trademark infringement',
    personal_data: 'Personal data or privacy',
    other: 'Something else',
  },
  reasonLabel: 'What is illegal about it?',
  reasonHint: 'Please describe the problem in up to 4000 characters.',
  contentUrlLabel: 'Link to the content (optional)',
  reporterNameLabel: 'Your name (optional)',
  reporterEmailLabel: 'Your email (optional)',
  optionalNote: 'Every field except the first two is optional.',
  submit: 'Send report',
  submitting: 'Sending…',
  receiptTitle: 'Report received',
  receiptBody: 'The platform has recorded your report.',
  receiptIdLabel: 'Receipt number',
  receiptReceivedAt: (date) => `Received on ${date}`,
  receiptKeep: 'Please keep the receipt number for your records.',
  formErrorTitle: 'The report could not be sent.',
  shopUnknown: 'This restaurant could not be loaded.',
  categoryRequiredError: 'Please choose a category.',
  reasonRequiredError: 'Please describe the problem.',
  urlInvalidError: 'Please enter a valid http:// or https:// link, or leave this field empty.',
  genericSubmitError: 'Something went wrong. Please try again.',
};

const de: ReportCopy = {
  link: 'Illegale Inhalte melden',
  eyebrow: 'Rechtliches',
  title: 'Illegale Inhalte melden',
  backToMenu: 'Zurück zur Speisekarte',
  lead: 'Melden Sie illegale Inhalte auf der Storefront dieses Restaurants an die Plattform. Sie benötigen dafür kein Konto.',
  privacyNote: 'Ihr Name und Ihre E-Mail-Adresse sind optional. Die Plattform nutzt sie nur, um auf diese Meldung zu reagieren.',
  categoryLabel: 'Worum geht es?',
  categoryPlaceholder: 'Bitte auswählen…',
  categoryOptions: {
    illegal_goods: 'Illegale Waren oder Dienstleistungen',
    fraud_or_scam: 'Betrug oder Täuschung',
    hate_or_harassment: 'Hassrede oder Belästigung',
    copyright_or_trademark: 'Urheber- oder Markenrechtsverletzung',
    personal_data: 'Personenbezogene Daten oder Datenschutz',
    other: 'Etwas anderes',
  },
  reasonLabel: 'Was ist daran rechtswidrig?',
  reasonHint: 'Bitte beschreiben Sie das Problem mit höchstens 4000 Zeichen.',
  contentUrlLabel: 'Link zum Inhalt (optional)',
  reporterNameLabel: 'Ihr Name (optional)',
  reporterEmailLabel: 'Ihre E-Mail-Adresse (optional)',
  optionalNote: 'Alle Felder außer den ersten beiden sind optional.',
  submit: 'Meldung senden',
  submitting: 'Wird gesendet…',
  receiptTitle: 'Meldung eingegangen',
  receiptBody: 'Die Plattform hat Ihre Meldung erfasst.',
  receiptIdLabel: 'Vorgangsnummer',
  receiptReceivedAt: (date) => `Eingegangen am ${date}`,
  receiptKeep: 'Bitte bewahren Sie die Vorgangsnummer auf.',
  formErrorTitle: 'Die Meldung konnte nicht gesendet werden.',
  shopUnknown: 'Dieses Restaurant konnte nicht geladen werden.',
  categoryRequiredError: 'Bitte wählen Sie eine Kategorie aus.',
  reasonRequiredError: 'Bitte beschreiben Sie das Problem.',
  urlInvalidError:
    'Bitte geben Sie einen gültigen http://- oder https://-Link ein, oder lassen Sie dieses Feld leer.',
  genericSubmitError: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
};

/** The report page's own fixed text, in the diner's page language. */
export function reportCopy(lang: string): ReportCopy {
  return lang === 'de' ? de : en;
}
