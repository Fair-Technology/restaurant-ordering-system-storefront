import type { CatalogCategoryDto, CatalogProductDto } from '../api/endpoints';
import type { Product } from '../types/Product';
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
export const mapApiProductToProduct = (
  product: CatalogProductDto,
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
  price: centsToDollars(product.price ?? 0),
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
