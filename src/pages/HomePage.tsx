import { Link } from 'react-router';
import { useGetShopsQuery } from '../api/endpoints';
import ShopLogo from '../shared/ShopLogo';
import { resolveShopBranding } from '../utils/branding';

const HomePage = () => {
  const { data, isLoading, isError } = useGetShopsQuery();
  const shops = data?.shops ?? [];

  return (
    <div className="min-h-screen w-full bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold text-gray-900 text-center">
          Welcome to Online Ordering System
        </h1>
        <p className="mt-3 text-center text-gray-600 max-w-xl mx-auto">
          Browse and order from your favorite storefronts.
        </p>

        {/* data-testid="shop-list-section" — labels this whole section so tests can find it */}
        <div className="mt-10" data-testid="shop-list-section">
          {isLoading && (
            // data-testid="loading-indicator" — tests can assert a spinner/message appears while loading
            <p
              className="text-center text-gray-500"
              data-testid="loading-indicator"
            >
              Loading shops…
            </p>
          )}

          {isError && (
            // data-testid="error-message" — tests can assert the error state renders correctly
            <p className="text-center text-red-500" data-testid="error-message">
              Failed to load shops.
            </p>
          )}

          {!isLoading && !isError && shops.length === 0 && (
            // data-testid="empty-state" — tests can assert the empty state renders when there are no shops
            <p className="text-center text-gray-500" data-testid="empty-state">
              No shops available.
            </p>
          )}

          {!isLoading && !isError && shops.length > 0 && (
            // data-testid="shop-grid" — labels the grid container so tests can find all shop cards inside it
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6"
              data-testid="shop-grid"
            >
              {shops.map((shop) => {
                const branding = resolveShopBranding(shop.branding);
                return (
                  <Link
                    key={shop.id}
                    to={`/shops/${shop.slug}`}
                    // data-testid="shop-card" — each shop card gets this label
                    // Tests can do: page.locator('[data-testid="shop-card"]') to get ALL cards
                    // Or: page.locator('[data-testid="shop-card"]').first() for just the first one
                    data-testid="shop-card"
                    className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <ShopLogo
                      name={shop.name ?? ''}
                      logoUrl={branding.logoUrl}
                      accentColor={branding.accentColor}
                      className="h-16 w-16 rounded-full bg-gray-100"
                      logoClassName="h-16 w-16"
                      wideClassName="h-16 w-auto max-w-64"
                      textClassName="text-lg"
                    />
                    {/* data-testid="shop-name" — lets tests check the shop name text */}
                    <span
                      className="mt-4 text-center text-sm font-medium text-gray-800"
                      data-testid="shop-name"
                    >
                      {shop.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
