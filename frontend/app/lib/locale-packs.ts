import { getDictionary, getIntlayer } from 'react-intlayer';

type LocalePack = Record<string, Parameters<typeof getDictionary>[0]>;

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

/**
 * Every dictionary of one language (scripts/build-locale-packs.mjs). The
 * browser loads only the packs it needs; its getIntlayer has no dictionaries
 * (next.config.js). The server and tests load none and read getIntlayer.
 */
const packs = new Map<string, LocalePack>();
/** `status` lets React's `use` read a loaded pack without suspending again. */
type PackPromise = Promise<void> & { status?: 'fulfilled' };
const pendingPacks = new Map<string, PackPromise>();

export const loadLocalePack = (locale: string): Promise<void> => {
  let pending = pendingPacks.get(locale);
  if (!pending) {
    const loading: PackPromise = import(`../../.intlayer/locale_pack/${locale}.mjs`).then(
      (module: { default: LocalePack }) => {
        packs.set(locale, module.default);
        loading.status = 'fulfilled';
      },
      (error: unknown) => {
        pendingPacks.delete(locale);
        throw error;
      },
    );
    pending = loading;
    pendingPacks.set(locale, pending);
  }
  return pending;
};

/** `getIntlayer` through the same cache, for code outside components. */
export const getCachedIntlayer = ((key: string, locale: string) => {
  const cacheKey = `${key}\u0000${locale}`;
  let content = transformed.get(cacheKey);
  if (content === undefined) {
    const dictionary = packs.get(locale)?.[key];
    if (dictionary) {
      content = getDictionary(dictionary, locale as never);
    } else {
      content = getIntlayer(key as never, locale as never);
      // A browser read before the pack is in: a stand-in, not worth keeping.
      if (pendingPacks.has(locale)) {
        return content;
      }
    }
    transformed.set(cacheKey, content);
  }
  return content;
}) as typeof getIntlayer;
