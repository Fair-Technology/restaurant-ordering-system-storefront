import React, { useState } from 'react';
import type { DeliveryZoneDto } from '../../api/orderEndpoints';
import type { OrderCopy } from '../../utils/orderCopy';
import { isWellFormedPostcode, normalisePostcode, postcodeFormatFor, zoneFor } from '../../utils/delivery';

interface DeliveryPostcodeBoxProps {
  zones: DeliveryZoneDto[];
  postcode: string | null;
  deliveryMinutes: number;
  countryCode: string | null;
  onChoose: (postcode: string) => void;
  onCollect: () => void;
  copy: OrderCopy;
  formatCents: (cents: number) => string;
}

type PostcodeError = { kind: 'malformed'; digits: number } | { kind: 'notServed'; postcode: string };

const DeliveryPostcodeBox: React.FC<DeliveryPostcodeBoxProps> = ({
  zones,
  postcode,
  deliveryMinutes,
  countryCode,
  onChoose,
  onCollect,
  copy,
  formatCents,
}) => {
  const [input, setInput] = useState(postcode ?? '');
  const [error, setError] = useState<PostcodeError | null>(null);
  const [editing, setEditing] = useState(postcode === null);
  const zone = postcode ? zoneFor(zones, postcode) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fmt = postcodeFormatFor(countryCode);
    if (fmt && !isWellFormedPostcode(input, countryCode)) {
      setError({ kind: 'malformed', digits: fmt.digits });
      return;
    }
    const z = zoneFor(zones, input);
    if (z) {
      setError(null);
      onChoose(z.postcode);
      setEditing(false);
    } else {
      setError({ kind: 'notServed', postcode: normalisePostcode(input) });
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
      {error?.kind === 'malformed' && (
        <div className="mt-2 text-sm text-amber-800">
          <p role="status">{copy.deliveryPostcodeInvalid(error.digits)}</p>
        </div>
      )}
      {error?.kind === 'notServed' && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-amber-800">
          <p role="status">{copy.deliveryNotServed(error.postcode)}</p>
          <button type="button" onClick={onCollect} className="underline">
            {copy.collectInstead}
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliveryPostcodeBox;
