import type { CatalogAdditive, CatalogLabel } from '../api/endpoints';
export type { CatalogAdditive, CatalogLabel };

export interface Product {
  id: string;
  label: string;
  imageURL: string;
  description: string;
  isAvailable: boolean;
  price: number;
  categories: Category[];
  variantTypes: VariantType[];
  addons: AddonGroup[];
  allergens: CatalogLabel[];
  additives: CatalogAdditive[];
  dietaryTags: CatalogLabel[];
  spice: CatalogLabel | null;
  /** Menu language this product's text is localized to (e.g. 'de', 'en') */
  language: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface VariantType {
  id: string;
  label: string;
  variants: Variant[];
}

export interface Variant {
  id: string;
  label: string;
  imageURL: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface AddonGroup {
  id: string;
  label: string;
  options: AddonOption[];
}

export interface AddonOption {
  id: string;
  label: string;
  imageURL: string;
  priceDelta: number;
  isAvailable: boolean;
}
