import { useCallback, useState } from 'react';
import {
  clearDeliverySession,
  normalisePostcode,
  readDeliverySession,
  writeDeliverySession,
  type DeliverySession,
} from '../utils/delivery';

export interface DeliverySessionState {
  postcode: string | null;
  choose: (postcode: string) => void;
  clear: () => void;
}

/** The delivery postcode chosen in this tab for the restaurant, or null. */
export function useDeliverySession(slug: string | undefined): DeliverySessionState {
  const [session, setSession] = useState<DeliverySession | null>(() =>
    slug ? readDeliverySession(slug, Date.now()) : null,
  );
  const choose = useCallback(
    (postcode: string) => {
      if (!slug) return;
      const s = { slug, postcode: normalisePostcode(postcode), savedAt: Date.now() };
      writeDeliverySession(s);
      setSession(s);
    },
    [slug],
  );
  const clear = useCallback(() => {
    if (slug) clearDeliverySession(slug);
    setSession(null);
  }, [slug]);
  return { postcode: session && session.slug === slug ? session.postcode : null, choose, clear };
}
