import { baseApi as api } from './baseApi';
export const addTagTypes = ['Orders', 'Legal', 'Shops', 'Catalog'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      cancelCustomerOrder: build.mutation<
        CancelCustomerOrderApiResponse,
        CancelCustomerOrderApiArg
      >({
        query: (queryArg) => ({
          url: `/customer-orders/${queryArg.orderId}/cancel`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['Orders'],
      }),
      viewCustomerDocument: build.mutation<
        ViewCustomerDocumentApiResponse,
        ViewCustomerDocumentApiArg
      >({
        query: (queryArg) => ({
          url: `/customer-orders/${queryArg.orderId}/documents/${queryArg.documentId}`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['Orders'],
      }),
      viewCustomerOrder: build.query<
        ViewCustomerOrderApiResponse,
        ViewCustomerOrderApiArg
      >({
        query: (queryArg) => ({
          url: `/customer-orders/${queryArg.orderId}/view`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['Orders'],
      }),
      getPlatformLegal: build.query<
        GetPlatformLegalApiResponse,
        GetPlatformLegalApiArg
      >({
        query: () => ({ url: `/legal/platform` }),
        providesTags: ['Legal'],
      }),
      createOrder: build.mutation<CreateOrderApiResponse, CreateOrderApiArg>({
        query: (queryArg) => ({
          url: `/orders`,
          method: 'POST',
          body: queryArg,
        }),
        invalidatesTags: ['Orders'],
      }),
      quoteBasket: build.query<QuoteBasketApiResponse, QuoteBasketApiArg>({
        query: (queryArg) => ({
          url: `/orders/quote`,
          method: 'POST',
          body: queryArg,
        }),
        providesTags: ['Orders'],
      }),
      getShopById: build.query<GetShopByIdApiResponse, GetShopByIdApiArg>({
        query: (queryArg) => ({ url: `/shops/${queryArg}` }),
        providesTags: ['Shops'],
      }),
      getCatalog: build.query<GetCatalogApiResponse, GetCatalogApiArg>({
        query: (queryArg) => ({
          url: `/shops/${queryArg.shopId}/catalog`,
          params: {
            lang: queryArg.lang,
            at: queryArg.at,
          },
        }),
        providesTags: ['Catalog'],
      }),
      listPublicShops: build.query<
        ListPublicShopsApiResponse,
        ListPublicShopsApiArg
      >({
        query: () => ({ url: `/shops/public` }),
        providesTags: ['Shops'],
      }),
      getShopBySlug: build.query<GetShopBySlugApiResponse, GetShopBySlugApiArg>(
        {
          query: (queryArg) => ({ url: `/shops/slug/${queryArg}` }),
          providesTags: ['Shops'],
        },
      ),
      getPublicLegalPack: build.query<
        GetPublicLegalPackApiResponse,
        GetPublicLegalPackApiArg
      >({
        query: (queryArg) => ({
          url: `/shops/slug/${queryArg.slug}/legal`,
          params: {
            lang: queryArg.lang,
          },
        }),
        providesTags: ['Legal'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type CancelCustomerOrderApiResponse =
  /** status 200 Success */ CustomerOrderDto;
export type CancelCustomerOrderApiArg = {
  orderId: string;
  body: {
    token: any;
  };
};
export type ViewCustomerDocumentApiResponse =
  /** status 200 The PDF as base64 */ {
    [key: string]: any;
  };
export type ViewCustomerDocumentApiArg = {
  orderId: string;
  documentId: string;
  body: {
    token: any;
  };
};
export type ViewCustomerOrderApiResponse =
  /** status 200 Success */ CustomerOrderDto;
export type ViewCustomerOrderApiArg = {
  orderId: string;
  body: {
    token: any;
  };
};
export type GetPlatformLegalApiResponse =
  /** status 200 Success */ PlatformLegalPublicDto;
export type GetPlatformLegalApiArg = void;
export type CreateOrderApiResponse =
  /** status 200 Order created and PaymentIntent initiated */ CheckoutResultDto;
export type CreateOrderApiArg = CheckoutRequestDto;
export type QuoteBasketApiResponse = /** status 200 Success */ BasketQuoteDto;
export type QuoteBasketApiArg = QuoteBasketRequestDto;
export type GetShopByIdApiResponse =
  /** status 200 Shop retrieved successfully */ GetShopResultDto;
export type GetShopByIdApiArg = string;
export type GetCatalogApiResponse =
  /** status 200 Catalog retrieved successfully */ GetCatalogResultDto;
export type GetCatalogApiArg = {
  shopId: string;
  /** Preferred menu language; falls back to the original */
  lang?: string;
  at?: string;
};
export type ListPublicShopsApiResponse =
  /** status 200 Listed shops, sorted by name */ GetPublicShopsResultDto;
export type ListPublicShopsApiArg = void;
export type GetShopBySlugApiResponse =
  /** status 200 Shop retrieved successfully */ GetShopBySlugResultDto;
export type GetShopBySlugApiArg = string;
export type GetPublicLegalPackApiResponse =
  /** status 200 Success */ PublicLegalPackDto;
export type GetPublicLegalPackApiArg = {
  slug: string;
  lang?: any;
};
export type MenuLanguage = 'de' | 'en';
export type StoredOrderState =
  | 'PLACED'
  | 'ACCEPTED'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUNDED';
export type OrderState =
  | 'PLACED'
  | 'ACCEPTED'
  | 'IN_PREPARATION'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUNDED';
export type FulfilmentMode = 'collection' | 'delivery' | 'dine_in';
export type PaymentStatus =
  'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'canceled';
export type DisplayPaymentStatus = PaymentStatus | 'not_paid_online';
export type InvoiceDocumentType = 'invoice' | 'cancellation' | 'correction';
export type OrderDocumentDto = {
  id: string;
  kind: InvoiceDocumentType;
  number: string;
};
export type DeliveryAddress = {
  street: string;
  postcode: string;
  city: string;
};
export type OrderDiscountKind = 'code' | 'voucher';
export type StaffRejectReason =
  'too_busy' | 'item_unavailable' | 'closing_soon' | 'other';
export type RejectReason =
  | StaffRejectReason
  | 'no_response'
  | 'payment_failed'
  | 'payment_unavailable'
  | 'shop_unavailable';
export type CustomerOrderDto = {
  orderId: string;
  orderRef: string;
  emailsEnabled: boolean;
  shopSlug: string;
  shopName: string;
  sellerPhone: string | null;
  timezone: string;
  language: MenuLanguage;
  state: StoredOrderState;
  displayState: OrderState;
  fulfilmentMode: FulfilmentMode;
  table: {
    label: string;
  } | null;
  scheduledFor: string | null;
  paymentStatus: DisplayPaymentStatus;
  refundedCents: number;
  refundFailed: boolean;
  documents: OrderDocumentDto[];
  readyAt: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    selectedVariantOptionName: string | null;
    selectedAddonOptionNames: string[];
    combo?: {
      line: number;
      productId: string;
      name: string;
    } | null;
    ageRestricted: boolean;
  }[];
  subtotalCents: number;
  totalCents: number;
  deliveryFeeCents: number | null;
  deliveryAddress: DeliveryAddress | null;
  discount: {
    kind: OrderDiscountKind;
    code: string;
    cents: number;
  } | null;
  currency: string;
  createdAt: string;
  canCancel: boolean;
  paymentHeld: boolean;
  rejectionReason: RejectReason | null;
};
export type ErrorResponse = {
  ok: boolean;
  code: string;
  error: string;
};
export type SubProcessor = {
  id: 'azure' | 'entra' | 'acs';
  name: string;
  purpose: {
    de: string;
    en: string;
  };
  location: {
    de: string;
    en: string;
  };
};
export type PlatformLegalPublicDto = {
  platformName: string;
  salesSiteUrl: string | null;
  operator: {
    legalName: string;
    address: string;
    email: string;
  };
  euRepresentative: {
    name: string;
    address: string;
    email: string;
  } | null;
  subProcessors: SubProcessor[];
  currentDpaVersion: string;
  currentDpaIsDraft: boolean;
};
export type CardCheckoutResultDto = {
  kind: 'card';
  sessionId: string;
  orderId: string;
  accessToken: string;
  clientSecret: string;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  stripeConnectAccountId: string;
};
export type PlacedCheckoutResultDto = {
  kind: 'placed';
  orderId: string;
  orderRef: string;
  accessToken: string;
  subtotalCents: number;
  totalCents: number;
  currency: string;
};
export type CheckoutResultDto = CardCheckoutResultDto | PlacedCheckoutResultDto;
export type ComboChoiceInput = {
  groupId: string;
  productId: string;
  selectedVariantOptionId?: string;
  selectedAddonOptionIds?: string[];
};
export type CheckoutItemDto = {
  productId: string;
  quantity: number;
  selectedVariantOptionId?: string;
  selectedAddonOptionIds?: string[];
  expectedUnitPriceCents?: number;
  comboChoices?: ComboChoiceInput[];
};
export type PaymentMethod = 'card';
export type CustomerAddress = {
  street: string;
  postcode: string;
  city: string;
  country: string;
};
export type LegalRevisions = {
  terms: number;
  withdrawal: number;
};
export type CheckoutRequestDto = {
  shopId: string;
  items: CheckoutItemDto[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNotes?: string;
  fulfilmentMode?: FulfilmentMode;
  paymentMethod?: PaymentMethod;
  customerAddress?: CustomerAddress;
  deliveryAddress?: DeliveryAddress;
  expectedDeliveryFeeCents?: number;
  table?: string;
  scheduledFor?: string;
  discountCode?: string;
  expectedDiscountCents?: number;
  loyaltyOptIn?: boolean;
  replacesOrderId?: string;
  replacesAccessToken?: string;
  idempotencyKey?: string;
  language?: string;
  legalRevisions?: LegalRevisions;
  ageConfirmedAt?: string;
};
export type LineStatus =
  'ok' | 'price_changed' | 'unavailable' | 'invalid_options';
export type QuoteLineDto = {
  index: number;
  productId: string;
  name: string | null;
  quantity: number;
  status: LineStatus;
  unitPriceCents: number | null;
  expectedUnitPriceCents: number | null;
  lineTotalCents: number | null;
};
export type TimeLimitedLineDto = {
  index: number;
  servedNow: boolean;
  servedLater: boolean;
};
export type DiscountProblem =
  | 'unknown'
  | 'not_started'
  | 'expired'
  | 'used_up'
  | 'already_used'
  | 'minimum'
  | 'too_small';
export type BasketQuoteDto = {
  currency: string;
  fulfilmentMode: FulfilmentMode;
  scheduleHorizonDays: number;
  lines: QuoteLineDto[];
  subtotalCents: number;
  deliveryFeeCents: number | null;
  totalCents: number;
  postcodeServed: boolean | null;
  taxCents: number;
  minOrderAmountCents: number;
  belowMinimum: boolean;
  openNow: boolean;
  paymentMethods: PaymentMethod[];
  addressRequired: boolean;
  prepMinutes: number;
  orderLimitReached: boolean;
  slots: string[];
  scheduledFor: string | null;
  slotAvailable: boolean | null;
  servedNow: boolean;
  timeLimited: TimeLimitedLineDto[];
  acceptsCodes: boolean;
  discount: {
    kind: OrderDiscountKind;
    code: string;
    cents: number;
  } | null;
  discountProblem: DiscountProblem | null;
  discountMinSubtotalCents: number | null;
  loyalty: {
    everyOrders: number;
    rewardCents: number;
  } | null;
};
export type QuoteBasketRequestDto = {
  shopId: string;
  items: CheckoutItemDto[];
  fulfilmentMode?: FulfilmentMode;
  language?: string;
  postcode?: string;
  scheduledFor?: string;
  discountCode?: string;
};
export type OrdersAutoPaused = {
  missedOrders: number;
  at: string;
};
export type ShopRoleKey = 'owner' | 'manager' | 'staff';
export type ShopPermission =
  | 'view_orders'
  | 'manage_menu'
  | 'manage_stock'
  | 'manage_shop'
  | 'manage_staff'
  | 'manage_billing'
  | 'view_audit'
  | 'refund_orders'
  | 'view_reports';
export type ShopBranding = {
  logoUrl: string | null;
  heroImageUrl: string | null;
  accentColor: string | null;
  showHero?: boolean;
};
export type WeeklyHours = {
  mon: {
    open: string;
    close: string;
  }[];
  tue: {
    open: string;
    close: string;
  }[];
  wed: {
    open: string;
    close: string;
  }[];
  thu: {
    open: string;
    close: string;
  }[];
  fri: {
    open: string;
    close: string;
  }[];
  sat: {
    open: string;
    close: string;
  }[];
  sun: {
    open: string;
    close: string;
  }[];
};
export type DeliveryZone = {
  postcode: string;
  feeCents: number;
  minOrderCents: number;
};
export type OrderSettings = {
  autoRejectMinutes: number;
  alertEmail: string | null;
  autoAccept: boolean;
  dineIn: boolean;
  autoAcceptHours: WeeklyHours | null;
  prepMinutes: {
    collection: number;
    delivery: number;
    dine_in: number;
  };
  lastOrdersMinutes: number | null;
  busyExtraMinutes: number;
  delivery: boolean;
  deliveryHours: WeeklyHours | null;
  deliveryZones: DeliveryZone[];
  deliveryFeeTaxClassId: string | null;
  scheduledOrders: boolean;
  slotCapacity: number | null;
};
export type GetShopResultDto = {
  id: string;
  slug: string;
  name: string;
  isDeleted: boolean;
  deletedAt?: string;
  isPaused: boolean;
  pausedMessage?: string;
  ordersPaused: boolean;
  ordersPausedUntil: string | null;
  ordersAutoPaused: OrdersAutoPaused | null;
  ordersPausedMessage?: string;
  isOffline: boolean;
  offlineBySuperadmin: boolean;
  offlineBySuperadminReason?: string;
  orderAcceptanceMode: string;
  currency: string;
  timezone: string;
  minOrderAmountCents: number;
  addressLocked: boolean;
  address: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  openingHours: {
    mon: {
      open: string;
      close: string;
    }[];
    tue: {
      open: string;
      close: string;
    }[];
    wed: {
      open: string;
      close: string;
    }[];
    thu: {
      open: string;
      close: string;
    }[];
    fri: {
      open: string;
      close: string;
    }[];
    sat: {
      open: string;
      close: string;
    }[];
    sun: {
      open: string;
      close: string;
    }[];
  };
  closures: {
    id: string;
    start: string;
    end: string;
    reason?: string;
  }[];
  callerRole: (ShopRoleKey | 'superadmin') | null;
  callerPermissions: ShopPermission[];
  countryCode: string;
  menuLanguages: MenuLanguage[];
  branding: ShopBranding | null;
  pendingNameChange: {
    requestedName: string;
    requestedSlug: string;
    requestedBy: string;
    requestedAt: string;
  } | null;
  stripe: {
    connectAccountId: string | null;
    connectOnboardingStatus: ('not_started' | 'pending' | 'complete') | null;
  } | null;
  orderSettings: OrderSettings;
  scheduleHorizonDays: number;
  createdAt: string;
  updatedAt: string;
};
export type CatalogCategoryScheduleDto = {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
};
export type CatalogLabelDto = {
  id: string;
  label: string;
};
export type CatalogAdditiveDto = {
  id: string;
  code: number;
  label: string;
};
export type CatalogOptionDto = {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
  allergens: CatalogLabelDto[];
  additives: CatalogAdditiveDto[];
  category: string | null;
};
export type CatalogVariantGroupDto = {
  id: string;
  name: string;
  options: CatalogOptionDto[];
};
export type CatalogAddonGroupDto = {
  id: string;
  name: string;
  minSelectable: number;
  maxSelectable: number;
  options: CatalogOptionDto[];
};
export type CatalogComboDto = {
  groups: {
    id: string;
    name: string;
    productIds: string[];
  }[];
};
export type CatalogProductDto = {
  id: string;
  name: string;
  description: string;
  price: number;
  offerPrice?: number | null;
  offerLabel?: string | null;
  images: {
    id: string;
    url: string;
    alt?: string;
    sortOrder: number;
  }[];
  variants: CatalogVariantGroupDto[];
  addons: CatalogAddonGroupDto[];
  isAvailable: boolean;
  allergens: CatalogLabelDto[];
  additives: CatalogAdditiveDto[];
  dietaryTags: CatalogLabelDto[];
  spice: CatalogLabelDto | null;
  unavailableModes: FulfilmentMode[];
  ageRestricted: boolean;
  availableNow: boolean;
  combo: CatalogComboDto | null;
  createdAt: string;
  updatedAt: string;
};
export type CatalogCategoryDto = {
  id: string;
  name: string;
  sortOrder: number;
  icon?: string;
  availableNow: boolean;
  schedule: CatalogCategoryScheduleDto | null;
  products: CatalogProductDto[];
};
export type CatalogProductScheduleDto = {
  startDate: string;
  endDate: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
};
export type CatalogOtherTimeDishDto = {
  id: string;
  name: string;
  price: number;
  schedule: CatalogProductScheduleDto;
};
export type GetCatalogResultDto = {
  language: MenuLanguage;
  languages: MenuLanguage[];
  categories: CatalogCategoryDto[];
  otherTimeDishes: CatalogOtherTimeDishDto[];
};
export type PublicShopBrandingDto = {
  logoUrl: string | null;
  heroImageUrl: string | null;
  accentColor: string | null;
  showHero: boolean;
};
export type PublicShopSummaryDto = {
  id: string;
  slug: string;
  name: string;
  address: {
    city: string | null;
    postcode: string | null;
  };
  branding: PublicShopBrandingDto | null;
  openingHours: {
    mon?: {
      open: string;
      close: string;
    }[];
    tue?: {
      open: string;
      close: string;
    }[];
    wed?: {
      open: string;
      close: string;
    }[];
    thu?: {
      open: string;
      close: string;
    }[];
    fri?: {
      open: string;
      close: string;
    }[];
    sat?: {
      open: string;
      close: string;
    }[];
    sun?: {
      open: string;
      close: string;
    }[];
  };
  timezone: string;
  ordersPaused: boolean;
  closures: {
    id: string;
    start: string;
    end: string;
    reason?: string;
  }[];
};
export type GetPublicShopsResultDto = {
  shops: PublicShopSummaryDto[];
};
export type GetShopBySlugResultDto = {
  id: string;
  slug: string;
  name: string;
  isDeleted: boolean;
  isPaused: boolean;
  pausedMessage?: string;
  ordersPaused: boolean;
  ordersPausedUntil: string | null;
  ordersPausedMessage?: string;
  isOffline: boolean;
  orderAcceptanceMode: string;
  currency: string;
  timezone: string;
  minOrderAmountCents: number;
  address: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  phone: string | null;
  openingHours: {
    mon: {
      open: string;
      close: string;
    }[];
    tue: {
      open: string;
      close: string;
    }[];
    wed: {
      open: string;
      close: string;
    }[];
    thu: {
      open: string;
      close: string;
    }[];
    fri: {
      open: string;
      close: string;
    }[];
    sat: {
      open: string;
      close: string;
    }[];
    sun: {
      open: string;
      close: string;
    }[];
  };
  closures: {
    id: string;
    start: string;
    end: string;
    reason?: string;
  }[];
  branding: ShopBranding | null;
  countryCode: string;
  fulfilment: {
    modes: FulfilmentMode[];
    prepMinutes: {
      collection: number;
      delivery: number;
      dine_in: number;
    };
    delivery: {
      zones: DeliveryZone[];
      hours: WeeklyHours | null;
    } | null;
  };
  orderLimitReached: boolean;
  createdAt: string;
  updatedAt: string;
};
export type ImpressumLine = {
  label: string;
  value: string;
};
export type LegalTextDto = {
  text: string;
  revision: number;
  updatedAt: string;
};
export type LegalSection = {
  heading: string;
  paragraphs: string[];
};
export type PrivacyNotice = {
  templateVersion: string;
  isDraft: boolean;
  sections: LegalSection[];
};
export type PublicLegalPackDto = {
  slug: string;
  shopName: string;
  language: MenuLanguage;
  impressum: {
    lines: ImpressumLine[];
  } | null;
  terms: LegalTextDto | null;
  withdrawal: LegalTextDto | null;
  privacyNotice: PrivacyNotice | null;
  seller: {
    legalName: string;
    phone: string | null;
  };
  platform: {
    name: string;
    salesSiteUrl: string | null;
  };
};
export const {
  useCancelCustomerOrderMutation,
  useViewCustomerDocumentMutation,
  useViewCustomerOrderQuery,
  useGetPlatformLegalQuery,
  useCreateOrderMutation,
  useQuoteBasketQuery,
  useGetShopByIdQuery,
  useGetCatalogQuery,
  useListPublicShopsQuery,
  useGetShopBySlugQuery,
  useGetPublicLegalPackQuery,
} = injectedRtkApi;
