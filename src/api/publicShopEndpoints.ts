// Hand-written endpoint for the diner home page's restaurant list. Kept out of endpoints.ts because
// that file is generated; shapes mirror the backend's src/application/shop/getPublicShops/dtos.ts.
import { api } from './endpoints';
import type { WeeklyHours } from '../utils/openingHours';

export interface PublicShopSummary {
  id: string;
  slug: string;
  name: string;
  address: { city: string | null; postcode: string | null };
  branding: {
    logoUrl: string | null;
    heroImageUrl: string | null;
    accentColor: string | null;
    showHero: boolean;
  } | null;
  openingHours: WeeklyHours;
  timezone: string;
  ordersPaused: boolean;
}

export interface PublicShopListResponse {
  shops: PublicShopSummary[];
}

export const publicShopApi = api.injectEndpoints({
  endpoints: (b) => ({
    listPublicShops: b.query<PublicShopListResponse, void>({
      query: () => ({ url: '/shops/public' }),
      providesTags: ['Shops'],
    }),
  }),
});

export const { useListPublicShopsQuery } = publicShopApi;
