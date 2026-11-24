import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, MapPin, Phone } from 'lucide-react';
import type { OrderCopy } from '../../utils/orderCopy';
import { hoursLines, routeUrl, telHref, type WeeklyHours } from '../../utils/openingHours';

export interface OtherTimeOption {
  id: string;
  label: string;
  when: string;
}

interface ShopInfoFooterProps {
  name: string;
  address?: { street?: string; postcode?: string; city?: string; country?: string };
  openingHours?: WeeklyHours;
  deliveryHours?: WeeklyHours | null;
  phone?: string | null;
  copy: OrderCopy;
  /** Categories outside their times right now; listed in a dropdown at the bottom of the footer. */
  otherTimes?: OtherTimeOption[];
  onPickOtherTime?: (id: string) => void;
}

/**
 * Address, opening hours and phone at the bottom of the shop page. No embedded map:
 * a map would load from Google on every visit and need cookie consent, so the route
 * button only opens Google Maps when the diner taps it.
 *
 * `id="shop-info"` anchors the address/hours/phone block.
 */
const ShopInfoFooter: React.FC<ShopInfoFooterProps> = ({
  name,
  address,
  openingHours,
  deliveryHours,
  phone,
  copy,
  otherTimes,
  onPickOtherTime,
}) => {
  const [otherOpen, setOtherOpen] = useState(false);
  const otherRef = useRef<HTMLDivElement>(null);

  // The "Other times" list closes on Escape or a click outside it
  useEffect(() => {
    if (!otherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (otherRef.current && !otherRef.current.contains(e.target as Node)) setOtherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtherOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [otherOpen]);


  const route = address ? routeUrl(address) : null;
  const words = { dayShort: copy.infoDayShort, daily: copy.infoDaily, closed: copy.infoClosed, allDay: copy.infoAllDay };
  const hours = openingHours ? hoursLines(openingHours, words) : [];
  const delivery = deliveryHours ? hoursLines(deliveryHours, words) : [];
  const hasOther = !!otherTimes && otherTimes.length > 0;
  if (!route && hours.length === 0 && !phone && !hasOther) return null;

  const heading = 'mb-2 text-xs font-semibold uppercase tracking-wider text-[#6b6058]';
  return (
    <section
      id="shop-info"
      className="mt-14 w-full scroll-mt-24 border-t border-[#efe7de] bg-[#faf6f1]"
      data-testid="shop-info"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 text-[15px] leading-relaxed text-[#3a322d] sm:grid-cols-3 sm:px-6">
        {route && (
          <div>
            <h2 className={heading}>{copy.infoAddress}</h2>
            <p className="font-semibold text-gray-900">{name}</p>
            <p>{address?.street}</p>
            <p>{[address?.postcode, address?.city].filter(Boolean).join(' ')}</p>
            <a
              href={route}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-gray-900 px-5 text-sm font-bold text-gray-900 transition-colors hover:bg-white"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {copy.infoRoute}
            </a>
          </div>
        )}
        {hours.length > 0 && (
          <div>
            <h2 className={heading}>{copy.infoHours}</h2>
            {hours.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {delivery.length > 0 && (
              <>
                <p className="mt-3 font-semibold text-gray-900">{copy.infoDeliveryHours}</p>
                {delivery.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </>
            )}
          </div>
        )}
        {phone && (
          <div>
            <h2 className={heading}>{copy.infoPhone}</h2>
            <a href={telHref(phone)} className="inline-flex items-center gap-2 font-semibold text-gray-900 underline underline-offset-2">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {phone}
            </a>
          </div>
        )}
        {hasOther && (
          <div ref={otherRef} className="sm:col-span-3">
            <button
              type="button"
              aria-expanded={otherOpen}
              aria-controls="other-times-list"
              onClick={() => setOtherOpen((o) => !o)}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[#cfc4b8] bg-white px-4 text-sm font-bold text-gray-900 sm:text-[15px]"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>{copy.otherTimes}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${otherOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {otherOpen && (
              <ul
                id="other-times-list"
                data-testid="other-times"
                className="mt-2 w-full max-w-[320px] rounded-2xl border border-[#efe7de] bg-white p-1.5 shadow-[0_10px_28px_rgba(31,26,23,0.12)]"
              >
                {otherTimes!.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left hover:bg-[#f6f1eb]"
                      onClick={() => {
                        setOtherOpen(false);
                        onPickOtherTime?.(o.id);
                      }}
                    >
                      <span className="text-[15px] font-bold text-gray-900">{o.label}</span>
                      <span className="text-[13px] text-[#5c524b]">{o.when}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ShopInfoFooter;
