// Pure helpers for the checkout "When?" choice. Slots are quarter-hour UTC instants
// sent by the server; labels are shown in the restaurant's own time zone.

export type WhenChoice = 'asap' | 'later';

/** What the "When?" choice really is: later is only possible with slots, as soon as possible only while open. */
export function effectiveWhen(choice: WhenChoice | null, openNow: boolean, hasSlots: boolean): WhenChoice {
  if (!hasSlots) return 'asap';
  if (choice === 'later') return 'later';
  if (choice === 'asap' && openNow) return 'asap';
  return openNow ? 'asap' : 'later';
}

export interface SlotOption {
  iso: string;
  label: string;
}

export interface SlotDay {
  key: string;
  label: string;
  times: SlotOption[];
}

function localeFor(lang: string): string {
  return lang === 'de' ? 'de-DE' : 'en-GB';
}

export function slotDays(slots: readonly string[], timeZone: string, lang: string): SlotDay[] {
  const locale = localeFor(lang);
  const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'short', day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' });
  const out: SlotDay[] = [];
  for (const iso of slots) {
    const d = new Date(iso);
    const key = keyFmt.format(d);
    let day = out[out.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayFmt.format(d), times: [] };
      out.push(day);
    }
    day.times.push({ iso, label: timeFmt.format(d) });
  }
  return out;
}

/** 'Saturday, 10 October, 18:00' / 'Samstag, 10. Oktober, 18:00' — the same wording as the backend email. */
export function slotLabel(iso: string, timeZone: string, lang: string): string {
  const locale = localeFor(lang);
  const d = new Date(iso);
  const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(d);
  const dayMonth = new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'long' }).format(d);
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${weekday}, ${dayMonth}, ${time}`;
}
