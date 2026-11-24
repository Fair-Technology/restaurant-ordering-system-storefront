/**
 * Derived image variant URLs (rs-backend adds "thumb"/"card" siblings for every uploaded
 * image by inserting `-thumb`/`-card` before the file extension — no API field for this,
 * it's derived client-side from the canonical url). Images confirmed before that backend
 * change have no siblings and 404 if requested directly, so every srcset built from these
 * MUST keep the canonical url as the largest/last candidate (native srcset falls back to it
 * when a smaller candidate 404s).
 */
export type ImageVariant = 'thumb' | 'card';

export const imageVariantUrl = (url: string, variant: ImageVariant): string =>
  url.replace(/(\.[a-zA-Z0-9]+)(\?.*)?$/, (_match, ext, query) => `-${variant}${ext}${query ?? ''}`);

/** Dish photo: thumb (400x300) + card (800x600) + canonical (1200x900) fallback. */
export const dishImageSrcSet = (url: string): string =>
  `${imageVariantUrl(url, 'thumb')} 400w, ${imageVariantUrl(url, 'card')} 800w, ${url} 1200w`;

/** Shop cover/hero: card (960x320) + canonical (1920x640) fallback. */
export const shopCoverSrcSet = (url: string): string =>
  `${imageVariantUrl(url, 'card')} 960w, ${url} 1920w`;

/** Shop logo: thumb (160x160 contain) + canonical (640x96 contain) fallback. */
export const shopLogoSrcSet = (url: string): string =>
  `${imageVariantUrl(url, 'thumb')} 160w, ${url} 640w`;
