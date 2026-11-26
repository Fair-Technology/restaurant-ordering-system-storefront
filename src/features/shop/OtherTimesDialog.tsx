import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import type { OrderCopy } from '../../utils/orderCopy';
import { useModalFocus } from '../../hooks/useModalFocus';
import { capitalise, plainDateText, scheduleWindowText } from '../../utils/categoryTimes';
import { slotDays } from '../../utils/slots';
import { bookability, entrySlots, type OtherTimeEntry } from '../../utils/otherTimes';

interface OtherTimesDialogProps {
  entries: OtherTimeEntry[];
  /** Bookable moments from the empty-basket quote; empty = nothing can be booked, so a plain list */
  slots: string[];
  /** Booking window in days, from the quote; null until it is known */
  horizonDays: number | null;
  timeZone: string;
  lang: string;
  copy: OrderCopy;
  /** Reopened from the banner: start on this entry's day/time step, with this moment selected */
  initial?: { entry: OtherTimeEntry; iso: string } | null;
  /** Resolves to the names of basket items that would be removed; rejects when the basket cannot be checked */
  checkBasket: (iso: string) => Promise<string[]>;
  /** "Back to now" found items not served now: confirm-only view naming them */
  backToNow?: { names: string[] } | null;
  onBackToNow: () => void;
  onApply: (iso: string, entry: OtherTimeEntry) => void;
  onClose: () => void;
}

const field =
  'h-12 w-full rounded-xl border-[1.5px] border-[#cfc4b8] bg-white px-3 text-[15px] text-gray-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]';
const primary =
  'inline-flex h-12 w-full items-center justify-center rounded-full bg-gray-900 px-5 text-base font-bold text-white transition-colors hover:bg-black disabled:opacity-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2';
const secondary =
  'inline-flex h-12 w-full items-center justify-center rounded-full border-[1.5px] border-gray-900 bg-white px-5 text-base font-bold text-gray-900 transition-colors hover:bg-[#f6f1eb] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2';

/**
 * The "Other times" modal: a list of what is served at other times, and — when the shop takes orders for
 * later — a day and time step for the entry the diner taps. Choosing a time first checks the basket; items
 * that would not be served then are named, and only removed if the diner confirms.
 */
const OtherTimesDialog: React.FC<OtherTimesDialogProps> = ({
  entries,
  slots,
  horizonDays,
  timeZone,
  lang,
  copy,
  initial,
  checkBasket,
  backToNow,
  onBackToNow,
  onApply,
  onClose,
}) => {
  const titleId = useId();
  const dialogRef = useModalFocus(true, onClose);
  const [picked, setPicked] = useState<OtherTimeEntry | null>(initial?.entry ?? null);
  const canBook = slots.length > 0 && horizonDays !== null;
  const now = useMemo(() => new Date(), []);

  const pickedSlots = useMemo(
    () => (picked ? entrySlots(picked.schedule, slots, timeZone) : []),
    [picked, slots, timeZone],
  );
  const days = useMemo(() => slotDays(pickedSlots, timeZone, lang), [pickedSlots, timeZone, lang]);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [timeIso, setTimeIso] = useState<string | null>(null);
  const day =
    days.find((d) => d.key === dayKey) ??
    (initial && picked?.id === initial.entry.id ? days.find((d) => d.times.some((t) => t.iso === initial.iso)) : undefined) ??
    days[0];
  const time =
    day?.times.find((t) => t.iso === timeIso) ??
    (initial && picked?.id === initial.entry.id ? day?.times.find((t) => t.iso === initial.iso) : undefined) ??
    day?.times[0];

  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pickConflict, setConflict] = useState<{ names: string[]; iso: string } | null>(null);
  const conflict = pickConflict ?? (backToNow ? { names: backToNow.names, iso: '' } : null);

  async function confirm() {
    if (!picked || !time || checking) return;
    setChecking(true);
    setFailed(false);
    try {
      const names = await checkBasket(time.iso);
      if (names.length > 0) setConflict({ names, iso: time.iso });
      else onApply(time.iso, picked);
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  const when = (e: OtherTimeEntry) => {
    const s = e.schedule;
    const dates = copy.otherTimesDates(
      s.startDate && s.startDate.slice(0, 10) > now.toISOString().slice(0, 10) ? plainDateText(s.startDate, lang) : null,
      s.endDate ? plainDateText(s.endDate, lang) : null,
    );
    return `${capitalise(scheduleWindowText(s, lang))}${dates ? ` · ${dates}` : ''}`;
  };

  // The step's buttons are replaced when the step changes: keep focus inside the dialog
  const stepKey = conflict ? 'conflict' : picked ? 'pick' : 'list';
  useEffect(() => {
    dialogRef.current?.focus();
  }, [stepKey, dialogRef]);

  const heading = conflict ? copy.otherTimesRemoveTitle : picked ? copy.otherTimesChoose : copy.otherTimes;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="other-times-dialog"
        className="relative flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[20px] bg-white text-gray-900 shadow-[0_24px_60px_rgba(31,26,23,0.25)] sm:rounded-[20px]"
      >
        <div className="flex items-center gap-1 px-3 pt-3">
          {picked && !conflict && !initial ? (
            <button
              type="button"
              aria-label={copy.otherTimesBackToList}
              onClick={() => {
                setPicked(null);
                setDayKey(null);
                setTimeIso(null);
                setFailed(false);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#f6f1eb]"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <span className="w-3" />
          )}
          <h2 id={titleId} className="flex-1 font-display text-[20px] font-semibold leading-tight">
            {heading}
          </h2>
          <button
            type="button"
            aria-label={copy.otherTimesClose}
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#f6f1eb]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-2">
          {conflict ? (
            <div className="flex flex-col gap-4">
              <p role="alert" className="text-[15px] leading-relaxed text-[#3a322d]">
                {copy.otherTimesRemoveText(conflict.names.join(', '))}
              </p>
              <button type="button" className={primary} onClick={() => (backToNow ? onBackToNow() : picked && onApply(conflict.iso, picked))}>
                {copy.otherTimesRemoveConfirm}
              </button>
              <button type="button" className={secondary} onClick={() => (backToNow ? onClose() : setConflict(null))}>
                {copy.otherTimesKeep}
              </button>
            </div>
          ) : picked ? (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] font-bold">{picked.name}</p>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#3a322d]">
                {copy.slotDay}
                <select
                  className={field}
                  value={day?.key ?? ''}
                  onChange={(e) => {
                    setDayKey(e.target.value);
                    setTimeIso(null);
                  }}
                >
                  {days.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#3a322d]">
                {copy.slotTime}
                <select className={field} value={time?.iso ?? ''} onChange={(e) => setTimeIso(e.target.value)}>
                  {(day?.times ?? []).map((t) => (
                    <option key={t.iso} value={t.iso}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {failed && (
                <p role="alert" className="rounded-xl border border-[#f6d3c1] bg-[#fdeee6] px-3 py-2 text-sm text-[#7c2a09]">
                  {copy.otherTimesCheckFailed}
                </p>
              )}
              <button type="button" className={primary} disabled={!time || checking} onClick={() => void confirm()}>
                {checking ? copy.otherTimesChecking : copy.otherTimesConfirm}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm leading-relaxed text-[#5c524b]">
                {entries.length === 0
                  ? copy.otherTimesNothing
                  : canBook
                    ? copy.otherTimesLead
                    : copy.otherTimesInfoOnly}
              </p>
              <ul data-testid="other-times" className="flex flex-col gap-1.5">
                {entries.map((e) => {
                  const b = canBook ? bookability(e.schedule, now, timeZone, horizonDays) : null;
                  const hasSlot = canBook && entrySlots(e.schedule, slots, timeZone).length > 0;
                  const tappable = b?.state === 'bookable' && hasSlot;
                  const body = (
                    <>
                      <span className="text-[15px] font-bold text-gray-900">{e.name}</span>
                      <span className="text-[13px] text-[#5c524b]">{when(e)}</span>
                      {b?.state === 'beyond' && (
                        <span className="text-[13px] font-semibold text-[#7a4a12]">
                          {copy.otherTimesPreorderFrom(plainDateText(b.preorderFrom, lang))}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {tappable ? (
                        <button
                          type="button"
                          onClick={() => setPicked(e)}
                          className="flex min-h-[48px] w-full flex-col items-start rounded-xl border border-[#efe7de] px-3 py-2.5 text-left hover:bg-[#f6f1eb] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                        >
                          {body}
                        </button>
                      ) : (
                        <div
                          data-testid="other-time-static"
                          className="flex min-h-[48px] w-full flex-col items-start rounded-xl bg-[#faf6f1] px-3 py-2.5 text-left"
                        >
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OtherTimesDialog;
