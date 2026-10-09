import type { DiscountProblem } from '../api/orderEndpoints';
import type { OrderCopy } from './orderCopy';

const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

/** The code as the server will read it, or null while the box holds nothing usable. */
export function normaliseCodeInput(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** The diner-facing sentence for a problem. */
export function discountProblemText(problem: DiscountProblem, copy: OrderCopy, minimum: string): string {
  switch (problem) {
    case 'unknown':
      return copy.codeUnknown;
    case 'not_started':
      return copy.codeNotStarted;
    case 'expired':
      return copy.codeExpired;
    case 'used_up':
      return copy.codeUsedUp;
    case 'already_used':
      return copy.codeAlreadyUsed;
    case 'minimum':
      return copy.codeMinimum(minimum);
    case 'too_small':
      return copy.codeTooSmall;
  }
}
