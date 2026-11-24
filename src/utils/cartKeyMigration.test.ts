import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateLegacyCartKeys } from './cartKeyMigration';

// Like a real browser Storage, stored entries are enumerable own properties
// (so Object.keys(localStorage) lists them) while the methods are not.
function makeStorage(): Storage {
  const s = {} as Record<string, string>;
  const methods = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null),
    setItem: (k: string, v: string) => void (s[k] = v),
    removeItem: (k: string) => void delete s[k],
  };
  for (const [name, fn] of Object.entries(methods)) {
    Object.defineProperty(s, name, { value: fn, enumerable: false });
  }
  return s as unknown as Storage;
}

describe('migrateLegacyCartKeys', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves legacy keys, drops the stale mapasta key', () => {
    const a = JSON.stringify([{ id: 'a', quantity: 1 }]);
    localStorage.setItem('mewmew_cart_v1:shop-a', a);
    localStorage.setItem('mewmew_cart_v1:mapasta', JSON.stringify([{ id: 'x' }]));

    migrateLegacyCartKeys();

    expect(localStorage.getItem('cart_v1:shop-a')).toBe(a);
    expect(localStorage.getItem('mewmew_cart_v1:shop-a')).toBeNull();
    expect(localStorage.getItem('mewmew_cart_v1:mapasta')).toBeNull();
    expect(localStorage.getItem('cart_v1:mapasta')).toBeNull();
  });

  it('does not overwrite an existing new-style key but still removes the old one', () => {
    localStorage.setItem('cart_v1:shop-b', 'new');
    localStorage.setItem('mewmew_cart_v1:shop-b', 'old');

    migrateLegacyCartKeys();

    expect(localStorage.getItem('cart_v1:shop-b')).toBe('new');
    expect(localStorage.getItem('mewmew_cart_v1:shop-b')).toBeNull();
  });

  it('does not throw when localStorage access throws', () => {
    vi.stubGlobal('localStorage', {
      get length() {
        throw new Error('denied');
      },
    });
    expect(() => migrateLegacyCartKeys()).not.toThrow();
  });
});
