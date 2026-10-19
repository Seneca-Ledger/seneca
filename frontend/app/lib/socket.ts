import { io, type Socket } from 'socket.io-client';

let notificationsSocket: Socket | null = null;

function getBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && /^https?:\/\//.test(apiUrl)) {
    return apiUrl.replace(/\/api\/v1\/?$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function connectNotificationsSocket(): Socket {
  if (notificationsSocket) {
    return notificationsSocket;
  }

  const baseUrl = getBaseUrl();
  // No `auth.token`: the access token is an httpOnly cookie the browser
  // attaches to the handshake itself (withCredentials), and this page cannot
  // read it. The gateway reads it from the handshake cookie header.
  notificationsSocket = io(`${baseUrl}/notifications`, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
  });

  return notificationsSocket;
}

export function getNotificationsSocket(): Socket | null {
  return notificationsSocket;
}

export function disconnectNotificationsSocket(): void {
  if (!notificationsSocket) {
    return;
  }

  notificationsSocket.disconnect();
  notificationsSocket = null;
}
