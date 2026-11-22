import { describe, expect, it } from 'vitest';
import { toCents } from './money';

describe('toCents', () => {
  it('rounds binary floating-point error to the intended cent', () => {
    // 4.35 * 100 === 434.99999999999994 in IEEE doubles
    expect(toCents(4.35)).toBe(435);
    expect(toCents(0.29)).toBe(29);
    expect(toCents(1.15)).toBe(115);
  });
  it('returns an integer for ordinary amounts', () => {
    expect(toCents(13.05)).toBe(1305);
    expect(Number.isInteger(toCents(19.99))).toBe(true);
  });
});
