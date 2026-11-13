import { useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useGetShopBySlugQuery } from '../api/endpoints';

/** Must match the <title> shipped in index.html. */
const SHELL_TITLE = 'Restaurant Ordering System';

/**
 * Keeps the single shell <title> in sync with the route on CLIENT-SIDE
 * navigation (the Function only sets it on a full page load).
 *
 * - Mutates `document.title` only; never renders a <title>/<meta> (no duplicates).
 * - Never writes og:* tags (the Function owns them).
 * - Title is the shop name only; nothing path/query-derived (order id, token).
 * - First load is left alone: a deep link already carries the Function's title.
 * - Non-shop routes restore the baseline shell title.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  const slug = matchPath({ path: '/shops/:slug', end: false }, pathname)?.params.slug;

  // Slug at first render; its title was set server-side, so don't rewrite it.
  const initialSlug = useRef<string | undefined | null>(slug);
  // Baseline = the shipped shell title. If we landed on a shop deep link the live
  // title is already per-shop, so fall back to the known shell constant.
  const baseline = useRef<string>(slug ? SHELL_TITLE : document.title || SHELL_TITLE);
  // True once the tab shows something this hook (or the Function) put there for a shop.
  const shopTitleShown = useRef(false);

  const { currentData } = useGetShopBySlugQuery(slug ?? '', { skip: !slug });
  const name = currentData?.name;

  useEffect(() => {
    if (slug !== initialSlug.current) initialSlug.current = null;

    if (!slug) {
      if (shopTitleShown.current) {
        document.title = baseline.current;
        shopTitleShown.current = false;
      }
      return;
    }
    if (name) {
      if (slug !== initialSlug.current) document.title = name;
      shopTitleShown.current = true;
    } else if (shopTitleShown.current && slug !== initialSlug.current) {
      // New shop still loading (or unknown): don't leave the previous shop's name.
      document.title = baseline.current;
    }
  }, [slug, name]);
}
