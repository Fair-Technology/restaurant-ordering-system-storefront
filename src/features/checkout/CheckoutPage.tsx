import React, { useEffect, useMemo, useState } from 'react';
import { toComboChoiceDtos } from '../../utils/combo';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutPageSkeleton } from '../../shared/Skeletons';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveShop, setResolvedMenuLanguage } from '../../store/slices/shopSlice';
import { loadCart, selectCartItems, clearCart, removeItem, setItemPrice } from '../../store/slices/cartSlice';
import { useGetShopBySlugQuery, useGetCatalogQuery } from '../../api/endpoints';
import {
  ADDRESS_REQUIRED_ERROR,
  BASKET_CHANGED_ERROR,
  DELIVERY_FEE_CHANGED_ERROR,
  DISCOUNT_ALREADY_USED_ERROR,
  DISCOUNT_CHANGED_ERROR,
  DELIVERY_POSTCODE_NOT_SERVED_ERROR,
  LEGAL_CHANGED_ERROR,
  MODE_NOT_OFFERED_ERROR,
  ORDER_LIMIT_REACHED_ERROR,
  SLOT_UNAVAILABLE_ERROR,
  TABLE_INVALID_ERROR,
  usePlaceOrderMutation,
  useQuoteBasketQuery,
  type CardCheckoutResult,
  type ShopFulfilment,
} from '../../api/orderEndpoints';
import type { Product } from '../../types/Product';
import { mapApiProductToProduct } from '../../utils/catalogMapper';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { useMoney } from '../../hooks/useMoney';
import { orderCopy } from '../../utils/orderCopy';
import { discountProblemText, normaliseCodeInput } from '../../utils/discount';
import { effectiveWhen, slotDays, type WhenChoice } from '../../utils/slots';
import { useTableSession } from '../../hooks/useTableSession';
import { readTableSession } from '../../utils/tableSession';
import { useDeliverySession } from '../../hooks/useDeliverySession';
import { chosenMode } from '../../utils/delivery';
import { stripeForAccount } from '../../utils/stripe';
import QuoteNotice from './components/QuoteNotice';
import { useGetShopLegalQuery } from '../../api/legalEndpoints';
import { legalCopy } from '../../utils/legalCopy';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import CartSummary, { itemDetail } from './components/CartSummary';
import CustomerDetailsForm, { inputClass, type CustomerFormData } from './components/CustomerDetailsForm';
import PaymentStep from './components/PaymentStep';

/** The diner's order page; the access token in the link is what lets them see it. */
function orderPath(slug: string | undefined, orderId: string, accessToken: string): string {
  return `/shops/${slug}/orders/${orderId}?t=${accessToken}`;
}

const CheckoutPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const money = useMoney();

  const cartItems = useAppSelector(selectCartItems);

  const { data: shopData, isLoading: isShopLoading } = useGetShopBySlugQuery(slug ?? '', {
    skip: !slug,
  });
  const resolvedShopData = shopData as ShopWithBranding | undefined;
  const resolvedShopId = shopData?.id ?? '';
  const resolvedBranding = resolveShopBranding(resolvedShopData?.branding);
  const shopName = resolvedShopData?.name ?? 'Online Ordering';

  // Apply CSS custom properties and get page wrapper style
  const brandStyle = useBrandingStyle(resolvedBranding);

  // Same lang the shop view resolved, so RTK Query shares the cached catalog response
  const storedMenuLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = currentChoice(storedMenuLanguage, navigator.language);

  // Fetch the product catalog so CartSummary can show variant/addon names and open the edit modal
  const { data: catalogData } = useGetCatalogQuery(
    { shopId: resolvedShopId, lang },
    { skip: !resolvedShopId },
  );
  const resolvedLanguage = catalogData?.language ?? lang; // menu language
  const pageLanguage = pageLanguageOf(lang); // language of the page text and of the order

  // Remember the language the menu actually came back in, for price formatting
  useEffect(() => {
    if (catalogData?.language) dispatch(setResolvedMenuLanguage(catalogData.language));
  }, [dispatch, catalogData?.language]);
  const { data: legalData, refetch: refetchLegal } = useGetShopLegalQuery(
    { slug: slug ?? '', lang },
    { skip: !slug },
  );
  const products: Product[] = useMemo(
    () =>
      catalogData?.categories.flatMap(
        (cat) => (cat.products ?? []).map((p) => mapApiProductToProduct(p, cat, resolvedLanguage)),
      ) ?? [],
    [catalogData, resolvedLanguage],
  );

  // Persist the shop's currency so money components format in it
  useEffect(() => {
    if (shopData?.id) {
      dispatch(setActiveShop({ shopId: shopData.id, currency: shopData.currency }));
    }
  }, [dispatch, shopData?.id, shopData?.currency]);

  // Load cart from localStorage using the shop slug as the scope key
  useEffect(() => {
    if (!slug) return;
    dispatch(loadCart({ shopId: slug }));
  }, [dispatch, slug]);

  // Checkout flow state
  type Step = 'info' | 'payment';
  const [step, setStep] = useState<Step>('info');
  const [checkoutData, setCheckoutData] = useState<CardCheckoutResult | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [placeOrder, { isLoading: isInitiating }] = usePlaceOrderMutation();
  const [placeError, setPlaceError] = useState<string | undefined>(undefined);

  // Ask the server to re-price the basket; it flags changed prices, sold-out
  // dishes, closing time and which payment method this restaurant offers.
  const fulfilment = (resolvedShopData as { fulfilment?: ShopFulfilment } | undefined)?.fulfilment;
  const dineInOn = (fulfilment?.modes ?? []).includes('dine_in');
  const { table, unbind } = useTableSession(slug, dineInOn);
  const [tableNotice, setTableNotice] = useState<string | null>(null);
  const { postcode: deliveryPostcode, clear: clearDelivery } = useDeliverySession(slug);
  const mode = chosenMode({ table, deliveryPostcode, modes: fulfilment?.modes ?? ['collection'] });
  const copy = orderCopy(pageLanguage);
  const [whenChoice, setWhenChoice] = useState<WhenChoice | null>(null);
  const [slotChoice, setSlotChoice] = useState<string | null>(null);
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null); // what the quote is asked about
  const [loyaltyTick, setLoyaltyTick] = useState(false);
  const quoteArg = {
    shopId: resolvedShopId,
    fulfilmentMode: mode,
    language: pageLanguage,
    ...(mode === 'delivery' && deliveryPostcode ? { postcode: deliveryPostcode } : {}),
    ...(whenChoice === 'later' && slotChoice ? { scheduledFor: slotChoice } : {}),
    ...(appliedCode ? { discountCode: appliedCode } : {}),
    items: cartItems.map((i) => ({
      productId: i.id,
      quantity: i.quantity,
      selectedVariantOptionId: i.variantId,
      selectedAddonOptionIds: i.addonOptionIds,
      expectedUnitPriceCents: Math.round(i.price * 100),
      ...(i.comboChoices ? { comboChoices: toComboChoiceDtos(i.comboChoices) } : {}),
    })),
  };
  const {
    data: quote,
    isFetching: quoting,
    isError: quoteFailed,
    refetch: requote,
  } = useQuoteBasketQuery(quoteArg, { skip: !resolvedShopId || cartItems.length === 0 });
  // One key per attempt: a double click re-sends the same key and yields one order
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const method = quote?.paymentMethods[0] ?? null;
  const allOk = !!quote && quote.lines.every((l) => l.status === 'ok');
  const discount = appliedCode && quote?.discount ? quote.discount : null;
  const codeProblem = appliedCode && quote && !quote.discount ? quote.discountProblem ?? 'unknown' : null;
  const showCodeBox = quote?.acceptsCodes === true || appliedCode !== null;
  const loyalty = quote?.loyalty ?? null;
  function applyCode() {
    const c = normaliseCodeInput(codeInput);
    setIdempotencyKey(crypto.randomUUID());
    setAppliedCode(c ?? (codeInput.trim() === '' ? null : codeInput.trim().toUpperCase()));
  }
  function removeCode() {
    setIdempotencyKey(crypto.randomUUID());
    setAppliedCode(null);
    setCodeInput('');
  }
  const timeZone = (shopData as { timezone?: string } | undefined)?.timezone ?? 'Europe/Berlin';
  const quoteSlots = useMemo(() => quote?.slots ?? [], [quote?.slots]);
  const hasSlots = mode !== 'dine_in' && quoteSlots.length > 0;
  const when = effectiveWhen(whenChoice, quote?.openNow ?? true, hasSlots);
  const chosenSlot = when === 'later' && slotChoice && quoteSlots.includes(slotChoice) ? slotChoice : null;
  const days = useMemo(
    () => slotDays(quoteSlots, timeZone, pageLanguage),
    [quoteSlots, timeZone, pageLanguage],
  );
  const currentDay =
    days.find((d) => d.key === dayChoice) ?? days.find((d) => d.times.some((t) => t.iso === chosenSlot)) ?? days[0];
  const canSubmit =
    !!quote && allOk &&
    (when === 'asap' ? quote.openNow : chosenSlot !== null && quote.slotAvailable === true) &&
    !quote.belowMinimum && method !== null && !quoting &&
    !quote.orderLimitReached && (mode !== 'delivery' || quote.postcodeServed === true) &&
    codeProblem === null && !(appliedCode && quoting);

  function applyQuoteChanges() {
    if (!quote) return;
    quote.lines.forEach((l) => {
      const item = cartItems[l.index];
      if (!item) return;
      if (l.status === 'unavailable' || l.status === 'invalid_options') {
        dispatch(removeItem({ key: item.key }));
      } else if (l.status === 'price_changed' && l.unitPriceCents !== null) {
        dispatch(setItemPrice({ key: item.key, price: l.unitPriceCents / 100 }));
      }
    });
    setPlaceError(undefined);
  }

  async function handleInfoSubmit(data: CustomerFormData) {
    if (cartItems.length === 0 || method === null) return;
    if (mode === 'dine_in' && !(slug && readTableSession(slug, Date.now()))) {
      unbind();
      setTableNotice(copy.tableExpired);
      return;
    }
    setTableNotice(null);
    setPlaceError(undefined);
    const res = await placeOrder({
      ...quoteArg,
      ...(table ? { table } : {}),
      customerName: data.name,
      customerEmail: data.email,
      customerPhone: data.phone,
      customerNotes: data.notes || undefined,
      paymentMethod: method,
      customerAddress: data.customerAddress,
      ...(mode === 'delivery' && data.deliveryAddress
        ? { deliveryAddress: data.deliveryAddress, expectedDeliveryFeeCents: quote?.deliveryFeeCents ?? 0 }
        : {}),
      ...(when === 'later' && chosenSlot ? { scheduledFor: chosenSlot } : {}),
      ...(discount ? { discountCode: discount.code, expectedDiscountCents: discount.cents } : {}),
      ...(loyalty && loyaltyTick ? { loyaltyOptIn: true } : {}),
      idempotencyKey,
      legalRevisions:
        legalData?.terms && legalData?.withdrawal
          ? { terms: legalData.terms.revision, withdrawal: legalData.withdrawal.revision }
          : undefined,
    });
    if ('data' in res && res.data) {
      if (res.data.kind === 'placed') {
        dispatch(clearCart());
        navigate(orderPath(slug, res.data.orderId, res.data.accessToken), { replace: true });
      } else {
        setCheckoutData(res.data);
        setStep('payment');
      }
      return;
    }
    const msg = (res.error as { data?: { error?: string } } | undefined)?.data?.error;
    if (msg === DELIVERY_POSTCODE_NOT_SERVED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      clearDelivery();
      setPlaceError(copy.deliveryNotServedNow);
    } else if (msg === DELIVERY_FEE_CHANGED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      requote();
      setPlaceError(copy.deliveryFeeChanged);
    } else if (msg === SLOT_UNAVAILABLE_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      setSlotChoice(null);
      requote();
      setPlaceError(copy.slotGone);
    } else if (msg === DISCOUNT_ALREADY_USED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      setAppliedCode(null);
      setCodeInput('');
      setPlaceError(copy.codeAlreadyUsed);
    } else if (msg === DISCOUNT_CHANGED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      requote();
      setPlaceError(copy.discountChanged);
    } else if (msg === BASKET_CHANGED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      requote();
      setPlaceError(copy.basketChangedTitle);
    } else if (msg === LEGAL_CHANGED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      refetchLegal();
      setPlaceError(copy.termsChanged);
    } else if (msg === ADDRESS_REQUIRED_ERROR) {
      setPlaceError(copy.addressNeeded);
    } else if (msg === MODE_NOT_OFFERED_ERROR || msg === TABLE_INVALID_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      if (mode === 'delivery') {
        clearDelivery();
        setTableNotice(copy.deliveryOff);
      } else {
        unbind();
        setTableNotice(msg === MODE_NOT_OFFERED_ERROR ? copy.dineInOff : copy.tableInvalid);
      }
    } else if (msg === ORDER_LIMIT_REACHED_ERROR) {
      requote();
      setPlaceError(copy.orderingPaused);
    } else {
      setPlaceError(msg ?? copy.orderFailed);
    }
  }

  // The order page waits for the backend to confirm the reservation, so go there at once.
  function handlePaymentSuccess() {
    if (!checkoutData) return;
    dispatch(clearCart());
    navigate(orderPath(slug, checkoutData.orderId, checkoutData.accessToken), { replace: true });
  }

  const stripePromise = useMemo(
    () => (checkoutData ? stripeForAccount(checkoutData.stripeConnectAccountId) : null),
    [checkoutData],
  );

  // Stripe's card form is drawn inside its own frame; this theme makes it match the page
  const stripeAppearance = useMemo(
    () => ({
      theme: 'stripe' as const,
      variables: {
        colorPrimary: resolvedBranding.accentColor,
        colorText: '#1f1a17',
        colorTextSecondary: '#5c524b',
        colorDanger: '#8a1f12',
        borderRadius: '12px',
        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
        fontSizeBase: '15px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': { border: '1.5px solid #e3d9ce', boxShadow: 'none', padding: '12px 14px' },
        '.Input:focus': { borderColor: '#1f1a17', boxShadow: '0 0 0 3px rgba(31, 26, 23, 0.08)' },
        '.Label': { fontWeight: '600', color: '#4a413b', fontSize: '13px' },
        '.Tab': { border: '1.5px solid #e3d9ce', boxShadow: 'none' },
        '.Tab--selected': { borderColor: '#1f1a17', boxShadow: 'none' },
      },
    }),
    [resolvedBranding.accentColor],
  );
  const [recapOpen, setRecapOpen] = useState(false);
  // Each step starts at the top of the page (on a phone the button sits far below the title)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (isShopLoading) return <CheckoutPageSkeleton />;

  const legalWords = legalCopy(pageLanguage);
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const card = 'rounded-[20px] border border-[#efe7de] bg-white p-5 sm:p-6';
  const errorBox = 'rounded-2xl bg-[#fdecea] px-4 py-3 text-sm leading-relaxed text-[#8a1f12]';
  const warnBox = 'rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900';
  const totalCents = quote ? quote.totalCents ?? quote.subtotalCents : null;
  const submitError = placeError ?? (quoteFailed ? copy.orderFailed : undefined);
  const backClass =
    'inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-[#5c524b] hover:text-gray-900';

  return (
    <div className="flex min-h-screen flex-col bg-[#faf6f1] pb-24 lg:pb-0" style={brandStyle}>
      <div className="sticky top-0 z-50">
        <NavBar shopName={shopName} shopId={slug ?? ''} logoUrl={resolvedBranding.logoUrl} />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-5 sm:px-6 lg:pb-16 lg:pt-7">
        {/* Back link, title, steps */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 lg:mb-6">
          <div className="flex flex-col gap-1">
            {step === 'info' ? (
              <Link to={`/shops/${slug}`} className={backClass}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {copy.backToMenu}
              </Link>
            ) : (
              <button type="button" onClick={() => setStep('info')} className={backClass}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {copy.backToDetails}
              </button>
            )}
            <h1 className="font-display text-[32px] font-semibold leading-tight text-gray-900 sm:text-[40px]">
              {step === 'info' ? copy.checkoutTitle : copy.paymentTitle}
            </h1>
          </div>
          <ol aria-label={copy.stepsLabel} className="flex items-center gap-2.5 text-[13px] font-semibold sm:text-sm">
            <li className={`flex items-center gap-2 ${step === 'payment' ? 'text-[#4a413b]' : 'text-gray-900'}`} aria-current={step === 'info' ? 'step' : undefined}>
              {step === 'payment' ? (
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#e6f3ea] text-[#1d5a32]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
              ) : (
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gray-900 text-[13px] text-white">1</span>
              )}
              {copy.stepDetails}
            </li>
            <li aria-hidden="true" className={`h-0.5 w-7 ${step === 'payment' ? 'bg-gray-900' : 'bg-[#e3d9ce]'}`} />
            <li className={`flex items-center gap-2 ${step === 'payment' ? 'text-gray-900' : 'text-[#6b6058]'}`} aria-current={step === 'payment' ? 'step' : undefined}>
              <span
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13px] ${
                  step === 'payment' ? 'bg-gray-900 text-white' : 'border-[1.5px] border-[#cfc4b8]'
                }`}
              >
                2
              </span>
              {copy.stepPayment}
            </li>
          </ol>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
          {/* ── Left column ── */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* Step 1. Stays mounted (only hidden) on the payment step, so "back to details" keeps what was typed */}
            <div hidden={step !== 'info'}>
              <div className="flex flex-col gap-5">
                {(tableNotice || table || (quote && (!allOk || quote.paymentMethods.length === 0 || quote.orderLimitReached || !quote.openNow))) && (
                  <div className="flex flex-col gap-3">
                    {tableNotice && <p className={warnBox}>{tableNotice}</p>}
                    {table && (
                      <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 ring-1 ring-[#efe7de]">
                        {copy.orderingForTable(table)}
                      </p>
                    )}
                    {quote && !allOk && (
                      <QuoteNotice
                        lines={quote.lines}
                        cartItems={cartItems}
                        copy={copy}
                        formatCents={money.cents}
                        onUpdate={applyQuoteChanges}
                      />
                    )}
                    {quote && quote.paymentMethods.length === 0 && <p className={errorBox}>{copy.noOnlinePayment}</p>}
                    {quote?.orderLimitReached && <p className={errorBox}>{copy.orderingPaused}</p>}
                    {quote && !quote.openNow && !hasSlots && <p className={errorBox}>{copy.closedNow}</p>}
                    {quote && !quote.openNow && hasSlots && <p className={warnBox}>{copy.closedOrderLater}</p>}
                  </div>
                )}

                <CartSummary slug={slug ?? ''} products={products} copy={copy} />

                {quote && hasSlots && (
                  <section className={card}>
                    <fieldset className="flex flex-col gap-3" data-testid="when">
                      <legend className="mb-3 text-[19px] font-bold text-gray-900">{copy.whenTitle}</legend>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {(
                          [
                            { value: 'asap' as const, title: copy.whenAsap(quote.prepMinutes), disabled: !quote.openNow },
                            { value: 'later' as const, title: copy.whenLater, disabled: false },
                          ]
                        ).map((o) => {
                          const on = when === o.value;
                          return (
                            <label
                              key={o.value}
                              className={`relative flex min-h-[60px] items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-accent)] ${
                                o.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              } ${on ? 'border-[var(--brand-accent)]' : 'border-[#e3d9ce] bg-white hover:border-gray-400'}`}
                              style={on ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent) 8%, white)' } : undefined}
                            >
                              <input
                                type="radio"
                                name="when"
                                className="absolute inset-0 m-0 h-full w-full cursor-[inherit] opacity-0"
                                checked={on}
                                disabled={o.disabled}
                                onChange={() => setWhenChoice(o.value)}
                              />
                              <span
                                aria-hidden="true"
                                className={`h-5 w-5 shrink-0 rounded-full ${on ? 'border-[6px] border-[var(--brand-accent)]' : 'border-[1.5px] border-[#b9ada2]'}`}
                              />
                              <span className="text-[15px] font-bold text-gray-900">{o.title}</span>
                            </label>
                          );
                        })}
                      </div>
                      {when === 'later' && (
                        <div className="grid grid-cols-2 gap-2.5 sm:max-w-md">
                          <select
                            aria-label={copy.slotDay}
                            className={inputClass}
                            value={currentDay?.key ?? ''}
                            onChange={(e) => {
                              setWhenChoice('later');
                              setDayChoice(e.target.value);
                              setSlotChoice(null);
                            }}
                          >
                            {days.map((d) => (
                              <option key={d.key} value={d.key}>{d.label}</option>
                            ))}
                          </select>
                          <select
                            aria-label={copy.slotTime}
                            className={inputClass}
                            value={chosenSlot ?? ''}
                            onChange={(e) => {
                              setWhenChoice('later');
                              setSlotChoice(e.target.value || null);
                            }}
                          >
                            <option value="">{copy.slotPick}</option>
                            {(currentDay?.times ?? []).map((t) => (
                              <option key={t.iso} value={t.iso}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {when === 'later' && chosenSlot && quote.slotAvailable === false && !quoting && (
                        <p className={errorBox}>{copy.slotGone}</p>
                      )}
                    </fieldset>
                  </section>
                )}

                <section className={card}>
                  <CustomerDetailsForm
                    formId="checkout-details"
                    onSubmit={handleInfoSubmit}
                    legalCopy={legalWords}
                    copy={copy}
                    slug={slug ?? ''}
                    addressRequired={quote?.addressRequired ?? false}
                    defaultCountry={pageLanguage === 'de' ? 'Deutschland' : 'Germany'}
                    deliveryPostcode={mode === 'delivery' ? deliveryPostcode : null}
                  >
                    {quote && loyalty && (
                      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#3a322d]">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-accent)]"
                          checked={loyaltyTick}
                          onChange={(e) => setLoyaltyTick(e.target.checked)}
                        />
                        <span>{copy.loyaltyOptIn(money.cents(loyalty.rewardCents), loyalty.everyOrders, shopName)}</span>
                      </label>
                    )}
                  </CustomerDetailsForm>
                </section>
              </div>
            </div>

            {/* Step 2: payment */}
            {step === 'payment' && checkoutData && stripePromise && (
              <section className={card}>
                <h2 className="mb-4 text-[19px] font-bold text-gray-900">{copy.paymentHeading}</h2>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: checkoutData.clientSecret,
                    locale: pageLanguage === 'de' ? 'de' : 'en',
                    appearance: stripeAppearance,
                  }}
                >
                  <PaymentStep
                    totalCents={checkoutData.totalCents ?? checkoutData.subtotalCents}
                    country={(shopData as { countryCode?: string } | undefined)?.countryCode ?? null}
                    currency={checkoutData.currency}
                    onSuccess={handlePaymentSuccess}
                    onError={(msg) => setPaymentError(msg)}
                    error={paymentError}
                  />
                </Elements>
              </section>
            )}
          </div>

          {/* ── Right column: summary (step 1) / recap (step 2) ── */}
          <aside className={`flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 ${step === 'payment' ? 'order-first lg:order-none' : ''}`}>
            <div hidden={step !== 'info'}>
              <div className="flex flex-col gap-4">
                <section className={`${card} flex flex-col gap-3 shadow-[0_8px_28px_rgba(31,26,23,0.06)]`}>
                  <h2 className="text-[19px] font-bold text-gray-900">{copy.summaryTitle}</h2>

                  {quote && (
                    <dl
                      className="flex flex-col gap-2 text-[15px] text-[#3a322d]"
                      data-testid={mode === 'delivery' ? 'delivery-totals' : 'order-totals'}
                    >
                      <div className="flex justify-between gap-3">
                        <dt>{copy.itemsLine}</dt>
                        <dd>{money.cents(quote.subtotalCents)}</dd>
                      </div>
                      {discount && (
                        <div className="flex justify-between gap-3 text-[#1d5a32]">
                          <dt>{copy.discountLine(discount.code)}</dt>
                          <dd>{money.cents(-discount.cents)}</dd>
                        </div>
                      )}
                      {mode === 'delivery' && quote.postcodeServed && (
                        <div className="flex justify-between gap-3">
                          <dt>{copy.deliveryFeeLine}</dt>
                          <dd>{money.cents(quote.deliveryFeeCents ?? 0)}</dd>
                        </div>
                      )}
                      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-[#f1ebe4] pt-3 text-gray-900">
                        <dt className="text-[17px] font-bold">
                          {copy.total} <span className="text-xs font-normal text-[#6b6058]">{copy.inclVat}</span>
                        </dt>
                        <dd className="text-2xl font-bold">{money.cents(quote.totalCents ?? quote.subtotalCents)}</dd>
                      </div>
                    </dl>
                  )}

                  {quote && showCodeBox && (
                    <div className="flex flex-col gap-2" data-testid="discount">
                      {!codeOpen && !appliedCode ? (
                        <button
                          type="button"
                          className="self-start py-1 text-sm font-bold text-gray-900 underline underline-offset-4"
                          onClick={() => setCodeOpen(true)}
                        >
                          {copy.haveCode}
                        </button>
                      ) : (
                        <div className="flex items-end gap-2">
                          <label className="flex-1">
                            <span className="mb-1.5 block text-[13px] font-semibold text-[#4a413b]">{copy.codeLabel}</span>
                            <input
                              className={`${inputClass} h-11 uppercase`}
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value)}
                              disabled={appliedCode !== null}
                              aria-label={copy.codeLabel}
                            />
                          </label>
                          {appliedCode === null ? (
                            <button
                              type="button"
                              className="h-11 rounded-xl border-[1.5px] border-gray-900 bg-white px-4 text-sm font-bold text-gray-900 disabled:opacity-40"
                              onClick={applyCode}
                              disabled={codeInput.trim() === ''}
                            >
                              {copy.codeApply}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="h-11 rounded-xl border-[1.5px] border-[#e3d9ce] bg-white px-4 text-sm font-bold text-gray-900"
                              onClick={removeCode}
                            >
                              {copy.codeRemove}
                            </button>
                          )}
                        </div>
                      )}
                      {codeProblem && !quoting && (
                        <p className={errorBox}>
                          {discountProblemText(codeProblem, copy, money.cents(quote.discountMinSubtotalCents ?? 0))}
                        </p>
                      )}
                    </div>
                  )}

                  {quote && mode === 'delivery' && quote.postcodeServed === false && (
                    <p className={errorBox}>{copy.deliveryNotServedNow}</p>
                  )}
                  {quote && quote.belowMinimum && (
                    <p className={errorBox}>{copy.belowMinimum(money.cents(quote.minOrderAmountCents))}</p>
                  )}
                  {submitError && <p role="alert" className={errorBox}>{submitError}</p>}

                  {/* Phones: pinned to the bottom of the screen; from lg: in place */}
                  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#efe7de] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(31,26,23,0.06)] lg:static lg:z-auto lg:mt-1 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                    <button
                      type="submit"
                      form="checkout-details"
                      className="flex h-14 w-full items-center justify-between gap-3 rounded-full bg-[var(--brand-accent)] px-6 text-base font-bold text-[var(--brand-on-accent)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={cartItems.length === 0 || isInitiating || !canSubmit}
                    >
                      <span className="truncate">
                        {isInitiating || method === null ? copy.loading : copy.continueToPayment}
                      </span>
                      {totalCents !== null && <span className="shrink-0">{money.cents(totalCents)}</span>}
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl bg-[#f6f1eb] px-3 py-2.5 text-[13px] leading-relaxed text-[#4a413b]">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{copy.payOnlineInfo}</span>
                  </div>
                </section>

                {legalData && (
                  <div className="flex flex-col gap-2 px-1.5 text-xs leading-relaxed text-[#6b6058]">
                    <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                      {legalData.seller.phone
                        ? legalWords.allergyLine(legalData.seller.legalName, legalData.seller.phone)
                        : legalWords.allergyLineNoPhone}
                    </p>
                    <p data-testid="seller-statement">
                      {legalWords.sellerStatement(legalData.seller.legalName, legalData.platform.name)}
                    </p>
                    <p>
                      {legalWords.acceptPrefix(legalData.seller.legalName)}
                      <Link to={`/shops/${slug}/legal/terms`} className="underline">
                        {legalWords.footerTerms}
                      </Link>
                      {legalWords.acceptMiddle(legalData.seller.legalName)}
                      <Link to={`/shops/${slug}/legal/withdrawal`} className="underline">
                        {legalWords.footerWithdrawal}
                      </Link>
                      {legalWords.acceptAnd}
                      <Link to={`/shops/${slug}/legal/privacy`} className="underline">
                        {legalWords.footerPrivacy}
                      </Link>
                      {legalWords.acceptEnd}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {step === 'payment' && checkoutData && (
              <section className={`${card} !p-0`}>
                {/* Phones: one tappable line that opens the recap; from lg: always open */}
                <button
                  type="button"
                  aria-expanded={recapOpen}
                  onClick={() => setRecapOpen((v) => !v)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left lg:hidden"
                >
                  <span className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
                    <ChevronRight className={`h-4 w-4 transition-transform ${recapOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                    {copy.showOrder(copy.cartItems(itemCount))}
                  </span>
                  <span className="text-base font-bold text-gray-900">
                    {money.cents(checkoutData.totalCents ?? checkoutData.subtotalCents)}
                  </span>
                </button>
                <div className={`${recapOpen ? 'flex' : 'hidden'} flex-col gap-3.5 border-t border-[#f1ebe4] px-5 pb-5 pt-4 lg:flex lg:border-0 lg:p-6`}>
                  <div className="hidden items-baseline justify-between lg:flex">
                    <h2 className="text-[19px] font-bold text-gray-900">{copy.checkoutTitle}</h2>
                    <button
                      type="button"
                      onClick={() => setStep('info')}
                      className="text-sm font-semibold text-gray-900 underline underline-offset-4"
                    >
                      {copy.recapChange}
                    </button>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {cartItems.map((item) => {
                      const detail = itemDetail(item, products);
                      return (
                        <li key={item.key} className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="hidden h-12 w-12 shrink-0 rounded-[10px] object-cover lg:block" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-bold text-gray-900">
                              {item.quantity}× {item.name}
                            </div>
                            {detail && <div className="text-[13px] text-[#5c524b]">{detail}</div>}
                          </div>
                          <span className="text-[15px] font-semibold text-gray-900">
                            {money.major(item.quantity * item.price)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-baseline justify-between border-t border-[#f1ebe4] pt-3">
                    <span className="text-[17px] font-bold text-gray-900">
                      {copy.total} <span className="text-xs font-normal text-[#6b6058]">{copy.inclVat}</span>
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {money.cents(checkoutData.totalCents ?? checkoutData.subtotalCents)}
                    </span>
                  </div>
                </div>
              </section>
            )}
            {step === 'payment' && (
              <p className="flex items-start gap-2 px-1.5 text-xs leading-relaxed text-[#6b6058]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {copy.secureNote}
              </p>
            )}
          </aside>
        </div>
      </main>

      <Footer slug={slug} />
    </div>
  );
};

export default CheckoutPage;
