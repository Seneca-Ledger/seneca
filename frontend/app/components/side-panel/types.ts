import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from '@/app/components/icons';

// ============================================================================
// Core Configuration Types
// ============================================================================

/** Width presets for the side panel */
export type SidePanelWidth = 'sm' | 'md' | 'lg' | 'xl' | number;

/** Position of the side panel */
export type SidePanelPosition = 'left' | 'right';

/** Section types supported by the side panel */
export type SidePanelSectionType =
  | 'navigation'
  | 'status'
  | 'summary'
  | 'metrics'
  | 'actions'
  | 'settings'
  | 'error'
  | 'chart'
  | 'custom';

// ============================================================================
// Content Item Types
// ============================================================================

/** Navigation link item */
export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon | ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  badgeLoading?: boolean;
  emphasis?: 'default' | 'high' | 'low';
  disabled?: boolean;
  active?: boolean;
  children?: NavigationItem[];
}

/** Status indicator item */
export interface StatusItem {
  id: string;
  label: string;
  status: 'online' | 'offline' | 'pending' | 'error' | 'warning' | 'success';
  description?: string;
  timestamp?: string | Date;
  icon?: LucideIcon | ReactNode;
}

/** Summary/metric item for displaying key values */
export interface SummaryItem {
  id: string;
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period?: string;
  };
  icon?: LucideIcon | ReactNode;
  format?: 'number' | 'currency' | 'percentage' | 'custom';
  prefix?: string;
  suffix?: string;
}

/** Action button item */
export interface ActionItem {
  id: string;
  label: string;
  onClick: () => void;
  icon?: LucideIcon | ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
}

/** Settings toggle item */
export interface SettingsToggleItem {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: LucideIcon | ReactNode;
}

/** Settings select item */
export interface SettingsSelectItem {
  id: string;
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: LucideIcon | ReactNode;
}

/** Error display item */
export interface ErrorItem {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp?: string | Date;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
}

/** Chart/metric visualization item */
export interface ChartItem {
  id: string;
  title: string;
  type: 'sparkline' | 'progress' | 'donut' | 'bar' | 'custom';
  data: number[] | { label: string; value: number }[];
  color?: string;
  height?: number;
  customRenderer?: (data: ChartItem['data']) => ReactNode;
}

// ============================================================================
// Section Configuration
// ============================================================================

/** Base section configuration */
export interface SidePanelSectionBase {
  id: string;
  title?: string;
  icon?: LucideIcon | ReactNode;
  titleClassName?: string;
  contentClassName?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  hidden?: boolean;
  className?: string;
}

/** Navigation section */
export interface NavigationSection extends SidePanelSectionBase {
  type: 'navigation';
  items: NavigationItem[];
}

/** Status section */
export interface StatusSection extends SidePanelSectionBase {
  type: 'status';
  items: StatusItem[];
}

/** Summary/metrics section */
export interface SummarySection extends SidePanelSectionBase {
  type: 'summary';
  items: SummaryItem[];
  layout?: 'list' | 'grid';
  columns?: 1 | 2 | 3;
}

/** Metrics section (alias for summary with chart support) */
export interface MetricsSection extends SidePanelSectionBase {
  type: 'metrics';
  items: (SummaryItem | ChartItem)[];
  layout?: 'list' | 'grid';
}

/** Actions section */
export interface ActionsSection extends SidePanelSectionBase {
  type: 'actions';
  items: ActionItem[];
  layout?: 'vertical' | 'horizontal' | 'grid';
}

/** Settings section */
export interface SettingsSection extends SidePanelSectionBase {
  type: 'settings';
  items: (SettingsToggleItem | SettingsSelectItem)[];
}

/** Error display section */
export interface ErrorSection extends SidePanelSectionBase {
  type: 'error';
  items: ErrorItem[];
  maxItems?: number;
}

/** Chart section */
export interface ChartSection extends SidePanelSectionBase {
  type: 'chart';
  items: ChartItem[];
}

/** Custom section with render function */
export interface CustomSection extends SidePanelSectionBase {
  type: 'custom';
  render: () => ReactNode;
}

/** Union type for all section types */
export type SidePanelSection =
  | NavigationSection
  | StatusSection
  | SummarySection
  | MetricsSection
  | ActionsSection
  | SettingsSection
  | ErrorSection
  | ChartSection
  | CustomSection;

// ============================================================================
// Permission & Role Types
// ============================================================================

/** Permission configuration for role-based visibility */
export interface SidePanelPermissions {
  /** Required permissions to view the panel */
  viewPanel?: string[];
  /** Section-level permissions */
  sections?: Record<string, string[]>;
  /** Item-level permissions (sectionId.itemId) */
  items?: Record<string, string[]>;
}

// ============================================================================
// Main Configuration Types
// ============================================================================

/** Page-specific side panel configuration */
export interface SidePanelPageConfig {
  /** Unique identifier for this page config */
  pageId: string;
  /** Panel header configuration */
  header?: {
    title?: string;
    subtitle?: string;
    icon?: LucideIcon | ReactNode;
    actions?: ActionItem[];
  };
  /** Sections to display */
  sections: SidePanelSection[];
  /** Footer content */
  footer?: {
    content?: ReactNode;
    actions?: ActionItem[];
  };
}

/** Main side panel props */
export interface SidePanelProps {
  /** Whether the panel is visible */
  visible?: boolean;
  /** Panel width */
  width?: SidePanelWidth;
  /** Panel position */
  position?: SidePanelPosition;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Controlled collapsed state */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Array of enabled section IDs (if not provided, all sections are enabled) */
  enabledSections?: string[];
  /** Permission configuration */
  permissions?: SidePanelPermissions;
  /** Page-specific configuration */
  config: SidePanelPageConfig;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether to show collapse toggle button */
  showCollapseToggle?: boolean;
  /** Custom collapse toggle position */
  collapseTogglePosition?: 'header' | 'edge';
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Callback for retry on error */
  onRetry?: () => void;
  /** Optional content rendered above panel header */
  topContent?: ReactNode;
}

// ============================================================================
// Context Types
// ============================================================================

/** Side panel context state */
export interface SidePanelContextState {
  /** Current collapsed state */
  isCollapsed: boolean;
  /** Toggle collapsed state */
  toggleCollapsed: () => void;
  /** Set collapsed state */
  setCollapsed: (collapsed: boolean) => void;
  /** Current panel width */
  width: SidePanelWidth;
  /** Set panel width */
  setWidth: (width: SidePanelWidth) => void;
  /** Current panel position */
  position: SidePanelPosition;
  /** Set panel position */
  setPosition: (position: SidePanelPosition) => void;
  /** Current page config */
  config: SidePanelPageConfig | null;
  /** Set page config */
  setConfig: (config: SidePanelPageConfig | null) => void;
  /** Collapsed sections by ID */
  collapsedSections: Set<string>;
  /** Toggle section collapsed state */
  toggleSection: (sectionId: string) => void;
  /** Check if user has permission */
  hasPermission: (permission: string) => boolean;
}

/** Side panel provider props */
export interface SidePanelProviderProps {
  children: ReactNode;
  /** Default width */
  defaultWidth?: SidePanelWidth;
  /** Default position */
  defaultPosition?: SidePanelPosition;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Permission checker function */
  checkPermission?: (permission: string) => boolean;
  /** Persist state to localStorage */
  persistState?: boolean;
  /** Storage key for persisted state */
  storageKey?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Width values in pixels */
export const WIDTH_VALUES: Record<Exclude<SidePanelWidth, number>, number> = {
  sm: 240,
  md: 260,
  lg: 320,
  xl: 400,
};

/** Get width value in pixels */
export function getWidthValue(width: SidePanelWidth): number {
  if (typeof width === 'number') return width;
  return WIDTH_VALUES[width];
}

/** Status color mapping */
export const STATUS_COLORS: Record<StatusItem['status'], string> = {
  online: 'bg-green-500',
  success: 'bg-green-500',
  offline: 'bg-gray-400',
  pending: 'bg-yellow-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

/** Badge variant classes */
export const BADGE_VARIANTS: Record<NonNullable<NavigationItem['badgeVariant']>, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/** Action button variant classes */
export const ACTION_VARIANTS: Record<NonNullable<ActionItem['variant']>, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
  outline:
    'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
  ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};
