'use client';

import type React from 'react';
import { AnalyticsLeaderboardSkeleton } from '@/app/(main)/statements/components/analytics/AnalyticsLeaderboardSkeleton';
import { AnalyticsMonthEmpty } from '@/app/(main)/statements/components/analytics/flow/AnalyticsMonthEmpty';
import type { AnalyticsViewMode } from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  title: string;
  /** The section's own month strip and toggles. */
  header: React.ReactNode;
  /** The chart fetches on its own and draws its own skeleton. */
  viewMode: AnalyticsViewMode;
  loading: boolean;
  isEmpty: boolean;
  isIncome: boolean;
  month: Date;
  emptyLabels: { emptyMonthSpend: string; emptyMonthIncome: string; emptyMonthHint: string };
  children: React.ReactNode;
  /**
   * The `?focus=` id this section answers to, so a deep link that opens on the
   * chart still rings and scrolls to something: the chart draws no element of
   * its own to tag, so the whole card stands in for it. Table mode already
   * rings its own row, so this is only read in chart mode.
   */
  attentionId?: string | null;
};

/**
 * One leaderboard on the Cash flow tab: its name, its own header and the body,
 * which is the content, its skeleton or the empty month.
 */
export function AnalyticsSection({
  title,
  header,
  viewMode,
  loading,
  isEmpty,
  isIncome,
  month,
  emptyLabels,
  children,
  attentionId,
}: Props): React.JSX.Element {
  const showSkeleton = viewMode !== 'chart' && loading;
  const showEmpty = viewMode !== 'chart' && !loading && isEmpty;
  return (
    <section
      className="lumio-cash-flow__section"
      data-attention={viewMode === 'chart' ? (attentionId ?? undefined) : undefined}
    >
      <h2 className="lumio-cash-flow__section-title">{title}</h2>
      {header}
      {showSkeleton ? <AnalyticsLeaderboardSkeleton /> : null}
      {showEmpty ? (
        <div
          style={{
            border: '1px dashed var(--border-color)',
            background: 'var(--card-bg)',
            borderRadius: tokens.radius.lg,
          }}
        >
          <AnalyticsMonthEmpty month={month} isIncome={isIncome} labels={emptyLabels} />
        </div>
      ) : null}
      {showSkeleton || showEmpty ? null : children}
    </section>
  );
}
