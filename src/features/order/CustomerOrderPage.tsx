import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveShop } from '../../store/slices/shopSlice';
import {
  useCancelCustomerOrderMutation,
  useGetCustomerOrderQuery,
} from '../../api/orderEndpoints';
import { useGetShopBySlugQuery } from '../../api/endpoints';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { useMoney } from '../../hooks/useMoney';
import { orderCopy } from '../../utils/orderCopy';

const LIVE_STATES = ['PLACED', 'ACCEPTED', 'READY'];

const CustomerOrderPage: React.FC = () => {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const token = new URLSearchParams(location.search).get('t') ?? '';
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);

  const { data: shopData } = useGetShopBySlugQuery(slug ?? '', { skip: !slug });
  const branding = resolveShopBranding((shopData as ShopWithBranding | undefined)?.branding);
  const brandStyle = useBrandingStyle(branding);

  const { data, isLoading, isError } = useGetCustomerOrderQuery(
    { orderId: orderId ?? '', token },
    { skip: !orderId },
  );
  // Poll while the order is still moving so acceptance and ready-time show up on
  // their own. Same arguments as above, so both hooks share one cache entry.
  useGetCustomerOrderQuery(
    { orderId: orderId ?? '', token },
    { skip: !orderId || !data, pollingInterval: data && LIVE_STATES.includes(data.state) ? 15000 : 0 },
  );

  const [cancelOrder, { data: cancelled, isLoading: isCancelling, isError: cancelFailed }] =
    useCancelCustomerOrderMutation();
  const order = cancelled ?? data;
  // Prices in the language the diner ordered in, even when the page is opened fresh from the email link
  const money = useMoney(order?.language);

  useEffect(() => {
    if (data) dispatch(setActiveShop({ shopId: data.shopSlug, currency: data.currency }));
  }, [dispatch, data]);

  const copy = orderCopy(order?.language ?? storedLanguage ?? navigator.language.slice(0, 2));

  const timeIn = (iso: string | null, timeZone: string): string =>
    iso
      ? new Intl.DateTimeFormat(order?.language === 'de' ? 'de-DE' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        }).format(new Date(iso))
      : '';

  async function handleCancel() {
    if (!order || !window.confirm(copy.cancelConfirm)) return;
    await cancelOrder({ orderId: order.orderId, token });
  }

  let status: React.ReactNode = null;
  if (order) {
    if (order.state === 'PLACED') {
      status = (
        <>
          <p className="text-lg font-medium">{copy.statusPlaced(order.shopName)}</p>
          <p className="text-sm text-gray-600">{copy.statusPlacedHint}</p>
        </>
      );
    } else if (order.state === 'REJECTED') {
      status = (
        <>
          <p className="text-lg font-medium">{copy.statusRejected}</p>
          {order.rejectionReason && (
            <p className="text-sm text-gray-600">{copy.rejectReason[order.rejectionReason]}</p>
          )}
          {order.paymentMethod === 'cash' && (
            <p className="text-sm text-gray-600">{copy.notCharged}</p>
          )}
        </>
      );
    } else if (order.state === 'CANCELLED') {
      status = <p className="text-lg font-medium">{copy.statusCancelled}</p>;
    } else if (order.state === 'COMPLETED') {
      status = <p className="text-lg font-medium">{copy.statusCompleted}</p>;
    } else if (order.state === 'READY') {
      status = <p className="text-lg font-medium">{copy.statusReady}</p>;
    } else {
      status = (
        <p className="text-lg font-medium">
          {copy.statusAccepted(timeIn(order.readyAt, order.timezone))}
        </p>
      );
    }
  }

  return (
    <div className="bg-gray-50/60 min-h-screen flex flex-col" style={brandStyle}>
      <div className="sticky top-0 z-50">
        <NavBar
          shopName={order?.shopName ?? shopData?.name ?? 'Online Ordering'}
          shopId={slug ?? ''}
          logoUrl={branding.logoUrl}
        />
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
        {isLoading && <p className="text-gray-500">{copy.loading}</p>}
        {isError && !order && <p className="text-red-600">{copy.orderNotFound}</p>}

        {order && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-5">
            <h1 className="text-2xl font-bold" style={{ color: branding.accentColor }}>
              {copy.yourOrder(order.orderRef)}
            </h1>
            <div className="space-y-1">{status}</div>

            <ul className="divide-y text-sm">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <div>
                    <div>
                      {item.quantity} × {item.productName}
                    </div>
                    {(item.selectedVariantOptionName || item.selectedAddonOptionNames.length > 0) && (
                      <div className="text-xs text-gray-500">
                        {[item.selectedVariantOptionName, ...item.selectedAddonOptionNames]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                  <div>{money.cents(item.lineTotalCents)}</div>
                </li>
              ))}
            </ul>

            <div className="flex justify-between font-semibold text-sm">
              <span>{copy.total}</span>
              <span>{money.cents(order.subtotalCents)}</span>
            </div>
            <p className="text-sm text-gray-600">{copy.paymentCash}</p>

            {order.sellerPhone && (
              <p className="text-sm text-gray-600">{copy.callRestaurant(order.sellerPhone)}</p>
            )}

            {order.canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {copy.cancelOrder}
              </button>
            )}
            {cancelFailed && <p className="text-sm text-red-600">{copy.cancelFailed}</p>}
          </div>
        )}
      </div>

      <Footer slug={slug} />
    </div>
  );
};

export default CustomerOrderPage;
