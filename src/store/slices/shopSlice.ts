import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type FulfilmentMode = 'collection' | 'delivery' | 'dine_in';

export interface ShopState {
  activeShopId: string | null;
  menuLanguage: string | null;
  /** Language the catalog actually came back in (the shop may not offer the visitor's own). */
  resolvedMenuLanguage: string | null;
  currency: string | null;
}

const initialState: ShopState = {
  activeShopId: null,
  menuLanguage: null,
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
    },
    setResolvedMenuLanguage(state, action: PayloadAction<string>) {
      state.resolvedMenuLanguage = action.payload;
    },
  },
});

export const { setActiveShop, clearActiveShop, setMenuLanguage, setResolvedMenuLanguage } = shopSlice.actions;
export const shopReducer = shopSlice.reducer;
