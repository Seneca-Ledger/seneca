'use client';

import { getIntlayer, useIntlayerContext, useLocale } from 'react-intlayer';

type UseIntlayer = typeof import('react-intlayer').useIntlayer;

/**
 * Dictionaries already turned into React content, by key and locale.
 *
 * react-intlayer's own hook memoises per component instance, so every mount of
 * every component rebuilds the whole dictionary: `statementsPage` alone is 556
 * strings, read by eleven components, plus one smaller dictionary per list row.
 * Going back to the statements list spent ~0.7 s of main thread in that alone.
 * The result is immutable (strings wrapped in React elements), so one copy per
 * key and locale serves every component.
 *
 * In development a dictionary rebuilt by `intlayer build` shows after a page
 * reload, not on the next remount.
 */
const transformed = new Map<string, unknown>();

/** `getIntlayer` through the same cache, for code outside components. */
export const getCachedIntlayer = ((key: string, locale: string) => {
  const cacheKey = `${key}\u0000${locale}`;
  let content = transformed.get(cacheKey);
  if (content === undefined) {
    content = getIntlayer(key as never, locale as never);
    transformed.set(cacheKey, content);
  }
  return content;
}) as typeof getIntlayer;

export const useIntlayer = ((key: string, locale?: string) => {
  const { locale: currentLocale } = useIntlayerContext();
  return getCachedIntlayer(key as never, (locale ?? currentLocale) as never);
}) as UseIntlayer;

export { useLocale };
