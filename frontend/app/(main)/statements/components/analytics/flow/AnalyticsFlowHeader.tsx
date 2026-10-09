'use client';

import { MonthStrip } from '@/app/(main)/dashboard/components/MonthStrip';
import {
  AnalyticsIconToggle,
  type IconToggleOption,
} from '@/app/(main)/statements/components/analytics/flow/AnalyticsIconToggle';
import type {
  AnalyticsFlowHeaderLabels,
  AnalyticsFlowType,
  AnalyticsViewMode,
} from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { ArrowDownLeft, ArrowUpRight, Table, Workflow } from '@/app/components/icons';
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
 * dashboard's month strip, then icon toggles for spend/income and chart/table.
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
  const flowOptions: IconToggleOption<AnalyticsFlowType>[] = [
    { value: 'spend', label: labels.tabSpenders, Icon: ArrowUpRight },
    { value: 'income', label: labels.tabIncomeSenders, Icon: ArrowDownLeft },
  ];
  const viewOptions: IconToggleOption<AnalyticsViewMode>[] = [
    { value: 'chart', label: labels.viewChart, Icon: Workflow },
    { value: 'table', label: labels.viewTable, Icon: Table },
  ];
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <AnalyticsIconToggle
          options={flowOptions}
          value={flowType}
          onChange={onFlowTypeChange}
          groupLabel={labels.flowTypeLabel}
        />
        <AnalyticsIconToggle
          options={viewOptions}
          value={viewMode}
          onChange={onViewModeChange}
          groupLabel={labels.viewModeLabel}
        />
      </div>
    </div>
  );
}
