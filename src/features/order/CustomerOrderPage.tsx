import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Bike, Check, Download, Mail, MapPin, Phone, ShieldCheck, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
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
  type CustomerOrderDto,
} from '../../api/orderEndpoints';
import { useGetShopBySlugQuery } from '../../api/endpoints';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { useMoney } from '../../hooks/useMoney';
import { downloadBase64File } from '../../utils/download';
import { orderCopy, type OrderCopy } from '../../utils/orderCopy';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { slotLabel } from '../../utils/slots';
import { routeUrl, telHref } from '../../utils/openingHours';

const LIVE_STATES = ['PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY'];
const CONFIRMING_POLL_MS = 3000;
// Right after payment the order can briefly look missing while Stripe's confirmation is
// being stored, so "not found" is only believed once it persists this long.
const NOT_FOUND_GRACE_MS = 20000;

type StepState = 'done' | 'current' | 'todo';
interface Step {
  label: string;
  sub: string;
  state: StepState;
  spinning?: boolean;
}

/**
 * The progress steps for an order: Sent → Accepted → Ready (collection, table) or
 * Sent → Accepted → On the way → Delivered (delivery). `null` order = payment still being confirmed.
 * Orders a restaurant accepts automatically simply arrive already accepted.
 */
function progressSteps(order: CustomerOrderDto | null, copy: OrderCopy, time: string): Step[] {
  const delivery = order?.fulfilmentMode === 'delivery';
  const state = order?.state ?? 'CONFIRMING';
  // Index of the step in progress; past the end = everything done
  const at =
    state === 'CONFIRMING' ? 0
      : state === 'PLACED' ? 1
        : state === 'ACCEPTED' ? 2
          : state === 'READY' ? (delivery ? 2 : 99)
            : state === 'OUT_FOR_DELIVERY' ? 3
              : 99;
  const scheduled = order?.scheduledFor ? slotLabel(order.scheduledFor, order.timezone, order.language) : null;
  const defs: Array<{ label: string; sub: string }> = [
    { label: copy.stepSent, sub: state === 'CONFIRMING' ? copy.stepPaymentConfirming : copy.stepPaymentReserved },
    {
      label: copy.stepAccepted,
      sub: at === 1 ? (scheduled ?? copy.stepWaiting) : at > 1 ? copy.stepPreparing : '',
    },
    delivery
      ? { label: copy.stepOnTheWay, sub: '' }
      : { label: copy.stepReady, sub: at === 2 ? time : at > 2 && state === 'READY' ? copy.stepPickUpNow : '' },
  ];
  if (delivery) defs.push({ label: copy.stepDelivered, sub: at === 3 ? time : '' });
  return defs.map((d, i) => ({
    ...d,
    state: at > i ? 'done' : at === i ? 'current' : 'todo',
    spinning: state === 'CONFIRMING' && i === 0,
  }));
}

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
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), NOT_FOUND_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);
  // The backend answers "payment is being confirmed" until Stripe has told it the card
  // reservation went through (the order is created only then), so keep asking quickly.
  const isConfirming =
    !data && (error as { data?: { error?: string } } | undefined)?.data?.error === PAYMENT_CONFIRMING_ERROR;
  const isRetrying = !data && isError && !isConfirming && !graceOver;
  // Poll while the order is still moving so acceptance and ready-time show up on
  // their own. Same arguments as above, so both hooks share one cache entry.
  useGetCustomerOrderQuery(
    { orderId: orderId ?? '', token },
    {
      skip: !orderId || (!data && !isConfirming && !isRetrying),
      pollingInterval: isConfirming || isRetrying
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

  const copy = orderCopy(order?.language ?? pageLanguageOf(currentChoice(storedLanguage, navigator.language)));

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

  // ── What the hero says ──
  const dineIn = order?.fulfilmentMode === 'dine_in';
  const delivery = order?.fulfilmentMode === 'delivery';
  const readyTime = order ? timeIn(order.readyAt, order.timezone) : '';
  let title = '';
  let subtitle: string | null = null;
  let tone: 'progress' | 'good' | 'ready' | 'stopped' = 'good';
  if (!order && isConfirming) {
    title = copy.orderSent;
    subtitle = copy.confirmingPayment;
    tone = 'progress';
  } else if (order) {
    if (order.state === 'PLACED') {
      title = order.scheduledFor ? copy.statusScheduled(order.shopName) : copy.statusPlaced(order.shopName);
      subtitle = order.scheduledFor ? copy.statusScheduledHint : copy.statusPlacedHint;
    } else if (order.state === 'REJECTED') {
      title = copy.statusRejected;
      subtitle = order.rejectionReason ? copy.rejectReason[order.rejectionReason] : null;
      tone = 'stopped';
    } else if (order.state === 'CANCELLED') {
      title = copy.statusCancelled;
      tone = 'stopped';
    } else if (order.state === 'COMPLETED') {
      title = delivery ? copy.statusCompletedDelivery : dineIn ? copy.statusCompletedDineIn : copy.statusCompleted;
    } else if (order.state === 'OUT_FOR_DELIVERY') {
      title = copy.statusOutForDelivery;
      tone = 'ready';
    } else if (order.state === 'READY') {
      title = dineIn ? copy.statusReadyDineIn : copy.statusReady;
      tone = 'ready';
    } else {
      title = delivery
        ? copy.statusAcceptedDelivery(readyTime)
        : dineIn
          ? copy.statusAcceptedDineIn(readyTime)
          : copy.statusAccepted(readyTime);
    }
  }
  const stopped = tone === 'stopped';
  const showTimeBox = order?.state === 'ACCEPTED' && !!readyTime;
  const steps = !stopped && (order || isConfirming) ? progressSteps(order ?? null, copy, readyTime) : [];
  const live = isConfirming || (order ? LIVE_STATES.includes(order.state) : false);

  // Money lines: what happened to the card payment, in the diner's words
  let paymentChip: string | null = null;
  let paymentLines: string[] = [];
  if (order) {
    const gone = order.state === 'REJECTED' || order.state === 'CANCELLED';
    if (order.paymentStatus === 'authorized') {
      paymentChip = copy.reservedOnline;
      paymentLines = gone ? [] : [copy.reservePromise];
    } else if (order.paymentStatus === 'paid') {
      if (gone) paymentLines = [copy.refundInProgress(money.cents(order.totalCents ?? order.subtotalCents))];
      else paymentChip = copy.paidOnline;
    } else if (order.paymentStatus === 'canceled') {
      paymentLines = [copy.reservationBankNote];
    } else if (order.paymentStatus === 'refunded') {
      paymentLines = [copy.refunded(money.cents(order.refundedCents))];
    } else if (order.paymentStatus === 'partially_refunded') {
      paymentLines = [copy.partlyRefunded(money.cents(order.refundedCents))];
    }
  }
  const notCharged = order?.paymentStatus === 'canceled';

  const shopAddress = (shopData as { address?: { street?: string; postcode?: string; city?: string; country?: string } } | undefined)
    ?.address;
  const route = shopAddress ? routeUrl(shopAddress) : null;
  const finished = order ? order.state === 'COMPLETED' || stopped : false;

  const card = 'rounded-[20px] border border-[#efe7de] bg-white p-5 sm:p-6';
  const outlineButton =
    'inline-flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-gray-900 px-4 text-sm font-bold text-gray-900 transition-colors hover:bg-[#faf6f1]';
  const iconBg =
    tone === 'stopped' ? 'bg-[#6b6058]' : tone === 'good' ? 'bg-[#2f8a4c]' : 'bg-[var(--brand-accent)]';

  return (
    <div className="flex min-h-screen flex-col bg-[#faf6f1]" style={brandStyle}>
      <div className="sticky top-0 z-50">
        <NavBar
          shopName={order?.shopName ?? shopData?.name ?? 'Online Ordering'}
          shopId={slug ?? ''}
          logoUrl={branding.logoUrl}
          hideCart
        />
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
        {(isLoading || (isRetrying && !order)) && !isConfirming && (
          <div className={`${card} flex items-center gap-3 text-[#5c524b]`}>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#e3d9ce] border-t-gray-900" aria-hidden="true" />
            {copy.loading}
          </div>
        )}
        {isError && !isConfirming && !isRetrying && !order && (
          <p role="alert" className="rounded-2xl bg-[#fdecea] px-5 py-4 text-[15px] text-[#8a1f12]">
            {copy.orderNotFound}
          </p>
        )}

        {(order || isConfirming) && (
          <>
            {/* ── Status hero ── */}
            <section className={`${card} flex flex-col gap-6 shadow-[0_8px_28px_rgba(31,26,23,0.05)] sm:p-8`}>
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white ${iconBg}`}
                  aria-hidden="true"
                >
                  {tone === 'progress' ? (
                    <span className="h-7 w-7 animate-spin rounded-full border-[3.5px] border-white/35 border-t-white" />
                  ) : tone === 'stopped' ? (
                    <X className="h-8 w-8" strokeWidth={2.8} />
                  ) : tone === 'ready' && order?.state === 'OUT_FOR_DELIVERY' ? (
                    <Bike className="h-8 w-8" strokeWidth={2} />
                  ) : tone === 'ready' ? (
                    <ShoppingBag className="h-8 w-8" strokeWidth={2} />
                  ) : (
                    <Check className="h-9 w-9" strokeWidth={2.8} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
                  {order && (
                    <span className="rounded-lg bg-[#f4efe9] px-2.5 py-1 text-[15px] font-bold tracking-wide text-gray-900">
                      {copy.yourOrder(order.orderRef)}
                    </span>
                  )}
                  <h1 aria-live="polite" className="font-display text-[28px] font-semibold leading-tight text-gray-900 sm:text-[36px]">
                    {title}
                  </h1>
                  {subtitle && <p className="max-w-2xl text-[15px] leading-relaxed text-[#4a413b] sm:text-base">{subtitle}</p>}
                  {order?.scheduledFor && (
                    <p className="text-[15px] font-semibold text-gray-900">
                      {copy.scheduledLine(slotLabel(order.scheduledFor, order.timezone, order.language))}
                    </p>
                  )}
                </div>
                {showTimeBox && (
                  <div className="shrink-0 rounded-[18px] border border-[#efe7de] bg-[#faf6f1] px-6 py-3 text-center">
                    <div className="text-[13px] font-semibold text-[#6b6058]">
                      {delivery ? copy.timeDeliveryAround : copy.timeReadyAt}
                    </div>
                    <div className="font-display text-[40px] font-semibold leading-tight text-gray-900 sm:text-[44px]">
                      {readyTime}
                    </div>
                  </div>
                )}
              </div>

              {steps.length > 0 && (
                <ol
                  aria-label={copy.progressLabel}
                  className={`flex flex-col sm:grid ${steps.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
                >
                  {steps.map((s, i) => {
                    const last = i === steps.length - 1;
                    const lineDone = s.state === 'done';
                    return (
                      <li key={s.label} className="flex gap-3.5 sm:flex-col sm:gap-2.5" aria-current={s.state === 'current' ? 'step' : undefined}>
                        <div className="flex flex-col items-center sm:flex-row">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                              s.state === 'done'
                                ? 'bg-[#2f8a4c] text-white'
                                : s.state === 'current'
                                  ? 'bg-[var(--brand-accent)] text-white ring-4 ring-[color-mix(in_srgb,var(--brand-accent)_18%,transparent)]'
                                  : 'border-2 border-[#e3d9ce] bg-white'
                            }`}
                          >
                            {s.state === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3.2} aria-hidden="true" />}
                            {s.spinning && (
                              <span className="h-3 w-3 animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" aria-hidden="true" />
                            )}
                          </span>
                          {!last && (
                            <span
                              aria-hidden="true"
                              className={`my-1 min-h-[18px] w-[3px] flex-1 rounded-full sm:mx-2 sm:my-0 sm:h-[3px] sm:min-h-0 sm:w-auto ${
                                lineDone ? 'bg-[#2f8a4c]' : 'bg-[#efe7de]'
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex flex-col pb-4 sm:pb-0 sm:pr-3">
                          <span className={`text-[15px] font-bold ${s.state === 'todo' ? 'text-[#9a8f86]' : 'text-gray-900'}`}>
                            {s.label}
                          </span>
                          {s.sub && <span className="text-[13px] text-[#6b6058]">{s.sub}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {notCharged && (
                <div className="flex items-start gap-3 rounded-2xl bg-[#e6f3ea] px-4 py-3.5 text-[15px] leading-relaxed text-[#1d4a2c]">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>
                    <strong>{copy.notCharged}</strong>
                  </p>
                </div>
              )}

              {live && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#f1ebe4] pt-4 text-sm text-[#5c524b]">
                  <span className="inline-flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2f8a4c] opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2f8a4c]" />
                    </span>
                    {copy.liveUpdates}
                  </span>
                  {order && order.state !== 'PLACED' && (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      {copy.emailedCopy}
                    </span>
                  )}
                </div>
              )}
            </section>

            {order && (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                {/* ── Order details ── */}
                <section className={`${card} flex flex-col gap-3.5`}>
                  <h2 className="text-[19px] font-bold text-gray-900">{copy.checkoutTitle}</h2>
                  <ul className="flex flex-col">
                    {order.items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-3 border-b border-[#f1ebe4] py-3 first:pt-0">
                        <div>
                          <div className="text-[15px] font-bold text-gray-900">
                            {item.quantity} × {item.productName}
                          </div>
                          {(item.selectedVariantOptionName || item.selectedAddonOptionNames.length > 0) && (
                            <div className="text-[13px] text-[#5c524b]">
                              {[item.selectedVariantOptionName, ...item.selectedAddonOptionNames]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </div>
                        <div className="whitespace-nowrap text-[15px] font-semibold text-gray-900">
                          {money.cents(item.lineTotalCents)}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {order.discount && (
                    <div className="flex justify-between text-[15px] text-[#1d5a32]">
                      <span>{copy.discountLine(order.discount.code)}</span>
                      <span>{money.cents(-order.discount.cents)}</span>
                    </div>
                  )}
                  {order.deliveryFeeCents != null && (
                    <div className="flex justify-between text-[15px] text-[#3a322d]">
                      <span>{copy.deliveryFeeLine}</span>
                      <span>{money.cents(order.deliveryFeeCents)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-[17px] font-bold text-gray-900">
                      {copy.total} <span className="text-xs font-normal text-[#6b6058]">{copy.inclVat}</span>
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {money.cents(order.totalCents ?? order.subtotalCents)}
                    </span>
                  </div>

                  {(paymentChip || paymentLines.length > 0) && (
                    <div className="flex flex-col gap-2 rounded-2xl bg-[#faf6f1] px-4 py-3">
                      {paymentChip && (
                        <span className="self-start rounded-full bg-[#e6f3ea] px-3 py-1 text-[13px] font-bold text-[#1d5a32]">
                          {paymentChip}
                        </span>
                      )}
                      {paymentLines.map((line) => (
                        <p key={line} className="text-sm leading-relaxed text-[#4a413b]">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  {order.documents.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {order.documents.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleDownload(doc.id)}
                          disabled={downloadingId === doc.id}
                          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border-[1.5px] border-[#e3d9ce] px-4 py-2 text-left text-sm font-bold text-gray-900 hover:border-gray-400 disabled:opacity-50"
                        >
                          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {copy.downloadDocument[doc.kind]} ({doc.number})
                        </button>
                      ))}
                      {documentFailed && <p className="text-sm text-[#8a1f12]">{copy.invoiceFailed}</p>}
                    </div>
                  )}
                </section>

                {/* ── Where, contact, cancel ── */}
                <div className="flex flex-col gap-4">
                  <section className={`${card} flex flex-col gap-3.5`}>
                    <h2 className="text-[19px] font-bold text-gray-900">
                      {delivery ? copy.placeDelivery : dineIn ? copy.placeTable : copy.placeCollection}
                    </h2>
                    {delivery && order.deliveryAddress ? (
                      <p className="text-[15px] leading-relaxed text-gray-900">
                        {copy.deliverTo(
                          `${order.deliveryAddress.street}, ${order.deliveryAddress.postcode} ${order.deliveryAddress.city}`,
                        )}
                      </p>
                    ) : dineIn && order.table ? (
                      <p className="text-[15px] font-bold text-gray-900">{copy.tableLine(order.table.label)}</p>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#efe7de] bg-white">
                          {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="" className="h-[74%] w-[74%] object-contain" />
                          ) : (
                            <UtensilsCrossed className="h-5 w-5 text-[#b9ada2]" aria-hidden="true" />
                          )}
                        </div>
                        <div className="text-[15px] leading-snug">
                          <div className="font-bold text-gray-900">{order.shopName}</div>
                          {shopAddress?.street && (
                            <div className="text-[#5c524b]">
                              {[shopAddress.street, [shopAddress.postcode, shopAddress.city].filter(Boolean).join(' ')]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {(route || order.sellerPhone) && (
                      <div className="flex flex-wrap gap-2">
                        {route && !delivery && !dineIn && (
                          <a href={route} target="_blank" rel="noopener noreferrer" className={outlineButton}>
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {copy.infoRoute}
                          </a>
                        )}
                        {order.sellerPhone && (
                          <a href={telHref(order.sellerPhone)} className={outlineButton}>
                            <Phone className="h-4 w-4" aria-hidden="true" />
                            {copy.callButton(order.sellerPhone)}
                          </a>
                        )}
                      </div>
                    )}
                  </section>

                  {order.canCancel && (
                    <section className={`${card} flex flex-col gap-3`}>
                      <p className="text-sm leading-relaxed text-[#5c524b]">{copy.cancelHint}</p>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancel(true)}
                        disabled={isCancelling}
                        className="h-11 self-start rounded-full border-[1.5px] border-[#e3d9ce] bg-white px-5 text-sm font-bold text-[#8a1f12] hover:border-[#8a1f12] disabled:opacity-50"
                      >
                        {copy.cancelOrder}
                      </button>
                      {cancelFailed && <p className="text-sm text-[#8a1f12]">{copy.cancelFailed}</p>}
                    </section>
                  )}

                  <Link
                    to={`/shops/${order.shopSlug || slug}`}
                    className={`flex h-[52px] items-center justify-center rounded-full text-[15px] font-bold ${
                      finished
                        ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)]'
                        : 'border-[1.5px] border-[#e3d9ce] text-gray-900 hover:border-gray-400'
                    }`}
                  >
                    {finished ? copy.orderAgain : copy.backToMenu}
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ConfirmModal
        isOpen={confirmingCancel}
        title={copy.cancelConfirmTitle}
        message={copy.cancelConfirm}
        confirmLabel={copy.cancelConfirmYes}
        cancelLabel={copy.cancelConfirmNo}
        icon="cancel"
        onConfirm={handleCancel}
        onCancel={() => setConfirmingCancel(false)}
      />

      <Footer slug={slug} />
    </div>
  );
};

export default CustomerOrderPage;
