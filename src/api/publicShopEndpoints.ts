// Hand-written types for the diner home page's restaurant list; the endpoint is
// generated in endpoints.ts. Shapes mirror the backend's src/application/shop/getPublicShops/dtos.ts.
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

// The endpoint is generated (endpoints.ts: listPublicShops, GET /shops/public).
export const { useListPublicShopsQuery } = api;
