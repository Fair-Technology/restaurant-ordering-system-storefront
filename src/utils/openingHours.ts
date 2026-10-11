export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export type WeeklyHours = Partial<Record<WeekDay, Array<{ open: string; close: string }>>>;

export interface HoursWords {
  dayShort: Record<WeekDay, string>;
  daily: string;
  closed: string;
  allDay: string;
}

/** One day's hours as text: "11:30 – 21:00", several windows joined, closed, or open all day. */
function dayText(slots: Array<{ open: string; close: string }> | undefined, w: HoursWords): string {
  if (!slots || slots.length === 0) return w.closed;
  if (slots.length === 1 && slots[0].open === slots[0].close) return w.allDay; // 00:00–00:00 = round the clock
  return slots.map((s) => `${s.open} – ${s.close}`).join(', ');
}

/**
 * Weekly hours as footer lines, with neighbouring days that share the same hours
 * grouped: "Mo – Sa: 11:30 – 21:00", "So: Ruhetag". Seven equal days become one
 * "Täglich" line.
 */
export function hoursLines(hours: WeeklyHours, w: HoursWords): string[] {
  const texts = WEEK_DAYS.map((d) => dayText(hours[d], w));
  if (texts.every((t) => t === texts[0])) return [`${w.daily}: ${texts[0]}`];
  const lines: string[] = [];
  let start = 0;
  for (let i = 1; i <= WEEK_DAYS.length; i++) {
    if (i < WEEK_DAYS.length && texts[i] === texts[start]) continue;
    const from = w.dayShort[WEEK_DAYS[start]];
    const to = w.dayShort[WEEK_DAYS[i - 1]];
    lines.push(`${start === i - 1 ? from : `${from} – ${to}`}: ${texts[start]}`);
    start = i;
  }
  return lines;
}

/** Google Maps directions to the address; opens the app on phones. Nothing is loaded until tapped. */
export function routeUrl(address: { street?: string; postcode?: string; city?: string; country?: string }): string | null {
  const place = [address.street, [address.postcode, address.city].filter(Boolean).join(' '), address.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
  if (!address.street?.trim() || !place) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
}

/** "069 / 2028 4438" → "tel:06920284438" */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Whether the shop is open at `now` (in `timeZone`, or the browser's zone) and until when.
 * Handles windows that run past midnight (close before open, counted from the day they start)
 * and round-the-clock days (open === close).
 */
export function openState(
  hours: WeeklyHours,
  now: Date = new Date(),
  timeZone?: string,
): { open: boolean; until?: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const day = (parts.find((p) => p.type === 'weekday')?.value ?? '').toLowerCase().slice(0, 3) as WeekDay;
  const idx = WEEK_DAYS.indexOf(day);
  if (idx < 0) return { open: false };
  const minutes = toMinutes(`${parts.find((p) => p.type === 'hour')?.value}:${parts.find((p) => p.type === 'minute')?.value}`);

  // A window from yesterday that runs past midnight
  for (const s of hours[WEEK_DAYS[(idx + 6) % 7]] ?? []) {
    const o = toMinutes(s.open);
    const c = toMinutes(s.close);
    if (c < o && minutes < c) return { open: true, until: s.close };
  }
  for (const s of hours[day] ?? []) {
    const o = toMinutes(s.open);
    const c = toMinutes(s.close);
    if (o === c) return { open: true }; // round the clock
    if (c < o ? minutes >= o : minutes >= o && minutes < c) return { open: true, until: s.close };
  }
  return { open: false };
}

/**
 * When the shop next opens after `now` (in `timeZone`): days from today (0 = later today)
 * plus that day and the opening time. Null when no opening is set in the coming week.
 */
export function nextOpening(
  hours: WeeklyHours,
  now: Date = new Date(),
  timeZone?: string,
): { inDays: number; day: WeekDay; time: string } | null {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const today = (parts.find((p) => p.type === 'weekday')?.value ?? '').toLowerCase().slice(0, 3) as WeekDay;
  const idx = WEEK_DAYS.indexOf(today);
  if (idx < 0) return null;
  const minutes = toMinutes(`${parts.find((p) => p.type === 'hour')?.value}:${parts.find((p) => p.type === 'minute')?.value}`);

  for (let inDays = 0; inDays <= 7; inDays++) {
    const day = WEEK_DAYS[(idx + inDays) % 7];
    const opens = (hours[day] ?? [])
      .map((s) => s.open)
      .filter((o) => inDays > 0 || toMinutes(o) > minutes)
      .sort((a, b) => toMinutes(a) - toMinutes(b));
    if (opens.length) return { inDays, day, time: opens[0] };
  }
  return null;
}
