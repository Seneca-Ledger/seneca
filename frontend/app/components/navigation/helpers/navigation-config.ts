import React, { type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart2,
  BookmarkOutline,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChartPie,
  CircleDollarSign,
  Compass,
  CreditCard,
  FileText,
  Flag,
  Inbox,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  PiggyBank,
  Plug,
  Puzzle,
  ReceiptText,
  Scale,
  ScrollText,
  Shuffle,
  Table,
  Tag,
  TrendingUp,
  Wallet,
} from '@/app/components/icons';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
export const MOBILE_MENU_VISIBILITY_EVENT = 'seneca-mobile-menu-visibility';

export type { AppLocale as AppLanguage } from '@/app/lib/locale';

export interface NavItem {
  label: ReactNode;
  path: string;
  icon: React.ReactElement;
  permission: string;
  /** Only offered while experimental mode is on — the feature is unfinished. */
  experimental?: boolean;
  /** Hidden in the home profile: household money has no invoices or ledger. */
  businessOnly?: boolean;
  /** The sidebar folds the item under this group; without one it stays a row of its own. */
  group?: NavGroupId;
}

export type NavGroupId =
  | 'transactions'
  | 'classification'
  | 'analytics'
  | 'investments'
  | 'business';

export interface NavGroup {
  id: NavGroupId;
  label: ReactNode;
  icon: React.ReactElement;
}

export function buildNavGroups(labels: Record<NavGroupId, unknown>): NavGroup[] {
  return [
    {
      id: 'transactions',
      label: labels.transactions as ReactNode,
      icon: React.createElement(Shuffle, { size: 18 }),
    },
    {
      id: 'classification',
      label: labels.classification as ReactNode,
      icon: React.createElement(Tag, { size: 18 }),
    },
    {
      id: 'analytics',
      label: labels.analytics as ReactNode,
      icon: React.createElement(ChartPie, { size: 18 }),
    },
    {
      id: 'investments',
      label: labels.investments as ReactNode,
      icon: React.createElement(CircleDollarSign, { size: 18 }),
    },
    {
      id: 'business',
      label: labels.business as ReactNode,
      icon: React.createElement(BriefcaseBusiness, { size: 18 }),
    },
  ];
}

export type NavEntry =
  | { kind: 'item'; item: NavItem }
  | { kind: 'group'; group: NavGroup; items: NavItem[] };

/**
 * The sidebar's rows: ungrouped items where they are, each group where its first
 * item would be. A group none of whose items is visible is left out.
 */
export function groupNavItems(items: NavItem[], groups: NavGroup[]): NavEntry[] {
  const entries: NavEntry[] = [];
  const byGroup = new Map<NavGroupId, NavItem[]>();
  for (const item of items) {
    const group = groups.find(candidate => candidate.id === item.group);
    if (!group) {
      entries.push({ kind: 'item', item });
      continue;
    }
    const members = byGroup.get(group.id);
    if (members) {
      members.push(item);
    } else {
      const created = [item];
      byGroup.set(group.id, created);
      entries.push({ kind: 'group', group, items: created });
    }
  }
  return entries;
}

export type WorkspaceProfile = 'home' | 'business';

/** Business is how every workspace behaved before the profile existed. */
export function workspaceProfileOf(
  workspace?: { settings?: Record<string, unknown> | null } | null,
): WorkspaceProfile {
  return workspace?.settings?.profile === 'home' ? 'home' : 'business';
}

/** The one filter the sidebar, the mobile menu and the tutorial share. */
export function isNavItemVisible(
  item: NavItem,
  context: {
    hasPermission: (permission: string) => boolean;
    experimentalMode: boolean;
    profile: WorkspaceProfile;
  },
): boolean {
  if (!context.hasPermission(item.permission)) return false;
  if (item.experimental && !context.experimentalMode) return false;
  if (item.businessOnly && context.profile === 'home') return false;
  return true;
}

export function buildNavItems(nav: {
  dashboard: unknown;
  allTransactions: unknown;
  statements: unknown;
  expenses: unknown;
  income: unknown;
  tables: unknown;
  workspaces: unknown;
  reports: unknown;
  taxDeclaration: unknown;
  netWorth: unknown;
  forecast: unknown;
  advice: unknown;
  budgets: unknown;
  goals: unknown;
  roi: unknown;
  subscriptions: unknown;
  crypto: unknown;
  ledger: unknown;
  invoices: unknown;
  review: unknown;
  categories: unknown;
  tags: unknown;
}): NavItem[] {
  return [
    {
      label: nav.dashboard as ReactNode,
      path: DEFAULT_APP_ROUTE,
      icon: React.createElement(LayoutDashboard, { size: 18 }),
      permission: 'statement.view',
    },
    {
      label: nav.statements as ReactNode,
      path: '/statements',
      group: 'transactions',
      icon: React.createElement(FileText, { size: 18 }),
      permission: 'statement.view',
    },
    {
      label: nav.expenses as ReactNode,
      path: '/statements/pay',
      group: 'transactions',
      icon: React.createElement(ArrowUpRight, { size: 18 }),
      permission: 'payable.view',
    },
    {
      label: nav.income as ReactNode,
      path: '/statements/receive',
      group: 'transactions',
      icon: React.createElement(ArrowDownLeft, { size: 18 }),
      permission: 'payable.view',
    },
    {
      label: nav.allTransactions as ReactNode,
      path: '/statements/transactions',
      group: 'transactions',
      icon: React.createElement(Banknote, { size: 18 }),
      permission: 'transaction.view',
    },
    {
      label: nav.review as ReactNode,
      path: '/review',
      icon: React.createElement(Inbox, { size: 18 }),
      permission: 'transaction.view',
    },
    {
      label: nav.categories as ReactNode,
      path: '/categories',
      group: 'classification',
      icon: React.createElement(BookmarkOutline, { size: 18 }),
      permission: 'category.view',
    },
    {
      label: nav.tags as ReactNode,
      path: '/tags',
      group: 'classification',
      icon: React.createElement(Tag, { size: 18 }),
      permission: 'tag.view',
    },
    {
      label: nav.budgets as ReactNode,
      path: '/budgets',
      icon: React.createElement(PiggyBank, { size: 18 }),
      permission: 'budget.view',
    },
    {
      label: nav.goals as ReactNode,
      path: '/goals',
      icon: React.createElement(Flag, { size: 18 }),
      permission: 'goal.view',
    },
    {
      label: nav.subscriptions as ReactNode,
      path: '/subscriptions',
      icon: React.createElement(CreditCard, { size: 18 }),
      permission: 'subscription.view',
    },
    {
      label: nav.reports as ReactNode,
      path: '/reports',
      group: 'analytics',
      icon: React.createElement(BarChart2, { size: 18 }),
      permission: 'statement.view',
    },
    {
      label: nav.netWorth as ReactNode,
      path: '/net-worth',
      group: 'analytics',
      icon: React.createElement(TrendingUp, { size: 18 }),
      // Matches the endpoint's own guard (Permission.REPORT_VIEW) so the item
      // is not offered to roles that would only get a 403 from it.
      permission: 'report.view',
    },
    {
      label: nav.forecast as ReactNode,
      path: '/forecast',
      group: 'analytics',
      icon: React.createElement(Compass, { size: 18 }),
      // Reads the same aggregates as the dashboard and net worth (Permission.REPORT_VIEW).
      permission: 'report.view',
    },
    {
      label: nav.advice as ReactNode,
      path: '/advice',
      group: 'analytics',
      icon: React.createElement(Lightbulb, { size: 18 }),
      permission: 'statement.view',
    },
    {
      label: nav.crypto as ReactNode,
      path: '/crypto',
      group: 'investments',
      // Crypto wallets are wallets: the endpoints guard on the same permission,
      // so the item is offered to exactly the roles that can open it.
      icon: React.createElement(Wallet, { size: 18 }),
      permission: 'wallet.view',
    },
    {
      label: nav.roi as ReactNode,
      path: '/roi',
      group: 'investments',
      icon: React.createElement(Calculator, { size: 18 }),
      // A standalone calculator that reads nothing of the workspace's data,
      // so being a member is enough to open it.
      permission: 'statement.view',
    },
    {
      label: nav.invoices as ReactNode,
      path: '/invoices',
      group: 'business',
      icon: React.createElement(ReceiptText, { size: 18 }),
      permission: 'invoice.view',
      businessOnly: true,
    },
    {
      label: nav.taxDeclaration as ReactNode,
      path: '/tax-declaration',
      group: 'business',
      icon: React.createElement(Landmark, { size: 18 }),
      // Matches the draft endpoints' read guard (Permission.REPORT_VIEW).
      permission: 'report.view',
      businessOnly: true,
    },
    {
      label: nav.ledger as ReactNode,
      path: '/ledger',
      group: 'business',
      icon: React.createElement(Scale, { size: 18 }),
      permission: 'ledger.view',
      // Behind experimental mode until the ledger has been used on real books for a while.
      experimental: true,
      businessOnly: true,
    },
    {
      label: nav.tables as ReactNode,
      path: '/custom-tables',
      group: 'business',
      icon: React.createElement(Table, { size: 18 }),
      permission: 'statement.view',
      businessOnly: true,
    },
    {
      label: nav.workspaces as ReactNode,
      path: '/workspaces',
      icon: React.createElement(Building2, { size: 18 }),
      permission: 'workspaces.view',
    },
  ];
}

export function buildUserMenuNavItems(nav: {
  activityLog: unknown;
  integrations: unknown;
  plugins: unknown;
}): NavItem[] {
  return [
    {
      label: nav.integrations as ReactNode,
      path: '/integrations',
      icon: React.createElement(Plug, { size: 18 }),
      // Held by the admin and user roles but not by viewer, which is who
      // these two links have always been shown to.
      permission: 'telegram.connect',
    },
    {
      label: nav.plugins as ReactNode,
      path: '/plugins',
      icon: React.createElement(Puzzle, { size: 18 }),
      permission: 'telegram.connect',
    },
    {
      label: nav.activityLog as ReactNode,
      path: '/admin',
      icon: React.createElement(ScrollText, { size: 18 }),
      permission: 'audit_log.view',
    },
  ];
}

export function isNavItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/**
 * The one item a page belongs to. Items can nest (/statements holds /statements/pay),
 * so the most specific match wins and only one row lights up.
 */
export function activeNavPath(pathname: string, items: NavItem[]): string | undefined {
  let best: string | undefined;
  for (const item of items) {
    if (isNavItemActive(pathname, item.path) && item.path.length > (best?.length ?? -1)) {
      best = item.path;
    }
  }
  return best;
}
