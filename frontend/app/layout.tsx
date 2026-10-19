import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
import './globals.scss';
import { getLocale } from 'next-intlayer/server';
import { getIntlayer } from 'react-intlayer';
import { IntlayerServerProvider } from 'react-intlayer/server';
import { ThemeProvider } from '@/components/theme-provider';
import AppChrome from './components/AppChrome';
import DynamicPageTitle from './components/DynamicPageTitle';
import MobileBottomBar from './components/mobile/MobileBottomBar';
import { AppPanels } from './components/panels/AppPanels';
import { ReactScan } from './components/ReactScan';
import { ReceiptPlaceFollowupHost } from './components/receipts/place-followup/ReceiptPlaceFollowupHost';
import { SidePanelProvider } from './components/side-panel/SidePanelContext';
import TopBar from './components/TopBar';
import { WelcomeTutorialHost } from './components/welcome-tutorial/WelcomeTutorialHost';
import { normalizeLocale } from './lib/locale';
import { PALETTE_MODE_COOKIE, parsePaletteModeCookie } from './lib/theme-preference';
import { Providers } from './providers';

// Self-hosted (OFL, from Fontsource): the build and the app fetch nothing from a font CDN.
const geist = localFont({
  src: './fonts/geist-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-geist',
});

const geistMono = localFont({
  src: './fonts/geist-mono-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-geist-mono',
});

// Keep Nunito for branding elements. One face per subset, each limited to its
// characters; `--font-nunito` below lists both.
const nunitoLatin = localFont({
  src: './fonts/nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-nunito-latin',
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
});

const nunitoCyrillic = localFont({
  src: './fonts/nunito-cyrillic-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-nunito-cyrillic',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
});

const FONT_CLASS_NAMES = [
  geist.variable,
  geistMono.variable,
  nunitoLatin.variable,
  nunitoCyrillic.variable,
].join(' ');
const BODY_STYLE = {
  '--font-nunito': 'var(--font-nunito-latin), var(--font-nunito-cyrillic)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  WebkitFontSmoothing: 'antialiased',
  fontFamily: 'var(--font-geist, system-ui, sans-serif)',
} as React.CSSProperties;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getIntlayer('layout', locale);

  return {
    title: t.title.value,
    description: t.description.value,
    icons: {
      icon: '/images/favicon-new.png',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const locale = await getLocale();
  const resolvedLocale = normalizeLocale(typeof locale === 'string' ? locale : undefined);
  const t = getIntlayer('layout', locale);
  const initialPaletteMode = parsePaletteModeCookie(
    (await cookies()).get(PALETTE_MODE_COOKIE)?.value,
  );

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      {process.env.NODE_ENV === 'development' ? <ReactScan /> : null}
      <body className={FONT_CLASS_NAMES} style={BODY_STYLE} suppressHydrationWarning>
        {/* First Tab stop: jumps past the sidebar and top bar; shown only while focused. */}
        <a href="#main-content" className="seneca-skip-link">
          {t.skipToContent.value}
        </a>
        <IntlayerServerProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Providers initialLocale={resolvedLocale} initialPaletteMode={initialPaletteMode}>
              <DynamicPageTitle />
              <SidePanelProvider
                defaultWidth="md"
                defaultPosition="left"
                defaultCollapsed={false}
                persistState={true}
                storageKey="seneca-side-panel"
              >
                <div className="seneca-shell">
                  <AppChrome />
                  <div className="seneca-shell__content">
                    <TopBar />
                    <main id="main-content" tabIndex={-1}>
                      {children}
                    </main>
                    <MobileBottomBar />
                    <AppPanels />
                    <WelcomeTutorialHost />
                    <ReceiptPlaceFollowupHost />
                    <div
                      id="fab-portal"
                      style={{ position: 'fixed', inset: 0, zIndex: 300, pointerEvents: 'none' }}
                    >
                      <div style={{ position: 'relative', height: '100%', width: '100%' }} />
                    </div>
                  </div>
                </div>
              </SidePanelProvider>
            </Providers>
          </ThemeProvider>
        </IntlayerServerProvider>
      </body>
    </html>
  );
}
