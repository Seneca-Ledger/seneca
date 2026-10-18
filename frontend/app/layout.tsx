import type { Metadata } from 'next';
import { Geist, Geist_Mono, Manrope, Nunito } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.scss';
import { getLocale } from 'next-intlayer/server';
import { getIntlayer } from 'react-intlayer';
import { IntlayerServerProvider } from 'react-intlayer/server';
import { ThemeProvider } from '@/components/theme-provider';
import { ChatModeRedirect } from './chat/ChatModeRedirect';
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

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
});

// Keep Nunito for branding elements
const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-nunito',
});

const FONT_CLASS_NAMES = [
  geist.variable,
  geistMono.variable,
  manrope.variable,
  nunito.variable,
].join(' ');
const BODY_STYLE: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  WebkitFontSmoothing: 'antialiased',
  fontFamily: 'var(--font-geist, system-ui, sans-serif)',
};

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
        <a href="#main-content" className="lumio-skip-link">
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
              <ChatModeRedirect />
              <DynamicPageTitle />
              <SidePanelProvider
                defaultWidth="md"
                defaultPosition="left"
                defaultCollapsed={false}
                persistState={true}
                storageKey="lumio-side-panel"
              >
                <div className="lumio-shell">
                  <AppChrome />
                  <div className="lumio-shell__content">
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
