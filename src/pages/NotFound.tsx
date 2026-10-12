import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PlatformHeader from '../shared/PlatformHeader';
import { useAppSelector } from '../store/hooks';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { siteCopy } from '../utils/siteCopy';

/** An empty plate with cutlery (an original drawing); "404" on the plate for a missing page. */
const EmptyPlate: React.FC<{ label?: string; className?: string }> = ({ label, className }) => (
  <svg viewBox="0 0 180 132" className={className} aria-hidden="true">
    <circle cx="90" cy="70" r="58" fill="#faf6f1" stroke="#e6dcd1" strokeWidth="2" />
    <circle cx="90" cy="70" r="38" fill="#fff" stroke="#efe7de" strokeWidth="2" />
    <path d="M14 28v26a6 6 0 0 0 6 6v58M8 28v18M20 28v18" fill="none" stroke="#b9ada2" strokeWidth="3" strokeLinecap="round" />
    <path d="M166 28c-8 4-10 20-10 30h8v60" fill="none" stroke="#b9ada2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {label && (
      <text x="90" y="80" textAnchor="middle" fontFamily="'Fraunces Variable', Georgia, serif" fontSize="28" fontWeight="600" fill="#8a7f77">
        {label}
      </text>
    )}
  </svg>
);

/**
 * NotFound — a link that leads nowhere. `kind="shop"` is a restaurant link with no restaurant
 * behind it (shows the mistyped address); the default is any other unknown page (404).
 */
const NotFound: React.FC<{ kind?: 'page' | 'shop' }> = ({ kind = 'page' }) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = siteCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const location = useLocation();
  const navigate = useNavigate();
  const shop = kind === 'shop';

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <PlatformHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-[460px] flex-col items-center text-center">
          <EmptyPlate label={shop ? undefined : '404'} className="h-[104px] w-[140px] sm:h-[132px] sm:w-[180px]" />
          <h1 className="mt-4 font-display text-[28px] font-semibold leading-tight sm:mt-5 sm:text-4xl">
            {shop ? copy.shopMissingTitle : copy.pageMissingTitle}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 sm:text-base">
            {shop ? copy.shopMissingText : copy.pageMissingText}
          </p>
          <div className="mt-6 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Link
              to="/"
              className="flex h-[52px] items-center justify-center rounded-full bg-gray-900 px-6 text-[15px] font-bold text-white transition-colors hover:bg-black sm:h-12"
            >
              {shop ? copy.allRestaurants : copy.toHome}
            </Link>
            {!shop && window.history.length > 1 && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="hidden h-12 items-center justify-center rounded-full border-[1.5px] border-[#e3d9ce] px-6 text-[15px] font-bold hover:bg-gray-50 sm:flex"
              >
                {copy.back}
              </button>
            )}
          </div>
          {shop && (
            <code className="mt-5 max-w-full truncate rounded-lg bg-[#faf6f1] px-2.5 py-1 text-[13px] text-[#8a7f77]">
              {location.pathname}
            </code>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotFound;
