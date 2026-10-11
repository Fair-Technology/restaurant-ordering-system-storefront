import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CirclePause, Clock, Phone, WifiOff } from 'lucide-react';
import { telHref } from '../../utils/openingHours';

interface ShopNoticeModalProps {
  kind: 'closed' | 'paused' | 'offline';
  title: string;
  /** One or two short sentences */
  lines: string[];
  /** Paused only: the shop's phone number, for ordering by phone */
  phone?: string | null;
  phoneLabel?: string;
  okLabel: string;
  /** False for the offline popup: no OK button, no Escape, no click beside it */
  dismissible?: boolean;
  onClose: () => void;
}

/**
 * ShopNoticeModal — a small popup on the menu page when the shop is closed or has paused
 * online ordering. It sits over the page instead of pushing the menu down, and goes away with OK
 * (or Escape, or a click beside it). The offline kind cannot be closed at all.
 */
const ShopNoticeModal: React.FC<ShopNoticeModalProps> = ({ kind, title, lines, phone, phoneLabel, okLabel, dismissible = true, onClose }) => {
  const titleId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus OK once on open; Escape closes
  useEffect(() => {
    (okRef.current ?? dialogRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!dismissible) {
        // Not closable: Escape does nothing, and Tab stays on the dialog (phone link at most)
        if (e.key === 'Escape') e.preventDefault();
        if (e.key === 'Tab') {
          const items = dialogRef.current?.querySelectorAll<HTMLElement>('a[href]');
          if (!items || items.length === 0) {
            e.preventDefault();
          } else if (!dialogRef.current?.contains(document.activeElement) || document.activeElement === items[items.length - 1]) {
            e.preventDefault();
            items[0].focus();
          }
        }
        return;
      }
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissible]);

  const Icon = kind === 'closed' ? Clock : kind === 'paused' ? CirclePause : WifiOff;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[360px] rounded-[20px] bg-white px-6 pb-5 pt-6 text-center text-gray-900 shadow-[0_24px_60px_rgba(31,26,23,0.25)]"
      >
        <span
          aria-hidden="true"
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            kind === 'closed' ? 'bg-[#f4efe9] text-[#4a413b]' : 'bg-[#fdeee6] text-[#a8380c]'
          }`}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
        <h2 id={titleId} className="mt-3 font-display text-[22px] font-semibold leading-tight">
          {title}
        </h2>
        <div className="mt-2 flex flex-col gap-1.5 text-[15px] leading-relaxed text-gray-600">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {phone && (
          <p className="mt-3 text-sm text-gray-600">
            {phoneLabel}{' '}
            <a href={telHref(phone)} className="inline-flex items-center gap-1 font-semibold text-gray-900 underline underline-offset-2">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {phone}
            </a>
          </p>
        )}
        {dismissible && (
        <button
          ref={okRef}
          type="button"
          onClick={onClose}
          className="mt-5 h-12 w-full rounded-full bg-gray-900 text-base font-bold text-white transition-colors hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
        >
          {okLabel}
        </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ShopNoticeModal;
