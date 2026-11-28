import { describe, expect, it } from 'vitest';
import { isWellFormedPostcode, postcodeFormatFor } from './delivery';

describe('postcodeFormatFor', () => {
  it('finds Germany', () => {
    expect(postcodeFormatFor('DE')?.digits).toBe(5);
    expect(postcodeFormatFor('de')?.digits).toBe(5);
  });
  it('returns null for an unknown country', () => {
    expect(postcodeFormatFor('ZZ')).toBeNull();
  });
  it('returns null for null/undefined', () => {
    expect(postcodeFormatFor(null)).toBeNull();
    expect(postcodeFormatFor(undefined)).toBeNull();
  });
});

describe('isWellFormedPostcode', () => {
  it('accepts a 5-digit German postcode', () => {
    expect(isWellFormedPostcode('12345', 'DE')).toBe(true);
    expect(isWellFormedPostcode(' 123 45 ', 'DE')).toBe(true);
  });
  it('rejects malformed German postcodes', () => {
    expect(isWellFormedPostcode('1234', 'DE')).toBe(false);
    expect(isWellFormedPostcode('123456', 'DE')).toBe(false);
    expect(isWellFormedPostcode('ABCDE', 'DE')).toBe(false);
  });
  it('skips the check for an unknown country', () => {
    expect(isWellFormedPostcode('x', 'ZZ')).toBe(true);
    expect(isWellFormedPostcode('12', null)).toBe(true);
    expect(isWellFormedPostcode('', undefined)).toBe(true);
  });
});
