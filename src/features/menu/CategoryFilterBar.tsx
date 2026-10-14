import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { ICON_MAP } from '../../utils/iconMap';

type CategoryOption = { id: string; label: string; count?: number; icon?: string };

export interface OtherTimeOption {
  id: string;
  label: string;
  when: string;
}

interface CategoryFilterBarProps {
  categories: CategoryOption[];
  /** Categories outside their times right now; shown in a dropdown behind one pill. */
  otherTimes?: OtherTimeOption[];
  otherTimesLabel?: string;
  onPickOtherTime?: (id: string) => void;
}

// STICKY_OFFSET accounts for the combined height of the sticky NavBar (64px)
// and CategoryFilterBar itself (~76px), so scroll-based section detection
// fires slightly before the heading scrolls fully behind the bars.
const STICKY_OFFSET = 140;

const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({ categories, otherTimes, otherTimesLabel, onPickOtherTime }) => {
  const [selected, setSelected] = useState(() => categories[0]?.id ?? '');
  const [hovered, setHovered] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // The "Other times" list closes on Escape or a click outside the bar
  useEffect(() => {
    if (!otherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOtherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtherOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [otherOpen]);

  // Keep selected in sync if categories change (e.g. after data loads)
  useEffect(() => {
    if (!categories.length) {
      setSelected('');
      return;
    }
    if (!selected || !categories.find((cat) => cat.id === selected)) {
      setSelected(categories[0].id);
    }
  }, [categories, selected]);

  // Smooth-scroll to the category section and mark it as selected
  const handleClick = (categoryId: string) => {
    setSelected(categoryId);
    setHovered('');
    document.getElementById(categoryId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // Highlight the category whose section is currently visible as the user scrolls.
  // Throttled with requestAnimationFrame to avoid layout thrashing on every
  // scroll event. `ticking` prevents multiple rAF callbacks from being queued
  // at the same time.
  useEffect(() => {
    if (!categories.length) return;
    const lastCategoryId = categories[categories.length - 1]?.id ?? '';
    let ticking = false;

    const updateSelectedByScroll = () => {
      const anchorY = window.scrollY + STICKY_OFFSET + 8;
      let activeId = categories[0].id;

      for (const category of categories) {
        const sectionEl = document.getElementById(category.id);
        if (!sectionEl) continue;
        if (sectionEl.offsetTop <= anchorY) {
          activeId = category.id;
        } else {
          break;
        }
      }

      // When the user reaches the very bottom of the page, the last section's
      // top may never cross the anchor (not enough scroll space), so we force
      // it to be selected once the page bottom is reached.
      const scrollBottom = window.scrollY + window.innerHeight;
      const pageBottom = document.documentElement.scrollHeight;
      if (pageBottom - scrollBottom <= 4) {
        activeId = lastCategoryId || activeId;
      }

      setSelected((prev) => (prev === activeId ? prev : activeId));
    };

    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        updateSelectedByScroll();
        ticking = false;
      });
    };

    updateSelectedByScroll();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [categories]);

  if (!categories.length && !otherTimes?.length) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Categories"
      className="sticky top-[64px] z-40 border-y border-[#f1ebe4] bg-white"
    >
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-6 sm:py-3 [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => {
          const on = selected === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={on}
              onClick={() => handleClick(cat.id)}
              onMouseEnter={() => setHovered(cat.id)}
              onMouseLeave={() => setHovered('')}
              className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-bold transition-colors sm:text-[15px] ${
                on
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : hovered === cat.id
                    ? 'border-gray-400 bg-white text-gray-900'
                    : 'border-[#e3d9ce] bg-white text-gray-900'
              }`}
            >
              {cat.icon && (() => {
                const IC = ICON_MAP[cat.icon];
                return IC ? <IC className="h-4 w-4" aria-hidden="true" /> : null;
              })()}
              <span>{cat.label}</span>
              {typeof cat.count === 'number' ? (
                <span className={`text-xs font-semibold ${on ? 'opacity-70' : 'text-[#6b6058]'}`}>{cat.count}</span>
              ) : null}
            </button>
          );
        })}
        {otherTimes && otherTimes.length > 0 && (
          <button
            type="button"
            aria-expanded={otherOpen}
            aria-controls="other-times-list"
            onClick={() => setOtherOpen((o) => !o)}
            className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[#cfc4b8] bg-white px-4 text-sm font-bold text-gray-900 sm:text-[15px]"
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>{otherTimesLabel}</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {otherOpen && otherTimes && (
        <ul
          id="other-times-list"
          data-testid="other-times"
          className="absolute right-4 top-full z-50 mt-1 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-[#efe7de] bg-white p-1.5 shadow-[0_10px_28px_rgba(31,26,23,0.12)] sm:right-6"
        >
          {otherTimes.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left hover:bg-[#f6f1eb]"
                onClick={() => {
                  setOtherOpen(false);
                  onPickOtherTime?.(o.id);
                }}
              >
                <span className="text-[15px] font-bold text-gray-900">{o.label}</span>
                <span className="text-[13px] text-[#5c524b]">{o.when}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

export default CategoryFilterBar;
