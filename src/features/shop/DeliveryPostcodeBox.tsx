import React, { useState } from 'react';
import type { DeliveryZoneDto } from '../../api/orderEndpoints';
import type { OrderCopy } from '../../utils/orderCopy';
import { normalisePostcode, zoneFor } from '../../utils/delivery';

interface DeliveryPostcodeBoxProps {
  zones: DeliveryZoneDto[];
  postcode: string | null;
  deliveryMinutes: number;
  onChoose: (postcode: string) => void;
  onCollect: () => void;
  copy: OrderCopy;
  formatCents: (cents: number) => string;
}

const DeliveryPostcodeBox: React.FC<DeliveryPostcodeBoxProps> = ({
  zones,
  postcode,
  deliveryMinutes,
  onChoose,
  onCollect,
  copy,
  formatCents,
}) => {
  const [input, setInput] = useState(postcode ?? '');
  const [notServed, setNotServed] = useState<string | null>(null);
  const [editing, setEditing] = useState(postcode === null);
  const zone = postcode ? zoneFor(zones, postcode) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zoneFor(zones, input);
    if (z) {
      setNotServed(null);
      onChoose(z.postcode);
      setEditing(false);
    } else {
      setNotServed(normalisePostcode(input));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-3">
      {!editing && zone ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <span>
            {copy.deliverySummary(
              zone.postcode,
              formatCents(zone.feeCents),
              formatCents(zone.minOrderCents),
              deliveryMinutes,
            )}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="underline text-gray-600">
            {copy.deliveryChange}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={copy.deliveryPostcodeLabel}
            placeholder={copy.deliveryPostcodeLabel}
            inputMode="text"
            autoComplete="postal-code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copy.deliveryCheck}
          </button>
        </form>
      )}
      {notServed !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-amber-800">
          <p role="status">{copy.deliveryNotServed(notServed)}</p>
          <button type="button" onClick={onCollect} className="underline">
            {copy.collectInstead}
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliveryPostcodeBox;
