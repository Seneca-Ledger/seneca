import { configuration, getLocaleFromStorageServer, localeDetector } from 'intlayer';
import { cookies, headers } from 'next/headers';

/**
 * The request's language: the stored cookie or header, then Accept-Language,
 * then the default. Same order as `getLocale` from `next-intlayer/server`, whose
 * entry also exports the Next build plugin and drags intlayer's build engine
 * into the server bundle.
 */
export const getRequestLocale = async () => {
  const headersList = await headers();
  const cookiesList = await cookies();
  const storedLocale = getLocaleFromStorageServer({
    getCookie: name => cookiesList.get(name)?.value ?? null,
    getHeader: name => headersList.get(name) ?? null,
  });
  if (storedLocale) {
    return storedLocale;
  }

  const negotiatorHeaders: Record<string, string> = {};
  headersList.forEach((value, key) => {
    negotiatorHeaders[key] = value;
  });
  return localeDetector(negotiatorHeaders) ?? configuration.internationalization.defaultLocale;
};
