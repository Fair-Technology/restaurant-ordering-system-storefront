import type { CatalogAdditive, CatalogLabel } from '../types/Product';

export interface Declaring {
  allergens?: CatalogLabel[];
  additives?: CatalogAdditive[];
}
export interface DeclaringOption extends Declaring {
  id: string;
}
export interface Declaration {
  allergens: CatalogLabel[];
  additives: CatalogAdditive[];
}
export interface OptionTree {
  variantTypes?: { variants: DeclaringOption[] }[];
  addons?: { options: DeclaringOption[] }[];
}

/** The sizes and extras currently picked on a dish. */
export function chosenOptions(
  product: OptionTree,
  variantId: string | undefined,
  addonIds: Iterable<string>,
): DeclaringOption[] {
  const picked = new Set(addonIds);
  return [
    ...(product.variantTypes ?? []).flatMap((t) => t.variants).filter((v) => v.id === variantId),
    ...(product.addons ?? []).flatMap((g) => g.options).filter((o) => picked.has(o.id)),
  ];
}

/** The base list plus what each chosen option adds; no repeats, additives in number order. */
export function combinedDeclaration(base: Declaring, extra: readonly Declaring[]): Declaration {
  const byId = <T extends { id: string }>(list: T[]): T[] => [
    ...new Map(list.map((x) => [x.id, x] as const)).values(),
  ];
  return {
    allergens: byId([...(base.allergens ?? []), ...extra.flatMap((o) => o.allergens ?? [])]),
    additives: byId([...(base.additives ?? []), ...extra.flatMap((o) => o.additives ?? [])]).sort(
      (a, b) => a.code - b.code,
    ),
  };
}

/** True when at least one size or extra declares something, so the list can change as the diner picks. */
export function optionsDeclareAnything(product: OptionTree): boolean {
  return [
    ...(product.variantTypes ?? []).flatMap((t) => t.variants),
    ...(product.addons ?? []).flatMap((g) => g.options),
  ].some((o) => (o.allergens?.length ?? 0) + (o.additives?.length ?? 0) > 0);
}
