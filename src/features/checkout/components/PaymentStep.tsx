import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAppSelector } from '../../../store/hooks';
import { formatCents } from '../../../utils/money';
import { initialMenuLanguage } from '../../../utils/menuLanguage';
import { orderCopy } from '../../../utils/orderCopy';

interface PaymentStepProps {
  totalCents: number;
  country: string | null;
  currency: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

const PaymentStep: React.FC<PaymentStepProps> = ({
  totalCents,
  country,
  currency,
  onSuccess,
  onError,
}) => {
  const resolvedLanguage = useAppSelector((state) => state.shop.resolvedMenuLanguage);
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const language = resolvedLanguage ?? storedLanguage ?? initialMenuLanguage(navigator.language);
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
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        {copy.total}:{' '}
        <span className="font-semibold text-gray-800" data-testid="payment-total">
          {total}
        </span>
      </div>

      {/* Skeleton shown until the Stripe iframe is ready */}
      {!elementReady && (
        <div className="space-y-3">
          <div className="skeleton h-11 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-11 rounded-xl" />
            <div className="skeleton h-11 rounded-xl" />
          </div>
          <p className="text-xs text-center text-gray-400">{copy.loading}</p>
        </div>
      )}

      <PaymentElement
        onReady={() => setElementReady(true)}
        options={country ? { defaultValues: { billingDetails: { address: { country } } } } : undefined}
      />

      <button
        className="w-full bg-[var(--brand-accent)] hover:opacity-90 text-[var(--brand-on-accent)] px-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handlePay}
        disabled={!isReady || paying}
      >
        {paying ? copy.paying : !isReady ? copy.loading : copy.placeOrderCard}
      </button>
    </div>
  );
};

export default PaymentStep;
