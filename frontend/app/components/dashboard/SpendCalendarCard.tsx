'use client';

import type React from 'react';
import { SpendOverTimeCalendar } from '@/app/(main)/statements/components/spend-over-time/components/SpendOverTimeCalendar';
import { SpendOverTimeCalendarSkeleton } from '@/app/(main)/statements/components/spend-over-time/components/SpendOverTimeCalendarSkeleton';
import { SpendOverTimeDrillDown } from '@/app/(main)/statements/components/spend-over-time/components/SpendOverTimeDrillDown';
import { useSpendOverTimeViewModel } from '@/app/(main)/statements/components/spend-over-time/hooks/useSpendOverTimeViewModel';
import { DashboardCard } from './ui';
import { useMonthLabel } from './use-month-label';

interface SpendCalendarCardProps {
  /** The month the dashboard header is showing; the calendar has no nav of its own. */
  displayMonth: Date;
}

export function SpendCalendarCard({ displayMonth }: SpendCalendarCardProps): React.JSX.Element {
  const vm = useSpendOverTimeViewModel();
  const monthLabel = useMonthLabel(displayMonth);

  return (
    <DashboardCard title={vm.labels.title} subtitle={monthLabel}>
      {vm.loading ? (
        <SpendOverTimeCalendarSkeleton />
      ) : (
        <SpendOverTimeCalendar
          records={vm.flowFilteredRecords}
          month={displayMonth}
          currency={vm.workspaceCurrency}
          onDayClick={vm.setSelectedPeriod}
          labels={{
            emptyMonth: vm.labels.calendarEmptyMonth,
            operations: vm.labels.calendarOperations,
          }}
        />
      )}
      {vm.selectedPoint ? (
        <SpendOverTimeDrillDown
          selectedPoint={vm.selectedPoint}
          drillDownRecords={vm.drillDownRecords}
          groupBy="day"
          onClose={() => vm.setSelectedPeriod(null)}
          currency={vm.workspaceCurrency}
          sourceLabels={vm.sourceLabels}
          labels={{
            drillDown: vm.labels.drillDown,
            close: vm.labels.close,
            noOperations: vm.labels.noOperations,
            lastOperation: vm.labels.lastOperation,
            source: vm.labels.source,
            workspace: vm.labels.workspace,
            amount: vm.labels.amount,
          }}
        />
      ) : null}
    </DashboardCard>
  );
}
