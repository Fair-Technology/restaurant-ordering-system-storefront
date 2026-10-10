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
