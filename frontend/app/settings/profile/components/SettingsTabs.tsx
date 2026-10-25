'use client';

import { Tab, Tabs } from '@mui/material';
import type React from 'react';
import type { ComponentType } from 'react';
import {
  Bell,
  Cloud,
  FlaskConical,
  History,
  ShieldCheck,
  UserCircle,
} from '@/app/components/icons';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import {
  SETTINGS_TABS,
  type SettingsTabId,
} from '@/app/settings/profile/helpers/settings-url-state';

export type SettingsTabsLabels = Record<SettingsTabId, string>;

const TAB_ICON: Record<SettingsTabId, ComponentType<{ size?: number }>> = {
  general: UserCircle,
  security: ShieldCheck,
  notifications: Bell,
  data: Cloud,
  advanced: FlaskConical,
  versions: History,
};

type SettingsTabsProps = {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  labels: SettingsTabsLabels;
};

export function SettingsTabs({
  activeTab,
  onTabChange,
  labels,
}: SettingsTabsProps): React.JSX.Element {
  const handleChange = (_: React.SyntheticEvent, value: SettingsTabId): void => onTabChange(value);
  return (
    <Tabs
      value={activeTab}
      onChange={handleChange}
      variant="scrollable"
      scrollButtons={false}
      sx={sharedMuiTabsSx}
    >
      {SETTINGS_TABS.map(tab => {
        const Icon = TAB_ICON[tab];
        return (
          <Tab
            key={tab}
            value={tab}
            icon={<Icon size={16} />}
            iconPosition="start"
            label={labels[tab]}
            data-tour-id={`settings-tab-${tab}`}
            sx={{ minHeight: 48 }}
          />
        );
      })}
    </Tabs>
  );
}
