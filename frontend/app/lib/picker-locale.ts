'use client';

import type { PickersLocaleText } from '@mui/x-date-pickers/locales';
import type { Locale } from 'date-fns';
import { useEffect, useState } from 'react';
import type { AppLocale } from '@/app/lib/locale';

export interface PickerLocale {
  /** Month and weekday names, first day of the week. */
  dateLocale: Locale;
  /** Field placeholders ("ММММ ГГГГ"), toolbar and aria labels; absent where MUI has none. */
  localeText?: Partial<PickersLocaleText>;
}

type MuiLocales = typeof import('@mui/x-date-pickers/locales');
/** The barrel also exports helpers; only the locale packs carry `components`. */
type MuiLocaleName = {
  [K in keyof MuiLocales]: MuiLocales[K] extends { components: unknown } ? K : never;
}[keyof MuiLocales];

/** The MUI translations for the app locale, by export name; missing ones stay English. */
const MUI_LOCALE: Partial<Record<AppLocale, MuiLocaleName>> = {
  ru: 'ruRU',
  kk: 'kzKZ',
  zh: 'zhCN',
  de: 'deDE',
  fr: 'frFR',
  es: 'esES',
  uk: 'ukUA',
  pl: 'plPL',
  sk: 'skSK',
  pt: 'ptPT',
  tr: 'trTR',
  it: 'itIT',
  ja: 'jaJP',
  ko: 'koKR',
  nl: 'nlNL',
  sv: 'svSE',
  vi: 'viVN',
  da: 'daDK',
  nb: 'nbNO',
  nn: 'nnNO',
  fi: 'fiFI',
  is: 'isIS',
  cs: 'csCZ',
  bg: 'bgBG',
  hr: 'hrHR',
  mk: 'mk',
  be: 'beBY',
  bs: 'hrHR',
};

/**
 * One loader per locale with a literal path, so the bundler splits each
 * date-fns locale into its own chunk instead of shipping all of them.
 * date-fns has no Faroese or Upper Sorbian: Danish and German are the
 * languages their readers also use for dates.
 */
const DATE_FNS_LOCALE: Record<AppLocale, () => Promise<Locale>> = {
  en: () => import('date-fns/locale/en-US').then(m => m.enUS),
  ru: () => import('date-fns/locale/ru').then(m => m.ru),
  kk: () => import('date-fns/locale/kk').then(m => m.kk),
  zh: () => import('date-fns/locale/zh-CN').then(m => m.zhCN),
  de: () => import('date-fns/locale/de').then(m => m.de),
  fr: () => import('date-fns/locale/fr').then(m => m.fr),
  es: () => import('date-fns/locale/es').then(m => m.es),
  uk: () => import('date-fns/locale/uk').then(m => m.uk),
  pl: () => import('date-fns/locale/pl').then(m => m.pl),
  sk: () => import('date-fns/locale/sk').then(m => m.sk),
  pt: () => import('date-fns/locale/pt').then(m => m.pt),
  tr: () => import('date-fns/locale/tr').then(m => m.tr),
  it: () => import('date-fns/locale/it').then(m => m.it),
  ja: () => import('date-fns/locale/ja').then(m => m.ja),
  ko: () => import('date-fns/locale/ko').then(m => m.ko),
  hi: () => import('date-fns/locale/hi').then(m => m.hi),
  nl: () => import('date-fns/locale/nl').then(m => m.nl),
  sv: () => import('date-fns/locale/sv').then(m => m.sv),
  vi: () => import('date-fns/locale/vi').then(m => m.vi),
  id: () => import('date-fns/locale/id').then(m => m.id),
  da: () => import('date-fns/locale/da').then(m => m.da),
  nb: () => import('date-fns/locale/nb').then(m => m.nb),
  nn: () => import('date-fns/locale/nn').then(m => m.nn),
  fi: () => import('date-fns/locale/fi').then(m => m.fi),
  is: () => import('date-fns/locale/is').then(m => m.is),
  fo: () => import('date-fns/locale/da').then(m => m.da),
  cs: () => import('date-fns/locale/cs').then(m => m.cs),
  bg: () => import('date-fns/locale/bg').then(m => m.bg),
  hr: () => import('date-fns/locale/hr').then(m => m.hr),
  sr: () => import('date-fns/locale/sr').then(m => m.sr),
  sl: () => import('date-fns/locale/sl').then(m => m.sl),
  mk: () => import('date-fns/locale/mk').then(m => m.mk),
  be: () => import('date-fns/locale/be').then(m => m.be),
  bs: () => import('date-fns/locale/bs').then(m => m.bs),
  hsb: () => import('date-fns/locale/de').then(m => m.de),
};

export async function loadPickerLocale(locale: AppLocale): Promise<PickerLocale> {
  const muiName = MUI_LOCALE[locale];
  const [dateLocale, mui] = await Promise.all([
    DATE_FNS_LOCALE[locale](),
    // The MUI package only exposes the whole set; it is small and loaded once.
    muiName ? import('@mui/x-date-pickers/locales') : Promise.resolve(null),
  ]);
  return {
    dateLocale,
    localeText:
      mui && muiName
        ? mui[muiName].components.MuiLocalizationProvider.defaultProps.localeText
        : undefined,
  };
}

/**
 * The pickers' locale for the app language. Undefined until it has loaded, and
 * on English, where the adapter's built-in default already is the right one.
 */
export function usePickerLocale(locale: AppLocale): PickerLocale | undefined {
  const [loaded, setLoaded] = useState<{ locale: AppLocale; value: PickerLocale }>();

  useEffect(() => {
    if (locale === 'en') {
      return;
    }
    let cancelled = false;
    loadPickerLocale(locale).then(
      value => {
        if (!cancelled) setLoaded({ locale, value });
      },
      // A failed chunk leaves the pickers in English rather than breaking the app.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return loaded?.locale === locale ? loaded.value : undefined;
}
