import type { Metadata } from 'next';
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
import { FONT_FAMILY_VARIABLES } from './font-faces';
import { normalizeLocale } from './lib/locale';
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
      <body style={BODY_STYLE} suppressHydrationWarning>
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
