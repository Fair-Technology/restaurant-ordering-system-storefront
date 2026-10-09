import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { UtensilsCrossed } from 'lucide-react';
import Button from '../../shared/Button';
import TickCheckbox from '../../shared/TickCheckbox';
import { useAppDispatch } from '../../store/hooks';
import { addItem } from '../../store/slices/cartSlice';
import { useMoney } from '../../hooks/useMoney';
import { menuLabels } from '../../utils/menuLabels';
import { orderCopy } from '../../utils/orderCopy';
import { toggleAddonSelection } from '../../utils/addonSelection';
import {
  comboCartChoices,
  comboDetail,
  comboReady,
  comboUnitPrice,
  optionOf,
  type ComboPicks,
} from '../../utils/combo';
import type { Product } from '../../types/Product';

interface ComboModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
}

/** A group with exactly one dish starts picked; the others start empty. */
function initialPicks(product: Product): ComboPicks {
  const picks: ComboPicks = {};
  for (const g of product.combo ?? []) {
    if (g.options.length === 1) {
      const o = g.options[0];
      picks[g.id] = { productId: o.id, variantId: o.variantTypes[0]?.variants[0]?.id, addonIds: [] };
    }
  }
  return picks;
}

/**
 * ComboModal — picker for a combo: one dish per choice, plus that dish's own size and extras.
 * Sizes and extras that cost extra are added on top of the combo price. The combo goes into the
 * basket as one line; the server splits it into its dishes.
 */
const ComboModal: React.FC<ComboModalProps> = ({ product, isOpen, onClose, shopId }) => {
  const dispatch = useAppDispatch();
  const money = useMoney();
  const copy = orderCopy(product.language ?? '');
  const labels = menuLabels(product.language);

  const urlParts =
    typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
  const effectiveShopId = shopId ?? urlParts[1];

  const [picks, setPicks] = useState<ComboPicks>(() => initialPicks(product));
  const [quantity, setQuantity] = useState(1);

  // Reset on every open, as ProductModal does
  useEffect(() => {
    if (!isOpen) return;
    setPicks(initialPicks(product));
    setQuantity(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Allergens and additives of every dish on offer in the combo
  const { allergens, additives } = useMemo(() => {
    const options = (product.combo ?? []).flatMap((g) => g.options);
    const byId = <T extends { id: string }>(list: T[]) => [...new Map(list.map((x) => [x.id, x])).values()];
    return {
      allergens: byId([...product.allergens, ...options.flatMap((o) => o.allergens)]),
      additives: byId([...product.additives, ...options.flatMap((o) => o.additives)]),
    };
  }, [product]);

  const ready = comboReady(product, picks);
  const unit = comboUnitPrice(product, picks);

  function pickOption(groupId: string, o: Product) {
    setPicks((prev) => ({
      ...prev,
      [groupId]: { productId: o.id, variantId: o.variantTypes[0]?.variants[0]?.id, addonIds: [] },
    }));
  }

  function handleAdd() {
    dispatch(
      addItem({
        shopId: effectiveShopId,
        item: {
          id: product.id,
          name: product.label,
          imageUrl: product.imageURL,
          price: unit,
          quantity,
          comboChoices: comboCartChoices(product, picks),
          detail: comboDetail(product, picks),
        },
      }),
    );
    setQuantity(1);
    onClose();
  }

  if (!isOpen) return null;
  const canUseDom = typeof document !== 'undefined';

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="relative z-[1001] bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">{product.label}</h3>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
            {product.imageURL ? (
              <img src={product.imageURL} alt={product.label} className="w-full h-48 object-cover rounded" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded bg-gradient-to-br from-gray-100 to-gray-50">
                <UtensilsCrossed className="w-12 h-12 text-gray-300" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-4">{product.description}</p>

            {/* Mandatory allergen and additive declaration, for every dish on offer in the combo */}
            <section className="mb-4 text-xs text-gray-600">
              <p>
                <span className="font-semibold">{labels.allergens}:</span>{' '}
                {allergens.length ? allergens.map((a) => a.label).join(', ') : labels.noAllergens}
              </p>
              <p>
                <span className="font-semibold">{labels.additives}:</span>{' '}
                {additives.length
                  ? additives.map((a) => `${a.code} ${a.label}`).join(', ')
                  : labels.noAdditives}
              </p>
            </section>

            {(product.combo ?? []).map((group) => {
              const pick = picks[group.id];
              const chosen = pick ? optionOf(product, group.id, pick.productId) : undefined;
              return (
                <div key={group.id} className="mb-4">
                  <div className="font-medium text-sm mb-2">
                    {group.label}
                    <span className="ml-2 text-xs font-normal text-gray-500">{copy.comboPickOne}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.options.map((o) => (
                      <label
                        key={o.id}
                        className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm cursor-pointer ${
                          pick?.productId === o.id ? 'border-gray-900 bg-gray-50' : 'bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`combo-${group.id}`}
                          aria-label={o.label}
                          checked={pick?.productId === o.id}
                          onChange={() => pickOption(group.id, o)}
                        />
                        <span>{o.label}</span>
                        {o.allergens.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {o.allergens.map((a) => a.label).join(', ')}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>

                  {chosen && pick && (
                    <div className="mt-2 ml-6">
                      {chosen.variantTypes.map((vt) => (
                        <div key={vt.id} className="mb-3">
                          <div className="font-medium text-sm mb-2">{vt.label}</div>
                          <div className="flex gap-2 flex-wrap">
                            {vt.variants.map((variant) => (
                              <label
                                key={variant.id}
                                className={`px-3 py-1 border rounded cursor-pointer text-sm ${
                                  pick.variantId === variant.id ? 'border-gray-900 bg-gray-50' : 'bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`variant-${group.id}-${vt.id}`}
                                  value={variant.id}
                                  checked={pick.variantId === variant.id}
                                  onChange={() =>
                                    setPicks((prev) => ({ ...prev, [group.id]: { ...pick, variantId: variant.id } }))
                                  }
                                  className="hidden"
                                />
                                <div className="flex items-center gap-2">
                                  <span>{variant.label}</span>
                                  {variant.priceDelta ? (
                                    <span className="text-xs text-gray-500">+{money.major(variant.priceDelta)}</span>
                                  ) : null}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      {chosen.addons.map((ag) => (
                        <div key={ag.id} className="mb-3">
                          <div className="font-medium text-sm mb-2">
                            {ag.label}
                            {ag.minSelectable > 0 && (
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                {copy.addonChooseAtLeast(ag.minSelectable)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {ag.options.map((option) => (
                              <TickCheckbox
                                key={option.id}
                                checked={pick.addonIds.includes(option.id)}
                                onChange={() =>
                                  setPicks((prev) => ({
                                    ...prev,
                                    [group.id]: {
                                      ...pick,
                                      addonIds: [
                                        ...toggleAddonSelection(chosen.addons, new Set(pick.addonIds), option.id),
                                      ],
                                    },
                                  }))
                                }
                                label={option.label}
                                hint={option.priceDelta ? `+ ${money.major(option.priceDelta)}` : undefined}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center border rounded">
                <button className="px-3 py-1 text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  -
                </button>
                <div className="px-4">{quantity}</div>
                <button className="px-3 py-1 text-lg" onClick={() => setQuantity((q) => q + 1)}>
                  +
                </button>
              </div>
              <div className="ml-auto text-right">
                <div className="text-sm text-gray-500">{copy.comboTotal(money.major(unit * quantity))}</div>
                {!ready && <div className="text-xs text-gray-500">{copy.comboIncomplete}</div>}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button className="flex-1" onClick={handleAdd} disabled={!ready}>
                {copy.comboAdd}
              </Button>
              <Button variant="outline" className="px-4" onClick={onClose}>
                {copy.comboCancel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return canUseDom ? createPortal(modalContent, document.body) : modalContent;
};

export default ComboModal;
