import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import Button from '../../shared/Button';
import ProductModal from './ProductModal';
import { Product } from '../../types/Product';
import { formatDollars } from '../../utils/money';

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
 * Clicking the card image or "View Details" button opens ProductModal.
 *
 * A custom DOM event (`product-modal-open`) is dispatched when a modal opens,
 * allowing other open ProductCard instances to close their own modal. The
 * modalId (shopId:productId) uniquely identifies each modal so a card only
 * closes if a *different* card triggered the event.
 */
const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
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
  };

  return (
    <>
      <div className="group/card rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.13)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden">
        <button
          type="button"
          className="relative w-full aspect-[4/3] overflow-hidden cursor-pointer"
          onClick={openModal}
          aria-label={`View details for ${product.label}`}
        >
          {product.imageURL ? (
            <img
              src={product.imageURL}
              alt={product.label}
              className="w-full h-full object-cover pointer-events-none select-none group-hover/card:scale-105 transition-transform duration-500"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <UtensilsCrossed className="w-12 h-12 text-gray-300" />
            </div>
          )}
        </button>
        <div className="p-3 sm:p-4 flex flex-col justify-between flex-1 space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 line-clamp-1">
            {product.label}
          </h3>
          <p className="text-sm font-bold text-gray-900">
            {formatDollars(displayPrice)}
          </p>
          <p className="text-gray-500 text-xs sm:text-sm line-clamp-2">
            {product.description}
          </p>

          {(product.dietaryTags.length > 0 || product.spice) && (
            <div className="flex flex-wrap gap-1">
              {product.dietaryTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700"
                >
                  {tag.label}
                </span>
              ))}
              {product.spice && (
                <span className="rounded-full px-2 py-0.5 text-xs bg-orange-100 text-orange-700">
                  {product.spice.label}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="w-full text-xs sm:text-sm"
              onClick={openModal}
            >
              View Details
            </Button>
          </div>
        </div>
      </div>

      <ProductModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shopId={shopId}
        onAddToCart={(payload) => onAddToCart?.(payload)}
      />
    </>
  );
};

export default ProductCard;
