import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Icon } from './Icon';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loadCart, selectCartCount } from '../store/slices/cartSlice';
import CartDropdown from './CartDropdown';

interface NavBarProps {
  shopName: string;
  shopId: string;
  logoUrl: string;
  onCheckout?: () => void;
}

const NavBar: React.FC<NavBarProps> = ({
  shopName,
  shopId,
  logoUrl,
  onCheckout,
}) => {
  // `isCartOpen` tracks the visibility of the cart dropdown
  const [isCartOpen, setIsCartOpen] = useState(false);
  const navigate = useNavigate();

  const dispatch = useAppDispatch();
  const cartCount = useAppSelector(selectCartCount);

  useEffect(() => {
    if (!shopId) return;
    dispatch(loadCart({ shopId }));
  }, [dispatch, shopId]);

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
    const DROPDOWN_WIDTH = 384; // matches Tailwind w-96
    function compute() {
      const rect = buttonRef.current!.getBoundingClientRect();
      const left = Math.min(
        Math.max(rect.right - DROPDOWN_WIDTH, 8),
        window.innerWidth - DROPDOWN_WIDTH - 8,
      );
      const top = rect.bottom + window.scrollY + 8;
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
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center h-16">
          <button
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/shops/${shopId}`)}
            aria-label={`Go to ${shopName}`}
          >
            <img
              src={logoUrl}
              alt={shopName}
              className="h-8 w-8 rounded object-cover ring-2 ring-[var(--brand-primary)]"
            />
            <span className="font-bold text-xl text-gray-900">{shopName}</span>
          </button>

          <div className="flex items-center gap-4 relative">
            <div className="relative group">
              <button
                ref={buttonRef}
                className="relative text-gray-700"
                onClick={() => setIsCartOpen((v) => !v)}
                aria-label="Cart"
              >
                {Icon(ShoppingBag, { className: 'w-5 h-5' })}
                <span className="absolute -top-2 -right-2 text-white text-xs rounded-full px-1 bg-gray-900">
                  {cartCount}
                </span>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 z-10">
                Cart
              </span>
            </div>

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
