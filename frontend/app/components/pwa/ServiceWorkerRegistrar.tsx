'use client';

import { useEffect } from 'react';

/**
 * Registers the app's service worker (public/sw.js). Not in development: the
 * worker would cache dev bundles and hide hot reloads.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Without a worker the app still works; it just has no offline shell or push.
    });
  }, []);
  return null;
}
