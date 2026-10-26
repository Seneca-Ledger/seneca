import { type IntlayerConfig } from 'intlayer';

const config: IntlayerConfig = {
  internationalization: {
    locales: [
      'ru',
      'en',
      'kk',
      'de',
      'fr',
      'es',
      'pt',
      'tr',
      'uk',
      'zh',
      'pl',
      'it',
      'sk',
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
    ],
    defaultLocale: 'en',
  },
  dictionary: {
    // 'dynamic' makes intlayer build write each dictionary per locale, which
    // scripts/build-locale-packs.mjs gathers into one pack per language.
    importMode: 'dynamic',
  },
  build: {
    // The SWC optimizer stays off: it only rewrites useIntlayer imported from
    // react-intlayer, and components read the cached hook in app/i18n.ts.
    optimize: false,
  },
};

export default config;
