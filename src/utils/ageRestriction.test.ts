import { describe, expect, it } from 'vitest';
import { cartHasAgeRestrictedItem } from './ageRestriction';
import type { CartItem } from '../store/slices/cartSlice';
import type { Product } from '../types/Product';

const dish = (id: string, ageRestricted = false, extra: Partial<Product> = {}) =>
  ({ id, ageRestricted, ...extra }) as Product;
const line = (id: string, extra: Partial<CartItem> = {}): CartItem =>
  ({ key: id, id, name: id, price: 100, quantity: 1, ...extra }) as CartItem;

const combo = (id: string, options: Product[]) =>
  dish(id, false, { combo: [{ id: 'g1', label: 'Drink', options }] });
const pick = (productId: string) => [{ groupId: 'g1', productId }];

describe('cartHasAgeRestrictedItem', () => {
  it('is false for a plain non-restricted item', () => {
    expect(cartHasAgeRestrictedItem([line('pizza')], [dish('pizza')])).toBe(false);
  });
  it('is true for a plain restricted item', () => {
    expect(cartHasAgeRestrictedItem([line('beer')], [dish('beer', true)])).toBe(true);
  });
  it('is true for a combo with a restricted chosen component', () => {
    const beer = dish('beer', true);
    const cola = dish('cola');
    const products = [combo('meal', [beer, cola]), beer, cola];
    expect(cartHasAgeRestrictedItem([line('meal', { comboChoices: pick('beer') })], products)).toBe(true);
  });
  it('is false for a combo whose chosen component is not restricted', () => {
    const beer = dish('beer', true);
    const cola = dish('cola');
    const products = [combo('meal', [beer, cola]), beer, cola];
    expect(cartHasAgeRestrictedItem([line('meal', { comboChoices: pick('cola') })], products)).toBe(false);
  });
  it('is false for an empty cart', () => {
    expect(cartHasAgeRestrictedItem([], [dish('beer', true)])).toBe(false);
  });
});
