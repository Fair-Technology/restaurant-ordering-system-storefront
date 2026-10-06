import { useCallback, useState } from 'react';
import {
  clearTableSession,
  readTableSession,
  writeTableSession,
  type TableSession,
} from '../utils/tableSession';

export interface TableSessionState {
  table: string | null;
  bind: (label: string) => void;
  unbind: () => void;
}

/** The table bound to this tab for the restaurant; null whenever dine-in is off. */
export function useTableSession(slug: string | undefined, dineIn: boolean): TableSessionState {
  const [session, setSession] = useState<TableSession | null>(() =>
    slug ? readTableSession(slug, Date.now()) : null,
  );
  const bind = useCallback(
    (label: string) => {
      if (!slug) return;
      const s = { slug, label, boundAt: Date.now() };
      writeTableSession(s);
      setSession(s);
    },
    [slug],
  );
  const unbind = useCallback(() => {
    if (slug) clearTableSession(slug);
    setSession(null);
  }, [slug]);
  return { table: dineIn && session && session.slug === slug ? session.label : null, bind, unbind };
}
