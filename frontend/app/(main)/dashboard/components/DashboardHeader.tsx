'use client';

import type React from 'react';
import type { DashboardTabId } from '../helpers/dashboard-url-state';
import { DashboardTabs, type DashboardTabsLabels } from './DashboardTabs';
import { MonthStrip, type MonthStripLabels } from './MonthStrip';

export type DashboardHeaderLabels = {
  tabs: DashboardTabsLabels;
  monthStrip: MonthStripLabels;
};

type DashboardHeaderProps = {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  displayMonth: Date;
  changeMonth: (year: number, month: number) => void;
  locale: string;
  /** "Showing latest available period …" when the backend auto-shifted the window. */
  periodBanner: string | null;
  labels: DashboardHeaderLabels;
};

export function DashboardHeader({
  activeTab,
  onTabChange,
  displayMonth,
  changeMonth,
  locale,
  periodBanner,
  labels,
}: DashboardHeaderProps): React.JSX.Element {
  return (
    <div className="lumio-dashboard-header">
      <div className="lumio-dashboard-header__tabs">
        <DashboardTabs activeTab={activeTab} onTabChange={onTabChange} labels={labels.tabs} />
      </div>
      <div className="lumio-dashboard-header__controls">
        <MonthStrip
          displayMonth={displayMonth}
          onChange={changeMonth}
          locale={locale}
          labels={labels.monthStrip}
        />
        {periodBanner && <div className="lumio-dashboard__period-banner">{periodBanner}</div>}
      </div>
    </div>
  );
}
