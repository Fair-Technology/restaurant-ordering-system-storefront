import React from 'react';
import { DEFAULT_ACCENT } from '../utils/branding';

// Two letters from the shop name ("Ma Pasta" → "MA"), shown when no logo is
// uploaded — a logo is optional, so the storefront never shows a stock image.
export const shopInitials = (name: string): string =>
  (name.match(/\p{L}|\p{N}/gu) ?? []).slice(0, 2).join('').toUpperCase();

interface ShopLogoProps {
  name: string;
  logoUrl: string | null;
  className: string;
  textClassName: string;
  // Pages without a shop's branding variables (the home list) pass it directly
  accentColor?: string;
}

const ShopLogo: React.FC<ShopLogoProps> = ({ name, logoUrl, className, textClassName, accentColor }) =>
  logoUrl ? (
    <img src={logoUrl} alt={name} className={`${className} object-cover`} />
  ) : (
    <span
      role="img"
      aria-label={name}
      className={`${className} ${textClassName} flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: accentColor ?? `var(--brand-accent, ${DEFAULT_ACCENT})` }}
    >
      {shopInitials(name)}
    </span>
  );

export default ShopLogo;
