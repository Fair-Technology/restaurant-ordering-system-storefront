import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleX, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Icon above the title: a bin for removing something, a crossed circle for cancelling */
  icon?: 'remove' | 'cancel';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmModal — asks once before something that can't simply be undone (removing a dish,
 * cancelling an order). Same family as the closed/paused popup: icon, title, short text,
 * then the safe choice and the red one side by side (stacked on phones, red on top).
 * Escape or a click beside it keeps things as they are; focus starts on the safe choice.
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon = 'remove',
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!isOpen) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;
  const Icon = icon === 'cancel' ? CircleX : Trash2;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1101] w-full max-w-[380px] rounded-[20px] bg-white px-5 pb-[18px] pt-6 text-center text-gray-900 shadow-[0_24px_60px_rgba(31,26,23,0.25)] sm:px-[26px] sm:pb-[22px] sm:pt-[26px]"
      >
        <span
          aria-hidden="true"
          className="mx-auto hidden h-12 w-12 items-center justify-center rounded-full bg-[#fdeceb] text-[#b42318] sm:flex"
        >
          <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
        </span>
        <h3 id={titleId} className="font-display text-[21px] font-semibold leading-tight sm:mt-3 sm:text-[22px]">
          {title}
        </h3>
        <p className="mt-2 text-[15px] leading-normal text-gray-600">{message}</p>
        <div className="mt-[18px] flex flex-col-reverse gap-2 sm:mt-5 sm:flex-row sm:gap-2.5">
          <button
            ref={keepRef}
            type="button"
            onClick={onCancel}
            className="h-12 w-full rounded-full sm:flex-1 border-[1.5px] border-[#e3d9ce] bg-white text-[15px] font-bold text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 w-full rounded-full sm:flex-1 bg-[#b42318] text-[15px] font-bold text-white transition-colors hover:bg-[#981b14] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmModal;
