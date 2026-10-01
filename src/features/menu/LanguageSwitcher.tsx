import React from 'react';
import { Globe } from 'lucide-react';
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
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ languages, current, onChange }) => {
  if (languages.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={menuLabels(current).languageGroup}
      className="flex items-center gap-1"
    >
      <Globe className="w-4 h-4 text-gray-500" />
      {languages.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={lang === current}
          onClick={() => onChange(lang)}
          className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200"
          style={
            lang === current
              ? { backgroundColor: 'var(--brand-accent)', color: '#fff' }
              : { backgroundColor: '#fff', color: '#6b7280', border: '1px solid #e5e7eb' }
          }
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
