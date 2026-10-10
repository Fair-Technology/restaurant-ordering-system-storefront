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
 */
const ShopInfoFooter: React.FC<ShopInfoFooterProps> = ({ name, address, openingHours, deliveryHours, phone, copy }) => {
  const route = address ? routeUrl(address) : null;
  const words = { dayShort: copy.infoDayShort, daily: copy.infoDaily, closed: copy.infoClosed, allDay: copy.infoAllDay };
  const hours = openingHours ? hoursLines(openingHours, words) : [];
  const delivery = deliveryHours ? hoursLines(deliveryHours, words) : [];
  if (!route && hours.length === 0 && !phone) return null;

  const heading = 'text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2';
  return (
    <section className="w-full bg-white border-t border-gray-200 mt-12" data-testid="shop-info">
      <div className="max-w-7xl mx-auto px-6 py-8 grid gap-8 sm:grid-cols-3 text-sm text-gray-700">
        {route && (
          <div>
            <h2 className={heading}>{copy.infoAddress}</h2>
            <p className="font-medium text-gray-900">{name}</p>
            <p>{address?.street}</p>
            <p>{[address?.postcode, address?.city].filter(Boolean).join(' ')}</p>
            <a
              href={route}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
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
                <p className="mt-3 font-medium text-gray-900">{copy.infoDeliveryHours}</p>
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
            <a href={telHref(phone)} className="inline-flex items-center gap-1.5 hover:text-gray-900">
              <Phone className="w-4 h-4" aria-hidden="true" />
              {phone}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default ShopInfoFooter;
