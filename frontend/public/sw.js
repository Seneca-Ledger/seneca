/* Seneca service worker: app-shell cache, offline fallback, web push.
 *
 * Hashed Next assets are cached as they are fetched (they never change under
 * the same URL); navigations go network-first and fall back to /offline when
 * the network is gone. Data requests are never cached here: the page keeps its
 * own offline queue for manual entries and receipt photos.
 */
const VERSION = 'seneca-sw-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.addAll([OFFLINE_URL, '/manifest.webmanifest', '/images/favicon-new.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/workspace-backgrounds/') ||
    url.pathname.endsWith('.woff2')
  );
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then(cached => cached || Response.error())),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        }),
      ),
    );
  }
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Stoic Budget', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Stoic Budget';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/images/favicon-new.png',
      badge: '/images/favicon-new.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(client => client.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
