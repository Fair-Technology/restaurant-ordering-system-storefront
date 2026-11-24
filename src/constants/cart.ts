export const BASE_CART_KEY = 'cart_v1';

/**
 * Returns a localStorage key for the cart. If shopId is provided it will be scoped:
 *   cart_v1:<shopId>
 * otherwise:
 *   cart_v1:global
 */
export const cartKey = (shopId?: string) =>
  `${BASE_CART_KEY}:${shopId ? shopId : 'global'}`;
