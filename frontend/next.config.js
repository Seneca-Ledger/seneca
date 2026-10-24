const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const normalizeTarget = url => String(url || '').replace(/\/$/, '');

// Used to proxy API requests through the Next server to the backend when running as a single service
const apiProxyTarget = normalizeTarget(process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001');

const { withIntlayerSync } = require('next-intlayer/server');

const intlayerAliases = {
  intlayer: './node_modules/intlayer/dist/cjs/index.cjs',
  '@intlayer/config/built': './node_modules/@intlayer/config/dist/cjs/built.cjs',
  'react-intlayer$': './node_modules/react-intlayer/dist/cjs/index.cjs',
  'react-intlayer/server$': './node_modules/react-intlayer/dist/cjs/server/index.cjs',
};

const isDev = process.env.NODE_ENV !== 'production';

// The API origin the browser talks to. Same-origin in the standalone
// deployment (requests go through the /api rewrite below), a separate host
// when the two services are split, which connect-src has to allow.
const apiOrigin = (() => {
  const configured = process.env.NEXT_PUBLIC_API_URL || '';
  if (!configured || configured.startsWith('/')) {
    return '';
  }
  try {
    return new URL(configured).origin;
  } catch {
    return '';
  }
})();

// NOTE: script-src carries 'unsafe-inline' because Next inlines its hydration
// bootstrap and this app has no middleware to mint a per-request nonce.
// That limits how much this policy can do against injected script; the
// remaining directives (frame-ancestors, object-src, base-uri, form-action)
// are still worth having. Moving to a nonce-based policy needs a
// middleware.ts and is tracked as follow-up work.
// Third-party origins the app actually loads at runtime. Each is an existing
// product feature, not a convenience: omitting them does not harden anything,
// it just breaks the feature silently at the CSP layer. A deployment that does
// not use these integrations can drop the corresponding entry.
// Bank logos (brand-logo.ts) and the default identicon the backend assigns to
// users without an uploaded avatar (jwt.strategy.ts).
const REMOTE_IMAGE_HOSTS = 'https://logo.clearbit.com https://api.dicebear.com';

// react-scan (components/ReactScan.tsx) is mounted only when NODE_ENV is
// development and checks its own version over the network. Allowing it keeps
// the dev console free of a violation that says nothing about the app — and it
// stays out of the production policy, where the profiler is never mounted.
const DEV_PROFILER_HOST = 'https://www.react-grab.com';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Receipt map tiles are proxied by the API (/maps/tiles), so a split deployment
  // needs the API origin here; same-origin deployments are covered by 'self'.
  `img-src 'self' data: blob: ${REMOTE_IMAGE_HOSTS}${apiOrigin ? ` ${apiOrigin}` : ''}`,
  // pdf.js runs its parser in a worker; react-pdf also renders to blob URLs.
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  // blob: is required, not optional: the app downloads a file same-origin, wraps
  // it with URL.createObjectURL and hands the blob: URL to pdf.js, which fetches
  // it itself. `'self'` does not cover the blob: scheme, so without this the
  // viewer fails with "Unexpected server response (0)" — while <img src=blob:>
  // in the same modal keeps working, because img-src already allows it.
  //
  // ws:/wss: are listed in every environment: Socket.IO powers notifications and
  // import progress, and browsers have not been consistent about whether 'self'
  // covers the WebSocket schemes for the same origin.
  `connect-src 'self' blob: ws: wss:${apiOrigin ? ` ${apiOrigin}` : ''}${
    isDev ? ` ${DEV_PROFILER_HOST}` : ''
  }`,
  // Declaring frame-src at all removes the default-src fallback, so the app's
  // own embeds have to be listed explicitly: statement and receipt previews are
  // iframed from a blob: URL.
  "frame-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // geolocation is allowed for this origin only: a receipt photographed with the
  // camera is pinned to where it was taken (lib/device-location.ts).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  // Only honoured over HTTPS, so it is inert for local http development.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Was `true`, which meant a type error never failed a production build —
    // it was hiding two real ones in the tour positioning code. The tree is
    // clean now, so the safety net can stay on.
    ignoreBuildErrors: false,
  },
  output: 'standalone',

  // Auto-memoizes components and hooks (React 19 + Next 16). See plan: re-render audit 2026-09.
  reactCompiler: true,

  outputFileTracingRoot: __dirname,

  serverExternalPackages: ['esbuild'],

  turbopack: {
    resolveAlias: {
      ...intlayerAliases,
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      intlayer: path.resolve(__dirname, 'node_modules/intlayer/dist/cjs/index.cjs'),
      '@intlayer/config/built': path.resolve(
        __dirname,
        'node_modules/@intlayer/config/dist/cjs/built.cjs',
      ),
      'react-intlayer$': path.resolve(__dirname, 'node_modules/react-intlayer/dist/cjs/index.cjs'),
      'react-intlayer/server$': path.resolve(
        __dirname,
        'node_modules/react-intlayer/dist/cjs/server/index.cjs',
      ),
    };
    return config;
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiProxyTarget}/uploads/:path*`,
      },
    ];
  },
};

// Browser bundles get empty dictionary entries: components read the current
// language's pack (app/i18n.ts), so the dictionaries in all 35 locales stay on
// the server. Applied after withIntlayerSync, whose own aliases for the entries
// would otherwise win.
const CLIENT_DICTIONARIES_ENTRY = './app/lib/client-dictionaries-entry.ts';
const DICTIONARY_ENTRIES = [
  '@intlayer/dictionaries-entry',
  '@intlayer/dictionaries-entry/unmerged',
];

const withClientDictionariesEntry = config => {
  const { webpack } = config;
  const turbopackAlias = config.turbopack?.resolveAlias;
  return {
    ...config,
    // withIntlayerSync aliases the entries for Turbopack (dev and build).
    ...(turbopackAlias?.[DICTIONARY_ENTRIES[0]] && {
      turbopack: {
        ...config.turbopack,
        resolveAlias: {
          ...turbopackAlias,
          ...Object.fromEntries(
            DICTIONARY_ENTRIES.map(entry => [
              entry,
              { browser: CLIENT_DICTIONARIES_ENTRY, default: turbopackAlias[entry] },
            ]),
          ),
        },
      },
    }),
    webpack: (webpackConfig, options) => {
      const result = webpack ? webpack(webpackConfig, options) : webpackConfig;
      if (!options.isServer) {
        for (const entry of DICTIONARY_ENTRIES) {
          // Overwrite intlayer's own keys in place: its subpath keys come before
          // the bare entry, so `@intlayer/dictionaries-entry/remote` still wins.
          result.resolve.alias[entry] = path.resolve(__dirname, CLIENT_DICTIONARIES_ENTRY);
        }
      }
      return result;
    },
  };
};

module.exports = withBundleAnalyzer(withClientDictionariesEntry(withIntlayerSync(nextConfig)));
