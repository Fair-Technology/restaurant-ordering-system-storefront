import type { CustomerAddress } from '../api/orderEndpoints';

/** All fields empty → null (no address); all filled → trimmed address; anything between → 'incomplete'. */
export function addressFromForm(f: CustomerAddress): CustomerAddress | null | 'incomplete' {
  const address = {
    street: f.street.trim(),
    postcode: f.postcode.trim(),
    city: f.city.trim(),
    country: f.country.trim(),
  };
  const filled = Object.values(address).filter((v) => v !== '').length;
  if (filled === 0) return null;
  return filled === 4 ? address : 'incomplete';
}
