import { CSSProperties, useEffect, useMemo } from 'react';
import type { ResolvedBranding } from '../utils/branding';
import { onAccentColor } from '../utils/contrast';

/**
 * Applies the shop's accent colour as CSS custom properties on <html> and
 * returns an inline style object for the page wrapper element.
 *
 * We set properties on `document.documentElement` (the <html> element) rather
 * than the wrapper div because portal-rendered elements — the NavBar cart
 * dropdown and ProductModal — sit outside the wrapper in the DOM tree but
 * still need access to the brand colour via var(--brand-accent) etc.
 *
 * @param branding - Resolved branding object from resolveShopBranding()
 * @returns CSSProperties object to spread onto the page wrapper <div>
 */
export function useBrandingStyle(branding: ResolvedBranding): CSSProperties {
  const accent = branding.accentColor;
  const onAccent = onAccentColor(accent);

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--brand-accent', accent);
    rootStyle.setProperty('--brand-on-accent', onAccent);
  }, [accent, onAccent]);

  return useMemo(
    () =>
      ({
        '--brand-accent': accent,
        '--brand-on-accent': onAccent,
      }) as CSSProperties,
    [accent, onAccent],
  );
}
