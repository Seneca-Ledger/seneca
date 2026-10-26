# Side Panel Component

A reusable, configurable side panel component that provides context-aware content for all main pages of the application.

## Features

- **Context-aware**: Each page defines its own menu items, tools, and informational blocks
- **Fully configurable**: Control visibility, width, position, collapsed state, enabled sections, and permissions
- **Multiple content types**: Navigation links, status indicators, summaries, actions, settings, errors, charts
- **Visually secondary**: Non-dominant design that doesn't interfere with main workflow
- **Collapsible**: Smooth collapse/expand animations with persistent state
- **Permission-based**: Role-based visibility for sections and items
- **Type-safe**: Comprehensive TypeScript interfaces

## Installation

The `SidePanelProvider` is already integrated into `frontend/app/providers.tsx`.

## Quick Start

```tsx
import { PageWithSidePanel, createStatementsPageConfig } from '@/app/components/side-panel';

function StatementsPage() {
  const config = createStatementsPageConfig({
    totalStatements: 156,
    processedCount: 142,
    pendingCount: 8,
    errorCount: 6,
    recentActivity: [...],
    onUpload: () => {},
    onRefresh: () => {},
    onFilterByStatus: (status) => {},
    onExport: () => {},
  });

  return (
    <PageWithSidePanel sidePanelConfig={config} sidePanelWidth="md">
      <YourPageContent />
    </PageWithSidePanel>
  );
}
```

## Configuration Options

### SidePanelProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | `true` | Whether the panel is visible |
| `width` | `'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'` | Panel width |
| `position` | `'left' \| 'right'` | `'right'` | Panel position |
| `defaultCollapsed` | `boolean` | `false` | Initial collapsed state |
| `collapsed` | `boolean` | - | Controlled collapsed state |
| `onCollapsedChange` | `(collapsed: boolean) => void` | - | Collapse state callback |
| `enabledSections` | `string[]` | - | Array of enabled section IDs |
| `permissions` | `SidePanelPermissions` | - | Permission configuration |
| `config` | `SidePanelPageConfig` | required | Page-specific configuration |
| `showCollapseToggle` | `boolean` | `true` | Show collapse button |
| `collapseTogglePosition` | `'header' \| 'edge'` | `'header'` | Collapse button position |
| `loading` | `boolean` | `false` | Loading state |
| `error` | `string \| null` | `null` | Error message |
| `onRetry` | `() => void` | - | Retry callback for error state |

### Width Values

| Preset | Pixels |
|--------|--------|
| `sm` | 240px |
| `md` | 320px |
| `lg` | 400px |
| `xl` | 480px |

## Section Types

### Navigation Section
```tsx
{
  id: 'nav',
  type: 'navigation',
  title: 'Menu',
  items: [
    { id: 'home', label: 'Home', href: '/', icon: Home },
    { id: 'settings', label: 'Settings', onClick: () => {}, badge: 3 },
  ],
}
```

### Status Section
```tsx
{
  id: 'status',
  type: 'status',
  title: 'System Status',
  items: [
    { id: 'api', label: 'API', status: 'online', description: 'All systems operational' },
    { id: 'db', label: 'Database', status: 'warning', timestamp: new Date() },
  ],
}
```

### Summary Section
```tsx
{
  id: 'summary',
  type: 'summary',
  title: 'Overview',
  layout: 'grid',
  columns: 2,
  items: [
    { id: 'total', label: 'Total', value: 1234, format: 'number', icon: FileText },
    { id: 'revenue', label: 'Revenue', value: 50000, format: 'currency', change: { value: 12, type: 'increase' } },
  ],
}
```

### Actions Section
```tsx
{
  id: 'actions',
  type: 'actions',
  title: 'Quick Actions',
  layout: 'vertical',
  items: [
    { id: 'upload', label: 'Upload', icon: Upload, variant: 'primary', onClick: () => {} },
    { id: 'export', label: 'Export', icon: Download, variant: 'outline', onClick: () => {} },
  ],
}
```

### Settings Section
```tsx
{
  id: 'settings',
  type: 'settings',
  title: 'Preferences',
  items: [
    { id: 'notifications', label: 'Notifications', checked: true, onChange: (v) => {} },
    { id: 'theme', label: 'Theme', value: 'dark', options: [...], onChange: (v) => {} },
  ],
}
```

### Error Section
```tsx
{
  id: 'errors',
  type: 'error',
  title: 'Issues',
  maxItems: 3,
  items: [
    { id: 'e1', title: 'Upload failed', message: 'File too large', severity: 'warning', dismissible: true },
  ],
}
```

### Chart Section
```tsx
{
  id: 'charts',
  type: 'chart',
  title: 'Analytics',
  items: [
    { id: 'progress', title: 'Completion', type: 'progress', data: [75] },
    { id: 'trend', title: 'Weekly Trend', type: 'sparkline', data: [10, 20, 15, 30, 25] },
  ],
}
```

### Custom Section
```tsx
{
  id: 'custom',
  type: 'custom',
  title: 'Custom Content',
  render: () => <MyCustomComponent />,
}
```

## Pre-built Page Configurations

### Statements Page
```tsx
import { createStatementsPageConfig } from '@/app/components/side-panel';

const config = createStatementsPageConfig({
  totalStatements: number,
  processedCount: number,
  pendingCount: number,
  errorCount: number,
  recentActivity: Array<{ id, label, status, time }>,
  onUpload: () => void,
  onRefresh: () => void,
  onFilterByStatus: (status: string) => void,
  onExport: () => void,
});
```

### Reports Page
```tsx
import { createReportsPageConfig } from '@/app/components/side-panel';

const config = createReportsPageConfig({
  totalIncome: number,
  totalExpense: number,
  netAmount: number,
  transactionCount: number,
  topCategories: Array<{ name, amount }>,
  activeTab: string,
  onSwitchTab: (tab: string) => void,
  onGenerateReport: () => void,
  onExportPdf: () => void,
});
```

### Storage Page
```tsx
import { createStoragePageConfig } from '@/app/components/side-panel';

const config = createStoragePageConfig({
  totalFiles: number,
  totalSize: string,
  folderCount: number,
  sharedCount: number,
  folders: Array<{ id, name, count }>,
  recentErrors: Array<{ id, title, message }>,
  onCreateFolder: () => void,
  onUploadFile: () => void,
  onManageTags: () => void,
  onFolderClick: (folderId: string) => void,
  showIntegrations: boolean,
});
```

### Settings Page
```tsx
import { createSettingsPageConfig } from '@/app/components/side-panel';

const config = createSettingsPageConfig({
  activeSection: string,
  onSectionChange: (section: string) => void,
  notificationsEnabled: boolean,
  onNotificationsChange: (enabled: boolean) => void,
  // ... other settings
});
```

### Workspaces Page
```tsx
import { createWorkspacesPageConfig } from '@/app/components/side-panel';

const config = createWorkspacesPageConfig({
  workspaces: Array<{ id, name, icon, memberCount }>,
  currentWorkspaceId: string,
  onWorkspaceSelect: (id: string) => void,
  onCreateWorkspace: () => void,
  onManageMembers: () => void,
  pendingInvites: number,
});
```

## Hooks

### useSidePanel
Access the side panel context:
```tsx
const { isCollapsed, toggleCollapsed, width, position } = useSidePanel();
```

### useSidePanelConfig
Manage configuration dynamically:
```tsx
const { config, updateSection, addSection, removeSection } = useSidePanelConfig({
  config: initialConfig,
  autoRegister: true,
});
```

## Permissions

Control visibility based on user permissions:

```tsx
<SidePanel
  config={config}
  permissions={{
    viewPanel: ['panel.view'],
    sections: {
      'admin-section': ['admin.access'],
    },
    items: {
      'admin-section.delete': ['admin.delete'],
    },
  }}
/>
```

## Styling

The component uses Tailwind CSS classes consistent with the app's design system:
- `border-gray-200` borders
- `bg-white` backgrounds
- `rounded-lg` border radius
- `shadow-sm` shadows
- Dark mode support via `dark:` variants

Custom styling can be applied via the `className` prop.
