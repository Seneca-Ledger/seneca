/**
 * Browser stand-in for `@intlayer/dictionaries-entry` and
 * `@intlayer/dictionaries-entry/unmerged` (aliased in next.config.js).
 *
 * The real entries hold every dictionary in all 35 locales — 19 MB that every
 * page used to download. In the browser, app/i18n.ts reads the current
 * language's pack instead, so react-intlayer's getIntlayer gets nothing here.
 * The unmerged entry only feeds intlayer's visual editor, which is off.
 */
export const getDictionaries = (): Record<string, never> => ({});

export const getUnmergedDictionaries = (): Record<string, never> => ({});

export default {};
