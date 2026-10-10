import type { ShopResponse } from '../api/endpoints';
import defaultCoverUrl from '../assets/default-cover.jpg';

export type ShopBranding = {
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  accentColor?: string | null;
  showHero?: boolean;
};

export type ShopWithBranding = ShopResponse & {
  branding?: ShopBranding | null;
};

export const DEFAULT_ACCENT = '#C2410C';

export const DEFAULT_BRANDING = { heroImageUrl: defaultCoverUrl };

export type ResolvedBranding = {
  // null when no logo is uploaded — render <ShopLogo> to show initials instead
  logoUrl: string | null;
  heroImageUrl: string;
  // false when the shop switched its banner off: show no banner at all, not even the default photo
  showHero: boolean;
  accentColor: string;
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const resolveShopBranding = (
  branding?: ShopBranding | null
): ResolvedBranding => ({
  logoUrl: branding?.logoUrl || null,
  heroImageUrl: branding?.heroImageUrl || DEFAULT_BRANDING.heroImageUrl,
  showHero: branding?.showHero !== false,
  accentColor: HEX_COLOR_PATTERN.test(branding?.accentColor ?? '')
    ? (branding!.accentColor as string)
    : DEFAULT_ACCENT,
});
