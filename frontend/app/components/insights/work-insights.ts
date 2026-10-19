import type { Insight } from '@/app/hooks/useInsights';

/**
 * Insights that are work to do rather than a comment on the numbers, in order:
 * what keeps a month from closing comes first. They are the only ones shown above
 * the pages; observations (a rising category, risk, the savings rate) live on the
 * Advice page, where the person came for an opinion.
 */
export const WORK_INSIGHT_TYPES = [
  'operational.unapproved_count',
  'operational.uncategorized_count',
  'operational.duplicate_detected',
] as const;

export type WorkInsightType = (typeof WORK_INSIGHT_TYPES)[number];

export type WorkInsight = Insight & { type: WorkInsightType };

export function isWorkInsight(item: Insight): item is WorkInsight {
  return (WORK_INSIGHT_TYPES as readonly string[]).includes(item.type);
}

/** Work first by what blocks the month, then the rest of the list as it came. */
export function byWorkPriority(a: WorkInsight, b: WorkInsight): number {
  return WORK_INSIGHT_TYPES.indexOf(a.type) - WORK_INSIGHT_TYPES.indexOf(b.type);
}

/** How many rows the insight counts; every work insight carries `count`. */
export function workCount(item: WorkInsight): number {
  const count = item.data?.count ?? item.messageParams?.count;
  return typeof count === 'number' ? count : 0;
}
