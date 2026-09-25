import React from 'react';
import { useNavigate } from 'react-router-dom';
import { type GetOrderByPaymentIntentApiResponse } from '../../../api/endpoints';
import { formatDollars } from '../../../utils/money';
import { formatDate } from '../../../utils/formatting';

interface OrderSuccessViewProps {
  orderData: GetOrderByPaymentIntentApiResponse | undefined;
  isOrderSuccess: boolean;
  slug: string;
}

const OrderSuccessView: React.FC<OrderSuccessViewProps> = ({
  orderData,
  isOrderSuccess,
  slug,
}) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto space-y-6 py-6">
      {/* Confirmation header */}
      <div className="text-center space-y-3">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white text-4xl"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          ✓
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Order Confirmed!</h2>
        <p className="text-gray-500 text-sm">
          Thank you{orderData?.customerName ? `, ${orderData.customerName}` : ''}.
          Your order has been placed.
        </p>
      </div>

      {/* Spinner while waiting for the webhook-created order */}
      {!isOrderSuccess ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <div
            className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin"
            style={{ borderTopColor: 'var(--brand-primary)' }}
          />
          <p className="text-sm text-gray-400">Fetching your order details…</p>
        </div>
      ) : orderData ? (
        <div className="bg-white rounded-xl shadow-md divide-y">
          {/* Order metadata */}
          <div className="p-5 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order Reference</span>
              <span className="font-semibold">#{orderData.orderRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="capitalize font-medium text-green-600">
                {orderData.displayState.replace(/_/g, ' ').toLowerCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Placed at</span>
              <span>{formatDate(orderData.createdAt)}</span>
            </div>
          </div>

          {/* Items list */}
          <div className="p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Items
            </p>
            {orderData.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.productName} × {item.quantity}
                </span>
                <span className="font-medium">
                  {formatDollars(item.lineTotalCents / 100)}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="p-5 flex justify-between font-semibold">
            <span>Total</span>
            <span>
              {orderData.currency.toUpperCase()}{' '}
              {formatDollars(orderData.subtotalCents / 100)}
            </span>
          </div>
        </div>
      ) : null}

      <button
        className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] text-white px-6 py-3 rounded-lg transition-colors font-medium"
        onClick={() => navigate(`/shops/${slug}`)}
      >
        Back to Menu
      </button>
    </div>
  );
};

export default OrderSuccessView;
