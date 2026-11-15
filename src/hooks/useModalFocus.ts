import { useEffect, useRef } from 'react';

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbableIn(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      el.getClientRects().length > 0 &&
      el.closest('[aria-hidden="true"]') === null,
  );
}

// While open: lock page scroll, close on Escape, keep Tab inside the dialog, and hand focus back to the opener on close
export function useModalFocus(isOpen: boolean, onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  // The latest onClose lives in a ref so the effect below runs on open/close only.
  // Callers pass an inline arrow; depending on it would re-run the effect every render and pull focus back mid-interaction.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = tabbableIn(dialog);
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !active || !dialog.contains(active);
      if (e.shiftKey) {
        if (outside || active === dialog || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (outside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Focus that lands outside the dialog (pointer, script, screen reader) is pulled back in
    const onFocusIn = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || (e.target instanceof Node && dialog.contains(e.target))) return;
      (tabbableIn(dialog)[0] ?? dialog).focus();
    };

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
