import localFont from 'next/font/local';

/*
 * Self-hosted fonts (OFL, Fontsource 5.3.0): the build and the app fetch nothing
 * from a font CDN.
 *
 * Fontsource splits each family by script, as Google Fonts does: one file per
 * subset, each declared with the unicode-range of its characters, so a page
 * downloads only the subsets its text uses. Every subset the app's languages
 * need is listed here; with latin alone, Cyrillic, Polish, Czech, Turkish,
 * Kazakh or Vietnamese letters fell back to a system font in the middle of a
 * word. `font-faces.test.ts` checks that each letter of every translation is
 * in a file whose range declares it.
 *
 * Next.js needs each call written out with literal values, hence the repetition.
 * Only the last subset of a family gets the size-adjusted Arial fallback:
 * that fallback has no unicode-range, so anywhere earlier in the list it would
 * draw every letter after it in Arial.
 */

const geistLatin = localFont({
  src: './fonts/geist-latin-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
});

const geistLatinExt = localFont({
  src: './fonts/geist-latin-ext-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
});

const geistCyrillic = localFont({
  src: './fonts/geist-cyrillic-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
});

const geistCyrillicExt = localFont({
  src: './fonts/geist-cyrillic-ext-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
    },
  ],
});

const geistVietnamese = localFont({
  src: './fonts/geist-vietnamese-wght-normal.woff2',
  weight: '100 900',
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    },
  ],
});

const geistMonoLatin = localFont({
  src: './fonts/geist-mono-latin-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
});

const geistMonoLatinExt = localFont({
  src: './fonts/geist-mono-latin-ext-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
});

const geistMonoCyrillic = localFont({
  src: './fonts/geist-mono-cyrillic-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
});

const geistMonoCyrillicExt = localFont({
  src: './fonts/geist-mono-cyrillic-ext-wght-normal.woff2',
  weight: '100 900',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
    },
  ],
});

const geistMonoVietnamese = localFont({
  src: './fonts/geist-mono-vietnamese-wght-normal.woff2',
  weight: '100 900',
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    },
  ],
});

// Nunito is kept for branding elements.
const nunitoLatin = localFont({
  src: './fonts/nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
});

const nunitoLatinExt = localFont({
  src: './fonts/nunito-latin-ext-wght-normal.woff2',
  weight: '200 1000',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
});

const nunitoCyrillic = localFont({
  src: './fonts/nunito-cyrillic-wght-normal.woff2',
  weight: '200 1000',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
});

const nunitoCyrillicExt = localFont({
  src: './fonts/nunito-cyrillic-ext-wght-normal.woff2',
  weight: '200 1000',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
    },
  ],
});

const nunitoVietnamese = localFont({
  src: './fonts/nunito-vietnamese-wght-normal.woff2',
  weight: '200 1000',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    },
  ],
});

const GEIST = [geistLatin, geistLatinExt, geistCyrillic, geistCyrillicExt, geistVietnamese];
const GEIST_MONO = [
  geistMonoLatin,
  geistMonoLatinExt,
  geistMonoCyrillic,
  geistMonoCyrillicExt,
  geistMonoVietnamese,
];
const NUNITO = [nunitoLatin, nunitoLatinExt, nunitoCyrillic, nunitoCyrillicExt, nunitoVietnamese];

/**
 * Each family as one stack of its subsets, under the names the stylesheets read
 * (`var(--font-geist)` and friends). Set on `<body>`.
 */
export const FONT_FAMILY_VARIABLES: Record<string, string> = {
  '--font-geist': GEIST.map(font => font.style.fontFamily).join(', '),
  '--font-geist-mono': GEIST_MONO.map(font => font.style.fontFamily).join(', '),
  '--font-nunito': NUNITO.map(font => font.style.fontFamily).join(', '),
};
