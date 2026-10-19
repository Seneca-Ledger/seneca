// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDeviceLocation,
  isDeviceLocationBlocked,
  isDeviceLocationSupported,
  requestLocationAccess,
  watchDeviceLocation,
} from './device-location';

type PositionCallback = (position: { coords: GeolocationCoordinates }) => void;

const setSecureContext = (value: boolean) => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value });
};

const setGeolocation = (getCurrentPosition: ReturnType<typeof vi.fn> | undefined) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: getCurrentPosition ? { getCurrentPosition } : undefined,
  });
};

describe('getDeviceLocation', () => {
  beforeEach(() => {
    setSecureContext(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setGeolocation(undefined);
  });

  it('resolves null when the browser has no geolocation API', async () => {
    setGeolocation(undefined);

    await expect(getDeviceLocation()).resolves.toBeNull();
  });

  it('resolves null on an insecure page, where browsers refuse location anyway', async () => {
    const getCurrentPosition = vi.fn();
    setGeolocation(getCurrentPosition);
    setSecureContext(false);

    await expect(getDeviceLocation()).resolves.toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('returns the coordinates and accuracy of a fix', async () => {
    setGeolocation(
      vi.fn((onSuccess: PositionCallback) =>
        onSuccess({
          coords: { latitude: 43.2383, longitude: 76.9453, accuracy: 18 } as GeolocationCoordinates,
        }),
      ),
    );

    await expect(getDeviceLocation()).resolves.toEqual({
      latitude: 43.2383,
      longitude: 76.9453,
      accuracy: 18,
    });
  });

  it('resolves null when the user denies the prompt', async () => {
    setGeolocation(
      vi.fn((_onSuccess: PositionCallback, onError: (error: unknown) => void) =>
        onError({ code: 1 }),
      ),
    );

    await expect(getDeviceLocation()).resolves.toBeNull();
  });

  it('gives up when the prompt is left unanswered', async () => {
    vi.useFakeTimers();
    setGeolocation(vi.fn());

    const pending = getDeviceLocation(5000);
    vi.advanceTimersByTime(5000);

    await expect(pending).resolves.toBeNull();
  });
});

describe('requestLocationAccess', () => {
  beforeEach(() => {
    setSecureContext(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setGeolocation(undefined);
  });

  it('reports support only where a prompt can actually be shown', () => {
    setGeolocation(vi.fn());
    expect(isDeviceLocationSupported()).toBe(true);

    setSecureContext(false);
    expect(isDeviceLocationSupported()).toBe(false);
  });

  it('is granted when the browser returns a position', async () => {
    setGeolocation(
      vi.fn((onSuccess: PositionCallback) =>
        onSuccess({ coords: { latitude: 1, longitude: 2, accuracy: 3 } as GeolocationCoordinates }),
      ),
    );

    await expect(requestLocationAccess()).resolves.toBe('granted');
  });

  it('is denied only when the user refuses permission', async () => {
    setGeolocation(
      vi.fn((_onSuccess: PositionCallback, onError: (error: { code: number }) => void) =>
        onError({ code: 1 }),
      ),
    );

    await expect(requestLocationAccess()).resolves.toBe('denied');
  });

  it('is unavailable when there is no fix', async () => {
    setGeolocation(
      vi.fn((_onSuccess: PositionCallback, onError: (error: { code: number }) => void) =>
        onError({ code: 2 }),
      ),
    );

    await expect(requestLocationAccess()).resolves.toBe('unavailable');
  });

  it('is unavailable when the prompt is never answered', async () => {
    vi.useFakeTimers();
    setGeolocation(vi.fn());

    const pending = requestLocationAccess(30_000);
    vi.advanceTimersByTime(30_000);

    await expect(pending).resolves.toBe('unavailable');
  });

  it('does not prompt where location is unsupported', async () => {
    const getCurrentPosition = vi.fn();
    setGeolocation(getCurrentPosition);
    setSecureContext(false);

    await expect(requestLocationAccess()).resolves.toBe('unavailable');
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('watchDeviceLocation', () => {
  const setWatch = (watchPosition: ReturnType<typeof vi.fn>, clearWatch = vi.fn()) => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    });
    return clearWatch;
  };

  beforeEach(() => {
    setSecureContext(true);
  });

  afterEach(() => {
    setGeolocation(undefined);
  });

  it('reports only fixes precise enough and stops the watch', () => {
    let emit: PositionCallback = () => undefined;
    const watchPosition = vi.fn((onSuccess: PositionCallback, _onError?: unknown, _options?: unknown) => {
      emit = onSuccess;
      return 7;
    });
    const clearWatch = setWatch(watchPosition);
    const onFix = vi.fn();

    const stop = watchDeviceLocation(onFix, 100);
    emit({ coords: { latitude: 1, longitude: 2, accuracy: 900 } as GeolocationCoordinates });
    emit({ coords: { latitude: 3, longitude: 4, accuracy: 40 } as GeolocationCoordinates });
    stop();
    stop();

    expect(onFix.mock.calls).toEqual([[{ latitude: 3, longitude: 4, accuracy: 40 }]]);
    expect(watchPosition.mock.calls[0]?.[2]).toMatchObject({ enableHighAccuracy: true });
    expect(clearWatch).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('does nothing without geolocation', () => {
    setGeolocation(undefined);

    expect(() => watchDeviceLocation(vi.fn(), 100)()).not.toThrow();
  });
});

describe('isDeviceLocationBlocked', () => {
  const setPermissions = (value: unknown) => {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value });
  };

  afterEach(() => {
    setPermissions(undefined);
  });

  it('is true only when the browser reports denied', async () => {
    setPermissions({ query: vi.fn().mockResolvedValue({ state: 'denied' }) });
    await expect(isDeviceLocationBlocked()).resolves.toBe(true);

    setPermissions({ query: vi.fn().mockResolvedValue({ state: 'prompt' }) });
    await expect(isDeviceLocationBlocked()).resolves.toBe(false);
  });

  it('treats a missing or failing Permissions API as not blocked', async () => {
    setPermissions(undefined);
    await expect(isDeviceLocationBlocked()).resolves.toBe(false);

    setPermissions({ query: vi.fn().mockRejectedValue(new TypeError('geolocation')) });
    await expect(isDeviceLocationBlocked()).resolves.toBe(false);
  });
});
