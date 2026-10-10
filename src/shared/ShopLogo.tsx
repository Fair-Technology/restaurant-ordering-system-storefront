import React, { useState } from 'react';
import { DEFAULT_ACCENT } from '../utils/branding';

// Two letters from the shop name ("Ma Pasta" → "MA"), shown when no logo is
// uploaded — a logo is optional, so the storefront never shows a stock image.
export const shopInitials = (name: string): string =>
  (name.match(/\p{L}|\p{N}/gu) ?? []).slice(0, 2).join('').toUpperCase();

interface ShopLogoProps {
  name: string;
  logoUrl: string | null;
  className: string;
  // Classes for an uploaded logo that isn't square: same height as the square,
  // width follows the logo (w-auto) up to a cap, and the whole logo is shown
  wideClassName: string;
  textClassName: string;
  // Pages without a shop's branding variables (the home list) pass it directly
  accentColor?: string;
}

// Within 5% of square counts as square, so those logos look exactly as before.
const isSquare = (w: number, h: number): boolean => Math.abs(w / h - 1) < 0.05;

const ShopLogo: React.FC<ShopLogoProps> = ({
  name,
  logoUrl,
  className,
  wideClassName,
  textClassName,
  accentColor,
}) => {
  const [square, setSquare] = useState(true);
  return logoUrl ? (
    <img
      src={logoUrl}
      alt={name}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setSquare(
          naturalWidth <= 0 ||
            naturalHeight <= 0 ||
            isSquare(naturalWidth, naturalHeight),
        );
      }}
      className={
        square
          ? `${className} object-cover`
          : `${wideClassName} shrink-0 object-contain`
      }
    />
  ) : (
    <span
      role="img"
      aria-label={name}
      className={`${className} ${textClassName} flex items-center justify-center font-semibold text-white`}
      style={{
        backgroundColor:
          accentColor ?? `var(--brand-accent, ${DEFAULT_ACCENT})`,
      }}
    >
      {shopInitials(name)}
    </span>
  );
};

export default ShopLogo;
