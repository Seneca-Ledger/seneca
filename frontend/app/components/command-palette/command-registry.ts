import React from 'react';
import {
  Bell,
  FlaskConical,
  HelpCircle,
  Info,
  Moon,
  PanelLeftClose,
  Search,
  Settings,
  Sparkles,
  Upload,
} from '@/app/components/icons';
import type { NavItem } from '@/app/components/navigation/helpers/navigation-config';
import { toggleSidebarCollapsed } from '@/app/components/navigation/sidebar-collapsed-store';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { NAV_BINDINGS, SHORTCUT_OPEN_FILTERS } from '@/app/lib/keyboard-shortcuts';
import { STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT } from '@/app/lib/statement-expense-drawer';

export type CommandGroup = 'actions' | 'navigation' | 'settings' | 'help';

export interface Command {
  /** Stable: React key, `aria-activedescendant` target and test hook. */
  id: string;
  group: CommandGroup;
  /** Already localized — matching needs a string, not an intlayer node. */
  label: string;
  icon: React.ReactNode;
  /** Extra match terms, so "logout" finds "Sign out". */
  keywords?: string[];
  /** tinykeys syntax; the same string drives the handler and the hint chips. */
  binding?: string;
  permission?: string;
  experimental?: boolean;
  run: () => void;
}

/** The handful of labels that have no string anywhere else in the app. */
export interface CommandLabels {
  uploadStatement: string;
  openFilters: string;
  toggleLeftNav: string;
  toggleTheme: string;
  toggleExperimental: string;
  keyboardShortcuts: string;
  notifications: string;
  settings: string;
  whatsNew: string;
  reportBug: string;
}

export interface CommandDeps {
  labels: CommandLabels;
  /** Sidebar and account-menu entries, already carrying their own translated names. */
  navItems: NavItem[];
  push: (href: string) => void;
  toggleTheme: () => void;
  toggleExperimental: () => void;
  openHelp: () => void;
  reportBugUrl: string;
}

function dispatch(event: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(event, detail ? { detail } : undefined));
}

function actionCommands(deps: CommandDeps): Command[] {
  const { labels } = deps;
  return [
    {
      id: 'action.upload',
      group: 'actions',
      label: labels.uploadStatement,
      icon: React.createElement(Upload, { size: 18 }),
      binding: 'Shift+KeyA',
      permission: 'statement.upload',
      run: () => dispatch(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, { mode: 'scan' }),
    },
    {
      id: 'action.filters',
      group: 'actions',
      label: labels.openFilters,
      icon: React.createElement(Search, { size: 18 }),
      binding: 'Shift+KeyF',
      run: () => dispatch(SHORTCUT_OPEN_FILTERS),
    },
    {
      id: 'action.notifications',
      group: 'actions',
      label: labels.notifications,
      icon: React.createElement(Bell, { size: 18 }),
      run: () => openAppPanel('notifications'),
    },
  ];
}

function settingsCommands(deps: CommandDeps): Command[] {
  const { labels } = deps;
  return [
    {
      id: 'settings.open',
      group: 'settings',
      label: labels.settings,
      icon: React.createElement(Settings, { size: 18 }),
      run: () => deps.push('/settings/profile'),
    },
    {
      id: 'settings.toggleLeftNav',
      group: 'settings',
      label: labels.toggleLeftNav,
      icon: React.createElement(PanelLeftClose, { size: 18 }),
      binding: 'BracketLeft',
      run: toggleSidebarCollapsed,
    },
    {
      id: 'settings.toggleTheme',
      group: 'settings',
      label: labels.toggleTheme,
      icon: React.createElement(Moon, { size: 18 }),
      binding: 'Alt+Shift+KeyT',
      run: deps.toggleTheme,
    },
    {
      id: 'settings.toggleExperimental',
      group: 'settings',
      label: labels.toggleExperimental,
      icon: React.createElement(FlaskConical, { size: 18 }),
      run: deps.toggleExperimental,
    },
  ];
}

function helpCommands(deps: CommandDeps): Command[] {
  const { labels } = deps;
  return [
    {
      id: 'help.shortcuts',
      group: 'help',
      label: labels.keyboardShortcuts,
      icon: React.createElement(Info, { size: 18 }),
      binding: 'Shift+Slash',
      run: deps.openHelp,
    },
    {
      id: 'help.whatsNew',
      group: 'help',
      label: labels.whatsNew,
      icon: React.createElement(Sparkles, { size: 18 }),
      run: () => openAppPanel('whatsNew'),
    },
    {
      id: 'help.reportBug',
      group: 'help',
      label: labels.reportBug,
      icon: React.createElement(HelpCircle, { size: 18 }),
      run: () => window.open(deps.reportBugUrl, '_blank', 'noopener,noreferrer'),
    },
  ];
}

/** Reads an intlayer node's plain text — matching cannot work on a ReactNode. */
export function navLabelText(label: unknown): string {
  return (label as { value?: string } | null)?.value ?? '';
}

function navigationCommands(deps: CommandDeps): Command[] {
  return deps.navItems.map(item => ({
    id: `nav.${item.path}`,
    group: 'navigation' as const,
    label: navLabelText(item.label),
    icon: item.icon,
    binding: NAV_BINDINGS[item.path],
    permission: item.permission,
    experimental: item.experimental,
    run: () => deps.push(item.path),
  }));
}

export function buildCommands(deps: CommandDeps): Command[] {
  return [
    ...actionCommands(deps),
    ...navigationCommands(deps),
    ...settingsCommands(deps),
    ...helpCommands(deps),
  ];
}
