import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ShopState {
  activeShopId: string | null;
  menuLanguage: string | null;
}

const initialState: ShopState = {
  activeShopId: null,
  menuLanguage: null,
};

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setActiveShop(state, action: PayloadAction<{ shopId: string }>) {
      state.activeShopId = action.payload.shopId;
    },
    clearActiveShop(state) {
      state.activeShopId = null;
    },
    setMenuLanguage(state, action: PayloadAction<string>) {
      state.menuLanguage = action.payload;
    },
  },
});

export const { setActiveShop, clearActiveShop, setMenuLanguage } = shopSlice.actions;
export const shopReducer = shopSlice.reducer;
