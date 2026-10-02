// Hand-written endpoints for collection orders. Kept out of endpoints.ts because
// that file is generated; shapes mirror the backend's src/application/order DTOs.
import { api } from './endpoints';
import type { FulfilmentMode } from '../store/slices/shopSlice';

// Literal strings the backend sends as `error`; the storefront compares them.
export const BASKET_CHANGED_ERROR = 'Your basket has changed. Please review it and try again.';
export const LEGAL_CHANGED_ERROR =
  'The restaurant has updated its terms. Please review them and order again.';

export type PaymentMethod = 'cash' | 'card';
export type LineStatus = 'ok' | 'price_changed' | 'unavailable' | 'invalid_options';
export type StoredOrderState =
  | 'PLACED'
  | 'ACCEPTED'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'OUT_FOR_DELIVERY';
export type RejectReason = 'too_busy' | 'item_unavailable' | 'closing_soon' | 'other' | 'no_response';

export interface CheckoutItemDto {
  productId: string;
  quantity: number;
  selectedVariantOptionId?: string;
  selectedAddonOptionIds?: string[];
  expectedUnitPriceCents?: number;
}

export interface QuoteBasketRequest {
  shopId: string;
  items: CheckoutItemDto[];
  fulfilmentMode?: FulfilmentMode;
  language?: string;
}

export interface QuoteLineDto {
  index: number;
  productId: string;
  name: string | null;
  quantity: number;
  status: LineStatus;
  unitPriceCents: number | null;
  expectedUnitPriceCents: number | null;
  lineTotalCents: number | null;
}

export interface BasketQuoteDto {
  currency: string;
  fulfilmentMode: FulfilmentMode;
  lines: QuoteLineDto[];
  subtotalCents: number;
  taxCents: number;
  minOrderAmountCents: number;
  belowMinimum: boolean;
  openNow: boolean;
  paymentMethods: PaymentMethod[];
  prepMinutes: number;
}

export interface PlaceOrderRequest {
  shopId: string;
  items: CheckoutItemDto[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNotes?: string;
  fulfilmentMode?: FulfilmentMode;
  paymentMethod?: PaymentMethod;
  idempotencyKey?: string;
  language?: string;
  legalRevisions?: { terms: number; withdrawal: number };
}

export interface CardCheckoutResult {
  kind: 'card';
  sessionId: string;
  clientSecret: string;
  subtotalCents: number;
  currency: string;
  stripeConnectAccountId: string;
}

export interface CashCheckoutResult {
  kind: 'cash';
  orderId: string;
  orderRef: string;
  accessToken: string;
  subtotalCents: number;
  currency: string;
  state: 'PLACED';
  autoRejectAt: string;
}

export type PlaceOrderResult = CardCheckoutResult | CashCheckoutResult;

export interface CustomerOrderDto {
  orderId: string;
  orderRef: string;
  shopSlug: string;
  shopName: string;
  sellerPhone: string | null;
  timezone: string;
  language: 'de' | 'en';
  state: StoredOrderState;
  displayState: string;
  fulfilmentMode: FulfilmentMode;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  readyAt: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    selectedVariantOptionName: string | null;
    selectedAddonOptionNames: string[];
  }>;
  subtotalCents: number;
  currency: string;
  createdAt: string;
  canCancel: boolean;
  rejectionReason: RejectReason | null;
}

export interface CustomerOrderArg {
  orderId: string;
  token: string;
}

/** What GET /shops/slug/{slug} adds for ordering; absent on older backends. */
export interface ShopFulfilment {
  modes: FulfilmentMode[];
  prepMinutes: Record<FulfilmentMode, number>;
}

export const orderApi = api.injectEndpoints({
  endpoints: (b) => ({
    quoteBasket: b.query<BasketQuoteDto, QuoteBasketRequest>({
      query: (arg) => ({ url: '/orders/quote', method: 'POST', body: arg }),
    }),
    placeOrder: b.mutation<PlaceOrderResult, PlaceOrderRequest>({
      query: (arg) => ({ url: '/orders', method: 'POST', body: arg }),
    }),
    getCustomerOrder: b.query<CustomerOrderDto, CustomerOrderArg>({
      query: ({ orderId, token }) => ({
        url: `/customer-orders/${orderId}/view`,
        method: 'POST',
        body: { token },
      }),
      keepUnusedDataFor: 0,
    }),
    cancelCustomerOrder: b.mutation<CustomerOrderDto, CustomerOrderArg>({
      query: ({ orderId, token }) => ({
        url: `/customer-orders/${orderId}/cancel`,
        method: 'POST',
        body: { token },
      }),
    }),
  }),
});

export const {
  useQuoteBasketQuery,
  usePlaceOrderMutation,
  useGetCustomerOrderQuery,
  useCancelCustomerOrderMutation,
} = orderApi;
