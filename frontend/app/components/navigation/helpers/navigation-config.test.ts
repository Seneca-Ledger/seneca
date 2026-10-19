import { describe, expect, it } from 'vitest';
import {
  buildNavItems,
  buildUserMenuNavItems,
  isNavItemActive,
  isNavItemVisible,
  workspaceProfileOf,
} from './navigation-config';

const nav = {
  dashboard: 'Dashboard',
  statements: 'Statements',
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

  it('lists net worth next to the other money views', () => {
    const items = buildNavItems(nav);

    expect(items.map(item => item.path)).toContain('/net-worth');
    // Net worth, then the forecast built on it.
    expect(items.findIndex(item => item.path === '/net-worth')).toBe(
      items.findIndex(item => item.path === '/forecast') - 1,
    );
    expect(items.find(item => item.path === '/forecast')?.permission).toBe('report.view');
  });
});

describe('buildUserMenuNavItems', () => {
  it('gates activity log behind the audit log permission', () => {
    const items = buildUserMenuNavItems(userMenuNav);

    expect(items.find(item => item.path === '/admin')?.permission).toBe('audit_log.view');
  });

  it('keeps integrations and plugins away from the viewer role', () => {
    const items = buildUserMenuNavItems(userMenuNav);

    expect(items.find(item => item.path === '/integrations')?.permission).toBe('telegram.connect');
    expect(items.find(item => item.path === '/plugins')?.permission).toBe('telegram.connect');
  });
});

describe('isNavItemActive', () => {
  it('matches a route and its children', () => {
    expect(isNavItemActive('/custom-tables', '/custom-tables')).toBe(true);
    expect(isNavItemActive('/custom-tables/abc', '/custom-tables')).toBe(true);
    expect(isNavItemActive('/statements', '/custom-tables')).toBe(false);
  });
});
