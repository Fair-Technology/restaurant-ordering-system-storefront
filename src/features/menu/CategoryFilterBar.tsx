import React, { useEffect, useState } from 'react';
import { ICON_MAP } from '../../utils/iconMap';

type CategoryOption = { id: string; label: string; count?: number; icon?: string };

interface CategoryFilterBarProps {
  categories: CategoryOption[];
}

// STICKY_OFFSET accounts for the combined height of the sticky NavBar (64px)
// and CategoryFilterBar itself (~76px), so scroll-based section detection
// fires slightly before the heading scrolls fully behind the bars.
const STICKY_OFFSET = 140;

const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({ categories }) => {
  const [selected, setSelected] = useState(() => categories[0]?.id ?? '');
  const [hovered, setHovered] = useState('');

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

  if (!categories.length) return null;

  return (
    <nav
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
      </div>
    </nav>
  );
};

export default CategoryFilterBar;
