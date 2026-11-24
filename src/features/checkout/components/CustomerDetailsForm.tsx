import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { LegalCopy } from '../../../utils/legalCopy';
import type { CustomerAddress, DeliveryAddress } from '../../../api/orderEndpoints';
import type { OrderCopy } from '../../../utils/orderCopy';
import { addressFromForm } from '../../../utils/address';
import { isBlank, isPlausiblePhone, isValidEmail } from '../../../utils/formValidation';
import { readCheckoutDetails, writeCheckoutDetails } from '../../../utils/checkoutDetails';

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
  | 'nameRequiredError'
  | 'emailRequiredError'
  | 'emailInvalidError'
  | 'phoneRequiredError'
  | 'phoneInvalidError'
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
  'h-12 w-full rounded-xl border-[1.5px] border-[#e3d9ce] bg-white px-3.5 text-[16px] text-gray-900 placeholder:text-[#9a8f86] focus:border-gray-900 focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1 sm:text-[15px]';
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#4a413b]';
const fieldErrorClass = 'mt-1.5 rounded-xl bg-[#fdecea] px-3.5 py-2.5 text-sm text-[#8a1f12]';
const hintClass = 'font-normal text-[#6b6058]';
const counterClass = 'mt-1 text-right text-xs text-[#9a8f86]';

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
  // What the diner typed earlier in this tab (a trip back to the menu re-mounts this form); read once.
  const [saved] = useState(() => readCheckoutDetails(slug, Date.now()));
  const [name, setName] = useState(saved?.name ?? '');
  const [email, setEmail] = useState(saved?.email ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [address, setAddress] = useState<CustomerAddress>(
    saved?.address ?? {
      street: '',
      postcode: '',
      city: '',
      country: '',
    },
  );
  const [billingOpen, setBillingOpen] = useState(saved?.billingOpen ?? false);
  const showBilling = addressRequired || billingOpen;
  // Until the diner edits the country, it follows the default, which can change once the shop's
  // language has loaded (Germany → Deutschland). Captured once, a stale default looked like typed input.
  const [countryEdited, setCountryEdited] = useState(saved?.countryEdited ?? false);
  const country = countryEdited ? address.country : defaultCountry;
  const [deliveryStreet, setDeliveryStreet] = useState(saved?.deliveryStreet ?? '');
  const [deliveryCity, setDeliveryCity] = useState(saved?.deliveryCity ?? '');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    writeCheckoutDetails({
      slug,
      name,
      email,
      phone,
      notes,
      address,
      countryEdited,
      billingOpen,
      deliveryStreet,
      deliveryCity,
      savedAt: Date.now(),
    });
  }, [slug, name, email, phone, notes, address, countryEdited, billingOpen, deliveryStreet, deliveryCity]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Our own checks come first (the form is noValidate), so the diner sees inline messages, not a browser bubble.
    const nextNameError = isBlank(name) ? copy.nameRequiredError : null;
    const nextEmailError = isBlank(email)
      ? copy.emailRequiredError
      : !isValidEmail(email)
        ? copy.emailInvalidError
        : null;
    const nextPhoneError = isBlank(phone)
      ? copy.phoneRequiredError
      : !isPlausiblePhone(phone)
        ? copy.phoneInvalidError
        : null;
    if (nextNameError || nextEmailError || nextPhoneError) {
      setNameError(nextNameError);
      setEmailError(nextEmailError);
      setPhoneError(nextPhoneError);
      const first = nextNameError ? nameRef.current : nextEmailError ? emailRef.current : phoneRef.current;
      first?.focus();
      first?.scrollIntoView({ block: 'center' });
      return;
    }
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    // noValidate switched off the browser's checks for the other required fields too; keep them.
    if (!e.currentTarget.reportValidity()) return;
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
    <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-[19px] font-bold text-gray-900">{copy.detailsTitle}</h2>

      <div>
        <label htmlFor={`${uid}-name`} className={labelClass}>
          {copy.nameLabel}
        </label>
        <input
          id={`${uid}-name`}
          ref={nameRef}
          type="text"
          required
          aria-required="true"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? `${uid}-name-error` : undefined}
          autoComplete="name"
          maxLength={200}
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          placeholder={copy.namePlaceholder}
        />
        {nameError && (
          <p id={`${uid}-name-error`} role="alert" className={fieldErrorClass}>
            {nameError}
          </p>
        )}
        <p className={counterClass}>{name.length}/200</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <div>
          <label htmlFor={`${uid}-email`} className={labelClass}>
            {copy.emailLabel} <span className={hintClass}>– {copy.emailHint}</span>
          </label>
          <input
            id={`${uid}-email`}
            ref={emailRef}
            type="email"
            required
            aria-required="true"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? `${uid}-email-error` : undefined}
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            placeholder={copy.emailPlaceholder}
          />
          {emailError && (
            <p id={`${uid}-email-error`} role="alert" className={fieldErrorClass}>
              {emailError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={labelClass}>
            {copy.phoneLabel} <span className={hintClass}>– {copy.phoneHint}</span>
          </label>
          <input
            id={`${uid}-phone`}
            ref={phoneRef}
            type="tel"
            required
            aria-required="true"
            aria-invalid={!!phoneError}
            aria-describedby={phoneError ? `${uid}-phone-error` : undefined}
            autoComplete="tel"
            className={inputClass}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(null);
            }}
            placeholder={copy.phonePlaceholder}
          />
          {phoneError && (
            <p id={`${uid}-phone-error`} role="alert" className={fieldErrorClass}>
              {phoneError}
            </p>
          )}
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
          maxLength={500}
          className={`${inputClass} h-auto resize-y py-3`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={legalCopy.notesPlaceholder}
        />
        <p className={counterClass}>{notes.length}/500</p>
      </div>

      {children}
    </form>
  );
};

export default CustomerDetailsForm;
