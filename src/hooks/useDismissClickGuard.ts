import { useCallback, useEffect, useRef } from 'react';

/** How long after an overlay closes stray clicks are swallowed, in milliseconds. */
export const CLOSE_CLICK_GUARD_MS = 250;

/** Pointer and mouse events that make up a (double) click. */
const GUARDED_EVENTS = [
  'pointerdown',
  'mousedown',
  'mouseup',
  'pointerup',
  'click',
  'dblclick',
  'auxclick',
] as const;

type ActiveGuard = { listener: (event: Event) => void; timer: ReturnType<typeof setTimeout> };

/**
 * useDismissClickGuard — swallows stray pointer/mouse clicks for a short window after an overlay closes.
 *
 * Why: a modal that closes from its own button (e.g. "Add to order") unmounts straight away. The
 * second click of a double-click then lands on whatever is now underneath — a cart bar link, another
 * dish card — and fires it. The returned `guard()` installs a capture-phase listener on `document`
 * that cancels those events: `stopPropagation()` keeps them from reaching React's listeners (which sit
 * on the app root, below `document`), and `preventDefault()` blocks native default actions such as an
 * `<a>` navigation.
 *
 * Call `guard()` synchronously from the **pointer/click** close path (the click handler that closes
 * the overlay), before calling `onClose()`. It has to be armed before the browser dispatches the next
 * click of the double-click; arming it later (in an effect, after a re-render) can be too late. A
 * keyboard close (Escape) must not arm the guard: it has no stray second click to defend against, and
 * the window would swallow the user's next intentional click.
 *
 * The listener removes itself after `windowMs`; calling `guard()` again re-arms it. It is also removed
 * on unmount. No React state is used, so arming the guard never causes a re-render. SSR-safe: without
 * a `document` it does nothing.
 */
export function useDismissClickGuard(windowMs: number = CLOSE_CLICK_GUARD_MS): () => void {
  const activeRef = useRef<ActiveGuard | null>(null);

  const release = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    clearTimeout(active.timer);
    if (typeof document !== 'undefined') {
      GUARDED_EVENTS.forEach((type) => document.removeEventListener(type, active.listener, true));
    }
    activeRef.current = null;
  }, []);

  const guard = useCallback(() => {
    if (typeof document === 'undefined') return;
    release();
    const listener = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    GUARDED_EVENTS.forEach((type) => document.addEventListener(type, listener, true));
    const timer = setTimeout(release, windowMs);
    activeRef.current = { listener, timer };
  }, [release, windowMs]);

  // Never leave the listener behind when the owning component goes away
  useEffect(() => release, [release]);

  return guard;
}
