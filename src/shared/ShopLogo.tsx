import React, { useState } from 'react';
import { DEFAULT_ACCENT } from '../utils/branding';

// Two letters from the shop name ("Ma Pasta" → "MA"), shown when no logo is
// uploaded — a logo is optional, so the storefront never shows a stock image.
export const shopInitials = (name: string): string =>
  (name.match(/\p{L}|\p{N}/gu) ?? []).slice(0, 2).join('').toUpperCase();

interface ShopLogoProps {
  name: string;
  logoUrl: string | null;
  // Size and look of the initials fallback
  className: string;
  // An uploaded logo is shown bare — size only, no border, ring, fill or rounding
  logoClassName: string;
  // Size of an uploaded logo that isn't square: same height as the square,
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
  logoClassName,
  wideClassName,
  textClassName,
  accentColor,
}) => {
  const [square, setSquare] = useState(true);
  // Natural pixel size, exposed as CSS variables so callers can stop a small
  // logo being scaled up (and blurred) with max-w-[var(--logo-w)] etc.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  return logoUrl ? (
    <img
      src={logoUrl}
      alt={name}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setNatural(
          naturalWidth > 0 && naturalHeight > 0
            ? { w: naturalWidth, h: naturalHeight }
            : null,
        );
        setSquare(
          naturalWidth <= 0 ||
            naturalHeight <= 0 ||
            isSquare(naturalWidth, naturalHeight),
        );
      }}
      style={
        natural
          ? ({
              '--logo-w': `${natural.w}px`,
              '--logo-h': `${natural.h}px`,
            } as React.CSSProperties)
          : undefined
      }
      className={
        square
          ? `${logoClassName} object-contain`
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
