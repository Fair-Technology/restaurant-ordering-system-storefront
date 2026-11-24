/** Lowercase and strip diacritics so "Köln" and "koln" (or "Frankfürt" and "frankfurt") compare equal. */
export function foldForSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface SearchableShop {
  name: string;
  slug: string;
  address?: { city?: string | null; postcode?: string | null } | null;
}

/** Shops whose name, town, postcode or slug contains the query, ignoring case and accents. */
export function filterShopsByQuery<T extends SearchableShop>(shops: T[], query: string): T[] {
  const q = foldForSearch(query.trim());
  if (!q) return shops;
  return shops.filter((s) =>
    [s.name, s.address?.city, s.address?.postcode, s.slug].some((v) => v != null && foldForSearch(v).includes(q)),
  );
}
