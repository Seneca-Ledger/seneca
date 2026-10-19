'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
import { cn } from '@/app/lib/utils';
import { createBasicSidePanelConfig } from '../configs';
import { SidePanel, SidePanelProvider } from '../index';
import type { SidePanelPageConfig, SidePanelPosition, SidePanelWidth } from '../types';

// ============================================================================
// Page Layout with Side Panel
// ============================================================================

interface PageWithSidePanelProps {
  children: React.ReactNode;
  /** Side panel configuration */
  sidePanelConfig: SidePanelPageConfig;
  /** Panel visibility */
  showSidePanel?: boolean;
  /** Panel width */
  sidePanelWidth?: SidePanelWidth;
  /** Panel position */
  sidePanelPosition?: SidePanelPosition;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Enabled section IDs */
  enabledSections?: string[];
  /** Additional class for main content */
  contentClassName?: string;
  /** Additional class for container */
  className?: string;
}

/**
 * A reusable page layout component that includes a side panel.
 * Wraps content with the side panel and provides proper flex layout.
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function PageWithSidePanel({
  children,
  sidePanelConfig,
  showSidePanel = true,
  sidePanelWidth = 'md',
  sidePanelPosition = 'right',
  defaultCollapsed = false,
  enabledSections,
  contentClassName,
  className,
}: PageWithSidePanelProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        'flex min-h-[calc(100vh-var(--global-nav-height,0px))]',
        sidePanelPosition === 'left' && 'flex-row-reverse',
        className,
      )}
    >
      {/* Main Content */}
      <main className={cn('flex-1 min-w-0 overflow-auto', contentClassName)}>{children}</main>

      {/* Side Panel */}
      {showSidePanel && (
        <SidePanel
          config={sidePanelConfig}
          width={sidePanelWidth}
          position={sidePanelPosition}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          enabledSections={enabledSections}
          showCollapseToggle
          collapseTogglePosition="header"
        />
      )}
    </div>
  );
}

// ============================================================================
// Example: Statements Page with Side Panel
// ============================================================================

export function StatementsPageExample(): React.JSX.Element {
  // Simulated state - in real app, this would come from API/context
  const [statusFilter] = useState('');

  // Create configuration with current state
  const sidePanelConfig = useMemo(
    () =>
      createBasicSidePanelConfig({
        pageId: 'statements',
        title: 'Statements',
        subtitle: 'Overview',
      }),
    [],
  );

  return (
    <PageWithSidePanel sidePanelConfig={sidePanelConfig} sidePanelWidth="md">
      <Box className="container-shared" sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: 6 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
          Statements
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Current filter: {statusFilter || 'All'}
        </Typography>
        {/* Rest of page content */}
      </Box>
    </PageWithSidePanel>
  );
}

// ============================================================================
// Example: Reports Page with Side Panel
// ============================================================================

export function ReportsPageExample(): React.JSX.Element {
  const [activeTab, SetActiveTab] = useState('sheets');

  const sidePanelConfig = useMemo(
    () =>
      createBasicSidePanelConfig({
        pageId: 'reports',
        title: 'Reports',
        subtitle: `Overview - ${activeTab}`,
      }),
    [activeTab],
  );

  return (
    <PageWithSidePanel
      sidePanelConfig={sidePanelConfig}
      sidePanelWidth="lg"
      sidePanelPosition="right"
    >
      <Box className="container-shared" sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: 6 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
          Reports - {activeTab}
        </Typography>
        {/* Rest of page content */}
      </Box>
    </PageWithSidePanel>
  );
}

// ============================================================================
// Example: Storage Page with Side Panel
// ============================================================================

export function StoragePageExample(): React.JSX.Element {
  const [activeFolderId, SetActiveFolderId] = useState('');

  const sidePanelConfig = useMemo(
    () =>
      createBasicSidePanelConfig({
        pageId: 'storage',
        title: 'Storage',
        subtitle: activeFolderId ? `Folder ${activeFolderId}` : 'Overview',
      }),
    [activeFolderId],
  );

  return (
    <PageWithSidePanel
      sidePanelConfig={sidePanelConfig}
      sidePanelWidth="md"
      defaultCollapsed={false}
    >
      <Box className="container-shared" sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: 6 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
          Storage
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Active folder: {activeFolderId || 'All Files'}
        </Typography>
        {/* Rest of page content */}
      </Box>
    </PageWithSidePanel>
  );
}

// ============================================================================
// Example: Settings Page with Side Panel on Left
// ============================================================================

// eslint-disable-next-line max-lines-per-function
export function SettingsPageExample(): React.JSX.Element {
  const [activeSection, SetActiveSection] = useState('profile');
  const [Settings, SetSettings] = useState({
    notifications: true,
    emailNotifications: false,
    darkMode: false,
    language: 'en',
    twoFactor: false,
  });

  const sidePanelConfig = useMemo(
    () =>
      createBasicSidePanelConfig({
        pageId: 'settings',
        title: 'Settings',
        subtitle: activeSection,
      }),
    [activeSection],
  );

  return (
    <PageWithSidePanel
      sidePanelConfig={sidePanelConfig}
      sidePanelWidth="sm"
      sidePanelPosition="left"
    >
      <Box className="container-shared" sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: 6 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
          Settings - {activeSection}
        </Typography>
        {/* Rest of page content based on activeSection */}
      </Box>
    </PageWithSidePanel>
  );
}

// ============================================================================
// Full App Layout Example with Provider
// ============================================================================

interface AppLayoutWithSidePanelProps {
  children: React.ReactNode;
}

/**
 * Example of how to wrap the entire app with the SidePanelProvider.
 * This should be added to the app's providers or layout.
 */
export function AppLayoutWithSidePanel({
  children,
}: AppLayoutWithSidePanelProps): React.JSX.Element {
  // Optional: Get user permissions from auth context
  const checkPermission = (permission: string): boolean => {
    // In a real app, check against user's permissions
    const userPermissions = ['statement.view', 'storage.view', 'reports.view'];
    return userPermissions.includes(permission);
  };

  return (
    <SidePanelProvider
      defaultWidth="md"
      defaultPosition="right"
      defaultCollapsed={false}
      checkPermission={checkPermission}
      persistState={true}
      storageKey="app-side-panel"
    >
      {children}
    </SidePanelProvider>
  );
}
