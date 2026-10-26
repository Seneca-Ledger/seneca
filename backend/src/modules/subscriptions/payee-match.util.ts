/** Lower-case letters and digits only, so "ACME-Music Inc." reads as "acmemusicinc". */
function normalizeName(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** The bank's payee looks like this vendor: one contains the other, or it has the vendor's first word. */
export function payeeMatchesVendor(vendorName: string, payee: string | null | undefined): boolean {
  const name = normalizeName(payee);
  const vendor = normalizeName(vendorName);
  if (name.length < 3) return false;
  if (vendor.length >= 3 && (name.includes(vendor) || vendor.includes(name))) return true;
  const firstWord = normalizeName(vendorName.trim().split(/\s+/)[0]);
  return firstWord.length >= 3 && name.includes(firstWord);
}
