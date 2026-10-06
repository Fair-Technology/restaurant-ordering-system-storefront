import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  LEGAL_CHANGED_ERROR,
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
import { stripeForAccount } from '../../utils/stripe';
import QuoteNotice from './components/QuoteNotice';
import { useGetShopLegalQuery } from '../../api/legalEndpoints';
import { legalCopy } from '../../utils/legalCopy';
import { initialMenuLanguage } from '../../utils/menuLanguage';
import CartSummary from './components/CartSummary';
import CustomerDetailsForm, { type CustomerFormData } from './components/CustomerDetailsForm';
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
  const lang = storedMenuLanguage ?? initialMenuLanguage(navigator.language);

  // Fetch the product catalog so CartSummary can show variant/addon names and open the edit modal
  const { data: catalogData } = useGetCatalogQuery(
    { shopId: resolvedShopId, lang },
    { skip: !resolvedShopId },
  );
  const resolvedLanguage = catalogData?.language ?? lang;

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
  const storedMode = useAppSelector((state) => state.shop.fulfilmentMode);
  const mode =
    storedMode && (fulfilment?.modes ?? ['collection']).includes(storedMode)
      ? storedMode
      : fulfilment?.modes[0] ?? 'collection';
  const copy = orderCopy(resolvedLanguage);
  const quoteArg = {
    shopId: resolvedShopId,
    fulfilmentMode: mode,
    language: resolvedLanguage,
    items: cartItems.map((i) => ({
      productId: i.id,
      quantity: i.quantity,
      selectedVariantOptionId: i.variantId,
      selectedAddonOptionIds: i.addonOptionIds,
      expectedUnitPriceCents: Math.round(i.price * 100),
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
  const canSubmit =
    !!quote && allOk && quote.openNow && !quote.belowMinimum && method !== null && !quoting;

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
    setPlaceError(undefined);
    const res = await placeOrder({
      ...quoteArg,
      customerName: data.name,
      customerEmail: data.email,
      customerPhone: data.phone,
      customerNotes: data.notes || undefined,
      paymentMethod: method,
      customerAddress: data.customerAddress,
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
    if (msg === BASKET_CHANGED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      requote();
      setPlaceError(copy.basketChangedTitle);
    } else if (msg === LEGAL_CHANGED_ERROR) {
      setIdempotencyKey(crypto.randomUUID());
      refetchLegal();
      setPlaceError(copy.termsChanged);
    } else if (msg === ADDRESS_REQUIRED_ERROR) {
      setPlaceError(copy.addressNeeded);
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

  if (isShopLoading) return <CheckoutPageSkeleton />;

  return (
    <div className="bg-gray-50/60 min-h-screen flex flex-col" style={brandStyle}>
      <div className="sticky top-0 z-50">
        <NavBar shopName={shopName} shopId={slug ?? ''} logoUrl={resolvedBranding.logoUrl} />
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <h1
          className="text-2xl font-bold mb-6"
          style={{ color: resolvedBranding.accentColor }}
        >
          Checkout
        </h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left — editable cart summary */}
            <CartSummary slug={slug ?? ''} products={products} />

            {/* Right — customer info form + payment */}
            <div className="lg:sticky lg:top-24 bg-white rounded-xl shadow-md p-6">
              {/* Stays mounted (only hidden) on the payment step, so "back to details" keeps what was typed */}
              <div hidden={step !== 'info'}>
                {quote && !allOk && (
                  <div className="mb-4">
                    <QuoteNotice
                      lines={quote.lines}
                      cartItems={cartItems}
                      copy={copy}
                      formatCents={money.cents}
                      onUpdate={applyQuoteChanges}
                    />
                  </div>
                )}
                {quote && quote.paymentMethods.length === 0 && (
                  <p className="mb-4 text-sm text-red-600">{copy.noOnlinePayment}</p>
                )}
                {quote && !quote.openNow && (
                  <p className="mb-4 text-sm text-red-600">{copy.closedNow}</p>
                )}
                {quote && quote.belowMinimum && (
                  <p className="mb-4 text-sm text-red-600">
                    {copy.belowMinimum(money.cents(quote.minOrderAmountCents))}
                  </p>
                )}
                <CustomerDetailsForm
                  onSubmit={handleInfoSubmit}
                  isLoading={isInitiating}
                  isCartEmpty={cartItems.length === 0}
                  error={placeError ?? (quoteFailed ? copy.orderFailed : undefined)}
                  submitLabel={
                    method === null ? copy.loading : copy.continueToPayment
                  }
                  submitDisabled={!canSubmit}
                  paymentNote={copy.payOnlineInfo}
                  addressRequired={quote?.addressRequired ?? false}
                  addressCopy={copy}
                  defaultCountry={resolvedLanguage === 'de' ? 'Deutschland' : 'Germany'}
                  legal={legalData}
                  copy={legalCopy(legalData?.language ?? resolvedLanguage)}
                  slug={slug ?? ''}
                />
              </div>

              {step === 'payment' && checkoutData && stripePromise && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">{copy.paymentTitle}</h2>
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret: checkoutData.clientSecret,
                      locale: resolvedLanguage === 'de' ? 'de' : 'en',
                    }}
                  >
                    <PaymentStep
                      subtotalCents={checkoutData.subtotalCents}
                      currency={checkoutData.currency}
                      onSuccess={handlePaymentSuccess}
                      onError={(msg) => setPaymentError(msg)}
                    />
                    {paymentError && (
                      <p className="text-red-600 text-sm mt-3">{paymentError}</p>
                    )}
                  </Elements>
                  <button
                    className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
                    onClick={() => setStep('info')}
                  >
                    {copy.backToDetails}
                  </button>
                </div>
              )}
            </div>
          </div>
      </div>

      <Footer slug={slug} />
    </div>
  );
};

export default CheckoutPage;
