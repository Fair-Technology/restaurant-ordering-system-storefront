import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutPageSkeleton } from '../../shared/Skeletons';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadCart, selectCartItems, clearCart } from '../../store/slices/cartSlice';
import {
  useGetShopBySlugQuery,
  useGetCatalogQuery,
  useGetOrderByPaymentIntentQuery,
  useCreateOrderMutation,
  type CheckoutResponse,
} from '../../api/endpoints';
import type { Product } from '../../types/Product';
import { mapApiProductToProduct } from '../../utils/catalogMapper';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { initialMenuLanguage } from '../../utils/menuLanguage';
import CartSummary from './components/CartSummary';
import CustomerDetailsForm, { type CustomerFormData } from './components/CustomerDetailsForm';
import OrderSuccessView from './components/OrderSuccessView';
import PaymentStep from './components/PaymentStep';

// Load Stripe at module level (required for PCI compliance and performance)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? '');

const CheckoutPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();

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
  const products: Product[] = useMemo(
    () =>
      catalogData?.categories.flatMap(
        (cat) => (cat.products ?? []).map((p) => mapApiProductToProduct(p, cat, resolvedLanguage)),
      ) ?? [],
    [catalogData, resolvedLanguage],
  );

  // Load cart from localStorage using the shop slug as the scope key
  useEffect(() => {
    if (!slug) return;
    dispatch(loadCart({ shopId: slug }));
  }, [dispatch, slug]);

  // Checkout flow state
  type Step = 'info' | 'payment' | 'success';
  const [step, setStep] = useState<Step>('info');
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  // Controls order polling — true until the backend confirms the order
  const [polling, setPolling] = useState(false);

  const [initiateCheckout, { isLoading: isInitiating, error: initiateError }] =
    useCreateOrderMutation();

  // Poll every 2 s after payment succeeds to wait for Stripe webhook processing.
  // The backend creates/updates the order asynchronously after receiving the
  // Stripe webhook, so the first poll may return 404. pollingInterval keeps
  // retrying until isSuccess is true, then we stop polling and show the order.
  const { data: orderData, isSuccess: isOrderSuccess } =
    useGetOrderByPaymentIntentQuery(paymentIntentId ?? '', {
      skip: !paymentIntentId,
      pollingInterval: polling ? 2000 : 0,
    });

  // Stop polling and persist the order locally once confirmed
  useEffect(() => {
    if (isOrderSuccess && orderData) {
      setPolling(false);
    }
  }, [isOrderSuccess, orderData]);

  async function handleInfoSubmit(data: CustomerFormData) {
    if (cartItems.length === 0) return;
    const result = await initiateCheckout({
      shopId: resolvedShopId,
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        selectedVariantOptionId: item.variantId,
        selectedAddonOptionIds: item.addonOptionIds,
      })),
      customerName: data.name,
      customerEmail: data.email,
      customerPhone: data.phone,
      customerNotes: data.notes || undefined,
      fulfilmentMode: 'collection',
    });
    if ('data' in result && result.data) {
      setCheckoutData(result.data);
      setStep('payment');
    }
  }

  function handlePaymentSuccess(piId: string) {
    dispatch(clearCart());
    setPaymentIntentId(piId);
    setPolling(true);
    setStep('success');
  }

  // Format the checkout error for CustomerDetailsForm
  const checkoutError = initiateError
    ? 'data' in initiateError
      ? ((initiateError.data as any)?.error ?? 'Checkout failed')
      : 'Checkout failed'
    : undefined;

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

        {step === 'success' ? (
          <OrderSuccessView
            orderData={orderData}
            isOrderSuccess={isOrderSuccess}
            slug={slug ?? ''}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left — editable cart summary */}
            <CartSummary slug={slug ?? ''} products={products} />

            {/* Right — customer info form + payment */}
            <div className="lg:sticky lg:top-24 bg-white rounded-xl shadow-md p-6">
              {step === 'info' && (
                <CustomerDetailsForm
                  onSubmit={handleInfoSubmit}
                  isLoading={isInitiating}
                  isCartEmpty={cartItems.length === 0}
                  error={checkoutError}
                />
              )}

              {step === 'payment' && checkoutData && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Payment</h2>
                  <Elements
                    stripe={stripePromise}
                    options={{ clientSecret: checkoutData.clientSecret }}
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
                    Back to details
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer slug={slug} />
    </div>
  );
};

export default CheckoutPage;
