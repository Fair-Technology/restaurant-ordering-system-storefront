import { useEffect, useMemo, useState } from 'react';
import { ShopPageSkeleton } from '../../shared/Skeletons';
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
import { orderCopy } from '../../utils/orderCopy';
import type { ShopFulfilment } from '../../api/orderEndpoints';
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
import { initialMenuLanguage } from '../../utils/menuLanguage';
import { useTableSession } from '../../hooks/useTableSession';
import { normaliseTableNumber } from '../../utils/tableSession';
import { useDeliverySession } from '../../hooks/useDeliverySession';
import { useMoney } from '../../hooks/useMoney';
import { chosenMode } from '../../utils/delivery';

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
  const lang = storedMenuLanguage ?? initialMenuLanguage(navigator.language);

  const { data: catalogData } = useGetCatalogQuery(
    { shopId: resolvedShopId, lang },
    { skip: !resolvedShopId },
  );

  const resolvedLanguage = catalogData?.language ?? lang;

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

  const copy = orderCopy(resolvedLanguage);

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
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <h1 className="text-2xl font-semibold">Shop does not exist</h1>
      </div>
    );
  }

  return (
    <div className="bg-gray-50/60 min-h-screen" style={brandStyle}>
      <div className="sticky top-0 z-50">
        <NavBar
          shopName={shopName}
          shopId={slug ?? ''}
          logoUrl={resolvedBranding.logoUrl}
          onCheckout={() => navigate(`/shops/${slug}/checkout`)}
        />
      </div>
      {resolvedBranding.showHero && <HeroSection heroImageUrl={resolvedBranding.heroImageUrl} />}
      {orderLimitReached && (
        <p role="status" className="max-w-7xl mx-auto px-6 pt-3 text-sm font-medium text-red-700">
          {copy.orderingPaused}
        </p>
      )}
      {tableInvalid && (
        <p role="status" className="max-w-7xl mx-auto px-6 pt-3 text-sm text-amber-800">
          {copy.tableInvalid}
        </p>
      )}
      {table ? (
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
      <div className="max-w-7xl mx-auto px-6 pt-3 flex justify-end">
        <LanguageSwitcher
          languages={catalogData?.languages ?? []}
          current={resolvedLanguage}
          onChange={(l) => dispatch(setMenuLanguage(l))}
        />
      </div>
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
      <Footer slug={slug} />
    </div>
  );
};

export default ShopView;
