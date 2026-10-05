import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import ConfirmModal from '../../shared/ConfirmModal';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveShop } from '../../store/slices/shopSlice';
import {
  PAYMENT_CONFIRMING_ERROR,
  useCancelCustomerOrderMutation,
  useGetCustomerDocumentMutation,
  useGetCustomerOrderQuery,
} from '../../api/orderEndpoints';
import { useGetShopBySlugQuery } from '../../api/endpoints';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { useMoney } from '../../hooks/useMoney';
import { downloadBase64File } from '../../utils/download';
import { orderCopy } from '../../utils/orderCopy';

const LIVE_STATES = ['PLACED', 'ACCEPTED', 'READY'];
const CONFIRMING_POLL_MS = 3000;

const CustomerOrderPage: React.FC = () => {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const token = new URLSearchParams(location.search).get('t') ?? '';
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);

  const { data: shopData } = useGetShopBySlugQuery(slug ?? '', { skip: !slug });
  const branding = resolveShopBranding((shopData as ShopWithBranding | undefined)?.branding);
  const brandStyle = useBrandingStyle(branding);

  const { data, isLoading, isError, error } = useGetCustomerOrderQuery(
    { orderId: orderId ?? '', token },
    { skip: !orderId },
  );
  // The backend answers "payment is being confirmed" until Stripe has told it the card
  // reservation went through (the order is created only then), so keep asking quickly.
  const isConfirming =
    !data && (error as { data?: { error?: string } } | undefined)?.data?.error === PAYMENT_CONFIRMING_ERROR;
  // Poll while the order is still moving so acceptance and ready-time show up on
  // their own. Same arguments as above, so both hooks share one cache entry.
  useGetCustomerOrderQuery(
    { orderId: orderId ?? '', token },
    {
      skip: !orderId || (!data && !isConfirming),
      pollingInterval: isConfirming
        ? CONFIRMING_POLL_MS
        : data && LIVE_STATES.includes(data.state)
          ? 15000
          : 0,
    },
  );

  const [cancelOrder, { data: cancelled, isLoading: isCancelling, isError: cancelFailed }] =
    useCancelCustomerOrderMutation();
  const [getDocument] = useGetCustomerDocumentMutation();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [documentFailed, setDocumentFailed] = useState(false);
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
    setConfirmingCancel(false);
    if (!order) return;
    await cancelOrder({ orderId: order.orderId, token });
  }

  async function handleDownload(documentId: string) {
    if (!order) return;
    setDocumentFailed(false);
    setDownloadingId(documentId);
    const res = await getDocument({ orderId: order.orderId, documentId, token });
    setDownloadingId(null);
    if (res.data) {
      downloadBase64File(res.data.fileName, res.data.contentBase64, res.data.contentType);
    } else {
      setDocumentFailed(true);
    }
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

  // Money lines: what happened to the card payment, in the diner's words
  let paymentLines: string[] = [];
  if (order) {
    const gone = order.state === 'REJECTED' || order.state === 'CANCELLED';
    if (order.paymentStatus === 'authorized') {
      paymentLines = [copy.reservedOnline, ...(gone ? [] : [copy.reservePromise])];
    } else if (order.paymentStatus === 'paid') {
      paymentLines = gone
        ? [copy.refundInProgress(money.cents(order.subtotalCents))]
        : [copy.paidOnline];
    } else if (order.paymentStatus === 'canceled') {
      paymentLines = [copy.notCharged, copy.reservationBankNote];
    } else if (order.paymentStatus === 'refunded') {
      paymentLines = [copy.refunded(money.cents(order.refundedCents))];
    } else if (order.paymentStatus === 'partially_refunded') {
      paymentLines = [copy.partlyRefunded(money.cents(order.refundedCents))];
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
        {isConfirming && !order && <p className="text-gray-700">{copy.confirmingPayment}</p>}
        {isError && !isConfirming && !order && (
          <p className="text-red-600">{copy.orderNotFound}</p>
        )}

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
            {paymentLines.map((line) => (
              <p key={line} className="text-sm text-gray-600">
                {line}
              </p>
            ))}

            {order.documents.length > 0 && (
              <div className="space-y-2">
                {order.documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleDownload(doc.id)}
                    disabled={downloadingId === doc.id}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {copy.downloadDocument[doc.kind]} ({doc.number})
                  </button>
                ))}
                {documentFailed && <p className="text-sm text-red-600">{copy.invoiceFailed}</p>}
              </div>
            )}

            {order.sellerPhone && (
              <p className="text-sm text-gray-600">{copy.callRestaurant(order.sellerPhone)}</p>
            )}

            {order.canCancel && (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
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

      <ConfirmModal
        isOpen={confirmingCancel}
        title={copy.cancelConfirmTitle}
        message={copy.cancelConfirm}
        confirmLabel={copy.cancelConfirmYes}
        cancelLabel={copy.cancelConfirmNo}
        onConfirm={handleCancel}
        onCancel={() => setConfirmingCancel(false)}
      />

      <Footer slug={slug} />
    </div>
  );
};

export default CustomerOrderPage;
