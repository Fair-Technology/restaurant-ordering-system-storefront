import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type FulfilmentMode = 'collection' | 'delivery' | 'dine_in';

export interface ShopState {
  activeShopId: string | null;
  menuLanguage: string | null;
  /** Language the catalog actually came back in (the shop may not offer the visitor's own). */
  resolvedMenuLanguage: string | null;
  currency: string | null;
}

/** One global key (not shop-scoped): the diner's page-language choice follows them across shops. */
const LANG_KEY = 'mewmew_lang_v1';

function persistLanguage(lang: string) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
}

function loadStoredLanguage(): string | null {
  try {
    return localStorage.getItem(LANG_KEY) || null;
  } catch {
    return null;
  }
}

const initialState: ShopState = {
  activeShopId: null,
  menuLanguage: loadStoredLanguage(),
  resolvedMenuLanguage: null,
  currency: null,
};

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setActiveShop(state, action: PayloadAction<{ shopId: string; currency?: string }>) {
      if (state.activeShopId !== action.payload.shopId) state.resolvedMenuLanguage = null;
      state.activeShopId = action.payload.shopId;
      if (action.payload.currency) state.currency = action.payload.currency;
    },
    clearActiveShop(state) {
      state.activeShopId = null;
    },
    setMenuLanguage(state, action: PayloadAction<string>) {
      state.menuLanguage = action.payload;
      persistLanguage(action.payload);
    },
    setResolvedMenuLanguage(state, action: PayloadAction<string>) {
      state.resolvedMenuLanguage = action.payload;
    },
  },
});

export const { setActiveShop, clearActiveShop, setMenuLanguage, setResolvedMenuLanguage } = shopSlice.actions;
export const shopReducer = shopSlice.reducer;
