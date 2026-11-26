import { useCallback, useEffect, useState } from 'react';
import {
  clearOtherTime,
  readOtherTime,
  writeOtherTime,
  type OtherTimeChoice,
} from '../utils/otherTimeChoice';
import type { OtherTimeEntry } from '../utils/otherTimes';

export interface OtherTimeChoiceState {
  choice: OtherTimeChoice | null;
  choose: (iso: string, entry: OtherTimeEntry) => void;
  clear: () => void;
}

const CHECK_MS = 30_000;

/**
 * The "other time" chosen in this tab for the restaurant, or null. Once the chosen moment has passed it
 * drops itself (checked on a 30 s timer and when the tab regains focus, against the real clock).
 */
export function useOtherTimeChoice(slug: string | undefined): OtherTimeChoiceState {
  const [choice, setChoice] = useState<OtherTimeChoice | null>(() =>
    slug ? readOtherTime(slug, Date.now()) : null,
  );
  const choose = useCallback(
    (iso: string, entry: OtherTimeEntry) => {
      if (!slug) return;
      const c = { slug, iso, entry };
      writeOtherTime(c);
      setChoice(c);
    },
    [slug],
  );
  const clear = useCallback(() => {
    if (slug) clearOtherTime(slug);
    setChoice(null);
  }, [slug]);

  useEffect(() => {
    if (!choice) return;
    const check = () => {
      if (Date.parse(choice.iso) <= Date.now()) clear();
    };
    check();
    const t = window.setInterval(check, CHECK_MS);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [choice, clear]);

  return { choice: choice && choice.slug === slug ? choice : null, choose, clear };
}
