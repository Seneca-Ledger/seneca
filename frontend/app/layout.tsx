import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import './globals.scss';
import { getIntlayer } from 'react-intlayer';
import { IntlayerServerProvider } from 'react-intlayer/server';
import { ThemeProvider } from '@/components/theme-provider';
import AppChrome from './components/AppChrome';
import DynamicPageTitle from './components/DynamicPageTitle';
import MobileBottomBar from './components/mobile/MobileBottomBar';
import { AppPanels } from './components/panels/AppPanels';
import { ReceiptPlaceFollowupHost } from './components/receipts/place-followup/ReceiptPlaceFollowupHost';
import { SidePanelProvider } from './components/side-panel/SidePanelContext';
import { WelcomeTutorialHost } from './components/welcome-tutorial/WelcomeTutorialHost';
import { FONT_FAMILY_VARIABLES } from './font-faces';
import { normalizeLocale } from './lib/locale';
import { PRIVACY_BOOT_SCRIPT } from './lib/privacy-mode-boot';
import { getRequestLocale } from './lib/request-locale';
import { parseSidebarCollapsedCookie, SIDEBAR_COLLAPSED_COOKIE } from './lib/sidebar-preference';
import { PALETTE_MODE_COOKIE, parsePaletteModeCookie } from './lib/theme-preference';
import { Providers } from './providers';

const BODY_STYLE = {
  ...FONT_FAMILY_VARIABLES,
  background: 'var(--background)',
  color: 'var(--foreground)',
  WebkitFontSmoothing: 'antialiased',
  fontFamily: 'var(--font-geist, system-ui, sans-serif)',
} as React.CSSProperties;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
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
  const locale = await getRequestLocale();
  const resolvedLocale = normalizeLocale(typeof locale === 'string' ? locale : undefined);
  const t = getIntlayer('layout', locale);
  const cookieStore = await cookies();
  const initialPaletteMode = parsePaletteModeCookie(cookieStore.get(PALETTE_MODE_COOKIE)?.value);
  const initialSidebarCollapsed = parseSidebarCollapsedCookie(
    cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value,
  );

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <head>
        {/* Privacy mode before the first paint: a reload must not flash the figures. */}
        <Script id="privacy-boot" strategy="beforeInteractive">
          {PRIVACY_BOOT_SCRIPT}
        </Script>
        <link
          rel="preload"
          href="/fonts/redacted-script-latin-400-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body style={BODY_STYLE} suppressHydrationWarning>
        {/* First Tab stop: jumps past the sidebar; shown only while focused. */}
        <a href="#main-content" className="seneca-skip-link">
          {t.skipToContent.value}
        </a>
        <IntlayerServerProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
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
                  <AppChrome initialSidebarCollapsed={initialSidebarCollapsed} />
                  <div className="seneca-shell__content">
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
