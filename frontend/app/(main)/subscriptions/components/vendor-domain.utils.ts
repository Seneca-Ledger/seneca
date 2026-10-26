/**
 * A guess at a vendor's website from its name, used only to fetch a favicon.
 * The backend does not guess; the form sends this whenever the name changes.
 */
export const guessVendorDomain = (vendorName: string): string => {
  const name = vendorName.trim().toLowerCase();
  if (!name) {
    return '';
  }
  // Already a domain: keep what the user typed.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) {
    return name;
  }

  const slug = name.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : '';
};

/**
 * The Website field takes whatever people paste, often a full address
 * ("https://ksp.co.il/"). The API stores a bare domain only, so the scheme,
 * credentials, port, path, query and fragment are dropped before sending.
 */
export const toVendorDomain = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^[^/?#]*@/, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d*$/, '')
    .replace(/\.$/, '');

/**
 * The domain to save with a subscription. There is no Website field, so the
 * domain follows the name: a rename gets a fresh guess (null clears the old
 * domain, so "Apple" renamed to "Microsoft" stops showing Apple's icon), an
 * unchanged name keeps what is stored.
 */
export const vendorDomainForSave = (
  vendorName: string,
  storedName: string | undefined,
  storedDomain: string,
): string | null =>
  (storedName === vendorName ? toVendorDomain(storedDomain) : '') ||
  guessVendorDomain(vendorName) ||
  null;
