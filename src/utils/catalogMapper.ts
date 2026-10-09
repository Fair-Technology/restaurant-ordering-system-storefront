import type { CatalogCategoryDto, CatalogProductDto } from '../api/endpoints';
import type { ComboChoiceGroup, Product } from '../types/Product';
import { centsToDollars } from './money';

/**
 * Converts a category display name to a URL/DOM-safe slug ID.
 *
 * The slug is used as the `id` attribute on each category section element
 * so that CategoryFilterBar can scroll to them by ID and detect which
 * section is currently in view.
 *
 * e.g. "Main Courses" → "main-courses"
 * e.g. "Burgers & Wraps!" → "burgers-wraps"
 */
export const slugifyCategoryName = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Maps a CatalogProductDto from the API to the internal Product type used by
 * UI components (ProductCard, ProductModal, MenuList).
 *
 * The internal Product type differs from the API DTO in three ways:
 * - Uses `label` instead of `name` (historical naming)
 * - Uses `imageURL` (uppercase URL) instead of the image object's `url`
 * - Stores prices as dollar floats instead of integer cents
 *
 * This adapter keeps API shape changes isolated from UI components.
 */
// The generated client predates the catalog's offer fields; this hand-written type adds them
// until the client is regenerated from the backend's current OpenAPI spec.
export interface CatalogComboDto {
  groups: { id: string; name: string; productIds: string[] }[];
}

// The generated client also predates `combo` (null for a dish; absent from an older backend).
export type CatalogProductWithOffer = CatalogProductDto & {
  offerPrice?: number | null;
  offerLabel?: string | null;
  combo?: CatalogComboDto | null;
};

/** The combo's groups with each offered dish resolved; null when any group has no dish left. */
export function resolveCombo(
  product: CatalogProductWithOffer,
  dishes: ReadonlyMap<string, Product>,
): ComboChoiceGroup[] | null {
  if (!product.combo) return null;
  const groups = product.combo.groups.map((g) => ({
    id: g.id,
    label: g.name,
    options: g.productIds.flatMap((id) => {
      const d = dishes.get(id);
      return d ? [d] : [];
    }),
  }));
  return groups.length > 0 && groups.every((g) => g.options.length > 0) ? groups : null;
}

/**
 * The server only sends an offer price inside the dish's window, and charges it. Anything that is
 * not a whole, positive amount below the normal price is ignored, exactly as the server does.
 */
export const activeOfferCents = (product: CatalogProductWithOffer): number | null => {
  const offer = product.offerPrice;
  const normal = product.price ?? 0;
  return typeof offer === 'number' && Number.isInteger(offer) && offer > 0 && offer < normal ? offer : null;
};

export const mapApiProductToProduct = (
  product: CatalogProductWithOffer,
  category: CatalogCategoryDto,
  language: string,
): Product => ({
  id: product.id ?? '',
  label: product.name ?? '',
  imageURL:
    [...(product.images ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
      ?.url ?? '',
  description: product.description ?? '',
  isAvailable: product.isAvailable ?? true,
  ...(activeOfferCents(product) !== null
    ? {
        price: centsToDollars(activeOfferCents(product) ?? 0),
        regularPrice: centsToDollars(product.price ?? 0),
        offerLabel: product.offerLabel ?? undefined,
      }
    : { price: centsToDollars(product.price ?? 0) }),
  categories: [{ id: category.id ?? '', name: category.name ?? '', icon: category.icon ?? undefined }],
  allergens: product.allergens ?? [],
  additives: product.additives ?? [],
  dietaryTags: product.dietaryTags ?? [],
  spice: product.spice ?? null,
  language,
  // Variants and addons have a mismatch between API types and internal types,
  // so we cast them here. The shape is compatible at runtime.
  variantTypes: ((product.variants ?? []) as any[]).map((group) => ({
    id: group.id ?? '',
    label: group.name ?? '',
    variants: (group.options ?? []).map((opt: any) => ({
      id: opt.id ?? '',
      label: opt.name ?? '',
      imageURL: '',
      priceDelta: centsToDollars(opt.priceDelta ?? 0),
      isAvailable: opt.isAvailable ?? true,
    })),
  })),
  addons: ((product.addons ?? []) as any[]).map((group) => ({
    id: group.id ?? '',
    label: group.name ?? '',
    minSelectable: group.minSelectable ?? 0,
    maxSelectable: group.maxSelectable ?? 99,
    options: (group.options ?? []).map((opt: any) => ({
      id: opt.id ?? '',
      label: opt.name ?? '',
      imageURL: '',
      priceDelta: centsToDollars(opt.priceDelta ?? 0),
      isAvailable: opt.isAvailable ?? true,
    })),
  })),
});
