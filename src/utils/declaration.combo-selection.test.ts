import { describe, expect, it } from 'vitest';
import type { Product } from '../types/Product';
import { comboDeclaration, type ComboPicks } from './combo';

const dish = (id: string, extra: Partial<Product> = {}): Product =>
  ({
    id,
    price: 0,
    variantTypes: [],
    addons: [],
    allergens: [],
    additives: [],
    ...extra,
  }) as unknown as Product;

const fish = { id: 'fish', label: 'Fish' };
const caffeine = { id: 'caf', code: 11, label: 'contains caffeine' };

const combo = dish('combo', {
  combo: [
    { id: 'A', label: 'Dish', options: [dish('fishDish', { allergens: [fish] }), dish('plainDish')] },
    { id: 'B', label: 'Drink', options: [dish('cola', { additives: [caffeine] }), dish('water')] },
  ],
});

const pick = (a: string, b: string): ComboPicks => ({
  A: { productId: a, addonIds: [] },
  B: { productId: b, addonIds: [] },
});

describe('comboDeclaration', () => {
  it('declares nothing when the picked dishes declare nothing, even if other options do', () => {
    expect(comboDeclaration(combo, pick('plainDish', 'water'))).toEqual({ allergens: [], additives: [] });
  });

  it('declares exactly what the picked dishes contain', () => {
    expect(comboDeclaration(combo, pick('fishDish', 'cola'))).toEqual({
      allergens: [fish],
      additives: [caffeine],
    });
  });

  it('changes with the pick and ignores groups with no pick yet', () => {
    expect(comboDeclaration(combo, pick('fishDish', 'water'))).toEqual({ allergens: [fish], additives: [] });
    expect(comboDeclaration(combo, { A: { productId: 'plainDish', addonIds: [] } })).toEqual({
      allergens: [],
      additives: [],
    });
  });
});
