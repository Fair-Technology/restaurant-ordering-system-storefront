import type { CartItem } from '../store/slices/cartSlice';
import type { Product } from '../types/Product';

/** True when any cart line is an age-restricted dish, or a combo with an age-restricted chosen component. */
export function cartHasAgeRestrictedItem(cartItems: readonly CartItem[], products: readonly Product[]): boolean {
  const byId = new Map(products.map((p) => [p.id, p]));
  return cartItems.some((item) => {
    if (byId.get(item.id)?.ageRestricted) return true;
    return (item.comboChoices ?? []).some((c) => {
      const product = byId.get(item.id);
      const option = product?.combo?.find((g) => g.id === c.groupId)?.options.find((o) => o.id === c.productId);
      return (option ?? byId.get(c.productId))?.ageRestricted === true;
    });
  });
}
