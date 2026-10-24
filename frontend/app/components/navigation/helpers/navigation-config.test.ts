import { describe, expect, it } from 'vitest';
import {
  activeNavPath,
  buildNavGroups,
  buildNavItems,
  buildUserMenuNavItems,
  groupNavItems,
  isNavItemActive,
  isNavItemVisible,
  workspaceProfileOf,
} from './navigation-config';

const nav = {
  dashboard: 'Dashboard',
  allTransactions: 'All transactions',
  statements: 'Statements',
  expenses: 'Expenses',
  income: 'Income',
  tables: 'Tables',
  workspaces: 'Workspaces',
  reports: 'Reports',
  taxDeclaration: 'Tax declaration',
  netWorth: 'Net worth',
  forecast: 'Forecast',
  advice: 'Advice',
  budgets: 'Budgets',
  goals: 'Goals',
  roi: 'Returns',
  subscriptions: 'Subscriptions',
  crypto: 'Crypto',
  ledger: 'Ledger',
  invoices: 'Invoices',
  review: 'Review',
  rules: 'Rules',
};

const userMenuNav = {
  activityLog: 'Activity log',
  integrations: 'Integrations',
  plugins: 'Plugins',
};

describe('workspace profile', () => {
  const allowAll = () => true;

  it('reads home off the settings and treats everything else as business', () => {
    expect(workspaceProfileOf({ settings: { profile: 'home' } })).toBe('home');
    expect(workspaceProfileOf({ settings: { profile: 'business' } })).toBe('business');
    expect(workspaceProfileOf({ settings: null })).toBe('business');
    expect(workspaceProfileOf(null)).toBe('business');
  });

  it('hides invoices, the ledger, the tax declaration and tables at home, nothing else', () => {
    const items = buildNavItems(nav);
    const hiddenAtHome = items
      .filter(item => !isNavItemVisible(item, { hasPermission: allowAll, experimentalMode: true, profile: 'home' }))
      .map(item => item.path)
      .sort();
    expect(hiddenAtHome).toEqual(['/custom-tables', '/invoices', '/ledger', '/tax-declaration']);

    const hiddenInBusiness = items.filter(
      item => !isNavItemVisible(item, { hasPermission: allowAll, experimentalMode: true, profile: 'business' }),
    );
    expect(hiddenInBusiness).toEqual([]);
  });

  it('still respects permission and experimental mode', () => {
    const ledger = buildNavItems(nav).find(item => item.path === '/ledger');
    if (!ledger) throw new Error('the ledger is missing from the menu');
    expect(
      isNavItemVisible(ledger, { hasPermission: allowAll, experimentalMode: false, profile: 'business' }),
    ).toBe(false);
    expect(
      isNavItemVisible(ledger, { hasPermission: () => false, experimentalMode: true, profile: 'business' }),
    ).toBe(false);
  });
});

describe('buildNavItems', () => {
  it('offers the ledger only in experimental mode, behind its own view permission', () => {
    const ledger = buildNavItems(nav).find(item => item.path === '/ledger');

    expect(ledger?.permission).toBe('ledger.view');
    expect(ledger?.experimental).toBe(true);
  });

  it('does not include the items that moved into the user menu', () => {
    const items = buildNavItems(nav);

    expect(items.map(item => item.path)).not.toContain('/integrations');
    expect(items.map(item => item.path)).not.toContain('/plugins');
    expect(items.map(item => item.path)).not.toContain('/admin');
  });

  it('gates goals behind their own permission and leaves the calculator open', () => {
    const items = buildNavItems(nav);

    expect(items.find(item => item.path === '/goals')?.permission).toBe('goal.view');
    expect(items.find(item => item.path === '/roi')?.permission).toBe('statement.view');
  });

  it('gates crypto behind the wallet permission its endpoints use', () => {
    const items = buildNavItems(nav);

    expect(items.find(item => item.path === '/crypto')?.permission).toBe('wallet.view');
  });

  it('gates the tax declaration behind the report permission its endpoints use', () => {
    const items = buildNavItems(nav);

    expect(items.find(item => item.path === '/tax-declaration')?.permission).toBe('report.view');
  });

  it('puts net worth and the forecast built on it with the analytics', () => {
    const items = buildNavItems(nav);

    expect(items.find(item => item.path === '/net-worth')?.group).toBe('analytics');
    expect(items.find(item => item.path === '/forecast')?.group).toBe('analytics');
    expect(items.find(item => item.path === '/forecast')?.permission).toBe('report.view');
  });
});

describe('groupNavItems', () => {
  const groups = buildNavGroups({
    transactions: 'Transactions',
    analytics: 'Analytics',
    investments: 'Investments',
    business: 'Business',
  });
  const rows = (items: ReturnType<typeof buildNavItems>) =>
    groupNavItems(items, groups).map(entry =>
      entry.kind === 'item'
        ? entry.item.path
        : `${entry.group.id}: ${entry.items.map(item => item.path).join(' ')}`,
    );

  it('keeps standalone pages as rows and puts each group where its first page was', () => {
    expect(rows(buildNavItems(nav))).toEqual([
      '/dashboard',
      'transactions: /statements /statements/pay /statements/receive /statements/transactions /rules',
      '/review',
      '/budgets',
      '/goals',
      '/subscriptions',
      'analytics: /reports /net-worth /forecast /advice',
      'investments: /crypto /roi',
      'business: /invoices /tax-declaration /ledger /custom-tables',
      '/workspaces',
    ]);
  });

  it('leaves out a group with nothing visible in it', () => {
    const home = buildNavItems(nav).filter(item => item.group !== 'business');
    expect(rows(home).some(row => row.startsWith('business'))).toBe(false);
  });
});

describe('activeNavPath', () => {
  const items = buildNavItems(nav);

  it('lights the most specific page when one sits inside another', () => {
    expect(activeNavPath('/statements/pay', items)).toBe('/statements/pay');
    expect(activeNavPath('/statements/transactions', items)).toBe('/statements/transactions');
    expect(activeNavPath('/statements/receive', items)).toBe('/statements/receive');
  });

  it('keeps the statements page and its documents on Statements', () => {
    expect(activeNavPath('/statements/submit', items)).toBe('/statements');
    expect(activeNavPath('/statements/doc-1/edit', items)).toBe('/statements');
  });

  it('lights nothing outside the menu', () => {
    expect(activeNavPath('/settings', items)).toBeUndefined();
  });
});
