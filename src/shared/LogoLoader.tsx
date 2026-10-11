import React from 'react';
import { shopInitials } from './ShopLogo';

interface LogoLoaderProps {
  /** The restaurant's logo; without one its initials are used */
  logoUrl: string | null | undefined;
  /** Shop name, for the initials fallback */
  name: string;
  /** Diameter in px */
  size?: number;
  /** What is being waited for, read out by screen readers (the animation itself is decorative) */
  label?: string;
  /** Inside a container that already announces the loading text: hide the loader from screen readers */
  decorative?: boolean;
  className?: string;
}

/**
 * LogoLoader — loading indicator built from the restaurant's own logo ("Uhrzeiger" / clock-wipe).
 *
 * The logo sits greyed out in a white badge while a clock hand in the shop's brand colour sweeps
 * round, revealing the logo in full colour behind it; then it starts again. The sweep is a CSS
 * conic-gradient mask driven by an animated custom property (see `.logo-loader-*` in main.css).
 * With "reduce motion" switched on, the logo is simply shown in colour, without movement.
 */
const LogoLoader: React.FC<LogoLoaderProps> = ({ logoUrl, name, size = 120, label, decorative = false, className = '' }) => {
  const initials = shopInitials(name);
  const face = (extra: string) =>
    logoUrl ? (
      <img src={logoUrl} alt="" className={`block h-full w-full object-contain ${extra}`} draggable={false} />
    ) : (
      // Drawn with CSS content, so the initials are never read as part of the page text
      <span
        data-initials={initials}
        className={`flex h-full w-full items-center justify-center font-bold before:content-[attr(data-initials)] ${extra}`}
        style={{ fontSize: Math.round(size * 0.28) }}
      />
    );

  return (
    <div
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#efe7de] bg-white shadow-[0_6px_18px_rgba(31,26,23,0.10)] ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="relative" style={{ width: '72%', height: '72%' }} aria-hidden="true">
        {/* Greyed-out logo underneath */}
        <div className="absolute inset-0 opacity-35 grayscale">{face(logoUrl ? '' : 'text-gray-500')}</div>
        {/* Full-colour logo, revealed by the sweeping mask */}
        <div className="logo-loader-top absolute inset-0">{face(logoUrl ? '' : 'text-[var(--brand-accent,#1f1a17)]')}</div>
      </div>
      {/* The clock hand */}
      <span
        aria-hidden="true"
        className="logo-loader-hand absolute left-[calc(50%-1px)] top-0 h-1/2 w-0.5 rounded-full bg-[var(--brand-accent,#1f1a17)] opacity-60"
      />
    </div>
  );
};

export default LogoLoader;
