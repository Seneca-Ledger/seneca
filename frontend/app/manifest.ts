import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/app/lib/brand';

/**
 * Served at /manifest.webmanifest and linked automatically by Next. The
 * service worker in public/sw.js caches the app shell, serves /offline when
 * the network is gone and shows web push; manual entries made offline wait in
 * IndexedDB (app/lib/offline) and go out when the connection is back.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    // biome-ignore lint/style/useNamingConvention: key name is fixed by the web app manifest spec
    short_name: APP_NAME,
    description: 'Import, categorize, and analyze bank statement data.',
    // biome-ignore lint/style/useNamingConvention: key name is fixed by the web app manifest spec
    start_url: '/dashboard',
    display: 'standalone',
    // biome-ignore lint/style/useNamingConvention: key name is fixed by the web app manifest spec
    background_color: '#ffffff',
    // biome-ignore lint/style/useNamingConvention: key name is fixed by the web app manifest spec
    theme_color: '#0584c7',
    icons: [
      {
        src: '/images/favicon-new.png',
        sizes: '192x192 512x512 1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    // Long-press on the home-screen icon: straight into the two things people do on the go.
    shortcuts: [
      {
        name: 'Add expense',
        // biome-ignore lint/style/useNamingConvention: key name is fixed by the web app manifest spec
        short_name: 'Expense',
        url: '/statements/submit?openExpenseDrawer=manual',
        icons: [{ src: '/images/favicon-new.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Scan receipt',
        // biome-ignore lint/style/useNamingConvention: key name is fixed by the web app manifest spec
        short_name: 'Receipt',
        url: '/statements/submit?openExpenseDrawer=scan',
        icons: [{ src: '/images/favicon-new.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
