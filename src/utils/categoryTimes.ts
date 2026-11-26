// A category's weekly times in plain words, for the "Other times" list and the dish badge. Days come Monday first.
import type { CategoryWindowDto } from './catalogMapper';

const EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DE_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const EN_EVERY = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const DE_EVERY = ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags'];

export function categoryWindowText(w: CategoryWindowDto, lang: string): string {
  const de = lang === 'de';
  const days = [...new Set(w.daysOfWeek)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const key = days.join(',');
  const when =
    days.length === 7
      ? de ? 'täglich' : 'daily'
      : key === '1,2,3,4,5'
        ? de ? 'Mo–Fr' : 'Mon–Fri'
        : key === '6,0'
          ? de ? 'am Wochenende' : 'weekends'
          : days.length === 1
            ? (de ? DE_EVERY : EN_EVERY)[days[0]]
            : days.map((d) => (de ? DE_SHORT : EN_SHORT)[d]).join(', ');
  return `${when} ${w.startTime}–${w.endTime}`;
}

/** A weekly window with optional date range (a scheduled dish): "daily 11:00–15:00". Null times = all day. */
export function scheduleWindowText(
  s: { daysOfWeek: number[] | null; startTime: string | null; endTime: string | null },
  lang: string,
): string {
  return categoryWindowText(
    {
      daysOfWeek: s.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
      startTime: s.startTime ?? '00:00',
      endTime: s.endTime ?? '23:59',
    },
    lang,
  );
}

/** A plain YYYY-MM-DD date as "28 Nov" / "28. Nov." — no time zone, it is a calendar date. */
export function plainDateText(date: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

/**
 * When a dish is served, from the categories it sits in: every timed window joined with " · ", or
 * null when it is served any time (it sits in a category with no weekly times, or in none at all).
 */
export function dishTimesText(
  productId: string,
  categories: { schedule?: CategoryWindowDto | null; products?: { id?: string }[] | null }[],
  lang: string,
): string | null {
  const own = categories.filter((c) => (c.products ?? []).some((p) => p.id === productId));
  if (own.length === 0 || own.some((c) => !c.schedule)) return null;
  const texts = [...new Set(own.map((c) => categoryWindowText(c.schedule!, lang)))];
  return texts.join(' · ');
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
