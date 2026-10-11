import React from 'react';
import { menuLabels } from '../../utils/menuLabels';

interface LanguageSwitcherProps {
  languages: string[];
  current: string;
  onChange: (lang: string) => void;
}

/**
 * LanguageSwitcher — lets a visitor pick which of the shop's offered menu
 * languages to view the catalog in. Hidden for a single-language menu, since
 * there is nothing to switch between (product default 6).
 *
 * Shown as one segmented control: the chosen language is a white pill on a warm grey track.
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ languages, current, onChange }) => {
  if (languages.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={menuLabels(current).languageGroup}
      className="flex items-center rounded-full bg-[#f4efe9] p-[3px]"
    >
      {languages.map((lang) => {
        const on = lang === current;
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(lang)}
            className={`h-[38px] min-w-[44px] rounded-full px-2.5 text-[13px] transition-colors ${
              on
                ? 'bg-white font-bold text-gray-900 shadow-[0_1px_3px_rgba(31,26,23,0.12)]'
                : 'font-semibold text-[#6b6058] hover:text-gray-900'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
