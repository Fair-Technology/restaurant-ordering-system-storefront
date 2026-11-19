import { expect, test } from '@playwright/test';
import { groupOrderItems, type OrderItemDto } from '../../src/utils/orderItemGroups';

const item = (over: Partial<OrderItemDto>): OrderItemDto => ({
  productName: 'X',
  quantity: 1,
  unitPriceCents: 100,
  lineTotalCents: 100,
  selectedVariantOptionName: null,
  selectedAddonOptionNames: [],
  ...over,
});

const pasta = item({
  productName: 'Pomodoro English',
  unitPriceCents: 1043,
  lineTotalCents: 1043,
  selectedVariantOptionName: 'Spaghetti',
  selectedAddonOptionNames: ['Extra cheese'],
});
const fanta = item({ productName: 'Fanta', unitPriceCents: 447, lineTotalCents: 447 });
const combo = (line: number) => ({ line, productId: 'p-deal', name: 'Lunch deal' });

test('no combo items: one row per item', () => {
  const rows = groupOrderItems([pasta, fanta]);
  expect(rows).toEqual([
    { kind: 'item', label: 'Pomodoro English', quantity: 1, detail: 'Spaghetti · Extra cheese', totalCents: 1043 },
    { kind: 'item', label: 'Fanta', quantity: 1, detail: '', totalCents: 447 },
  ]);
});

test('combo with two components collapses to one row', () => {
  const rows = groupOrderItems([
    { ...pasta, combo: combo(1) },
    { ...fanta, combo: combo(1) },
  ]);
  expect(rows).toEqual([
    {
      kind: 'combo',
      label: 'Lunch deal',
      totalCents: 1490,
      components: ['Pomodoro English (Spaghetti, Extra cheese)', 'Fanta'],
    },
  ]);
});

test('mixed combo and standalone items keep first-appearance order; lines stay separate', () => {
  const rows = groupOrderItems([
    item({ productName: 'Tiramisu', lineTotalCents: 500 }),
    { ...pasta, combo: combo(1) },
    item({ productName: 'Water', lineTotalCents: 250 }),
    { ...fanta, combo: combo(1) },
    { ...fanta, combo: combo(2) },
  ]);
  expect(rows.map((r) => [r.kind, r.label, r.totalCents])).toEqual([
    ['item', 'Tiramisu', 500],
    ['combo', 'Lunch deal', 1490],
    ['item', 'Water', 250],
    ['combo', 'Lunch deal', 447],
  ]);
});

test('combo field absent or null behaves like no combo', () => {
  const items = [pasta, fanta];
  expect(groupOrderItems(items.map((i) => ({ ...i, combo: null })))).toEqual(groupOrderItems(items));
  expect(groupOrderItems(items).every((r) => r.kind === 'item')).toBe(true);
});

test('component quantity other than 1 is kept', () => {
  const [row] = groupOrderItems([{ ...fanta, quantity: 2, combo: combo(1) }]);
  expect(row).toMatchObject({ kind: 'combo', components: ['2 × Fanta'] });
});
