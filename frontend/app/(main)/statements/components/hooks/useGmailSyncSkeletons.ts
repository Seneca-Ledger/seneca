'use client';

import { useEffect, useState } from 'react';
import {
  type GmailSyncSkeletonMeta,
  STATEMENTS_GMAIL_SYNC_EVENT,
  STATEMENTS_GMAIL_SYNC_STORAGE_KEY,
} from '@/app/lib/statement-upload-actions';

/** Pending Gmail-sync skeleton count persisted by the upload flow; 0 when absent or corrupt. */
function readStoredGmailSyncCount(): number {
  const raw = sessionStorage.getItem(STATEMENTS_GMAIL_SYNC_STORAGE_KEY);
  if (!raw) {
    return 0;
  }
  try {
    const parsed = JSON.parse(raw) as GmailSyncSkeletonMeta | null;
    return parsed ? parsed.count : 0;
  } catch {
    sessionStorage.removeItem(STATEMENTS_GMAIL_SYNC_STORAGE_KEY);
    return 0;
  }
}

const buildGmailSyncSkeletonKeys = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `gmail-sync-${Date.now()}-${index}`);

export interface UseGmailSyncSkeletonsResult {
  gmailSyncSkeletonKeys: string[];
  setGmailSyncSkeletonKeys: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Плейсхолдеры для загрузок, которых сервер ещё не видит. Это не серверный
 * стейт: инвалидировать нечего, поэтому событие и sessionStorage остаются как
 * были и в кэш React Query не переезжают.
 */
export function useGmailSyncSkeletons({
  pageSize,
}: {
  pageSize: number;
}): UseGmailSyncSkeletonsResult {
  const [gmailSyncSkeletonKeys, setGmailSyncSkeletonKeys] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const count = readStoredGmailSyncCount();
    if (count > 0) {
      setGmailSyncSkeletonKeys(buildGmailSyncSkeletonKeys(Math.min(count, pageSize)));
    }
  }, [pageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleGmailSyncEvent = (event: Event): void => {
      const detail = (event as CustomEvent<GmailSyncSkeletonMeta>).detail;
      if (!detail || detail.count <= 0) {
        return;
      }
      setGmailSyncSkeletonKeys(buildGmailSyncSkeletonKeys(Math.min(detail.count, pageSize)));
    };

    window.addEventListener(STATEMENTS_GMAIL_SYNC_EVENT, handleGmailSyncEvent);
    return () => {
      window.removeEventListener(STATEMENTS_GMAIL_SYNC_EVENT, handleGmailSyncEvent);
    };
  }, [pageSize]);

  return { gmailSyncSkeletonKeys, setGmailSyncSkeletonKeys };
}
