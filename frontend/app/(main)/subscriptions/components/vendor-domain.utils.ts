/**
 * A first guess at a vendor's website, offered as the default in the form so
 * the user can correct it. Never written without being shown: the backend does
 * not guess, so a wrong guess can only reach the database via the form.
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
