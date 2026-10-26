'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { type PlaceSuggestions, receiptsApi } from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import {
  type DeviceLocation,
  isDeviceLocationBlocked,
  isDeviceLocationSupported,
  watchDeviceLocation,
} from '@/app/lib/device-location';
import { useReceiptLocationCapture } from '@/app/lib/receipt-location-capture';
import {
  FOLLOWUP_WATCH_MS,
  GOOD_FIX_ACCURACY_M,
  listPlaceFollowups,
  removePlaceFollowup,
  useReceiptPlaceFollowups,
} from '@/app/lib/receipt-place-followup';

export type PlaceQuestion = {
  statementId: string;
  suggestions: Extract<PlaceSuggestions, { needed: true }>;
};

/** For an older shot (the app was closed), how long one return to the app looks for a fix. */
export const RETURN_ATTEMPT_MS = 60_000;

const useDocumentVisible = (): boolean => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = (): void => setVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return visible;
};

const askAboutEntry = async (
  statementId: string,
  fix: DeviceLocation,
): Promise<PlaceQuestion | 'drop' | 'retry'> => {
  try {
    const suggestions = await receiptsApi.getPlaceSuggestions({
      statementId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
    });
    return suggestions.needed && suggestions.candidates.length > 0
      ? { statementId, suggestions }
      : 'drop';
  } catch (error) {
    // Gone (deleted, or never became a receipt): stop asking. Anything else is
    // worth another try with the next fix.
    return getApiErrorStatus(error) === 400 ? 'drop' : 'retry';
  }
};

/** The first queued receipt of the workspace worth asking about; settled ones leave the queue. */
const findQuestion = async (
  fix: DeviceLocation,
  workspaceId: string,
): Promise<PlaceQuestion | null> => {
  for (const entry of listPlaceFollowups()) {
    if (entry.workspaceId !== workspaceId) {
      continue;
    }
    const outcome = await askAboutEntry(entry.statementId, fix);
    if (outcome === 'retry') {
      return null;
    }
    if (outcome !== 'drop') {
      return outcome;
    }
    removePlaceFollowup(entry.statementId);
  }
  return null;
};

/**
 * Waits for GPS to come back while the app is on screen, then asks the backend
 * for shops near the fix, one queued receipt at a time. Only receipts of the
 * open workspace are asked about: the API client would treat a 403 from
 * another workspace as a lost membership and leave the page.
 */
export function useReceiptPlaceFollowup(): {
  question: PlaceQuestion | null;
  finish: (statementId: string) => void;
} {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const capture = useReceiptLocationCapture();
  const { promptOn, pending } = useReceiptPlaceFollowups();
  const visible = useDocumentVisible();
  const [question, setQuestion] = useState<PlaceQuestion | null>(null);
  const busyRef = useRef(false);

  const workspaceId = currentWorkspace?.id ?? null;
  const due = pending.filter(entry => entry.workspaceId === workspaceId);
  const newestCapturedAt = due[0]?.capturedAt ?? null;
  const enabled =
    Boolean(user) && workspaceId !== null && promptOn && capture === 'on' && question === null;

  const askAbout = useCallback(
    async (fix: DeviceLocation): Promise<void> => {
      if (busyRef.current || workspaceId === null) {
        return;
      }
      busyRef.current = true;
      try {
        const next = await findQuestion(fix, workspaceId);
        if (next) {
          setQuestion(next);
        }
      } finally {
        busyRef.current = false;
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!(enabled && visible && newestCapturedAt !== null && isDeviceLocationSupported())) {
      return undefined;
    }

    let stop: (() => void) | null = null;
    let timer: number | undefined;
    let cancelled = false;

    void isDeviceLocationBlocked().then(blocked => {
      if (blocked || cancelled) {
        return;
      }
      const now = Date.now();
      const watchEnd = newestCapturedAt + FOLLOWUP_WATCH_MS;
      const until = watchEnd > now ? watchEnd : now + RETURN_ATTEMPT_MS;
      stop = watchDeviceLocation(fix => {
        stop?.();
        void askAbout(fix);
      }, GOOD_FIX_ACCURACY_M);
      timer = window.setTimeout(() => stop?.(), until - now);
    });

    return () => {
      cancelled = true;
      stop?.();
      window.clearTimeout(timer);
    };
  }, [enabled, visible, newestCapturedAt, askAbout]);

  const finish = useCallback((statementId: string): void => {
    removePlaceFollowup(statementId);
    setQuestion(null);
  }, []);

  return { question, finish };
}
