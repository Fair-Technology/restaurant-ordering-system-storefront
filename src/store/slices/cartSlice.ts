import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// shop-scoped storage key helper
const BASE_CART_KEY = 'mewmew_cart_v1';
const cartKey = (shopId?: string) => `${BASE_CART_KEY}:${shopId ?? 'global'}`;

export type CartComboChoice = {
  groupId: string;
  productId: string;
  variantId?: string;
  addonOptionIds?: string[];
};

export type CartItem = {
  key: string; // signature id::variant::addons
  id: string;
  name: string;
  imageUrl?: string;
  price: number; // unit price
  quantity: number;
  variantId?: string;
  addonOptionIds?: string[];
  comboChoices?: CartComboChoice[];
  detail?: string; // a combo's picks as shown in the basket
};

interface CartState {
  shopId?: string;
  items: CartItem[];
}

const initialState: CartState = {
  shopId: undefined,
  items: [],
};

/**
 * Generates a unique signature key for a cart line item.
 *
 * The same product can appear multiple times if ordered with different
 * variants or addons, so the key captures all three dimensions:
 *   productId :: selectedVariantOptionId :: sorted addon option IDs
 *
 * Addon IDs are sorted so that selecting them in any order produces the
 * same key — preventing duplicate entries for identical selections.
 *
 * e.g. "abc123::var-sm::addon1,addon2"
 *
 * A combo appends its picks, so two combos with different dishes stay separate lines.
 */
function makeSignature(payload: {
  id: string;
  variantId?: string;
  addonOptionIds?: string[];
  comboChoices?: CartComboChoice[];
}) {
  const addons = (payload.addonOptionIds || []).slice().sort().join(',');
  const base = `${payload.id}::${payload.variantId ?? ''}::${addons}`;
  if (!payload.comboChoices?.length) return base; // dish keys stay exactly as before
  const picks = payload.comboChoices
    .map((c) => `${c.groupId}=${c.productId}/${c.variantId ?? ''}/${(c.addonOptionIds ?? []).slice().sort().join('+')}`)
    .join(';');
  return `${base}::${picks}`;
}

/**
 * Persists the current cart to localStorage under a shop-scoped key.
 *
 * The try/catch is intentional: localStorage may be unavailable in private
 * browsing mode (Safari) or when storage quota is exceeded. Silently failing
 * is acceptable here because the in-memory Redux state remains correct and
 * the user can still complete their session.
 */
function persist(state: CartState) {
  try {
    localStorage.setItem(cartKey(state.shopId), JSON.stringify(state.items));
  } catch {}
}

function loadFromStorage(shopId?: string): CartItem[] {
  try {
    const raw = localStorage.getItem(cartKey(shopId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // load cart for a shop (reads localStorage scoped key)
    loadCart(state, action: PayloadAction<{ shopId?: string }>) {
      const { shopId } = action.payload;
      state.shopId = shopId;
      state.items = loadFromStorage(shopId);
    },
    addItem(
      state,
      action: PayloadAction<{
        shopId?: string;
        item: {
          id: string;
          name: string;
          imageUrl?: string;
          price: number;
          quantity?: number;
          variantId?: string;
          addonOptionIds?: string[];
          comboChoices?: CartComboChoice[];
          detail?: string;
        };
      }>
    ) {
      const { shopId, item } = action.payload;
      if (state.shopId !== shopId) {
        state.shopId = shopId;
        state.items = [];
      }
      const signature = makeSignature(item);
      const idx = state.items.findIndex((it) => it.key === signature);
      if (idx >= 0) {
        state.items[idx].quantity += item.quantity ?? 1;
      } else {
        state.items.push({
          key: signature,
          id: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          price: item.price,
          quantity: item.quantity ?? 1,
          variantId: item.variantId,
          addonOptionIds: item.addonOptionIds,
          comboChoices: item.comboChoices,
          detail: item.detail,
        });
      }
      persist(state);
    },
    removeItem(state, action: PayloadAction<{ key: string }>) {
      state.items = state.items.filter((it) => it.key !== action.payload.key);
      persist(state);
    },
    incrementItem(state, action: PayloadAction<{ key: string; by?: number }>) {
      const { key, by = 1 } = action.payload;
      const it = state.items.find((i) => i.key === key);
      if (it) {
        it.quantity += by;
        persist(state);
      }
    },
    decrementItem(state, action: PayloadAction<{ key: string; by?: number }>) {
      const { key, by = 1 } = action.payload;
      const it = state.items.find((i) => i.key === key);
      if (it) {
        it.quantity = Math.max(0, it.quantity - by);
        if (it.quantity === 0)
          state.items = state.items.filter((i) => i.key !== key);
        persist(state);
      }
    },
    setQuantity(
      state,
      action: PayloadAction<{ key: string; quantity: number }>
    ) {
      const { key, quantity } = action.payload;
      const it = state.items.find((i) => i.key === key);
      if (it) {
        it.quantity = Math.max(0, quantity);
        if (it.quantity === 0)
          state.items = state.items.filter((i) => i.key !== key);
        persist(state);
      }
    },
    // The server re-priced this line; adopt its price so the next quote matches
    setItemPrice(state, action: PayloadAction<{ key: string; price: number }>) {
      const it = state.items.find((i) => i.key === action.payload.key);
      if (it) {
        it.price = action.payload.price;
        persist(state);
      }
    },
    clearCart(state) {
      state.items = [];
      persist(state);
    },
  },
});

export const {
  loadCart,
  addItem,
  removeItem,
  incrementItem,
  decrementItem,
  setQuantity,
  setItemPrice,
  clearCart,
} = cartSlice.actions;

// Selectors
export const selectCartItems = (root: { cart: CartState }) => root.cart.items;
export const selectCartCount = (root: { cart: CartState }) =>
  root.cart.items.reduce((total, item) => total + item.quantity, 0);
export const selectCartTotal = (root: { cart: CartState }) =>
  root.cart.items.reduce((total, item) => total + item.price * item.quantity, 0);

export default cartSlice.reducer;
