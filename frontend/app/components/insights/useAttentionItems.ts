'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useInsights } from '@/app/hooks/useInsights';
import { byWorkPriority, isWorkInsight, type WorkInsight } from './work-insights';

/**
 * The dashboard says how many rows wait for confirmation right under its month
 * strip (UnconfirmedNotice): one message lives in one place.
 */
const SHOWN_ON_THE_PAGE: Record<string, WorkInsight['type']> = {
  '/dashboard': 'operational.unapproved_count',
};

export interface AttentionItems {
  items: WorkInsight[];
  isPending: boolean;
  /** Hides an item until its number grows or a week passes (the server keeps that). */
  snooze: (id: string) => void;
}

/** The work items for the strip above the page, most blocking first. */
export function useAttentionItems(): AttentionItems {
  const pathname = usePathname();
  const { items, isPending, dismiss } = useInsights({ severities: ['warn', 'critical'] });
  const shownHere = SHOWN_ON_THE_PAGE[pathname ?? ''];
  const work = useMemo(
    () =>
      items
        .filter(isWorkInsight)
        .filter(item => item.type !== shownHere)
        .sort(byWorkPriority),
    [items, shownHere],
  );
  return { items: work, isPending, snooze: dismiss };
}
