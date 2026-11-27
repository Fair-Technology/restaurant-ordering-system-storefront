import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Icon } from './Icon';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loadCart, selectCartCount } from '../store/slices/cartSlice';
import CartDropdown, { type CartContext } from './CartDropdown';
import { OPEN_CART_EVENT } from '../constants/cart';
import ShopLogo from './ShopLogo';
import { orderCopy } from '../utils/orderCopy';
import { siteCopy } from '../utils/siteCopy';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';

// The cart label in every page language, for a button width that doesn't change with the language
const CART_LABELS = [...new Set(['de', 'en'].map((lang) => orderCopy(lang).cartLabel))];

interface NavBarProps {
  shopName: string;
  shopId: string;
  logoUrl: string | null;
  onCheckout?: () => void;
  /** Shown from sm up, left of the cart (phones show it in the shop intro instead) */
  languageSwitcher?: React.ReactNode;
  /** Pages after ordering (the order status page) have no use for the cart */
  hideCart?: boolean;
  /** How the order will be handed over, for the line at the top of the cart */
  cartContext?: CartContext;
  /** Shown instead of the logo and name while the shop has neither (not loaded, or failed to load) */
  fallbackLabel?: string;
}

const NavBar: React.FC<NavBarProps> = ({
  shopName,
  shopId,
  logoUrl,
  onCheckout,
  languageSwitcher,
  hideCart = false,
  cartContext,
  fallbackLabel,
}) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const pageLang = pageLanguageOf(currentChoice(storedLanguage, navigator.language));
  const copy = orderCopy(pageLang);
  const hasIdentity = Boolean(shopName || logoUrl);
  const homeLabel = fallbackLabel || siteCopy(pageLang).toHome;
  // `isCartOpen` tracks the visibility of the cart dropdown
  const [isCartOpen, setIsCartOpen] = useState(false);
  const navigate = useNavigate();

  const dispatch = useAppDispatch();
  const cartCount = useAppSelector(selectCartCount);

  useEffect(() => {
    if (!shopId) return;
    dispatch(loadCart({ shopId }));
  }, [dispatch, shopId]);

  // The customise popup's "View cart" asks for the cart to open without owning its state
  useEffect(() => {
    const open = () => setIsCartOpen(true);
    window.addEventListener(OPEN_CART_EVENT, open);
    return () => window.removeEventListener(OPEN_CART_EVENT, open);
  }, []);

  // Refs for the cart button and its portal dropdown panel
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  // Position the dropdown portal below the cart button.
  // We use useLayoutEffect (not useEffect) to avoid a one-frame flicker where
  // the dropdown would appear at position 0,0 before the DOM measurement runs.
  // The dropdown is rendered via createPortal to escape the sticky header's
  // stacking context, which would otherwise clip the overflow.
  useLayoutEffect(() => {
    if (!isCartOpen || !buttonRef.current) {
      setDropdownPos(null);
      return;
    }
    const DROPDOWN_WIDTH = 400;
    function compute() {
      const rect = buttonRef.current!.getBoundingClientRect();
      const left = Math.min(
        Math.max(rect.right - DROPDOWN_WIDTH, 8),
        window.innerWidth - DROPDOWN_WIDTH - 8,
      );
      const top = rect.bottom + window.scrollY + 12;
      setDropdownPos({ left, top, width: DROPDOWN_WIDTH });
    }
    compute();
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [isCartOpen]);

  // Close cart when the user clicks outside the button or dropdown
  useEffect(() => {
    if (!isCartOpen) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsCartOpen(false);
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [isCartOpen]);

  return (
    <>
      <header className="bg-white border-b border-[#f1ebe4]">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center h-16">
          <button
            className="flex min-w-0 items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/shops/${shopId}`)}
            aria-label={hasIdentity ? siteCopy(pageLang).goToShop(shopName) : homeLabel}
          >
            {hasIdentity ? (
              <>
                <ShopLogo
                  name={shopName}
                  logoUrl={logoUrl}
                  className="h-8 w-8 rounded-sm ring-2 ring-[var(--brand-accent)]"
                  logoClassName="h-10 w-10 md:h-12 md:w-12 max-h-[var(--logo-h)] max-w-[var(--logo-w)]"
                  wideClassName="h-10 md:h-12 w-auto max-h-[var(--logo-h)] max-w-[min(var(--logo-w),200px)] md:max-w-[min(var(--logo-w),320px)]"
                  textClassName="text-xs"
                />
                {!logoUrl && (
                  <span className="truncate font-bold text-xl text-gray-900">
                    {shopName}
                  </span>
                )}
              </>
            ) : (
              <span className="truncate font-bold text-xl text-gray-900">{homeLabel}</span>
            )}
          </button>

          <div className="flex items-center gap-3 relative">
            {languageSwitcher && <div className="hidden sm:block">{languageSwitcher}</div>}
            {!hideCart && (
            <button
              ref={buttonRef}
              className="relative flex h-11 items-center gap-2 rounded-full bg-gray-900 px-3 text-sm font-bold text-white transition-colors hover:bg-black sm:px-4"
              onClick={() => setIsCartOpen((v) => !v)}
              aria-expanded={isCartOpen}
              aria-label={copy.cartLabel}
            >
              {Icon(ShoppingBag, { className: 'w-[18px] h-[18px]' })}
              {/* Every language's label sits in the same grid cell, the others invisible, so the
                  button is as wide as the longest one and keeps its width when the language changes */}
              <span className="hidden sm:inline-grid" aria-hidden="true" data-testid="cart-label">
                {CART_LABELS.map((label) => (
                  <span key={label} className={`col-start-1 row-start-1 text-center ${label === copy.cartLabel ? '' : 'invisible'}`}>
                    {label}
                  </span>
                ))}
              </span>
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--brand-accent,#ff8c32)] px-1.5 text-xs text-[var(--brand-on-accent,#fff)]">
                {cartCount}
              </span>
            </button>
            )}

            {/* Render dropdown via portal anchored below the cart button */}
            {isCartOpen &&
              dropdownPos &&
              createPortal(
                <CartDropdown
                  dropdownRef={dropdownRef}
                  style={{
                    position: 'absolute',
                    left: dropdownPos.left,
                    top: dropdownPos.top,
                    width: dropdownPos.width,
                    zIndex: 9999,
                  }}
                  onClose={() => setIsCartOpen(false)}
                  onCheckout={onCheckout}
                  context={cartContext}
                />,
                document.body,
              )}
          </div>
        </div>
      </header>
    </>
  );
};

export default NavBar;
