import { useEffect, useMemo } from 'react';
import { ShopPageSkeleton } from '../../shared/Skeletons';
import { useParams, useNavigate } from 'react-router-dom';
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
import { setActiveShop, setMenuLanguage } from '../../store/slices/shopSlice';
import {
  resolveShopBranding,
  type ShopWithBranding,
} from '../../utils/branding';
import { slugifyCategoryName, mapApiProductToProduct } from '../../utils/catalogMapper';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { initialMenuLanguage } from '../../utils/menuLanguage';

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
      dispatch(setActiveShop({ shopId: resolvedShopId }));
    }
  }, [dispatch, resolvedShopId]);

  const storedMenuLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = storedMenuLanguage ?? initialMenuLanguage(navigator.language);

  const { data: catalogData } = useGetCatalogQuery(
    { shopId: resolvedShopId, lang },
    { skip: !resolvedShopId },
  );

  // Filter out empty/unavailable categories and sort by sortOrder
  const visibleCategories = useMemo(
    () =>
      (catalogData?.categories ?? [])
        .filter((cat) => cat.name && (cat.products?.length ?? 0) > 0)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [catalogData]
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

  const resolvedLanguage = catalogData?.language ?? lang;

  // Group available products by category slug, mapping API DTOs to Product type
  const groupedItems = useMemo<Record<string, Product[]>>(() => {
    const grouped: Record<string, Product[]> = {};
    visibleCategories.forEach((cat) => {
      const id = slugifyCategoryName(cat.name!);
      grouped[id] = (cat.products ?? [])
        .filter((p) => p.isAvailable !== false)
        .map((p) => mapApiProductToProduct(p, cat, resolvedLanguage));
    });
    return grouped;
  }, [visibleCategories, resolvedLanguage]);

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
      <HeroSection heroImageUrl={resolvedBranding.heroImageUrl} />
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
