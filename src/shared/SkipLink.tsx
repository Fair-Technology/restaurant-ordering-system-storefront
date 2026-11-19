import React from 'react';
import { useAppSelector } from '../store/hooks';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { siteCopy } from '../utils/siteCopy';

/**
 * SkipLink — the first Tab stop on every page. Invisible until focused; jumps past the header
 * to the page's <main id="main-content"> landmark.
 */
const SkipLink: React.FC<{ targetId?: string }> = ({ targetId = 'main-content' }) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = pageLanguageOf(currentChoice(storedLanguage, navigator.language));
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-full focus:bg-gray-900 focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {siteCopy(lang).skipToContent}
    </a>
  );
};

export default SkipLink;
