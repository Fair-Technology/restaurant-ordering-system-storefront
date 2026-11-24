import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'mewmew_lang_v1';

function makeStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
    ...overrides,
  } as Storage;
}

async function freshSlice() {
  vi.resetModules();
  return import('./shopSlice');
}

describe('shopSlice language persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('setMenuLanguage writes the choice under mewmew_lang_v1', async () => {
    const { shopReducer, setMenuLanguage } = await freshSlice();
    const state = shopReducer(undefined, setMenuLanguage('de'));
    expect(state.menuLanguage).toBe('de');
    expect(localStorage.getItem(KEY)).toBe('de');
  });

  it('a fresh slice starts from the stored choice', async () => {
    localStorage.setItem(KEY, 'de');
    const { shopReducer } = await freshSlice();
    expect(shopReducer(undefined, { type: 'init' }).menuLanguage).toBe('de');
  });

  it('starts null when nothing is stored', async () => {
    const { shopReducer } = await freshSlice();
    expect(shopReducer(undefined, { type: 'init' }).menuLanguage).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', async () => {
    vi.stubGlobal(
      'localStorage',
      makeStorage({
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
      }),
    );
    const { shopReducer, setMenuLanguage } = await freshSlice();
    expect(() => shopReducer(undefined, setMenuLanguage('it'))).not.toThrow();
    expect(shopReducer(undefined, setMenuLanguage('it')).menuLanguage).toBe('it');
  });

  it('starts null when localStorage.getItem throws', async () => {
    vi.stubGlobal(
      'localStorage',
      makeStorage({
        getItem: () => {
          throw new Error('SecurityError');
        },
      }),
    );
    const { shopReducer } = await freshSlice();
    expect(shopReducer(undefined, { type: 'init' }).menuLanguage).toBeNull();
  });
});
