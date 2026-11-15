import { useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useGetShopBySlugQuery } from '../api/endpoints';
import { useGetPlatformLegalQuery } from '../api/legalEndpoints';

/** Shipped in index.html; used only before the platform legal identity loads, or if that read fails. */
const FALLBACK_TITLE = 'Restaurant Ordering System';

/**
 * Keeps the single shell <title> in sync with the route.
 *
 * - The front-page (and every non-shop route) title is the platform legal identity's
 *   `platformName` (spec §16), never `operator.legalName`; FALLBACK_TITLE until it loads or if it fails.
 * - Mutates `document.title` only; never renders a <title>/<meta> (no duplicates).
 * - Never writes og:* tags (the Function owns them).
 * - On shop routes the title is the shop name only; nothing path/query-derived (order id, token).
 * - Shop deep-link first load is left alone: it already carries the Function's title.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  const slug = matchPath({ path: '/shops/:slug', end: false }, pathname)?.params.slug;

  // Slug at first render; its title was set server-side, so don't rewrite it.
  const initialSlug = useRef<string | undefined | null>(slug);

  const { currentData: platformLegal } = useGetPlatformLegalQuery();
  const platformName = platformLegal?.platformName?.trim() || FALLBACK_TITLE;

  const { currentData } = useGetShopBySlugQuery(slug ?? '', { skip: !slug });
  const name = currentData?.name;

  useEffect(() => {
    if (slug !== initialSlug.current) initialSlug.current = null;

    if (!slug) {
      document.title = platformName;
      return;
    }
    if (name) {
      if (slug !== initialSlug.current) document.title = name;
    } else if (slug !== initialSlug.current) {
      // New shop still loading (or unknown): don't leave the previous title.
      document.title = platformName;
    }
  }, [slug, name, platformName]);
}
