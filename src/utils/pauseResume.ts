/**
 * "HH:MM" in the shop's own time zone when a timed pause ends later the same local day,
 * otherwise null (no end, already over, or ending on another day: the standard text is enough).
 */
export function pauseResumeTime(
  until: string | null | undefined,
  timeZone: string | undefined,
  now: Date,
  lang: string,
): string | null {
  if (!until || !timeZone) return null;
  const end = new Date(until);
  if (!Number.isFinite(end.getTime()) || end.getTime() <= now.getTime()) return null;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  if (day.format(end) !== day.format(now)) return null;
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(end);
}
