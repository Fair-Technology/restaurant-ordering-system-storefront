import React from 'react';
import type { FulfilmentMode } from '../../store/slices/shopSlice';
import type { OrderCopy } from '../../utils/orderCopy';

interface FulfilmentModeBarProps {
  modes: FulfilmentMode[];
  selected: FulfilmentMode;
  onSelect: (mode: FulfilmentMode) => void;
  copy: OrderCopy;
}

const FulfilmentModeBar: React.FC<FulfilmentModeBarProps> = ({
  modes,
  selected,
  onSelect,
  copy,
}) => {
  const shortLabel: Record<FulfilmentMode, string> = {
    collection: copy.modeCollectionShort,
    delivery: copy.modeDelivery,
    dine_in: copy.modeDineIn,
  };

  // One way to get the food: nothing to choose, so nothing is shown
  if (modes.length <= 1) return null;

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
