'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReadOnlyWorkspace } from '@/app/contexts/WorkspaceContext';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus, isVersionReadOnlyError } from '@/app/lib/api-error';
import {
  indexedDbStore,
  isOfflineStoreAvailable,
  OFFLINE_QUEUE_EVENT,
  type OfflineEntry,
  type OfflineStore,
  replay,
} from './offline-queue';

/** Posts one queued entry the way the live form would have. */
export async function sendOfflineEntry(
  entry: OfflineEntry,
): Promise<{ ok: true } | { ok: false; status: number | undefined; error: string }> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entry.fields)) {
    formData.append(key, value);
  }
  for (const file of entry.files) {
    formData.append('files', file);
  }
  const url =
    entry.kind === 'manual-expense' ? '/statements/manual-expense' : '/statements/upload-receipt';
  try {
    await apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        // The same entry may be replayed twice if the app closes mid-send.
        'idempotency-key': entry.id,
      },
    });
    return { ok: true };
  } catch (error: unknown) {
    // A past version refuses every write: no status, so the entry is kept for
    // the live workspace instead of dropped as rejected.
    const status = isVersionReadOnlyError(error) ? undefined : getApiErrorStatus(error);
    return { ok: false, status, error: String(error) };
  }
}

/**
 * How many entries wait on this device, and a replay that runs when the
 * network comes back, when the app starts, and on demand.
 */
export function useOfflineQueue(store: OfflineStore = indexedDbStore) {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const available = isOfflineStoreAvailable();
  // Inside a past version nothing can be sent; read through a ref so the
  // mount-time listeners below see the current state.
  const { isReadOnly } = useReadOnlyWorkspace();
  const readOnlyRef = useRef(isReadOnly);

  const refresh = useCallback(async () => {
    if (!available) return;
    try {
      setCount((await store.list()).length);
    } catch {
      setCount(0);
    }
  }, [available, store]);

  const flush = useCallback(async () => {
    if (!available || replaying || readOnlyRef.current || !navigator.onLine) {
      return { sent: 0, kept: 0 };
    }
    setReplaying(true);
    try {
      return await replay(store, sendOfflineEntry);
    } finally {
      setReplaying(false);
      await refresh();
    }
  }, [available, replaying, store, refresh]);

  // Leaving a version sends what waited meanwhile.
  useEffect(() => {
    const wasReadOnly = readOnlyRef.current;
    readOnlyRef.current = isReadOnly;
    if (wasReadOnly && !isReadOnly && navigator.onLine) void flush();
  }, [isReadOnly, flush]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onChanged = () => void refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, onChanged);
    // Anything left from a previous session goes as soon as the app opens online.
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onChanged);
    };
    // Mount-only: `flush` and `refresh` only change with the store, which is fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { count, online, replaying, flush, refresh };
}
