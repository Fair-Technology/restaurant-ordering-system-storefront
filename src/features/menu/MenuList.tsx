import React from 'react';
import { ICON_MAP } from '../../utils/iconMap';
import ProductCard from './ProductCard';
import { Product } from '../../types/Product';
import { useAppSelector } from '../../store/hooks';
import { orderCopy } from '../../utils/orderCopy';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';

type CategoryLabelMap = Record<string, string>;

interface MenuListProps {
  groupedItems: Record<string, Product[]>;
  categoryLabels: CategoryLabelMap;
  categoryCounts: Record<string, number>;
  categoryIcons: Record<string, string>;
  onAddToCart: (item: Product) => void;
}

/**
 * MenuList — Renders all menu categories and their product cards.
 *
 * Each category section has an `id` matching its slug (from slugifyCategoryName)
 * so that CategoryFilterBar can scroll to it and detect which section is in view.
 *
 * Phones get a single-column list (ProductCard draws itself as a row: text left,
 * square photo right); from sm up the cards form a 2/3/4-column grid.
 */
const MenuList: React.FC<MenuListProps> = ({
  groupedItems,
  categoryLabels,
  categoryCounts,
  categoryIcons,
  onAddToCart,
}) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = orderCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:space-y-14 sm:px-6">
      {Object.entries(groupedItems).map(([categoryId, items]) => {
        const iconName = categoryIcons[categoryId];
        const IconComponent = iconName ? ICON_MAP[iconName] : null;
        const count = categoryCounts[categoryId] ?? items.length;
        return (
          <section key={categoryId} id={categoryId} className="scroll-mt-36">
            <h2 className="mb-2 flex items-baseline gap-2.5 sm:mb-5">
              {IconComponent && (
                <IconComponent className="h-5 w-5 self-center text-[#b9ada2]" aria-hidden="true" />
              )}
              <span className="font-display text-[26px] font-semibold text-gray-900 sm:text-3xl">
                {categoryLabels[categoryId] ?? categoryId}
              </span>
              <span className="text-sm font-normal text-[#6b6058] sm:text-[15px]">
                {copy.dishCount(count)}
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <div key={`${categoryId}-${item.id}`} className="h-full">
                  <ProductCard
                    product={item}
                    onAddToCart={() => onAddToCart?.(item)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default MenuList;
