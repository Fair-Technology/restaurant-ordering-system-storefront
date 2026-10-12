import React, { useEffect, useMemo, useState } from 'react';
import { Plus, UtensilsCrossed } from 'lucide-react';
import ProductModal from './ProductModal';
import ComboModal from './ComboModal';
import { PREVIEW_OPEN_EVENT, isPreviewMode, postToAdmin, usePreviewState } from '../../utils/preview';
import { orderCopy } from '../../utils/orderCopy';
import { Product } from '../../types/Product';
import { useMoney } from '../../hooks/useMoney';
import { useAppSelector } from '../../store/hooks';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';

type AddToCartPayload = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  variantId?: string;
  addonOptionIds?: string[];
};

type ProductCardProps = {
  product: Product;
  onAddToCart?: (payload: AddToCartPayload) => void;
};

/**
 * ProductCard — Presentational card for a single menu product.
 *
 * Two shapes from one markup:
 * - Phones: a list row — name, description and price on the left, a 108px square photo on
 *   the right with a round + button on its corner.
 * - sm and up: a grid card — 4:3 photo on top (+ button on its corner), name and price on one
 *   line, two lines of description below.
 * The photo box has a fixed shape and the picture or the placeholder fills it absolutely,
 * so cards with and without a photo are exactly the same size.
 *
 * Clicking anywhere on the card, or the + button, opens ProductModal. The picture is the
 * keyboard-reachable "View details" button; the + is a second, labelled button.
 *
 * A custom DOM event (`product-modal-open`) is dispatched when a modal opens,
 * allowing other open ProductCard instances to close their own modal. The
 * modalId (shopId:productId) uniquely identifies each modal so a card only
 * closes if a *different* card triggered the event.
 */
const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const money = useMoney();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const copy = orderCopy(pageLanguageOf(currentChoice(storedLanguage, navigator.language)));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const displayPrice =
    typeof product.price === 'number' && Number.isFinite(product.price)
      ? product.price
      : 0;

  // Derive shopId from the URL path (e.g. /shops/<shopId>/...)
  const parts =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean)
      : [];
  const shopId = parts[1];

  // Unique key used to identify this card's modal in the broadcast event
  const modalId = useMemo(
    () => `${shopId ?? 'global'}:${product.id}`,
    [product.id, shopId]
  );

  // Listen for other cards opening their modal and close this one if needed
  useEffect(() => {
    const handleModalOpen = (event: Event) => {
      const openedModalId = (event as CustomEvent<string>).detail;
      if (openedModalId !== modalId) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('product-modal-open', handleModalOpen);
    return () => window.removeEventListener('product-modal-open', handleModalOpen);
  }, [modalId]);

  const openModal = () => {
    // Notify all other ProductCard instances to close their modals
    window.dispatchEvent(new CustomEvent('product-modal-open', { detail: modalId }));
    setIsModalOpen(true);
    // In the admin's live preview, clicking a dish also opens it in the admin's editor
    postToAdmin({ type: 'select', productId: product.id });
  };

  // Admin's live preview: open or close this dish's popup on request
  const { focusId } = usePreviewState();
  useEffect(() => {
    if (!isPreviewMode()) return;
    const onPreviewOpen = (event: Event) => {
      const id = (event as CustomEvent<string | null>).detail;
      setIsModalOpen(id === product.id);
    };
    window.addEventListener(PREVIEW_OPEN_EVENT, onPreviewOpen);
    return () => window.removeEventListener(PREVIEW_OPEN_EVENT, onPreviewOpen);
  }, [product.id]);

  return (
    <>
      <div
        onClick={openModal}
        data-preview-dish={product.id}
        data-preview-focus={focusId === product.id ? 'true' : undefined}
        className="group/card flex h-full cursor-pointer flex-row-reverse items-start gap-3.5 border-b border-[#f1ebe4] py-4 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:rounded-[18px] sm:border sm:border-[#efe7de] sm:bg-white sm:py-0 sm:transition-all sm:duration-200 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_10px_28px_rgba(31,26,23,0.10)]"
      >
        {/* Photo box: fixed shape; picture or placeholder fills it */}
        <div className="relative shrink-0 sm:w-full">
          <button
            type="button"
            className="relative block h-[108px] w-[108px] cursor-pointer overflow-hidden rounded-[14px] bg-[#f6f1eb] sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none"
            onClick={openModal}
            aria-label={`View details for ${product.label}`}
          >
            {product.imageURL ? (
              <img
                src={product.imageURL}
                alt={product.label}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-transform duration-500 group-hover/card:scale-105"
                draggable={false}
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[#b9ada2]">
                <UtensilsCrossed className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            aria-label={copy.addDish(product.label)}
            className="absolute -bottom-1.5 -right-1.5 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_2px_8px_rgba(31,26,23,0.18)] transition-transform active:scale-95 sm:bottom-3 sm:right-3"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
          </button>
        </div>

        {/* Text: phones stack name → description → price; sm+ puts the price beside the name */}
        <div className="grid min-w-0 flex-1 grid-cols-1 content-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3 sm:p-4 sm:pl-[18px]">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 sm:col-start-1 sm:row-start-1 sm:line-clamp-1 sm:text-lg">
            {product.label}
          </h3>
          <p className="order-3 pt-0.5 text-[15px] font-bold text-gray-900 sm:order-none sm:col-start-2 sm:row-start-1 sm:pt-0 sm:text-right sm:text-base">
            {product.regularPrice !== undefined && (
              <span className="mr-1.5 font-normal text-gray-500 line-through" data-testid="regular-price">
                {money.major(product.regularPrice)}
              </span>
            )}
            <span data-testid="product-price" className="whitespace-nowrap">{money.major(displayPrice)}</span>
            {product.combo && (
              <span className="ml-2 rounded-full bg-[#f6f1eb] px-2 py-0.5 text-xs font-semibold text-[#4a413b]" data-testid="combo-badge">
                {orderCopy(product.language ?? '').comboBadge}
              </span>
            )}
            {product.offerLabel && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" data-testid="offer-label">
                {product.offerLabel}
              </span>
            )}
          </p>
          {product.description && (
            <p className="order-2 line-clamp-2 text-[13px] leading-relaxed text-[#5c524b] sm:order-none sm:col-span-2 sm:text-sm">
              {product.description}
            </p>
          )}

          {(product.dietaryTags.length > 0 || product.spice) && (
            <div className="order-4 flex flex-wrap gap-1 sm:order-none sm:col-span-2 sm:pt-1">
              {product.dietaryTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-[#f6f1eb] px-2 py-0.5 text-xs text-[#4a413b]"
                >
                  {tag.label}
                </span>
              ))}
              {product.spice && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                  {product.spice.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {product.combo ? (
        <ComboModal
          product={product}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          shopId={shopId}
        />
      ) : (
        <ProductModal
          product={product}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          shopId={shopId}
          onAddToCart={(payload) => onAddToCart?.(payload)}
        />
      )}
    </>
  );
};

export default ProductCard;
