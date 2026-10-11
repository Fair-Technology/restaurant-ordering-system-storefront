import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShieldCheck } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import { formatCents } from '../../../utils/money';
import { currentChoice, pageLanguageOf } from '../../../utils/pageLanguage';
import { orderCopy } from '../../../utils/orderCopy';

interface PaymentStepProps {
  totalCents: number;
  country: string | null;
  currency: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  /** Shown above the pay button when the last attempt failed */
  error: string | null;
}

/**
 * PaymentStep — Stripe's Payment Element (card, plus Apple Pay / Google Pay where the device
 * offers them), the "reserved first, charged later" note, and the "Order with obligation to pay"
 * button with the total on it. On phones the button is pinned to the bottom of the screen.
 */
const PaymentStep: React.FC<PaymentStepProps> = ({
  totalCents,
  country,
  currency,
  onSuccess,
  onError,
  error,
}) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const language = pageLanguageOf(currentChoice(storedLanguage, navigator.language));
  const total = formatCents(totalCents, currency, language);
  const copy = orderCopy(language);
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [elementReady, setElementReady] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setPaying(true);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setPaying(false);
    if (result.error) {
      onError(result.error.message ?? copy.paymentFailed);
    } else if (
      result.paymentIntent &&
      // The card is only reserved at checkout, so a successful reservation reads requires_capture.
      ['requires_capture', 'succeeded', 'processing'].includes(result.paymentIntent.status)
    ) {
      onSuccess(result.paymentIntent.id);
    }
  }

  const isReady = stripe && elements && elementReady;

  return (
    <div className="flex flex-col gap-5">
      {/* Skeleton shown until the Stripe iframe is ready */}
      {!elementReady && (
        <div className="space-y-3" aria-hidden="true">
          <div className="skeleton h-12 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
          <p className="text-center text-xs text-[#9a8f86]">{copy.loading}</p>
        </div>
      )}

      <PaymentElement
        onReady={() => setElementReady(true)}
        options={{
          // No Stripe Link: it would offer to open a Link account with the diner's email, phone and name
          wallets: { link: 'never' },
          ...(country ? { defaultValues: { billingDetails: { address: { country } } } } : {}),
        }}
      />

      <div className="flex items-start gap-3 rounded-2xl bg-[#e6f3ea] px-4 py-3.5 text-sm leading-relaxed text-[#1d4a2c]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          <strong>{copy.reserveTitle}</strong> {copy.reserveNote}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-[#fdecea] px-4 py-3.5 text-sm leading-relaxed text-[#8a1f12]">
          {error}
        </p>
      )}

      {/* Phones: pinned to the bottom of the screen; from lg: in place */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#efe7de] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(31,26,23,0.06)] lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <button
          type="button"
          className="flex h-14 w-full items-center justify-between gap-3 rounded-full bg-[var(--brand-accent)] px-6 text-base font-bold text-[var(--brand-on-accent)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handlePay}
          disabled={!isReady || paying}
        >
          {paying ? (
            <span className="flex w-full items-center justify-center gap-2.5">
              <span
                className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-white/40 border-t-white"
                aria-hidden="true"
              />
              {copy.paying}
            </span>
          ) : (
            <>
              <span className="truncate">{!isReady ? copy.loading : copy.placeOrderCard}</span>
              <span className="shrink-0" data-testid="payment-total">
                {total}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PaymentStep;
