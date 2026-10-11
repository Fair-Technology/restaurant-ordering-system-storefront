import React from 'react';
import { MapPin, Phone } from 'lucide-react';
import type { OrderCopy } from '../../utils/orderCopy';
import { hoursLines, routeUrl, telHref, type WeeklyHours } from '../../utils/openingHours';

interface ShopInfoFooterProps {
  name: string;
  address?: { street?: string; postcode?: string; city?: string; country?: string };
  openingHours?: WeeklyHours;
  deliveryHours?: WeeklyHours | null;
  phone?: string | null;
  copy: OrderCopy;
}

/**
 * Address, opening hours and phone at the bottom of the shop page. No embedded map:
 * a map would load from Google on every visit and need cookie consent, so the route
 * button only opens Google Maps when the diner taps it.
 *
 * `id="shop-info"` is the target of the Info link in ShopIntro.
 */
const ShopInfoFooter: React.FC<ShopInfoFooterProps> = ({ name, address, openingHours, deliveryHours, phone, copy }) => {
  const route = address ? routeUrl(address) : null;
  const words = { dayShort: copy.infoDayShort, daily: copy.infoDaily, closed: copy.infoClosed, allDay: copy.infoAllDay };
  const hours = openingHours ? hoursLines(openingHours, words) : [];
  const delivery = deliveryHours ? hoursLines(deliveryHours, words) : [];
  if (!route && hours.length === 0 && !phone) return null;

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
      </div>
    </section>
  );
};

export default ShopInfoFooter;
