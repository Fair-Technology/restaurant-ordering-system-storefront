import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectCartItems,
  selectCartTotal,
  incrementItem,
  decrementItem,
  removeItem,
  type CartItem,
} from '../../../store/slices/cartSlice';
import { useMoney } from '../../../hooks/useMoney';
import type { Product } from '../../../types/Product';
import ProductModal from '../../menu/ProductModal';
import ConfirmModal from '../../../shared/ConfirmModal';

interface CartSummaryProps {
  slug: string;
  products: Product[];
}

const CartSummary: React.FC<CartSummaryProps> = ({ slug, products }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cartItems = useAppSelector(selectCartItems);
  const cartTotal = useAppSelector(selectCartTotal);
  const money = useMoney();

  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [removingItem, setRemovingItem] = useState<CartItem | null>(null);

  // Look up the full product for the item being edited
  const editProduct = editingItem ? products.find((p) => p.id === editingItem.id) : undefined;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold mb-4">Your Order</h2>

      {cartItems.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-gray-500">Your cart is empty.</p>
          <button
            className="text-sm font-medium underline"
            style={{ color: 'var(--brand-accent)' }}
            onClick={() => navigate(`/shops/${slug}`)}
          >
            Back to Menu
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cartItems.map((item) => {
            // Look up selected variant and addon names for display
            const product = products.find((p) => p.id === item.id);
            const variantName = product?.variantTypes
              .flatMap((vt) => vt.variants)
              .find((v) => v.id === item.variantId)?.label;
            const addonNames =
              product?.addons
                .flatMap((ag) => ag.options)
                .filter((o) => item.addonOptionIds?.includes(o.id))
                .map((o) => o.label) ?? [];

            const customisationDetail = [variantName, addonNames.join(', ')]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                key={item.key}
                className="flex items-center gap-3 py-3 border-b last:border-b-0"
              >
                <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No image</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  {customisationDetail && (
                    <div className="text-gray-400 text-xs mt-0.5 leading-relaxed">{customisationDetail}</div>
                  )}
                  <div className="text-gray-500 text-xs mt-0.5">{money.major(item.price)} each</div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                      onClick={() => dispatch(decrementItem({ key: item.key }))}
                    >
                      −
                    </button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                      onClick={() => dispatch(incrementItem({ key: item.key }))}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-sm font-medium">
                    {money.major(item.quantity * item.price)}
                  </div>
                  <div className="flex gap-2">
                    {product && (
                      <button
                        className="text-xs text-[var(--brand-accent)] hover:underline"
                        onClick={() => setEditingItem(item)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className="text-xs text-red-400 hover:text-red-600"
                      onClick={() => setRemovingItem(item)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between font-semibold pt-2 text-sm">
            <span>Total</span>
            <span>{money.major(cartTotal)}</span>
          </div>
        </div>
      )}

      {/* Edit modal — pre-filled with the item's current selections */}
      {editingItem && editProduct && (
        <ProductModal
          product={editProduct}
          isOpen={true}
          onClose={() => setEditingItem(null)}
          shopId={slug}
          editItemKey={editingItem.key}
          initialVariantId={editingItem.variantId}
          initialAddonIds={editingItem.addonOptionIds}
          initialQuantity={editingItem.quantity}
        />
      )}

      {/* Remove confirmation modal */}
      <ConfirmModal
        isOpen={removingItem !== null}
        title="Remove item?"
        message={`Remove "${removingItem?.name}" from your order?`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => {
          dispatch(removeItem({ key: removingItem!.key }));
          setRemovingItem(null);
        }}
        onCancel={() => setRemovingItem(null)}
      />
    </div>
  );
};

export default CartSummary;
