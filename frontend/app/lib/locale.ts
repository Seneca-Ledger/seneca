export type AppLocale =
  | 'en'
  | 'ru'
  | 'kk'
  | 'zh'
  | 'de'
  | 'fr'
  | 'es'
  | 'uk'
  | 'pl'
  | 'sk'
  | 'pt'
  | 'tr'
  | 'it'
  | 'ja'
  | 'ko'
  | 'hi'
  | 'nl'
  | 'sv'
  | 'vi'
  | 'id'
  | 'da'
  | 'nb'
  | 'nn'
  | 'fi'
  | 'is'
  | 'fo'
  | 'cs'
  | 'bg'
  | 'hr'
  | 'sr'
  | 'sl'
  | 'mk'
  | 'be'
  | 'bs'
  | 'hsb';

export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE_NAME = 'INTLAYER_LOCALE';
export const SUPPORTED_LOCALES = [
  'ru',
  'en',
  'kk',
  'zh',
  'de',
  'fr',
  'es',
  'uk',
  'pl',
  'sk',
  'pt',
  'tr',
  'it',
  'ja',
  'ko',
  'hi',
  'nl',
  'sv',
  'vi',
  'id',
  'da',
  'nb',
  'nn',
  'fi',
  'is',
  'fo',
  'cs',
  'bg',
  'hr',
  'sr',
  'sl',
  'mk',
  'be',
  'bs',
  'hsb',
] as const satisfies readonly AppLocale[];

/**
 * The order languages are shown to people (auth greeting, language picker):
 * English first, then the Germanic languages, then the Romance (Latin) ones,
 * then everything else in SUPPORTED_LOCALES order. SUPPORTED_LOCALES itself
 * keeps its order.
 */
const DISPLAY_PRIORITY: readonly AppLocale[] = [
  'en',
  // Germanic
  'de',
  'nl',
  'sv',
  'da',
  'nb',
  'nn',
  'is',
  'fo',
  // Romance
  'fr',
  'es',
  'it',
  'pt',
];

/**
 * Every language named in itself and in its own script — "Deutsch", "日本語",
 * "हिन्दी" — never translated into the interface language, so a person can
 * find their language whatever the screen is currently set to.
 */
export const LOCALE_ENDONYMS: Record<AppLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  nl: 'Nederlands',
  sv: 'Svenska',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  kk: 'Қазақша',
  zh: '中文',
  uk: 'Українська',
  pl: 'Polski',
  sk: 'Slovenčina',
  tr: 'Türkçe',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  da: 'Dansk',
  nb: 'Norsk bokmål',
  nn: 'Nynorsk',
  fi: 'Suomi',
  is: 'Íslenska',
  fo: 'Føroyskt',
  cs: 'Čeština',
  bg: 'Български',
  hr: 'Hrvatski',
  sr: 'Српски',
  sl: 'Slovenščina',
  mk: 'Македонски',
  be: 'Беларуская',
  bs: 'Bosanski',
  hsb: 'Hornjoserbšćina',
};

export const LOCALE_DISPLAY_ORDER: readonly AppLocale[] = [
  ...DISPLAY_PRIORITY,
  ...SUPPORTED_LOCALES.filter(locale => !DISPLAY_PRIORITY.includes(locale)),
];
const LEGACY_LOCALE_COOKIE_NAME = 'intlayer-locale';
const LOCALE_COOKIE_ATTRIBUTES = 'path=/; max-age=31536000; samesite=lax';
const EXPIRED_COOKIE_ATTRIBUTES = 'path=/; max-age=0; samesite=lax';

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  if (value == null) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return (
    document.cookie
      .split(';')
      .map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith(`${name}=`))
      ?.split('=')[1] ?? null
  );
}

export function normalizeLocale(
  value: string | null | undefined,
  fallback: AppLocale = DEFAULT_LOCALE,
): AppLocale {
  return isSupportedLocale(value) ? value : fallback;
}

export function readLocaleFromCookie(): AppLocale | null {
  const primaryCookieLocale = readCookie(LOCALE_COOKIE_NAME);
  if (isSupportedLocale(primaryCookieLocale)) {
    return primaryCookieLocale;
  }

  const legacyCookieLocale = readCookie(LEGACY_LOCALE_COOKIE_NAME);
  return isSupportedLocale(legacyCookieLocale) ? legacyCookieLocale : null;
}

export function persistLocaleToCookie(locale: AppLocale) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; ${LOCALE_COOKIE_ATTRIBUTES}`;
  // Keep next-intlayer server reads and existing client helpers aligned across reloads.
  document.cookie = `${LEGACY_LOCALE_COOKIE_NAME}=${locale}; ${LOCALE_COOKIE_ATTRIBUTES}`;
}

export function syncLocaleFromUser(
  user: { locale?: string | null } | null | undefined,
  options?: { overwrite?: boolean },
) {
  if (!isSupportedLocale(user?.locale)) {
    return;
  }

  if (!options?.overwrite && readLocaleFromCookie() != null) {
    return;
  }

  persistLocaleToCookie(user.locale);
}
