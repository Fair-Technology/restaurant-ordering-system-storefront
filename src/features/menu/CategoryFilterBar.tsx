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
    <div className="sticky top-[64px] z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 px-6 py-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleClick(cat.id)}
            onMouseEnter={() => setHovered(cat.id)}
            onMouseLeave={() => setHovered('')}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
            style={
              selected === cat.id
                ? {
                    backgroundColor: 'var(--brand-accent)',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }
                : hovered === cat.id
                  ? {
                      backgroundColor: '#f3f4f6',
                      color: '#111827',
                      border: '1px solid #d1d5db',
                    }
                  : {
                      backgroundColor: '#fff',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                    }
            }
          >
            {cat.icon && (() => {
              const IC = ICON_MAP[cat.icon];
              return IC ? <IC className="w-3.5 h-3.5" /> : null;
            })()}
            <span>{cat.label}</span>
            {typeof cat.count === 'number' ? (
              <span className="ml-2 text-xs opacity-80">{cat.count}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilterBar;
