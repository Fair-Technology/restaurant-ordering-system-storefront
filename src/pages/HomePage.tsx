import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useListPublicShopsQuery, type PublicShopSummary } from '../api/publicShopEndpoints';
import ShopLogo from '../shared/ShopLogo';
import PlatformHeader from '../shared/PlatformHeader';
import { resolveShopBranding } from '../utils/branding';
import { openState } from '../utils/openingHours';
import { useAppSelector } from '../store/hooks';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { siteCopy, PLATFORM_NAME, type SiteCopy } from '../utils/siteCopy';

/** Ordering paused / open / closed as a small pill. Offline shops never reach this list: the server leaves them out. */
function statusOf(shop: PublicShopSummary, copy: SiteCopy): { text: string; open: boolean } | null {
  if (shop.ordersPaused) return { text: copy.homePaused, open: false };
  const hours = shop.openingHours;
  if (!hours || Object.keys(hours).length === 0) return null;
  const s = openState(hours, new Date(), shop.timezone);
  if (!s.open) return { text: copy.homeClosed, open: false };
  return { text: s.until ? copy.homeOpenUntil(s.until) : copy.homeOpen, open: true };
}

/**
 * HomePage — the platform's list of restaurants. A beige head with the title and a search field
 * (name or town, filtered as you type), then the restaurants: cards with cover photo, logo badge,
 * town and open status from sm up; compact rows with the round logo on phones.
 */
const HomePage = () => {
  const { data, isLoading, isError } = useListPublicShopsQuery();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = siteCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const [query, setQuery] = useState('');

  const shops = useMemo(() => data?.shops ?? [], [data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) =>
      [s.name, s.address?.city, s.address?.postcode].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [shops, query]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-white text-gray-900">
      <PlatformHeader />

      <section className="border-b border-[#efe7de] bg-[#faf6f1]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-6 pt-7 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:pb-10 lg:pt-12">
          <div className="max-w-[600px]">
            <h1 className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.015em] sm:text-[44px] lg:text-[52px]">
              {copy.homeTitle}
            </h1>
            <p className="mt-2.5 text-base leading-normal text-[#5c524b] sm:mt-3.5 sm:text-lg">{copy.homeLead}</p>
          </div>
          <label className="flex h-[52px] w-full shrink-0 items-center gap-2.5 rounded-full border-[1.5px] border-[#e3d9ce] bg-white px-4 shadow-[0_2px_8px_rgba(31,26,23,0.05)] focus-within:border-gray-900 sm:h-[54px] sm:px-[18px] lg:w-[380px]">
            <Search className="h-[18px] w-[18px] shrink-0 text-[#6b6058]" strokeWidth={2.2} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={copy.homeSearch}
              placeholder={copy.homeSearch}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#8a7f77]"
            />
          </label>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-14 pt-6 sm:px-6 sm:pt-8" data-testid="shop-list-section">
        <div className="mb-4 flex items-baseline gap-2.5 sm:mb-5">
          <h2 className="font-display text-2xl font-semibold sm:text-[28px]">{copy.homeRestaurants}</h2>
          {!isLoading && !isError && shops.length > 0 && (
            <span className="text-sm text-[#6b6058] sm:text-[15px]">{copy.homeCount(shown.length)}</span>
          )}
        </div>

        {isLoading && (
          <p className="text-gray-500" data-testid="loading-indicator">
            {copy.homeLoading}
          </p>
        )}
        {isError && (
          <p className="rounded-xl border border-[#f6d3c1] bg-[#fdeee6] px-4 py-3 text-[#7c2a09]" data-testid="error-message">
            {copy.homeError}
          </p>
        )}
        {!isLoading && !isError && shops.length === 0 && (
          <p className="text-gray-500" data-testid="empty-state">
            {copy.homeEmpty}
          </p>
        )}
        {!isLoading && !isError && shops.length > 0 && shown.length === 0 && (
          <p className="text-gray-500">{copy.homeNoMatch(query.trim())}</p>
        )}

        {!isLoading && !isError && shown.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-[22px] lg:grid-cols-3" data-testid="shop-grid">
            {shown.map((shop) => {
              const branding = resolveShopBranding(shop.branding);
              const status = statusOf(shop, copy);
              const town = shop.address?.city?.trim();
              return (
                <Link
                  key={shop.id}
                  to={`/shops/${shop.slug}`}
                  data-testid="shop-card"
                  className="group flex items-center gap-3.5 rounded-2xl border border-[#efe7de] bg-white p-3 transition-all sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:rounded-[18px] sm:p-0 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_10px_28px_rgba(31,26,23,0.10)]"
                >
                  {/* Cover (sm+) */}
                  <div className="relative hidden aspect-[3/1] overflow-hidden bg-[#f6f1eb] sm:block">
                    {branding.showHero && (
                      <img src={branding.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:flex-col sm:items-stretch sm:gap-2.5 sm:px-[18px] sm:pb-[18px]">
                    {/* Logo badge: overlaps the cover from sm */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#efe7de] bg-white sm:-mt-8 sm:border-[3px] sm:border-white sm:shadow-[0_3px_12px_rgba(31,26,23,0.14)]">
                      <ShopLogo
                        name={shop.name ?? ''}
                        logoUrl={branding.logoUrl}
                        accentColor={branding.accentColor}
                        className="h-full w-full rounded-full"
                        logoClassName="h-[80%] w-[80%] object-contain"
                        wideClassName="h-auto w-[84%] object-contain"
                        textClassName="text-lg"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold sm:text-lg" data-testid="shop-name">
                          {shop.name}
                        </div>
                        {town && <div className="truncate text-[13px] text-[#6b6058] sm:mt-0.5 sm:text-sm">{town}</div>}
                      </div>
                      {status && (
                        <span
                          className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:text-[13px] ${
                            status.open ? 'bg-[#e6f3ea] text-[#1d5a32]' : 'bg-[#f1ede8] text-[#4a413b]'
                          }`}
                        >
                          <span className={`h-[7px] w-[7px] rounded-full ${status.open ? 'bg-[#2f8a4c]' : 'bg-[#9a8f86]'}`} aria-hidden="true" />
                          {status.text}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-[#efe7de]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-[#6b6058] sm:px-6">
          <span>© {PLATFORM_NAME}</span>
          <Link to="/legal/sub-processors" className="hover:text-gray-900">
            {copy.subTitle}
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
