/** True when the trimmed value is empty — the one definition of "blank" for a required text field. */
export function isBlank(value: string): boolean {
  return value.trim() === '';
}

/** Same charset/length rule rs-backend enforces for customerPhone: digits, spaces, + - ( ) . only, 6-15 digits. */
export function isPlausiblePhone(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > 30) return false;
  if (!/^[0-9+\-().\s]+$/.test(trimmed)) return false;
  const digitCount = trimmed.replace(/\D/g, '').length;
  return digitCount >= 6 && digitCount <= 15;
}

/** Same pattern rs-backend uses for email addresses. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
