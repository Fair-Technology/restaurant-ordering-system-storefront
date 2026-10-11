import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { LegalCopy } from '../../../utils/legalCopy';
import type { CustomerAddress, DeliveryAddress } from '../../../api/orderEndpoints';
import type { OrderCopy } from '../../../utils/orderCopy';
import { addressFromForm } from '../../../utils/address';

export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
  customerAddress?: CustomerAddress;
  deliveryAddress?: DeliveryAddress;
}

type FormCopy = Pick<
  OrderCopy,
  | 'detailsTitle'
  | 'nameLabel'
  | 'namePlaceholder'
  | 'emailLabel'
  | 'emailHint'
  | 'emailPlaceholder'
  | 'phoneLabel'
  | 'phoneHint'
  | 'phonePlaceholder'
  | 'billingToggle'
  | 'addressTitleOptional'
  | 'addressTitleRequired'
  | 'addressStreet'
  | 'addressPostcode'
  | 'addressCity'
  | 'addressCountry'
  | 'addressIncomplete'
  | 'deliveryAddressTitle'
  | 'deliveryStreet'
  | 'deliveryCity'
  | 'deliveryPostcodeFixed'
>;

interface CustomerDetailsFormProps {
  /** The submit button lives in the order summary, outside the form, and points here by id */
  formId: string;
  onSubmit: (data: CustomerFormData) => void;
  /** Wording of the kitchen-notes field */
  legalCopy: Pick<LegalCopy, 'notesLabel' | 'notesPlaceholder'>;
  copy: FormCopy;
  slug: string;
  addressRequired: boolean;
  defaultCountry: string;
  /** The postcode chosen on the menu; non-null only for a delivery order. */
  deliveryPostcode: string | null;
  /** Extra controls shown at the end of the card (the loyalty opt-in) */
  children?: React.ReactNode;
}

export const inputClass =
  'h-12 w-full rounded-xl border-[1.5px] border-[#e3d9ce] bg-white px-3.5 text-base text-gray-900 placeholder:text-[#9a8f86] focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1 sm:text-[15px]';
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#4a413b]';
const hintClass = 'font-normal text-[#6b6058]';

/** "Postcode 10115 – change it on the menu": the part after the dash links back to the menu. */
const PostcodeFixedNote: React.FC<{ text: string; slug: string }> = ({ text, slug }) => {
  const at = text.indexOf(' – ');
  if (at < 0) return <Link to={`/shops/${slug}`} className="underline">{text}</Link>;
  return (
    <>
      {text.slice(0, at + 3)}
      <Link to={`/shops/${slug}`} className="underline">
        {text.slice(at + 3)}
      </Link>
    </>
  );
};

/**
 * CustomerDetailsForm — the "Your details" card: name, email and phone, the delivery address
 * (delivery orders only), the billing address (folded away while optional, always open when
 * the order needs one) and the kitchen notes. It has no submit button of its own: the
 * "Continue to payment" button in the order summary submits it via `form={formId}`.
 */
const CustomerDetailsForm: React.FC<CustomerDetailsFormProps> = ({
  formId,
  onSubmit,
  legalCopy,
  copy,
  slug,
  addressRequired,
  defaultCountry,
  deliveryPostcode,
  children,
}) => {
  const uid = useId();
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
  const [billingOpen, setBillingOpen] = useState(false);
  const showBilling = addressRequired || billingOpen;
  // Until the diner edits the country, it follows the default, which can change once the shop's
  // language has loaded (Germany → Deutschland). Captured once, a stale default looked like typed input.
  const [countryEdited, setCountryEdited] = useState(false);
  const country = countryEdited ? address.country : defaultCountry;
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
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
      setBillingOpen(true);
      setAddressError(copy.addressIncomplete);
      return;
    }
    setAddressError(null);
    onSubmit({
      name,
      email,
      phone,
      notes,
      customerAddress: parsed ?? undefined,
      deliveryAddress: deliveryPostcode
        ? { street: deliveryStreet.trim(), postcode: deliveryPostcode, city: deliveryCity.trim() }
        : undefined,
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-[19px] font-bold text-gray-900">{copy.detailsTitle}</h2>

      <div>
        <label htmlFor={`${uid}-name`} className={labelClass}>
          {copy.nameLabel}
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          required
          autoComplete="name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.namePlaceholder}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <div>
          <label htmlFor={`${uid}-email`} className={labelClass}>
            {copy.emailLabel} <span className={hintClass}>– {copy.emailHint}</span>
          </label>
          <input
            id={`${uid}-email`}
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={labelClass}>
            {copy.phoneLabel} <span className={hintClass}>– {copy.phoneHint}</span>
          </label>
          <input
            id={`${uid}-phone`}
            type="tel"
            required
            autoComplete="tel"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={copy.phonePlaceholder}
          />
        </div>
      </div>

      {deliveryPostcode !== null && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1.5 text-[15px] font-bold text-gray-900">{copy.deliveryAddressTitle}</legend>
          <input
            type="text"
            required
            maxLength={200}
            autoComplete="address-line1"
            aria-label={copy.deliveryStreet}
            placeholder={copy.deliveryStreet}
            className={inputClass}
            value={deliveryStreet}
            onChange={(e) => setDeliveryStreet(e.target.value)}
          />
          <input
            type="text"
            required
            maxLength={200}
            autoComplete="address-level2"
            aria-label={copy.deliveryCity}
            placeholder={copy.deliveryCity}
            className={inputClass}
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)}
          />
          <p className="text-sm text-[#5c524b]">
            <PostcodeFixedNote text={copy.deliveryPostcodeFixed(deliveryPostcode)} slug={slug} />
          </p>
        </fieldset>
      )}

      {/* Billing address: folded away while optional */}
      {!addressRequired && (
        <button
          type="button"
          aria-expanded={billingOpen}
          aria-controls={`${uid}-billing`}
          onClick={() => setBillingOpen((v) => !v)}
          className="flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-gray-900"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform ${billingOpen ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          {copy.billingToggle}
        </button>
      )}
      {showBilling && (
        <fieldset id={`${uid}-billing`} className="flex flex-col gap-2.5">
          <legend className="mb-1.5 text-[13px] font-semibold text-[#4a413b]">
            {addressRequired ? copy.addressTitleRequired : copy.addressTitleOptional}
          </legend>
          <input
            type="text"
            required={addressRequired}
            autoComplete="billing street-address"
            aria-label={copy.addressStreet}
            placeholder={copy.addressStreet}
            className={inputClass}
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-2.5">
            <input
              type="text"
              required={addressRequired}
              autoComplete="billing postal-code"
              aria-label={copy.addressPostcode}
              placeholder={copy.addressPostcode}
              className={inputClass}
              value={address.postcode}
              onChange={(e) => setAddress({ ...address, postcode: e.target.value })}
            />
            <input
              type="text"
              required={addressRequired}
              autoComplete="billing address-level2"
              aria-label={copy.addressCity}
              placeholder={copy.addressCity}
              className={inputClass}
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
          </div>
          <input
            type="text"
            required={addressRequired}
            autoComplete="billing country-name"
            aria-label={copy.addressCountry}
            placeholder={copy.addressCountry}
            className={inputClass}
            value={country}
            onChange={(e) => {
              setCountryEdited(true);
              setAddress({ ...address, country: e.target.value });
            }}
          />
          {addressError && (
            <p role="alert" className="rounded-xl bg-[#fdecea] px-3.5 py-2.5 text-sm text-[#8a1f12]">
              {addressError}
            </p>
          )}
        </fieldset>
      )}

      <div>
        <label htmlFor={`${uid}-notes`} className={labelClass}>
          {legalCopy.notesLabel}
        </label>
        <textarea
          id={`${uid}-notes`}
          rows={3}
          className={`${inputClass} h-auto resize-y py-3`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={legalCopy.notesPlaceholder}
        />
      </div>

      {children}
    </form>
  );
};

export default CustomerDetailsForm;
