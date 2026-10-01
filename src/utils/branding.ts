import type { ShopResponse } from '../api/endpoints';

export type ShopBranding = {
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  accentColor?: string | null;
};

export type ShopWithBranding = ShopResponse & {
  branding?: ShopBranding | null;
};

export const DEFAULT_ACCENT = '#C2410C';

export const DEFAULT_BRANDING = {
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
  heroImageUrl:
    'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=1600&q=80',
};

export type ResolvedBranding = {
  logoUrl: string;
  heroImageUrl: string;
  accentColor: string;
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const resolveShopBranding = (
  branding?: ShopBranding | null
): ResolvedBranding => ({
  logoUrl: branding?.logoUrl || DEFAULT_BRANDING.logoUrl,
  heroImageUrl: branding?.heroImageUrl || DEFAULT_BRANDING.heroImageUrl,
  accentColor: HEX_COLOR_PATTERN.test(branding?.accentColor ?? '')
    ? (branding!.accentColor as string)
    : DEFAULT_ACCENT,
});
