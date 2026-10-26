'use client';

import { useMemo } from 'react';
import { useInsights } from '@/app/hooks/useInsights';
import { byWorkPriority, isWorkInsight, type WorkInsight } from './work-insights';

export interface AttentionItems {
  items: WorkInsight[];
  isPending: boolean;
  /** Hides an item until its number grows or a week passes (the server keeps that). */
  snooze: (id: string) => void;
}

/** The work items for the strip above the page, most blocking first. */
export function useAttentionItems(): AttentionItems {
  const { items, isPending, dismiss } = useInsights({ severities: ['warn', 'critical'] });
  const work = useMemo(() => items.filter(isWorkInsight).sort(byWorkPriority), [items]);
  return { items: work, isPending, snooze: dismiss };
}
