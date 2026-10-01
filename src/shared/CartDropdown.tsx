import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectCartItems,
  selectCartTotal,
  incrementItem,
  decrementItem,
  removeItem,
  clearCart,
} from '../store/slices/cartSlice';
import { formatDollars } from '../utils/money';

interface CartDropdownProps {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
  onClose: () => void;
  onCheckout?: () => void;
}

const CartDropdown: React.FC<CartDropdownProps> = ({
  dropdownRef,
  style,
  onClose,
  onCheckout,
}) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const cartTotal = useAppSelector(selectCartTotal);

  return (
    <div ref={dropdownRef} role="dialog" aria-label="Cart dropdown" style={style}>
      <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl border border-gray-100 p-4">
        <h4 className="font-semibold mb-3 text-gray-900">Your Order</h4>

        {cartItems.length === 0 ? (
          <div className="text-sm text-gray-500">No items yet</div>
        ) : (
          <>
            <div className="max-h-64 overflow-auto space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 text-sm py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">No image</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-gray-500 text-xs">
                      {item.quantity} × {formatDollars(item.price)} ={' '}
                      {formatDollars(item.quantity * item.price)}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        className="w-7 h-7 flex items-center justify-center text-sm bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        onClick={() => dispatch(decrementItem({ key: item.key }))}
                      >
                        -
                      </button>
                      <div className="text-xs px-2 font-medium">{item.quantity}</div>
                      <button
                        className="w-7 h-7 flex items-center justify-center text-sm bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        onClick={() => dispatch(incrementItem({ key: item.key }))}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="text-xs text-red-500"
                      onClick={() => dispatch(removeItem({ key: item.key }))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 mt-2 flex items-center justify-between">
              <div className="font-semibold">Total</div>
              <div className="font-semibold">{formatDollars(cartTotal)}</div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                className="flex-1 bg-gray-900 hover:bg-[var(--brand-accent)] text-white px-4 py-2 rounded-full font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                onClick={() => {
                  onClose();
                  onCheckout?.();
                }}
              >
                Checkout
              </button>
              <button
                className="px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={() => dispatch(clearCart())}
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CartDropdown;
