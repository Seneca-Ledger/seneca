// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceLocation } from '@/app/lib/device-location';
import {
  enqueuePlaceFollowups,
  FOLLOWUP_WATCH_MS,
  listPlaceFollowups,
  setReceiptPlacePrompt,
} from '@/app/lib/receipt-place-followup';
import { RETURN_ATTEMPT_MS, useReceiptPlaceFollowup } from './useReceiptPlaceFollowup';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  workspaceId: 'ws-1' as string | null,
  capture: 'on' as 'on' | 'off' | null,
  blocked: false,
  supported: true,
  getPlaceSuggestions: vi.fn(),
  stops: [] as Array<ReturnType<typeof vi.fn>>,
  emit: null as ((fix: DeviceLocation) => void) | null,
}));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: mocks.workspaceId ? { id: mocks.workspaceId } : null }),
}));
vi.mock('@/app/lib/receipt-location-capture', () => ({
  useReceiptLocationCapture: () => mocks.capture,
}));
vi.mock('@/app/lib/api', () => ({
  receiptsApi: { getPlaceSuggestions: mocks.getPlaceSuggestions },
}));
vi.mock('@/app/lib/device-location', () => ({
  isDeviceLocationSupported: () => mocks.supported,
  isDeviceLocationBlocked: async () => mocks.blocked,
  watchDeviceLocation: (onFix: (fix: DeviceLocation) => void) => {
    mocks.emit = onFix;
    const stop = vi.fn(() => {
      if (mocks.emit === onFix) {
        mocks.emit = null;
      }
    });
    mocks.stops.push(stop);
    return stop;
  },
}));

const FIX: DeviceLocation = { latitude: 43.7308, longitude: 7.417, accuracy: 20 };

const suggestions = (receiptId: string) => ({
  needed: true as const,
  receiptId,
  vendor: 'Carrefour',
  amount: 12.5,
  currency: 'EUR',
  date: null,
  candidates: [{ name: 'Carrefour', osmType: 'node', osmId: '1', lat: 1, lng: 2, distanceM: 5 }],
});

const queue = (statementId: string, ageMs: number, workspaceId = 'ws-1') =>
  enqueuePlaceFollowups([{ statementId, workspaceId, capturedAt: Date.now() - ageMs }]);

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
};

const watching = () => mocks.emit !== null;

describe('useReceiptPlaceFollowup', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.user = { id: 'user-1' };
    mocks.workspaceId = 'ws-1';
    mocks.capture = 'on';
    mocks.blocked = false;
    mocks.supported = true;
    mocks.emit = null;
    mocks.stops = [];
    mocks.getPlaceSuggestions.mockReset();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks about a queued receipt once GPS comes back', async () => {
    queue('statement-1', 60_000);
    mocks.getPlaceSuggestions.mockResolvedValue(suggestions('receipt-1'));
    const { result } = renderHook(() => useReceiptPlaceFollowup());

    await waitFor(() => expect(watching()).toBe(true));
    act(() => mocks.emit?.(FIX));

    await waitFor(() => expect(result.current.question?.statementId).toBe('statement-1'));
    expect(mocks.getPlaceSuggestions).toHaveBeenCalledWith({
      statementId: 'statement-1',
      latitude: 43.7308,
      longitude: 7.417,
      accuracy: 20,
    });
    expect(result.current.question?.suggestions.receiptId).toBe('receipt-1');
    expect(watching()).toBe(false);

    act(() => result.current.finish('statement-1'));
    expect(result.current.question).toBeNull();
    expect(listPlaceFollowups()).toEqual([]);
  });

  it('drops receipts whose shop is already known and moves on to the next', async () => {
    queue('known', 1000);
    queue('unknown', 2000);
    mocks.getPlaceSuggestions.mockImplementation(async ({ statementId }: { statementId: string }) =>
      statementId === 'known' ? { needed: false } : suggestions('receipt-2'),
    );
    const { result } = renderHook(() => useReceiptPlaceFollowup());

    await waitFor(() => expect(watching()).toBe(true));
    act(() => mocks.emit?.(FIX));

    await waitFor(() => expect(result.current.question?.statementId).toBe('unknown'));
    expect(listPlaceFollowups().map(entry => entry.statementId)).toEqual(['unknown']);
  });

  it('forgets a receipt that no longer exists but keeps one after a network error', async () => {
    queue('gone', 1000);
    queue('offline', 2000);
    mocks.getPlaceSuggestions.mockImplementation(async ({ statementId }: { statementId: string }) => {
      throw statementId === 'gone'
        ? { isAxiosError: true, response: { status: 400 } }
        : { isAxiosError: true, code: 'ERR_NETWORK' };
    });
    const { result } = renderHook(() => useReceiptPlaceFollowup());

    await waitFor(() => expect(watching()).toBe(true));
    act(() => mocks.emit?.(FIX));

    await waitFor(() => expect(mocks.getPlaceSuggestions).toHaveBeenCalledTimes(2));
    expect(result.current.question).toBeNull();
    expect(listPlaceFollowups().map(entry => entry.statementId)).toEqual(['offline']);
  });

  it('does not ask without candidates', async () => {
    queue('statement-1', 1000);
    mocks.getPlaceSuggestions.mockResolvedValue({ ...suggestions('receipt-1'), candidates: [] });
    const { result } = renderHook(() => useReceiptPlaceFollowup());

    await waitFor(() => expect(watching()).toBe(true));
    act(() => mocks.emit?.(FIX));

    await waitFor(() => expect(listPlaceFollowups()).toEqual([]));
    expect(result.current.question).toBeNull();
  });

  it('stops watching while the app is in the background', async () => {
    queue('statement-1', 1000);
    renderHook(() => useReceiptPlaceFollowup());
    await waitFor(() => expect(watching()).toBe(true));

    act(() => setVisibility('hidden'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(watching()).toBe(false);
    expect(mocks.stops).toHaveLength(1);

    act(() => setVisibility('visible'));
    await waitFor(() => expect(watching()).toBe(true));
  });

  it('watches until twenty minutes after the shot', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queue('statement-1', FOLLOWUP_WATCH_MS - 5_000);
    renderHook(() => useReceiptPlaceFollowup());
    await waitFor(() => expect(watching()).toBe(true));

    act(() => vi.advanceTimersByTime(6_000));
    expect(watching()).toBe(false);
  });

  it('gives an older shot one short attempt each time the app comes back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queue('statement-1', FOLLOWUP_WATCH_MS + 60_000);
    renderHook(() => useReceiptPlaceFollowup());
    await waitFor(() => expect(watching()).toBe(true));

    act(() => vi.advanceTimersByTime(RETURN_ATTEMPT_MS + 1));
    expect(watching()).toBe(false);

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await waitFor(() => expect(watching()).toBe(true));
  });

  it.each([
    ['signed out', () => (mocks.user = null)],
    ['capture is off', () => (mocks.capture = 'off')],
    ['the prompt is turned off', () => setReceiptPlacePrompt(false)],
    ['location is blocked in the browser', () => (mocks.blocked = true)],
    ['geolocation is unsupported', () => (mocks.supported = false)],
    ['the receipt belongs to another workspace', () => (mocks.workspaceId = 'ws-2')],
  ])('never touches GPS when %s', async (_case, arrange) => {
    queue('statement-1', 1000);
    arrange();
    renderHook(() => useReceiptPlaceFollowup());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.stops).toHaveLength(0);
    expect(mocks.getPlaceSuggestions).not.toHaveBeenCalled();
  });

  it('does nothing with an empty queue', async () => {
    renderHook(() => useReceiptPlaceFollowup());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.stops).toHaveLength(0);
  });
});
