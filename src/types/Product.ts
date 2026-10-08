import type { CatalogAdditive, CatalogLabel } from '../api/endpoints';
export type { CatalogAdditive, CatalogLabel };

export interface Product {
  id: string;
  label: string;
  imageURL: string;
  description: string;
  isAvailable: boolean;
  /** Unit price the server charges right now: the offer price while an offer is on, else the normal price. */
  price: number;
  /** Normal price, set only while an offer is on (shown struck through next to `price`). */
  regularPrice?: number;
  /** Owner's name for the offer (e.g. "Lunch special"), if any. */
  offerLabel?: string;
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
  minSelectable: number;
  maxSelectable: number;
  options: AddonOption[];
}

export interface AddonOption {
  id: string;
  label: string;
  imageURL: string;
  priceDelta: number;
  isAvailable: boolean;
}
