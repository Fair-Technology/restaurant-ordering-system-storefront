import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectCartItems,
  incrementItem,
  decrementItem,
  removeItem,
  type CartItem,
} from '../../../store/slices/cartSlice';
import { useMoney } from '../../../hooks/useMoney';
import type { Product } from '../../../types/Product';
import type { OrderCopy } from '../../../utils/orderCopy';
import ProductModal from '../../menu/ProductModal';
import ConfirmModal from '../../../shared/ConfirmModal';
import DishTimeLine from '../../../shared/DishTimeLine';
import { useDishTimes } from '../../../hooks/useDishTimes';

/** "Rigatoni · Mozzarella, Pinienkerne": the chosen variant and extras of a basket line. */
export function itemDetail(item: CartItem, products: Product[]): string {
  if (item.detail) return item.detail;
  const product = products.find((p) => p.id === item.id);
  const variantName = product?.variantTypes
    ?.flatMap((vt) => vt.variants)
    .find((v) => v.id === item.variantId)?.label;
  const addonNames =
    product?.addons
      ?.flatMap((ag) => ag.options)
      .filter((o) => item.addonOptionIds?.includes(o.id))
      .map((o) => o.label) ?? [];
  return [variantName, addonNames.join(', ')].filter(Boolean).join(' · ');
}

interface CartSummaryProps {
  slug: string;
  products: Product[];
  copy: OrderCopy;
  /** Basket positions the quote calls time-limited; absent (no quote yet) = work it out from the menu */
  limitedIndexes?: number[];
  /** Basket positions that cannot share a time with the rest: their time line turns red */
  clashIndexes?: number[];
}

/**
 * CartSummary — the editable basket card on the checkout page: photo, name, chosen options,
 * a quantity stepper (the minus becomes a bin at one, asking before it removes), the line
 * total and an Edit link that reopens the dish popup with the current choices.
 */
const CartSummary: React.FC<CartSummaryProps> = ({ slug, products, copy, limitedIndexes, clashIndexes = [] }) => {
  const dishTimes = useDishTimes();
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const money = useMoney();
  const count = cartItems.reduce((n, i) => n + i.quantity, 0);

  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [removingItem, setRemovingItem] = useState<CartItem | null>(null);

  // Look up the full product for the item being edited
  const editProduct = editingItem ? products.find((p) => p.id === editingItem.id) : undefined;

  return (
    <section className="rounded-[20px] border border-[#efe7de] bg-white p-5 sm:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold text-gray-900">{copy.basketTitle}</h2>
        {count > 0 && <span className="text-sm text-[#6b6058]">{copy.cartItems(count)}</span>}
      </div>

      {cartItems.length === 0 ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-[#5c524b]">{copy.basketEmpty}</p>
          <Link to={`/shops/${slug}`} className="text-sm font-bold text-gray-900 underline underline-offset-4">
            {copy.backToMenu}
          </Link>
        </div>
      ) : (
        <>
          <ul>
            {cartItems.map((item, index) => {
              const timeText = limitedIndexes && !limitedIndexes.includes(index) ? null : dishTimes(item.id);
              const product = products.find((p) => p.id === item.id);
              const detail = itemDetail(item, products);
              const isOne = item.quantity <= 1;
              return (
                <li key={item.key} className="flex items-start gap-4 border-b border-[#f1ebe4] py-4">
                  <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f1eb] sm:h-[72px] sm:w-[72px]">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UtensilsCrossed className="h-6 w-6 text-[#b9ada2]" aria-hidden="true" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-bold text-gray-900 sm:text-base">{item.name}</span>
                      <span className="whitespace-nowrap text-[15px] font-bold text-gray-900 sm:text-base">
                        {money.major(item.quantity * item.price)}
                      </span>
                    </div>
                    {detail && <span className="text-[13px] leading-relaxed text-[#5c524b]">{detail}</span>}
                    {timeText && <DishTimeLine text={timeText} clash={clashIndexes.includes(index)} />}
                    {item.quantity > 1 && (
                      <span className="text-xs text-[#6b6058]">{copy.basketEach(money.major(item.price))}</span>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-1.5">
                      <div className="flex h-11 items-center rounded-full border border-[#e3d9ce] px-0.5">
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100"
                          aria-label={isOne ? copy.basketRemoveItem(item.name) : copy.basketLess(item.name)}
                          onClick={() =>
                            isOne ? setRemovingItem(item) : dispatch(decrementItem({ key: item.key }))
                          }
                        >
                          {isOne ? (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Minus className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                          )}
                        </button>
                        <span className="min-w-[22px] text-center text-[15px] font-bold" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100"
                          aria-label={copy.basketMore(item.name)}
                          onClick={() => dispatch(incrementItem({ key: item.key }))}
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                        </button>
                      </div>
                      {product && !item.comboChoices && (
                        <button
                          type="button"
                          className="px-1 py-3 text-sm font-semibold text-gray-900 underline underline-offset-4"
                          onClick={() => setEditingItem(item)}
                        >
                          {copy.basketEdit}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            to={`/shops/${slug}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-gray-900"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4efe9]">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
            </span>
            {copy.basketAddMore}
          </Link>
        </>
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
        title={copy.basketRemoveTitle}
        message={copy.basketRemoveMessage(removingItem?.name ?? '')}
        confirmLabel={copy.basketRemove}
        cancelLabel={copy.basketKeep}
        onConfirm={() => {
          dispatch(removeItem({ key: removingItem!.key }));
          setRemovingItem(null);
        }}
        onCancel={() => setRemovingItem(null)}
      />
    </section>
  );
};

export default CartSummary;
