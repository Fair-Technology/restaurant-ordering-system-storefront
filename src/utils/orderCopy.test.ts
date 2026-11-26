import { describe, expect, it } from 'vitest';
import { orderCopy } from './orderCopy';

describe('orderCopy.statusPlacedHint', () => {
  it('en: mentions the email only when emails are enabled', () => {
    const c = orderCopy('en');
    expect(c.statusPlacedHint(true)).toBe(
      'We have emailed you a copy. You can cancel until the restaurant confirms.',
    );
    expect(c.statusPlacedHint(false)).toBe('You can cancel until the restaurant confirms.');
  });

  it('de: mentions the email only when emails are enabled', () => {
    const c = orderCopy('de');
    expect(c.statusPlacedHint(true)).toBe(
      'Wir haben Ihnen eine Kopie per E-Mail geschickt. Bis zur Bestätigung können Sie stornieren.',
    );
    expect(c.statusPlacedHint(false)).toBe('Bis zur Bestätigung können Sie stornieren.');
  });
});
