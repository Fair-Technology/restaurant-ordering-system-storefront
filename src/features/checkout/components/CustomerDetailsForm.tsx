import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicLegalPackDto } from '../../../api/legalEndpoints';
import type { LegalCopy } from '../../../utils/legalCopy';
import type { CustomerAddress } from '../../../api/orderEndpoints';
import type { OrderCopy } from '../../../utils/orderCopy';
import { addressFromForm } from '../../../utils/address';

export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
  customerAddress?: CustomerAddress;
}

interface CustomerDetailsFormProps {
  onSubmit: (data: CustomerFormData) => void;
  isLoading: boolean;
  isCartEmpty: boolean;
  error?: string;
  legal?: PublicLegalPackDto;
  copy: LegalCopy;
  slug: string;
  submitLabel: string;
  submitDisabled: boolean;
  paymentNote: string | null;
  addressRequired: boolean;
  addressCopy: Pick<
    OrderCopy,
    | 'addressTitleOptional'
    | 'addressTitleRequired'
    | 'addressStreet'
    | 'addressPostcode'
    | 'addressCity'
    | 'addressCountry'
    | 'addressIncomplete'
  >;
  defaultCountry: string;
}

const CustomerDetailsForm: React.FC<CustomerDetailsFormProps> = ({
  onSubmit,
  isLoading,
  isCartEmpty,
  error,
  legal,
  copy,
  slug,
  submitLabel,
  submitDisabled,
  paymentNote,
  addressRequired,
  addressCopy,
  defaultCountry,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState<CustomerAddress>({
    street: '',
    postcode: '',
    city: '',
    country: '',
  });
  // Until the diner edits the country, it follows the default, which can change once the shop's
  // language has loaded (Germany → Deutschland). Captured once, a stale default looked like typed input.
  const [countryEdited, setCountryEdited] = useState(false);
  const country = countryEdited ? address.country : defaultCountry;
  const [addressError, setAddressError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // The prefilled country alone is not an address: an untouched optional form sends none.
    const untouched =
      !address.street.trim() &&
      !address.postcode.trim() &&
      !address.city.trim() &&
      country === defaultCountry;
    const parsed = untouched && !addressRequired ? null : addressFromForm({ ...address, country });
    if (parsed === 'incomplete') {
      setAddressError(addressCopy.addressIncomplete);
      return;
    }
    setAddressError(null);
    onSubmit({ name, email, phone, notes, customerAddress: parsed ?? undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Your Details</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-gray-700 mb-1">
          {addressRequired ? addressCopy.addressTitleRequired : addressCopy.addressTitleOptional}
        </legend>
        <input
          type="text"
          required={addressRequired}
          aria-label={addressCopy.addressStreet}
          placeholder={addressCopy.addressStreet}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={address.street}
          onChange={(e) => setAddress({ ...address, street: e.target.value })}
        />
        <input
          type="text"
          required={addressRequired}
          aria-label={addressCopy.addressPostcode}
          placeholder={addressCopy.addressPostcode}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={address.postcode}
          onChange={(e) => setAddress({ ...address, postcode: e.target.value })}
        />
        <input
          type="text"
          required={addressRequired}
          aria-label={addressCopy.addressCity}
          placeholder={addressCopy.addressCity}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={address.city}
          onChange={(e) => setAddress({ ...address, city: e.target.value })}
        />
        <input
          type="text"
          required={addressRequired}
          aria-label={addressCopy.addressCountry}
          placeholder={addressCopy.addressCountry}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={country}
          onChange={(e) => {
            setCountryEdited(true);
            setAddress({ ...address, country: e.target.value });
          }}
        />
        {addressError && <p className="text-red-600 text-sm">{addressError}</p>}
      </fieldset>

      {legal && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {legal.seller.phone
            ? copy.allergyLine(legal.seller.legalName, legal.seller.phone)
            : copy.allergyLineNoPhone}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {copy.notesLabel}
        </label>
        <textarea
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.notesPlaceholder}
        />
      </div>

      {legal && (
        <div className="space-y-2 text-xs text-gray-500">
          <p data-testid="seller-statement">
            {copy.sellerStatement(legal.seller.legalName, legal.platform.name)}
          </p>
          <p>
            {copy.acceptPrefix(legal.seller.legalName)}
            <Link to={`/shops/${slug}/legal/terms`} className="underline">
              {copy.footerTerms}
            </Link>
            {copy.acceptMiddle(legal.seller.legalName)}
            <Link to={`/shops/${slug}/legal/withdrawal`} className="underline">
              {copy.footerWithdrawal}
            </Link>
            {copy.acceptAnd}
            <Link to={`/shops/${slug}/legal/privacy`} className="underline">
              {copy.footerPrivacy}
            </Link>
            {copy.acceptEnd}
          </p>
        </div>
      )}

      {paymentNote && <p className="text-sm text-gray-700">{paymentNote}</p>}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        className="w-full bg-[var(--brand-accent)] hover:opacity-90 text-[var(--brand-on-accent)] px-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50"
        disabled={isCartEmpty || isLoading || submitDisabled}
      >
        {isLoading ? 'Loading…' : submitLabel}
      </button>
    </form>
  );
};

export default CustomerDetailsForm;
