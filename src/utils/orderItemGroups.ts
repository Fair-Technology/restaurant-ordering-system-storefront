import type { CustomerOrderDto } from '../api/orderEndpoints';

export type OrderItemDto = CustomerOrderDto['items'][number];

export type OrderRow =
  | { kind: 'item'; label: string; quantity: number; detail: string; totalCents: number }
  | { kind: 'combo'; label: string; totalCents: number; components: string[] };

/** "Spaghetti · Extra cheese" – the variant and extras of one item, empty when it has none. */
function itemDetail(item: OrderItemDto): string {
  return [item.selectedVariantOptionName, ...item.selectedAddonOptionNames].filter(Boolean).join(' · ');
}

/** One combo component, e.g. "Pomodoro (Spaghetti, Extra cheese)" (same style as comboDetail). */
function componentLabel(item: OrderItemDto): string {
  const more = [item.selectedVariantOptionName, ...item.selectedAddonOptionNames].filter(Boolean);
  const name = item.quantity === 1 ? item.productName : `${item.quantity} × ${item.productName}`;
  return more.length ? `${name} (${more.join(', ')})` : name;
}

/**
 * Display rows for an order: items sharing a combo line collapse into one row (combo name, summed
 * price, components underneath) at the position of the first such item; everything else is one row
 * per item. API order is preserved.
 */
export function groupOrderItems(items: readonly OrderItemDto[]): OrderRow[] {
  const rows: OrderRow[] = [];
  const combos = new Map<number, Extract<OrderRow, { kind: 'combo' }>>();
  for (const item of items) {
    if (!item.combo) {
      rows.push({
        kind: 'item',
        label: item.productName,
        quantity: item.quantity,
        detail: itemDetail(item),
        totalCents: item.lineTotalCents,
      });
      continue;
    }
    let row = combos.get(item.combo.line);
    if (!row) {
      row = { kind: 'combo', label: item.combo.name, totalCents: 0, components: [] };
      combos.set(item.combo.line, row);
      rows.push(row);
    }
    row.totalCents += item.lineTotalCents;
    row.components.push(componentLabel(item));
  }
  return rows;
}
