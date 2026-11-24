const OLD_PREFIX = 'mewmew_cart_v1:';
const NEW_PREFIX = 'cart_v1:';
// Cart for a shop slug that was renamed (now `ma-pasta`); genuinely orphaned, so dropped.
const STALE_KEYS = ['mewmew_cart_v1:mapasta'];

/**
 * One-time startup migration: moves carts from the legacy `mewmew_cart_v1:*`
 * keys to `cart_v1:*` and deletes known-orphaned keys. Never overwrites an
 * existing new-style key. Safe to call repeatedly (idempotent).
 */
export function migrateLegacyCartKeys(): void {
  try {
    // Snapshot first: don't mutate storage while iterating its live keys.
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      try {
        if (STALE_KEYS.includes(key)) {
          localStorage.removeItem(key);
          continue;
        }
        if (!key.startsWith(OLD_PREFIX)) continue;
        const newKey = NEW_PREFIX + key.slice(OLD_PREFIX.length);
        const value = localStorage.getItem(key);
        if (value !== null && localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, value);
        }
        localStorage.removeItem(key);
      } catch {
        // storage unavailable or full; skip this key
      }
    }
  } catch {
    // localStorage may throw (e.g. private browsing); nothing to migrate
  }
}
