import { describe, expect, it } from 'vitest';
import { selectCartTotal, type CartItem } from './cartSlice';

function stateWith(items: CartItem[]) {
  return { cart: { items } };
}

describe('selectCartTotal', () => {
  it('sums 3 x 435 cents to exactly 1305, matching a 1305-cent minimum', () => {
    const total = selectCartTotal(
      stateWith([{ key: 'a', id: 'a', name: 'Dish', price: 435, quantity: 3 }]),
    );
    expect(total).toBe(1305);
    expect(total < 1305).toBe(false); // the false "below minimum" this bug caused
  });
  it('sums several float-trap unit prices exactly', () => {
    const total = selectCartTotal(
      stateWith([
        { key: 'a', id: 'a', name: 'A', price: 29, quantity: 1 },
        { key: 'b', id: 'b', name: 'B', price: 115, quantity: 1 },
      ]),
    );
    expect(total).toBe(144);
  });
});
