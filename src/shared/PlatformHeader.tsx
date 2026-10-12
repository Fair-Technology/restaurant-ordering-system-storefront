import React from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMenuLanguage } from '../store/slices/shopSlice';
import LanguageSwitcher from '../features/menu/LanguageSwitcher';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { PLATFORM_NAME } from '../utils/siteCopy';

/** The platform's own wordmark: a dark square with the initial, then the name. */
export const PlatformMark: React.FC<{ name?: string; small?: boolean }> = ({ name = PLATFORM_NAME, small }) => (
  <span className={`inline-flex items-center gap-2.5 font-bold text-gray-900 ${small ? 'text-[15px]' : 'text-base sm:text-[17px]'}`}>
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-lg bg-gray-900 font-bold text-white ${small ? 'h-[18px] w-[18px] rounded-md text-[10px]' : 'h-7 w-7 text-sm sm:h-[30px] sm:w-[30px]'}`}
    >
      {name.charAt(0)}
    </span>
    {name}
  </span>
);

/**
 * PlatformHeader — top bar for pages that belong to no single restaurant (home, not found,
 * sub-processors): the platform wordmark linking home, and the DE/EN switch.
 */
const PlatformHeader: React.FC<{ showLanguage?: boolean }> = ({ showLanguage = true }) => {
  const dispatch = useAppDispatch();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = pageLanguageOf(currentChoice(storedLanguage, navigator.language));
  return (
    <header className="border-b border-[#f1ebe4] bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[68px] sm:px-6">
        <Link to="/" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <PlatformMark />
        </Link>
        {showLanguage && (
          <LanguageSwitcher languages={['de', 'en']} current={lang} onChange={(l) => dispatch(setMenuLanguage(l))} />
        )}
      </div>
    </header>
  );
};

export default PlatformHeader;
