// Main Components

// Page Configuration Factories
export { createBasicSidePanelConfig } from './configs';
// Example Components
export {
  AppLayoutWithSidePanel,
  PageWithSidePanel,
} from './examples/SidePanelPageLayout';

// Hooks
export { useCurrentSidePanelConfig, useSidePanelConfig } from './hooks/useSidePanelConfig';
export { SidePanel } from './SidePanel';
export { SidePanelProvider, useSidePanel, useSidePanelOptional } from './SidePanelContext';
// Section Renderers (for custom implementations)
export {
  ActionsSectionRenderer,
  ChartSectionRenderer,
  CustomSectionRenderer,
  ErrorSectionRenderer,
  MetricsSectionRenderer,
  NavigationSectionRenderer,
  SectionRenderer,
  SettingsSectionRenderer,
  StatusSectionRenderer,
  SummarySectionRenderer,
} from './sections';

// Types
export type {
  ActionItem,
  ActionsSection,
  ChartItem,
  ChartSection,
  CustomSection,
  ErrorItem,
  ErrorSection,
  MetricsSection,
  // Item types
  NavigationItem,
  NavigationSection,
  SettingsSection,
  SettingsSelectItem,
  SettingsToggleItem,
  // Context types
  SidePanelContextState,
  SidePanelPageConfig,
  // Configuration types
  SidePanelPermissions,
  SidePanelPosition,
  SidePanelProps,
  SidePanelProviderProps,
  SidePanelSection,
  // Section types
  SidePanelSectionBase,
  SidePanelSectionType,
  // Core types
  SidePanelWidth,
  StatusItem,
  StatusSection,
  SummaryItem,
  SummarySection,
} from './types';

// Utility exports
export {
  ACTION_VARIANTS,
  BADGE_VARIANTS,
  getWidthValue,
  STATUS_COLORS,
  WIDTH_VALUES,
} from './types';
