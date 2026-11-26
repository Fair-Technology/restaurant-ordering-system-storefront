// Pure helpers for the "Other times" picker: when a timed category or scheduled dish is next served,
// whether that falls inside the booking window, and which bookable slots it is served at.
// Every calendar day, weekday and clock time is read in the shop's own time zone.
import type { CatalogOtherTimeDishDto, CatalogCategoryWithTimes } from './catalogMapper';

/** A weekly serving window, optionally limited to a date range (dishes only). Null days = every day. */
export interface ServingSchedule {
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
}

export interface OtherTimeEntry {
  id: string;
  kind: 'category' | 'dish';
  name: string;
  schedule: ServingSchedule;
}

export interface ZonedParts {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = Sunday */
  dow: number;
  /** HH:mm, 24 hour */
  time: string;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(d: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    dow: WEEKDAYS[get('weekday')] ?? 0,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** A YYYY-MM-DD calendar date moved by whole days (pure date arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dowOfDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const startOf = (s: ServingSchedule) => s.startTime ?? '00:00';
const endOf = (s: ServingSchedule) => s.endTime ?? '23:59';

function dayServed(s: ServingSchedule, date: string, dow: number): boolean {
  if (s.daysOfWeek && !s.daysOfWeek.includes(dow)) return false;
  if (s.startDate && date < s.startDate.slice(0, 10)) return false;
  if (s.endDate && date > s.endDate.slice(0, 10)) return false;
  return true;
}

/** Is the schedule serving at this instant? The end of the window is exclusive. */
export function servedAt(s: ServingSchedule, at: Date, timeZone: string): boolean {
  const p = zonedParts(at, timeZone);
  return dayServed(s, p.date, p.dow) && p.time >= startOf(s) && p.time < endOf(s);
}

/** The first local day, from today on, on which the window starts after `now`; null when it never does. */
export function nextOccurrence(
  s: ServingSchedule,
  now: Date,
  timeZone: string,
  maxDays = 400,
): { date: string; time: string } | null {
  const today = zonedParts(now, timeZone);
  for (let i = 0; i <= maxDays; i++) {
    const date = addDays(today.date, i);
    if (!dayServed(s, date, dowOfDate(date))) continue;
    if (i === 0 && startOf(s) <= today.time) continue; // already started (or over) today
    return { date, time: startOf(s) };
  }
  return null;
}

export type Bookability =
  | { state: 'bookable'; date: string }
  /** Beyond the window: `preorderFrom` is the day that occurrence enters the sliding window */
  | { state: 'beyond'; date: string; preorderFrom: string }
  | { state: 'never' };

export function bookability(
  s: ServingSchedule,
  now: Date,
  timeZone: string,
  horizonDays: number,
): Bookability {
  const next = nextOccurrence(s, now, timeZone);
  if (!next) return { state: 'never' };
  const today = zonedParts(now, timeZone).date;
  return next.date <= addDays(today, horizonDays)
    ? { state: 'bookable', date: next.date }
    : { state: 'beyond', date: next.date, preorderFrom: addDays(next.date, -horizonDays) };
}

/** The bookable slots (ISO instants) at which the entry itself is served. */
export function entrySlots(s: ServingSchedule, slots: readonly string[], timeZone: string): string[] {
  return slots.filter((iso) => servedAt(s, new Date(iso), timeZone));
}

/**
 * Everything the "Other times" dialog lists: timed categories closed at the viewed moment, and the
 * scheduled dishes the server reports as not served now (which it judges from the real time, so for
 * a chosen later moment those the schedule does serve at that moment are left out).
 */
export function otherTimeEntries(
  categories: readonly CatalogCategoryWithTimes[],
  dishes: readonly CatalogOtherTimeDishDto[],
  viewedAt: Date | null,
  timeZone: string,
): OtherTimeEntry[] {
  const fromCategories = categories.flatMap((c): OtherTimeEntry[] =>
    c.availableNow === false && c.schedule && c.name
      ? [
          {
            id: `c:${c.id ?? c.name}`,
            kind: 'category',
            name: c.name,
            schedule: { daysOfWeek: c.schedule.daysOfWeek, startTime: c.schedule.startTime, endTime: c.schedule.endTime },
          },
        ]
      : [],
  );
  const fromDishes = dishes
    .filter((d) => !viewedAt || !servedAt(d.schedule, viewedAt, timeZone))
    .map((d): OtherTimeEntry => ({ id: `d:${d.id}`, kind: 'dish', name: d.name, schedule: d.schedule }));
  return [...fromCategories, ...fromDishes];
}
