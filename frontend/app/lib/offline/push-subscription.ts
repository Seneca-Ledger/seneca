import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export interface PushStatus {
  supported: boolean;
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  // A plain ArrayBuffer, which is what PushManager.subscribe accepts.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function readPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { supported: false, enabled: false, permission: 'unsupported', subscribed: false };
  }
  const server = await apiClient
    .get<{ enabled: boolean; publicKey: string | null }>('/push/public-key')
    .then(response => response.data)
    .catch(() => ({ enabled: false, publicKey: null }));
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return {
    supported: true,
    enabled: server.enabled,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

/** Asks for permission, subscribes this device and tells the server. */
export async function subscribeThisDevice(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const { enabled, publicKey } = await apiClient
    .get<{ enabled: boolean; publicKey: string | null }>('/push/public-key')
    .then(response => response.data);
  if (!(enabled && publicKey)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const { endpoint, keys } = subscription.toJSON();
  // A browser that hands back no endpoint or keys has given us nothing to push to.
  if (!(endpoint && keys?.p256dh && keys.auth)) return false;
  await apiClient.post('/push/subscriptions', {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    userAgent: navigator.userAgent,
  } satisfies ContractInput<'PushSubscriptionBody'>);
  return true;
}

export async function unsubscribeThisDevice(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await apiClient.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}
