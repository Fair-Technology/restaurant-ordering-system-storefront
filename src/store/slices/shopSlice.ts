import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type FulfilmentMode = 'collection' | 'delivery' | 'dine_in';

export interface ShopState {
  activeShopId: string | null;
  menuLanguage: string | null;
  currency: string | null;
  fulfilmentMode: FulfilmentMode | null;
}

const initialState: ShopState = {
  activeShopId: null,
  menuLanguage: null,
  currency: null,
  fulfilmentMode: null,
};

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setActiveShop(state, action: PayloadAction<{ shopId: string; currency?: string }>) {
      state.activeShopId = action.payload.shopId;
      if (action.payload.currency) state.currency = action.payload.currency;
    },
    clearActiveShop(state) {
      state.activeShopId = null;
    },
    setFulfilmentMode(state, action: PayloadAction<FulfilmentMode>) {
      state.fulfilmentMode = action.payload;
    },
    setMenuLanguage(state, action: PayloadAction<string>) {
      state.menuLanguage = action.payload;
    },
  },
});

export const { setActiveShop, clearActiveShop, setMenuLanguage, setFulfilmentMode } = shopSlice.actions;
export const shopReducer = shopSlice.reducer;
