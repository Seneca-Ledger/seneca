/**
 * The slice of `web-push` this module uses. The package is loaded lazily so a
 * server without VAPID keys (and a test image without the dependency) never
 * touches it; the real types ship with the package.
 */
declare module 'web-push' {
  export interface WebPushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  export class WebPushError extends Error {
    statusCode: number;
    body: string;
  }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: WebPushSubscription,
    payload?: string | Buffer | null,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' },
  ): Promise<{ statusCode: number; body: string }>;
}
