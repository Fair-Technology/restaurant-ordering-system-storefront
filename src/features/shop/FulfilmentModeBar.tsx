import React from 'react';
import type { FulfilmentMode } from '../../store/slices/shopSlice';
import type { OrderCopy } from '../../utils/orderCopy';

interface FulfilmentModeBarProps {
  modes: FulfilmentMode[];
  prepMinutes: Record<FulfilmentMode, number>;
  selected: FulfilmentMode;
  onSelect: (mode: FulfilmentMode) => void;
  copy: OrderCopy;
}

const FulfilmentModeBar: React.FC<FulfilmentModeBarProps> = ({
  modes,
  prepMinutes,
  selected,
  onSelect,
  copy,
}) => {
  const shortLabel: Record<FulfilmentMode, string> = {
    collection: copy.modeCollectionShort,
    delivery: copy.modeDelivery,
    dine_in: copy.modeDineIn,
  };

  if (modes.length <= 1) {
    const only = modes[0] ?? 'collection';
    const label = only === 'collection' ? copy.modeCollection(prepMinutes.collection) : shortLabel[only];
    return (
      <div className="max-w-7xl mx-auto px-6 pt-3">
        <span className="inline-block rounded-full bg-white border border-gray-200 px-3 py-1 text-sm text-gray-700">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-3">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">{copy.chooseMode}</h2>
      <div className="flex flex-wrap gap-2">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={selected === mode}
            onClick={() => onSelect(mode)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              selected === mode
                ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)] border-transparent'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {shortLabel[mode]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FulfilmentModeBar;
