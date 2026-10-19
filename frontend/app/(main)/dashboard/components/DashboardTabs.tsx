'use client';

import { Tab, Tabs } from '@mui/material';
import type React from 'react';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { DASHBOARD_TABS, type DashboardTabId } from '../helpers/dashboard-url-state';

export type DashboardTabsLabels = {
  financeOps: string;
  overview: string;
  trends: string;
  dataHealth: string;
};

const TAB_LABEL_KEY: Record<DashboardTabId, keyof DashboardTabsLabels> = {
  overview: 'overview',
  trends: 'trends',
  'finance-ops': 'financeOps',
  'data-health': 'dataHealth',
};

type DashboardTabsProps = {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  labels: DashboardTabsLabels;
};

export function DashboardTabs({
  activeTab,
  onTabChange,
  labels,
}: DashboardTabsProps): React.JSX.Element {
  // eslint-disable-next-line max-params
  const handleChange = (_: React.SyntheticEvent, value: DashboardTabId): void => onTabChange(value);
  return (
    <Tabs
      value={activeTab}
      onChange={handleChange}
      variant="scrollable"
      scrollButtons={false}
      sx={sharedMuiTabsSx}
    >
      {DASHBOARD_TABS.map(tab => (
        <Tab key={tab} value={tab} label={labels[TAB_LABEL_KEY[tab]]} />
      ))}
    </Tabs>
  );
}
