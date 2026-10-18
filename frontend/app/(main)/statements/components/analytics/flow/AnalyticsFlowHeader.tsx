'use client';

import { MonthStrip } from '@/app/(main)/dashboard/components/MonthStrip';
import type {
  AnalyticsFlowHeaderLabels,
  AnalyticsFlowType,
  AnalyticsViewMode,
} from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { useAnalyticsPeriod } from '@/app/(main)/statements/components/analytics/flow/analytics-period';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer, useLocale } from '@/app/i18n';

type Props = {
  labels: AnalyticsFlowHeaderLabels;
  flowType: AnalyticsFlowType;
  onFlowTypeChange: (flow: AnalyticsFlowType) => void;
  viewMode: AnalyticsViewMode;
  onViewModeChange: (mode: AnalyticsViewMode) => void;
  month: Date;
  onMonthChange: (year: number, month: number) => void;
};

/**
 * Header of one analytics section (top spenders, merchants, categories): the
 * dashboard's month strip (unless the page sets the period), then text tabs for
 * spend/income and chart/table — words, not a pair of filled icon toggles.
 * The section heading above it names the leaderboard, so this carries no title.
 */
export function AnalyticsFlowHeader({
  labels,
  flowType,
  onFlowTypeChange,
  viewMode,
  onViewModeChange,
  month,
  onMonthChange,
}: Props): React.JSX.Element {
  const headerT = useIntlayer('dashboardHeader');
  const { locale } = useLocale();
  // On a page with one period for everything (the Cash flow tab) there is no strip of its own.
  const period = useAnalyticsPeriod();
  const tabs = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 'auto' }}>
      <TextTabs
        value={flowType}
        onChange={onFlowTypeChange}
        ariaLabel={labels.flowTypeLabel}
        options={[
          { value: 'spend', label: labels.tabSpenders },
          { value: 'income', label: labels.tabIncomeSenders },
        ]}
      />
      <TextTabs
        value={viewMode}
        onChange={onViewModeChange}
        ariaLabel={labels.viewModeLabel}
        options={[
          { value: 'chart', label: labels.viewChart },
          { value: 'table', label: labels.viewTable },
        ]}
      />
    </div>
  );
  if (period) {
    return tabs;
  }
  return (
    <div
      style={{
        marginBottom: 20,
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {/* Basis = all twelve chips plus the year stepper: narrower than that the
          toggles wrap below rather than pushing January off the strip. */}
      <div style={{ flex: '1 1 880px', minWidth: 0 }}>
        <MonthStrip
          displayMonth={month}
          onChange={onMonthChange}
          locale={locale}
          labels={{
            group: headerT.monthStripLabel.value,
            previousYear: headerT.previousYear.value,
            nextYear: headerT.nextYear.value,
          }}
        />
      </div>
      {tabs}
    </div>
  );
}
