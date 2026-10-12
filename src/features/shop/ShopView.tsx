import { useEffect, useMemo, useState } from 'react';
import { ShopPageSkeleton } from '../../shared/Skeletons';
import NotFound from '../../pages/NotFound';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import HeroSection from '../../shared/HeroSection';
import CategoryFilterBar from '../menu/CategoryFilterBar';
import LanguageSwitcher from '../menu/LanguageSwitcher';
import MenuList from '../menu/MenuList';
import Footer from '../../shared/Footer';
import {
  useGetShopBySlugQuery,
  useGetShopByIdQuery,
  useGetCatalogQuery,
} from '../../api/endpoints';
import NavBar from '../../shared/NavBar';
import { Product } from '../../types/Product';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveShop, setMenuLanguage, setResolvedMenuLanguage, type FulfilmentMode } from '../../store/slices/shopSlice';
import FulfilmentModeBar from './FulfilmentModeBar';
import DeliveryPostcodeBox from './DeliveryPostcodeBox';
import ShopInfoFooter from './ShopInfoFooter';
import ShopIntro from './ShopIntro';
import MobileCartBar from './MobileCartBar';
import LogoLoader from '../../shared/LogoLoader';
import { nextOpening, openState, type WeeklyHours } from '../../utils/openingHours';
import ShopNoticeModal from './ShopNoticeModal';
import { orderCopy } from '../../utils/orderCopy';
import type { ShopFulfilment, ShopNoticeFields } from '../../api/orderEndpoints';
import {
  resolveShopBranding,
  type ShopWithBranding,
} from '../../utils/branding';
import {
  slugifyCategoryName,
  mapApiProductToProduct,
  resolveCombo,
  type CatalogProductWithOffer,
} from '../../utils/catalogMapper';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { currentChoice, pageLanguageOf, pickerCurrent, pickerLanguages } from '../../utils/pageLanguage';
import { useTableSession } from '../../hooks/useTableSession';
import { normaliseTableNumber } from '../../utils/tableSession';
import { useDeliverySession } from '../../hooks/useDeliverySession';
import { useMoney } from '../../hooks/useMoney';
import { chosenMode, zoneFor } from '../../utils/delivery';

type CategoryOption = { id: string; label: string; count: number; icon?: string };

/**
 * ShopView — The main menu browsing page for a single shop.
 *
 * Data flow:
 * 1. Fetches shop data by slug (URL) or by ID (Redux store fallback).
 * 2. Fetches the shop's product catalog once the shop ID is resolved.
 * 3. Maps API DTOs to the internal Product type via catalogMapper utils.
 * 4. Applies shop branding via the useBrandingStyle hook.
 */
const ShopView = () => {
  const navigate = useNavigate();
  const { shopId: routeShopId, slug } = useParams<{
    shopId?: string;
    slug?: string;
  }>();
  const dispatch = useAppDispatch();
  const storedShopId = useAppSelector((state) => state.shop.activeShopId);

  // Determine whether to fetch by slug (URL) or by ID (stored/route param)
  const shouldFetchBySlug = Boolean(slug);
  const shopIdLookup = shouldFetchBySlug
    ? ''
    : routeShopId ?? storedShopId ?? '';

  const {
    data: shopDataBySlug,
    isLoading: isSlugLoading,
    isError: isSlugError,
    error: slugError,
  } = useGetShopBySlugQuery(slug ?? '', {
    skip: !shouldFetchBySlug,
  });
  const { data: shopDataById, isLoading: isIdLoading } = useGetShopByIdQuery(shopIdLookup, {
    skip: !shopIdLookup,
  });

  const resolvedShopData = (shouldFetchBySlug
    ? shopDataBySlug
    : shopDataById) as ShopWithBranding | undefined;

  const resolvedShopId = (shouldFetchBySlug
    ? shopDataBySlug?.id
    : shopDataById?.id) ?? '';
  const resolvedBranding = resolveShopBranding(resolvedShopData?.branding);
  const shopName = resolvedShopData?.name ?? 'Online Ordering';

  // Apply CSS custom properties and get page wrapper style
  const brandStyle = useBrandingStyle(resolvedBranding);

  // Persist the resolved shop ID to Redux so other pages can reference it
  useEffect(() => {
    if (resolvedShopId) {
      dispatch(setActiveShop({ shopId: resolvedShopId, currency: resolvedShopData?.currency }));
    }
  }, [dispatch, resolvedShopId, resolvedShopData?.currency]);

  const storedMenuLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = currentChoice(storedMenuLanguage, navigator.language);

  // Offline shops refuse the catalog (403), so don't ask for it
  const shopIsOffline = (resolvedShopData as ShopNoticeFields | undefined)?.isOffline === true;
  const { data: catalogData, isLoading: isCatalogLoading } = useGetCatalogQuery(
    { shopId: resolvedShopId, lang },
    { skip: !resolvedShopId || shopIsOffline },
  );

  // Two separate things: the language the menu came back in, and the language of the page's own text
  const resolvedLanguage = catalogData?.language ?? lang;
  const pageLanguage = pageLanguageOf(lang);
  const offeredLanguages = pickerLanguages(catalogData?.languages);

  // Remember the language the menu actually came back in, for price formatting
  useEffect(() => {
    if (catalogData?.language) dispatch(setResolvedMenuLanguage(catalogData.language));
  }, [dispatch, catalogData?.language]);

  const fulfilment = (resolvedShopData as { fulfilment?: ShopFulfilment } | undefined)?.fulfilment;
  const orderLimitReached =
    (resolvedShopData as { orderLimitReached?: boolean } | undefined)?.orderLimitReached === true;
  // Dine in is never offered as a choice: it only exists once a table QR code was scanned.
  const visibleModes: FulfilmentMode[] = (fulfilment?.modes ?? ['collection']).filter((m) => m !== 'dine_in');
  const dineInOn = (fulfilment?.modes ?? []).includes('dine_in');
  const [searchParams] = useSearchParams();
  const scanned = searchParams.get('t');
  const { table, bind, unbind } = useTableSession(slug, dineInOn);
  const { postcode: deliveryPostcode, choose: chooseDelivery, clear: clearDelivery } = useDeliverySession(slug);
  const [askingPostcode, setAskingPostcode] = useState(false);
  const mode = chosenMode({ table, deliveryPostcode, modes: fulfilment?.modes ?? ['collection'] });
  const barSelected: FulfilmentMode = mode === 'delivery' || askingPostcode ? 'delivery' : 'collection';
  const money = useMoney();
  // How this order will be handed over, for the line at the top of the cart
  const deliveryZone =
    mode === 'delivery' && deliveryPostcode ? zoneFor(fulfilment?.delivery?.zones ?? [], deliveryPostcode) : null;
  const cartContext = {
    mode,
    postcode: deliveryPostcode,
    table,
    minOrder: deliveryZone ? deliveryZone.minOrderCents / 100 : null,
    fee: deliveryZone ? deliveryZone.feeCents / 100 : null,
    minutes: fulfilment?.prepMinutes?.[mode] ?? null,
  };
  const [tableInvalid, setTableInvalid] = useState(false);
  useEffect(() => {
    if (!slug || scanned === null || !fulfilment || !dineInOn) return; // dine-in off: ?t= is ignored
    const label = normaliseTableNumber(scanned);
    if (label) {
      bind(label);
      setTableInvalid(false);
    } else {
      unbind();
      setTableInvalid(true);
    }
    navigate(`/shops/${slug}`, { replace: true }); // the tab session is the one source of truth
  }, [slug, scanned, fulfilment, dineInOn, bind, unbind, navigate]);

  // Closed, paused or offline: a popup over the page instead of a banner pushing the menu down
  const openingHours = (resolvedShopData as { openingHours?: WeeklyHours } | undefined)?.openingHours;
  const shopTimeZone = (resolvedShopData as { timeZone?: string } | undefined)?.timeZone;
  const noticeFields = (resolvedShopData ?? {}) as ShopNoticeFields;
  // Offline: the owner or the platform took the shop off the web. Nothing of the menu is shown.
  const isOffline = noticeFields.isOffline === true;
  // Paused: the owner stopped new orders for now (optional message of their own), or the monthly limit is used up
  const ordersPaused = noticeFields.ordersPaused === true || orderLimitReached;
  const ordersPausedMessage = noticeFields.ordersPausedMessage?.trim();
  const noticeKind: 'offline' | 'paused' | 'closed' | null = isOffline
    ? 'offline'
    : ordersPaused
      ? 'paused'
      : openingHours && !openState(openingHours, new Date(), shopTimeZone).open
        ? 'closed'
        : null;
  // Only the "closed" popup is remembered per visit. Paused shows on every page load; offline cannot be closed.
  const noticeKey = slug && noticeKind === 'closed' ? `shop_notice_seen_v1:${slug}:${noticeKind}` : null;
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const [pausedClosed, setPausedClosed] = useState(false);
  const noticeSeen = (() => {
    if (noticeKind === 'paused') return pausedClosed;
    if (!noticeKey) return noticeKind !== 'offline';
    if (dismissedNotice === noticeKey) return true;
    try {
      return sessionStorage.getItem(noticeKey) === '1';
    } catch {
      return false;
    }
  })();
  const dismissNotice = () => {
    if (noticeKind === 'paused') {
      setPausedClosed(true);
      return;
    }
    if (!noticeKey) return;
    try {
      sessionStorage.setItem(noticeKey, '1');
    } catch {
      // private mode: it just shows again next visit
    }
    setDismissedNotice(noticeKey);
  };
  // Dishes a combo may offer right now: not a combo, on the menu, and offered for this mode
  const dishes = useMemo(
    () =>
      new Map(
        (catalogData?.categories ?? []).flatMap((cat) =>
          (cat.products ?? [])
            .filter(
              (p) =>
                !(p as CatalogProductWithOffer).combo &&
                p.isAvailable !== false &&
                !(p.unavailableModes ?? []).includes(mode),
            )
            .map((p) => [p.id!, mapApiProductToProduct(p, cat, resolvedLanguage)] as const),
        ),
      ),
    [catalogData, mode, resolvedLanguage],
  );

  // Filter out dishes not offered for this way of ordering, combos with an empty choice, empty categories, and sort by sortOrder
  const visibleCategories = useMemo(
    () =>
      (catalogData?.categories ?? [])
        .map((cat) => ({
          ...cat,
          products: (cat.products ?? []).filter(
            (p) =>
              !(p.unavailableModes ?? []).includes(mode) &&
              (!(p as CatalogProductWithOffer).combo ||
                resolveCombo(p as CatalogProductWithOffer, dishes) !== null),
          ),
        }))
        .filter((cat) => cat.name && cat.products.length > 0)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [catalogData, mode, dishes]
  );

  // Build the list of category filter options from visible categories
  const categories = useMemo<CategoryOption[]>(
    () =>
      visibleCategories.map((cat) => ({
        id: slugifyCategoryName(cat.name!),
        label: cat.name!,
        count: cat.products?.length ?? 0,
        icon: cat.icon ?? undefined,
      })),
    [visibleCategories]
  );

  // Map category slugs to their icon name (for MenuList section headers)
  const categoryIcons = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        visibleCategories
          .filter((cat) => cat.icon)
          .map((cat) => [slugifyCategoryName(cat.name!), cat.icon!])
      ),
    [visibleCategories]
  );

  const copy = orderCopy(pageLanguage);

  // Group available products by category slug, mapping API DTOs to Product type
  const groupedItems = useMemo<Record<string, Product[]>>(() => {
    const grouped: Record<string, Product[]> = {};
    visibleCategories.forEach((cat) => {
      const id = slugifyCategoryName(cat.name!);
      grouped[id] = (cat.products ?? [])
        .filter((p) => p.isAvailable !== false)
        .map((p) => ({
          ...mapApiProductToProduct(p, cat, resolvedLanguage),
          ...((p as CatalogProductWithOffer).combo
            ? { combo: resolveCombo(p as CatalogProductWithOffer, dishes)! }
            : {}),
        }));
    });
    return grouped;
  }, [visibleCategories, resolvedLanguage, dishes]);

  const categoryLabels = useMemo(() => {
    return categories.reduce<Record<string, string>>((acc, category) => {
      acc[category.id] = category.label;
      return acc;
    }, {});
  }, [categories]);

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, category) => {
      acc[category.id] = category.count;
      return acc;
    }, {});
  }, [categories]);

  const isLoading = shouldFetchBySlug ? isSlugLoading : isIdLoading;

  if (isLoading) {
    return <ShopPageSkeleton />;
  }

  if (
    shouldFetchBySlug &&
    isSlugError &&
    slugError &&
    'status' in slugError &&
    slugError.status === 404
  ) {
    return <NotFound kind="shop" />;
  }

  // One switcher element, placed in the nav bar from sm up and in the shop intro on phones
  const languageSwitcher = (
    <LanguageSwitcher
      languages={offeredLanguages}
      current={pickerCurrent(lang, offeredLanguages)}
      onChange={(l) => dispatch(setMenuLanguage(l))}
    />
  );

  return (
    <div className="bg-white min-h-screen" style={brandStyle}>
      <div className="sticky top-0 z-50">
        <NavBar
          shopName={shopName}
          shopId={slug ?? ''}
          logoUrl={resolvedBranding.logoUrl}
          onCheckout={() => navigate(`/shops/${slug}/checkout`)}
          languageSwitcher={languageSwitcher}
          cartContext={cartContext}
        />
      </div>
      {resolvedBranding.showHero && <HeroSection heroImageUrl={resolvedBranding.heroImageUrl} />}
      <ShopIntro
        name={shopName}
        logoUrl={resolvedBranding.logoUrl}
        address={(resolvedShopData as { address?: { street?: string; postcode?: string; city?: string } } | undefined)?.address}
        openingHours={(resolvedShopData as { openingHours?: WeeklyHours } | undefined)?.openingHours}
        timeZone={(resolvedShopData as { timeZone?: string } | undefined)?.timeZone}
        pickupMinutes={visibleModes.includes('collection') ? fulfilment?.prepMinutes?.collection : null}
        overlapsHero={resolvedBranding.showHero}
        languageSwitcher={languageSwitcher}
        copy={copy}
      />
      {noticeKind && !noticeSeen && (
        <ShopNoticeModal
          kind={noticeKind}
          title={
            noticeKind === 'offline'
              ? copy.noticeOfflineTitle
              : noticeKind === 'paused'
                ? copy.noticePausedTitle
                : copy.noticeClosedTitle
          }
          dismissible={noticeKind !== 'offline'}
          lines={
            noticeKind === 'offline'
              ? [copy.noticeOfflineText]
              : noticeKind === 'paused'
                ? [ordersPausedMessage || copy.noticePausedText]
                : [
                  ...(() => {
                    const next = openingHours ? nextOpening(openingHours, new Date(), shopTimeZone) : null;
                    return next ? [copy.noticeOpensAt(next.inDays, copy.weekdayLong[next.day], next.time)] : [];
                  })(),
                  copy.noticeClosedText,
                ]
          }
          phone={noticeKind !== 'closed' ? (resolvedShopData as { phone?: string | null } | undefined)?.phone : null}
          phoneLabel={copy.noticeCallUs}
          okLabel={copy.noticeOk}
          onClose={dismissNotice}
        />
      )}
      {!isOffline && tableInvalid && (
        <p role="status" className="max-w-7xl mx-auto px-6 pt-3 text-sm text-amber-800">
          {copy.tableInvalid}
        </p>
      )}
      {isOffline ? null : table ? (
        <div className="max-w-7xl mx-auto px-6 pt-3 flex flex-wrap items-center gap-3">
          <span className="inline-block rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-900">
            {copy.tableBanner(table)}
          </span>
          <button type="button" onClick={unbind} className="text-sm text-gray-600 underline">
            {copy.leaveTable}
          </button>
        </div>
      ) : (
        <>
          <FulfilmentModeBar
            modes={visibleModes}
            selected={barSelected}
            onSelect={(m) => {
              if (m === 'delivery') {
                setAskingPostcode(true);
              } else {
                clearDelivery();
                setAskingPostcode(false);
              }
            }}
            copy={copy}
          />
          {barSelected === 'delivery' && fulfilment?.delivery && (
            <DeliveryPostcodeBox
              zones={fulfilment.delivery.zones}
              postcode={deliveryPostcode}
              deliveryMinutes={fulfilment.prepMinutes.delivery}
              onChoose={(p) => {
                chooseDelivery(p);
                setAskingPostcode(false);
              }}
              onCollect={() => {
                clearDelivery();
                setAskingPostcode(false);
              }}
              copy={copy}
              formatCents={(c) => money.cents(c)}
            />
          )}
        </>
      )}
      {isOffline ? null : isCatalogLoading ? (
        // The shop arrives before its dishes: show that the menu is still on its way
        <div
          role="status"
          data-testid="menu-loading"
          className="flex w-full flex-col items-center justify-center gap-3 py-20 text-[15px] text-[#5c524b]"
        >
          <LogoLoader logoUrl={resolvedBranding.logoUrl} name={shopName} size={96} decorative />
          {copy.loading}
        </div>
      ) : (
        <>
          <CategoryFilterBar categories={categories} />
          <div className="w-full flex items-center justify-center flex-col mt-4">
            <MenuList
              groupedItems={groupedItems}
              categoryLabels={categoryLabels}
              categoryCounts={categoryCounts}
              categoryIcons={categoryIcons}
              onAddToCart={() => {}}
            />
          </div>
        </>
      )}
      {resolvedShopData && (
        <ShopInfoFooter
          name={resolvedShopData.name ?? ''}
          address={(resolvedShopData as { address?: { street?: string; postcode?: string; city?: string } }).address}
          openingHours={(resolvedShopData as { openingHours?: WeeklyHours }).openingHours}
          deliveryHours={fulfilment?.modes.includes('delivery') ? fulfilment.delivery?.hours : null}
          phone={(resolvedShopData as { phone?: string | null }).phone}
          copy={copy}
        />
      )}
      <Footer slug={slug} flush={!!resolvedShopData} />
      {!isOffline && <MobileCartBar onCheckout={() => navigate(`/shops/${slug}/checkout`)} copy={copy} />}
    </div>
  );
};

export default ShopView;
