import React from 'react';
import { menuLabels } from '../../utils/menuLabels';

interface LanguageSwitcherProps {
  languages: string[];
  current: string;
  onChange: (lang: string) => void;
  /** True while the menu in the newly picked language is on its way: a spinner shows in the picked pill */
  busy?: boolean;
}

/**
 * LanguageSwitcher — lets a visitor pick which of the shop's offered menu
 * languages to view the catalog in. Hidden for a single-language menu, since
 * there is nothing to switch between (product default 6).
 *
 * Shown as one segmented control: the chosen language is a white pill on a warm grey track.
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ languages, current, onChange, busy = false }) => {
  if (languages.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={menuLabels(current).languageGroup}
      aria-busy={busy}
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
            className={`inline-flex h-[38px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] transition-colors ${
              on
                ? 'bg-white font-bold text-gray-900 shadow-[0_1px_3px_rgba(31,26,23,0.12)]'
                : 'font-semibold text-[#6b6058] hover:text-gray-900'
            }`}
          >
            {on && busy && (
              <span
                data-testid="language-loading"
                aria-hidden="true"
                className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
              />
            )}
            {lang.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
