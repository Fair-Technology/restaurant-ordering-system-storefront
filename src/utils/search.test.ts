import { describe, expect, it } from 'vitest';
import { filterShopsByQuery, foldForSearch } from './search';

describe('foldForSearch', () => {
  it('strips diacritics', () => {
    expect(foldForSearch('é')).toBe('e');
    expect(foldForSearch('Köln')).toBe('koln');
    expect(foldForSearch('Frankfürt')).toBe('frankfurt');
    expect(foldForSearch('Crème Brûlée à la façon')).toBe('creme brulee a la facon');
  });
  it('is case-insensitive', () => {
    expect(foldForSearch('FRANKFURT')).toBe('frankfurt');
    expect(foldForSearch('ÉCOLE')).toBe('ecole');
  });
  it('leaves plain ASCII lowercase untouched', () => {
    expect(foldForSearch('ma-pasta 60311')).toBe('ma-pasta 60311');
  });
});

describe('filterShopsByQuery', () => {
  const shops = [
    { name: 'Rhein Grill', slug: 'rhein-grill', address: { city: 'Köln', postcode: '50667' } },
    { name: 'Nonna', slug: 'ma-pasta-berlin', address: { city: 'Berlin', postcode: '10115' } },
    { name: 'No Address', slug: 'plain' },
  ];
  it('matches accented city from an unaccented query and vice versa', () => {
    expect(filterShopsByQuery(shops, 'koln').map((s) => s.slug)).toEqual(['rhein-grill']);
    expect(filterShopsByQuery(shops, 'KÖLN').map((s) => s.slug)).toEqual(['rhein-grill']);
  });
  it('matches a slug fragment that is not in the name', () => {
    expect(filterShopsByQuery(shops, 'ma-pasta').map((s) => s.name)).toEqual(['Nonna']);
  });
  it('returns everything for a blank query', () => {
    expect(filterShopsByQuery(shops, '  ')).toHaveLength(3);
  });
});
