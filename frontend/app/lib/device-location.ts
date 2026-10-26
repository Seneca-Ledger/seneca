'use client';

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

const DEFAULT_TIMEOUT_MS = 5000;

export type LocationAccess = 'granted' | 'denied' | 'unavailable';

// Long enough to read the browser prompt; a prompt left open past this counts as no answer.
const ACCESS_PROMPT_TIMEOUT_MS = 30_000;
const PERMISSION_DENIED = 1;

/**
 * Browsers refuse location on insecure pages, so asking there would only stall.
 */
export const isDeviceLocationSupported = (): boolean =>
  typeof window !== 'undefined' && window.isSecureContext && Boolean(navigator.geolocation);

/**
 * Shows the browser's permission prompt. Call it from a click, so the prompt
 * appears on Seneca's own consent screen instead of on top of the camera app.
 */
export const requestLocationAccess = (
  timeoutMs = ACCESS_PROMPT_TIMEOUT_MS,
): Promise<LocationAccess> => {
  if (!isDeviceLocationSupported()) {
    return Promise.resolve('unavailable');
  }

  return new Promise(resolve => {
    let settled = false;
    const finish = (value: LocationAccess): void => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }
    };
    const timer = window.setTimeout(() => finish('unavailable'), timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        () => finish('granted'),
        error => finish(error?.code === PERMISSION_DENIED ? 'denied' : 'unavailable'),
        { timeout: timeoutMs, maximumAge: 60_000 },
      );
    } catch {
      finish('unavailable');
    }
  });
};

/**
 * Best-effort position of the phone, used to pin a camera capture to where it
 * was taken. Resolves null instead of rejecting: a denied prompt, no GPS fix or
 * an insecure page must never block the upload it accompanies.
 */
export const getDeviceLocation = (
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DeviceLocation | null> => {
  if (!isDeviceLocationSupported()) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    let settled = false;
    const finish = (value: DeviceLocation | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };

    // getCurrentPosition's own timeout starts only once permission is granted,
    // so a prompt the user ignores would otherwise keep the upload waiting.
    const timer = window.setTimeout(() => finish(null), timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) =>
          finish({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          }),
        () => finish(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
      );
    } catch {
      finish(null);
    }
  });
};

/**
 * Reports fixes at least as precise as `maxAccuracyM` until stopped. Never
 * prompts by itself in practice: callers only start it once the user has
 * granted location for receipts. Errors (no fix yet, GPS off) are ignored,
 * the watch simply keeps waiting.
 */
export const watchDeviceLocation = (
  onFix: (location: DeviceLocation) => void,
  maxAccuracyM: number,
): (() => void) => {
  if (!isDeviceLocationSupported()) {
    return () => undefined;
  }

  let watchId: number | null = null;
  try {
    watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (coords.accuracy <= maxAccuracyM) {
          onFix({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          });
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  } catch {
    watchId = null;
  }

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
};

/**
 * Whether the browser says location is blocked for this site. Unknown (no
 * Permissions API, as on older Safari) counts as not blocked.
 */
export const isDeviceLocationBlocked = async (): Promise<boolean> => {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' });
    return status?.state === 'denied';
  } catch {
    return false;
  }
};
