import { useSyncExternalStore } from 'react';

/**
 * Preview mode — the storefront shown inside the admin app ("Live-Vorschau").
 *
 * The admin embeds `/shops/<slug>?preview=1` in a frame. In that mode the page looks exactly as
 * customers see it, plus three things:
 * - the admin can send the dish being edited (unsaved name, description, price, availability),
 *   which is shown in place of the saved one, so typing shows up live;
 * - clicking a dish tells the admin which one was clicked (the admin opens it in its editor);
 * - checkout and the closed/paused popups are switched off.
 *
 * Nothing is saved from here and no owner login is involved: the frame only changes what this one
 * browser tab displays. Messages are plain objects tagged with `source: 'fair-preview'`.
 */
export const PREVIEW_SOURCE = 'fair-preview';

/** The dish being edited in the admin, as far as the preview can show it before saving. */
export interface PreviewDish {
  id: string;
  /** Language the texts are in; applied only when the menu is shown in that language */
  lang?: string | null;
  name: string;
  description: string;
  priceCents: number;
  isAvailable: boolean;
}

export type AdminToPreview =
  | { source: typeof PREVIEW_SOURCE; type: 'dish'; dish: PreviewDish | null }
  | { source: typeof PREVIEW_SOURCE; type: 'focus'; productId: string | null; open: boolean }
  | { source: typeof PREVIEW_SOURCE; type: 'refresh' }
  | { source: typeof PREVIEW_SOURCE; type: 'language'; lang: string };

export type PreviewToAdmin =
  | { source: typeof PREVIEW_SOURCE; type: 'ready' }
  | { source: typeof PREVIEW_SOURCE; type: 'select'; productId: string };

const SESSION_KEY = 'fair_preview_v1';
let previewOn: boolean | null = null;

/** True inside the admin's preview frame: `?preview=1` on the first page (remembered for the tab) and embedded in a frame. */
export function isPreviewMode(): boolean {
  if (previewOn === null) {
    let flag = false;
    try {
      flag = new URLSearchParams(window.location.search).get('preview') === '1';
      if (flag) sessionStorage.setItem(SESSION_KEY, '1');
      else flag = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      // storage blocked: only the first page counts as preview
    }
    previewOn = flag && window.parent !== window;
  }
  return previewOn;
}

export function isAdminMessage(data: unknown): data is AdminToPreview {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as { source?: unknown; type?: unknown };
  return d.source === PREVIEW_SOURCE && ['dish', 'focus', 'refresh', 'language'].includes(d.type as string);
}

/** Tell the admin around the frame something (ignored outside preview mode). */
export function postToAdmin(message: { type: 'ready' } | { type: 'select'; productId: string }): void {
  if (!isPreviewMode()) return;
  window.parent.postMessage({ source: PREVIEW_SOURCE, ...message } satisfies PreviewToAdmin, '*');
}

// ── Live state sent by the admin ──────────────────────────────────────────────

interface PreviewState {
  dish: PreviewDish | null;
  focusId: string | null;
}

let state: PreviewState = { dish: null, focusId: null };
const listeners = new Set<() => void>();

function setState(next: Partial<PreviewState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function usePreviewState(): PreviewState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Event a dish card listens to so the admin can open (or close, with id null) its popup. */
export const PREVIEW_OPEN_EVENT = 'fair-preview-open';

/**
 * Starts listening to the admin. `onRefresh` reloads the menu after a save, `onLanguage` switches
 * the menu language. Returns the stop function.
 */
export function startPreviewBridge(handlers: { onRefresh: () => void; onLanguage: (lang: string) => void }): () => void {
  if (!isPreviewMode()) return () => {};
  document.documentElement.classList.add('fair-preview');
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent || !isAdminMessage(event.data)) return;
    const msg = event.data;
    if (msg.type === 'dish') setState({ dish: msg.dish });
    else if (msg.type === 'refresh') handlers.onRefresh();
    else if (msg.type === 'language') handlers.onLanguage(msg.lang);
    else if (msg.type === 'focus') {
      setState({ focusId: msg.productId });
      if (msg.productId) {
        document
          .querySelector(`[data-preview-dish="${CSS.escape(msg.productId)}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_EVENT, { detail: msg.open ? msg.productId : null }));
    }
  };
  window.addEventListener('message', onMessage);
  postToAdmin({ type: 'ready' });
  return () => window.removeEventListener('message', onMessage);
}

/** The dish with the admin's unsaved edits applied (when it is the one being edited and in the shown language). */
export function withPreviewEdits<T extends { id: string; label: string; description?: string; price: number }>(
  product: T,
  dish: PreviewDish | null,
  shownLanguage: string,
): T {
  if (!dish || dish.id !== product.id) return product;
  if (dish.lang && dish.lang !== shownLanguage) return { ...product, price: dish.priceCents / 100 };
  return { ...product, label: dish.name || product.label, description: dish.description, price: dish.priceCents / 100 };
}
