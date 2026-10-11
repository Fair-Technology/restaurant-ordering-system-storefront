import React from 'react';
import { Info } from 'lucide-react';
import type { OrderCopy } from '../../utils/orderCopy';
import { openState, type WeeklyHours } from '../../utils/openingHours';
import { shopInitials } from '../../shared/ShopLogo';

interface ShopIntroProps {
  name: string;
  logoUrl: string | null;
  address?: { street?: string; postcode?: string; city?: string };
  openingHours?: WeeklyHours;
  timeZone?: string;
  /** Minutes until a collection order is ready; no chip when unknown */
  pickupMinutes?: number | null;
  /** True when the cover banner is shown above: the logo badge then overlaps its bottom edge */
  overlapsHero: boolean;
  /** Shown here on phones only; from sm up the switcher lives in the nav bar */
  languageSwitcher?: React.ReactNode;
  copy: OrderCopy;
}

/**
 * ShopIntro — the shop's identity block under the cover banner: a round logo badge that
 * overlaps the banner, the shop name, address line, open/closed status and pickup time,
 * plus an Info link that jumps to the address/hours/phone block at the bottom of the page.
 */
const ShopIntro: React.FC<ShopIntroProps> = ({
  name,
  logoUrl,
  address,
  openingHours,
  timeZone,
  pickupMinutes,
  overlapsHero,
  languageSwitcher,
  copy,
}) => {
  const place = [address?.street, address?.city].map((p) => p?.trim()).filter(Boolean).join(', ');
  const status = openingHours ? openState(openingHours, new Date(), timeZone) : null;

  return (
    <section className="bg-white" data-testid="shop-intro">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* The row starts below the banner; only the badge reaches up into it (negative margin),
            so the name and buttons never sit on top of the picture */}
        <div className={`flex flex-wrap items-end gap-x-5 gap-y-3 md:flex-nowrap ${overlapsHero ? 'pt-0' : 'pt-6'}`}>
          {/* Logo badge */}
          <div
            className={`relative z-10 flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_4px_16px_rgba(31,26,23,0.15)] md:h-28 md:w-28 ${
              overlapsHero ? '-mt-[56px] md:-mt-[76px]' : ''
            }`}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-[74%] w-[74%] object-contain" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[var(--brand-accent)] text-2xl font-bold text-[var(--brand-on-accent)] md:text-3xl">
                {shopInitials(name)}
              </span>
            )}
          </div>

          {/* Name + address: own row on phones, beside the badge from md */}
          <div className="order-3 w-full min-w-0 md:order-none md:w-auto md:flex-1 md:pb-1">
            <h1 className="font-display text-[28px] font-semibold leading-tight text-gray-900 md:text-[34px]">
              {name}
            </h1>
            {place && <p className="mt-0.5 truncate text-[15px] text-[#5c524b]">{place}</p>}
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0 md:pb-1">
            {languageSwitcher && <div className="sm:hidden">{languageSwitcher}</div>}
            <a
              href="#shop-info"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-[#e3d9ce] bg-white px-4 text-sm font-bold text-gray-900 transition-colors hover:border-gray-400"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
              {copy.introInfo}
            </a>
          </div>
        </div>

        {(status || (pickupMinutes ?? 0) > 0) && (
          <div className="flex flex-wrap gap-2 pb-5 pt-3 text-[13px] md:pl-[132px] md:text-sm">
            {status &&
              (status.open ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f3ea] px-3 py-1 font-semibold text-[#1d5a32]">
                  <span className="h-2 w-2 rounded-full bg-[#2f8a4c]" aria-hidden="true" />
                  {status.until ? copy.introOpenUntil(status.until) : copy.introOpen}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                  <span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden="true" />
                  {copy.introClosedNow}
                </span>
              ))}
            {(pickupMinutes ?? 0) > 0 && (
              <span className="rounded-full bg-[#f6f1eb] px-3 py-1 text-[#4a413b]">
                {copy.introPickupIn(pickupMinutes as number)}
              </span>
            )}
          </div>
        )}
        {!status && !((pickupMinutes ?? 0) > 0) && <div className="pb-5" />}
      </div>
    </section>
  );
};

export default ShopIntro;
