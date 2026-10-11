/**
 * The two fixed picture shapes the shop shows. Owners crop to these in admin and the backend
 * only accepts exactly these pixel sizes, so the storefront can lay them out without guessing.
 * Tailwind classes in the components express the same ratios (aspect-[2/1], aspect-[3/1],
 * aspect-[4/3]); change them together.
 */

/** Shop cover banner: 3:1 stored at 1920 x 640. */
export const COVER_IMAGE = {
  width: 1920,
  height: 640,
  /** Shown on desktop and tablets (sm and up) */
  ratio: 3,
  /** Phones show the centre 2:1 part of the banner (the middle 1280 x 640) */
  phoneRatio: 2,
} as const;

/** Dish photo: 4:3 stored at 1200 x 900. */
export const DISH_IMAGE = {
  width: 1200,
  height: 900,
  ratio: 4 / 3,
} as const;
