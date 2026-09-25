export interface MenuLabels {
  allergens: string;
  additives: string;
  noAllergens: string;
  noAdditives: string;
  languageGroup: string;
}

const EN: MenuLabels = {
  allergens: 'Allergens',
  additives: 'Additives',
  noAllergens: 'Contains none of the 14 declarable allergens',
  noAdditives: 'No declarable additives',
  languageGroup: 'Menu language',
};

const DE: MenuLabels = {
  allergens: 'Allergene',
  additives: 'Zusatzstoffe',
  noAllergens: 'Enthält keines der 14 kennzeichnungspflichtigen Allergene',
  noAdditives: 'Keine kennzeichnungspflichtigen Zusatzstoffe',
  languageGroup: 'Menüsprache',
};

/**
 * The allergen/additive box and the language switcher are the only bilingual
 * UI on the storefront in this slice (spec §21 item 2, product default 7) —
 * everything else around the menu stays English. `lang === 'de'` gets the
 * German set; anything else falls back to English.
 */
export function menuLabels(lang: string | undefined): MenuLabels {
  return lang === 'de' ? DE : EN;
}
