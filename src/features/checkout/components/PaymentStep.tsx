import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAppSelector } from '../../../store/hooks';
import { formatCents } from '../../../utils/money';
import { initialMenuLanguage } from '../../../utils/menuLanguage';

interface PaymentStepProps {
  subtotalCents: number;
  currency: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

const PaymentStep: React.FC<PaymentStepProps> = ({
  subtotalCents,
  currency,
  onSuccess,
  onError,
}) => {
  const language =
    useAppSelector((state) => state.shop.menuLanguage) ?? initialMenuLanguage(navigator.language);
  const total = formatCents(subtotalCents, currency, language);
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
      onError(result.error.message ?? 'Payment failed');
    } else if (result.paymentIntent?.status === 'succeeded') {
      onSuccess(result.paymentIntent.id);
    }
  }

  const isReady = stripe && elements && elementReady;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        Total:{' '}
        <span className="font-semibold text-gray-800">
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
          <p className="text-xs text-center text-gray-400">Loading payment form…</p>
        </div>
      )}

      <PaymentElement onReady={() => setElementReady(true)} />

      <button
        className="w-full bg-[var(--brand-accent)] hover:opacity-90 text-[var(--brand-on-accent)] px-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handlePay}
        disabled={!isReady || paying}
      >
        {paying
          ? 'Processing…'
          : !isReady
            ? 'Loading…'
            : `Pay ${total}`}
      </button>
    </div>
  );
};

export default PaymentStep;
