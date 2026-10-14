// This is the fake response for GET /api/shops/public
// The shape must match what the real API returns: { shops: [...] } (public fields only)

export const mockShops = {
  shops: [
    {
      id: 'shop-001',
      name: 'Burger Palace',
      slug: 'burger-palace',
      address: { city: 'Berlin', postcode: '10115' },
      branding: {
        logoUrl: 'https://placehold.co/64x64?text=BP',
        heroImageUrl: null,
        accentColor: null,
        showHero: true,
      },
      openingHours: {},
      timezone: 'Europe/Berlin',
      ordersPaused: false,
    },
    {
      id: 'shop-002',
      name: 'Pizza Heaven',
      slug: 'pizza-heaven',
      address: { city: 'Munich', postcode: '80331' },
      branding: {
        logoUrl: 'https://placehold.co/64x64?text=PH',
        heroImageUrl: null,
        accentColor: null,
        showHero: true,
      },
      openingHours: {},
      timezone: 'Europe/Berlin',
      ordersPaused: false,
    },
  ],
};

// Shortcuts — easier to use in tests than writing mockShops.shops[0] every time
export const firstMockShop = mockShops.shops[0]; //Burger Palace
export const secondMockShop = mockShops.shops[1]; //Pizza Heaven
