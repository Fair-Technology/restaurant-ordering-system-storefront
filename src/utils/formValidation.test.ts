import { describe, expect, it } from 'vitest';
import { isValidEmail } from './formValidation';

describe('isValidEmail', () => {
  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
  });
  it('rejects a missing @', () => {
    expect(isValidEmail('anna.example.com')).toBe(false);
  });
  it('rejects a missing domain dot', () => {
    expect(isValidEmail('anna@example')).toBe(false);
  });
  it('accepts a valid address, ignoring surrounding whitespace', () => {
    expect(isValidEmail('anna@example.com')).toBe(true);
    expect(isValidEmail('  anna@example.com ')).toBe(true);
  });
});
