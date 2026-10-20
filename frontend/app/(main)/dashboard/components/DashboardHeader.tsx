'use client';

import type React from 'react';
import { MonthStrip, type MonthStripLabels } from './MonthStrip';

export type DashboardHeaderLabels = {
  monthStrip: MonthStripLabels;
};

type DashboardHeaderProps = {
  displayMonth: Date;
  changeMonth: (year: number, month: number) => void;
  locale: string;
  /** "Showing latest available period …" when the backend auto-shifted the window. */
  periodBanner: string | null;
  labels: DashboardHeaderLabels;
};

export function DashboardHeader({
  displayMonth,
  changeMonth,
  locale,
  periodBanner,
  labels,
}: DashboardHeaderProps): React.JSX.Element {
  return (
    <div className="seneca-dashboard-header">
      <div className="seneca-dashboard-header__controls" data-tour-shot="dashboard-month">
        <MonthStrip
          displayMonth={displayMonth}
          onChange={changeMonth}
          locale={locale}
          labels={labels.monthStrip}
        />
        {periodBanner && <div className="seneca-dashboard__period-banner">{periodBanner}</div>}
      </div>
    </div>
  );
}
