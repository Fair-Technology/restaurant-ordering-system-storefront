import type { ComboChoiceDto } from '../api/orderEndpoints';
import type { CartComboChoice } from '../store/slices/cartSlice';
import type { Product } from '../types/Product';
import { unmetAddonGroups } from './addonSelection';
import { chosenOptions, combinedDeclaration, type Declaration } from './declaration';

export interface ComboPick {
  productId: string;
  variantId?: string;
  addonIds: string[];
}
/** The diner's picks, keyed by group id. */
export type ComboPicks = Record<string, ComboPick>;

export function optionOf(product: Product, groupId: string, productId: string): Product | undefined {
  return product.combo?.find((g) => g.id === groupId)?.options.find((o) => o.id === productId);
}

/** Allergens and additives of what the diner has actually picked: each picked dish, plus its picked size and extras. */
export function comboDeclaration(product: Product, picks: ComboPicks): Declaration {
  const dishes = (product.combo ?? []).flatMap((g) => {
    const pick = picks[g.id];
    const o = pick && optionOf(product, g.id, pick.productId);
    return o ? [o, ...chosenOptions(o, pick.variantId, pick.addonIds)] : [];
  });
  return combinedDeclaration(product, dishes);
}

/** One combo's price in major units: the combo price plus every size and extra surcharge picked. */
export function comboUnitPrice(product: Product, picks: ComboPicks): number {
  let total = product.price;
  for (const g of product.combo ?? []) {
    const pick = picks[g.id];
    const o = pick && optionOf(product, g.id, pick.productId);
    if (!o) continue;
    total += o.variantTypes.flatMap((t) => t.variants).find((v) => v.id === pick.variantId)?.priceDelta ?? 0;
    total += o.addons
      .flatMap((a) => a.options)
      .filter((x) => pick.addonIds.includes(x.id))
      .reduce((s, x) => s + x.priceDelta, 0);
  }
  return +total.toFixed(2);
}

/** True when every group has a pick and every picked dish has its required extras. */
export function comboReady(product: Product, picks: ComboPicks): boolean {
  return (product.combo ?? []).every((g) => {
    const pick = picks[g.id];
    const o = pick && optionOf(product, g.id, pick.productId);
    return !!o && unmetAddonGroups(o.addons, new Set(pick.addonIds)).length === 0;
  });
}

export function comboCartChoices(product: Product, picks: ComboPicks): CartComboChoice[] {
  return (product.combo ?? []).map((g) => ({
    groupId: g.id,
    productId: picks[g.id].productId,
    ...(picks[g.id].variantId ? { variantId: picks[g.id].variantId } : {}),
    ...(picks[g.id].addonIds.length ? { addonOptionIds: [...picks[g.id].addonIds] } : {}),
  }));
}

/** Reverses comboCartChoices: the picks a cart line was built from, for editing it. */
export function comboPicksFromChoices(choices: readonly CartComboChoice[]): ComboPicks {
  const picks: ComboPicks = {};
  for (const c of choices) {
    picks[c.groupId] = { productId: c.productId, variantId: c.variantId, addonIds: c.addonOptionIds ?? [] };
  }
  return picks;
}

/** The picks as one line for the basket, e.g. "Pomodoro (Spaghetti) · Cola". */
export function comboDetail(product: Product, picks: ComboPicks): string {
  return (product.combo ?? [])
    .flatMap((g) => {
      const pick = picks[g.id];
      const o = pick && optionOf(product, g.id, pick.productId);
      if (!o) return [];
      const variant = o.variantTypes.flatMap((t) => t.variants).find((v) => v.id === pick.variantId)?.label;
      const extras = o.addons
        .flatMap((a) => a.options)
        .filter((x) => pick.addonIds.includes(x.id))
        .map((x) => x.label);
      const more = [variant, ...extras].filter(Boolean);
      return [more.length ? `${o.label} (${more.join(', ')})` : o.label];
    })
    .join(' · ');
}

export function toComboChoiceDtos(choices: readonly CartComboChoice[]): ComboChoiceDto[] {
  return choices.map((c) => ({
    groupId: c.groupId,
    productId: c.productId,
    ...(c.variantId ? { selectedVariantOptionId: c.variantId } : {}),
    ...(c.addonOptionIds?.length ? { selectedAddonOptionIds: c.addonOptionIds } : {}),
  }));
}
