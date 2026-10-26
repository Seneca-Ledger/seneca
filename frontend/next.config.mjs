const normalizeTarget = url => String(url || '').replace(/\/$/, '');

// Used to proxy API requests through the app server to the backend when running as a single service
const apiProxyTarget = normalizeTarget(process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001');

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

const buildCsp = isDev =>
  [
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
    `connect-src 'self' blob: ws: wss:${apiOrigin ? ` ${apiOrigin}` : ''}`,
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

const securityHeaders = isDev => [
  { key: 'Content-Security-Policy', value: buildCsp(isDev) },
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

/**
 * Read by vinext (the Vite build of the App Router): only headers, rewrites and
 * the standalone output are used. The phase tells the dev server from the build.
 *
 * @type {(phase: string) => import('next').NextConfig}
 */
const nextConfig = phase => {
  const isDev = phase === 'phase-development-server';
  return {
    output: 'standalone',

    async headers() {
      return [
        {
          source: '/:path*',
          headers: securityHeaders(isDev),
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
};

export default nextConfig;
