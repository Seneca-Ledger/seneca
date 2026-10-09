import { describe, expect, it } from 'vitest';
import { queryKeys } from './query-keys';

/**
 * Снапшот форм ключей. Перестановка или пропажа сегмента молча раскалывает
 * кэш надвое (или, хуже, склеивает данные двух воркспейсов) — без падения тестов.
 */
describe('queryKeys', () => {
  it('keeps every key shape stable', () => {
    expect({
      dashboard: queryKeys.dashboard({ workspaceId: 'w1', range: '30d', date: null }),
      dashboardTrends: queryKeys.dashboardTrends({ workspaceId: 'w1', days: 30, month: '2026-07' }),
      dashboardHealthHistory: queryKeys.dashboardHealthHistory({ workspaceId: 'w1', year: 2026 }),
      dashboardCashFlow: queryKeys.dashboardCashFlow({
        workspaceId: 'w1',
        range: '12m',
        month: '2026-07',
      }),
      statements: queryKeys.statements({ workspaceId: 'w1', params: { stage: 'submit' } }),
      gmailReceipts: queryKeys.gmailReceipts({ workspaceId: 'w1', params: { limit: 50 } }),
      transactions: queryKeys.transactions({ workspaceId: 'w1', params: { limit: 500 } }),
      categories: queryKeys.categories('w1'),
      categoryUsage: queryKeys.categoryUsage('w1'),
      goalsList: queryKeys.goalsList('w1'),
      goalFlow: queryKeys.goalFlow({ workspaceId: 'w1', goalId: 'g1', month: '2026-09' }),
      goalPlan: queryKeys.goalPlan({ workspaceId: 'w1', goalId: 'g1' }),
      goalItems: queryKeys.goalItems({ workspaceId: 'w1', goalId: 'g1' }),
      insights: queryKeys.insights('w1', 'en'),
      netWorth: queryKeys.netWorth({ workspaceId: 'w1', range: '90d' }),
      auditEvents: queryKeys.auditEvents({ workspaceId: 'w1', params: { page: 1 } }),
      integrationStatus: queryKeys.integrationStatus({ workspaceId: 'w1', apiPath: 'gmail' }),
      webhookEndpoints: queryKeys.webhookEndpoints('w1'),
      webhookSubscriptions: queryKeys.webhookSubscriptions('w1'),
      apiKeys: queryKeys.apiKeys('w1'),
      customTables: queryKeys.customTables('w1'),
      adminUsers: queryKeys.adminUsers('w1'),
      budgets: queryKeys.budgets('w1'),
      balanceSheet: queryKeys.balanceSheet({ workspaceId: 'w1', date: null, locale: 'en' }),
      tablesReport: queryKeys.tablesReport({ workspaceId: 'w1', params: { days: 30 } }),
      storageFiles: queryKeys.storageFiles({ workspaceId: 'w1', listMode: 'trash' }),
      taxReturn: queryKeys.taxReturn({
        workspaceId: 'w1',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
      subscriptions: queryKeys.subscriptions({ workspaceId: 'w1', status: 'all' }),
      subscriptionsSummary: queryKeys.subscriptionsSummary('w1'),
      cryptoWallets: queryKeys.cryptoWallets('w1'),
      cryptoSummary: queryKeys.cryptoSummary('w1'),
      notifications: queryKeys.notifications('w1'),
      searchRecent: queryKeys.searchRecent('w1'),
      search: queryKeys.search({ workspaceId: 'w1', q: 'rent' }),
    }).toEqual({
      dashboard: ['dashboard', 'w1', '30d', null],
      dashboardTrends: ['dashboard', 'trends', 'w1', 30, '2026-07'],
      dashboardHealthHistory: ['dashboard', 'health-history', 'w1', 2026],
      dashboardCashFlow: ['dashboard', 'cash-flow', 'w1', '12m', '2026-07'],
      statements: ['statements', 'w1', { stage: 'submit' }],
      gmailReceipts: ['gmail-receipts', 'w1', { limit: 50 }],
      transactions: ['transactions', 'w1', { limit: 500 }],
      categories: ['categories', 'w1'],
      categoryUsage: ['categories', 'w1', 'usage'],
      goalsList: ['goals', 'list', 'w1'],
      goalFlow: ['goals', 'flow', 'w1', 'g1', '2026-09'],
      goalPlan: ['goals', 'plan', 'w1', 'g1'],
      goalItems: ['goals', 'items', 'w1', 'g1'],
      insights: ['insights', 'w1', 'en'],
      netWorth: ['net-worth', 'w1', '90d'],
      auditEvents: ['audit-events', 'w1', { page: 1 }],
      integrationStatus: ['integration-status', 'w1', 'gmail'],
      webhookEndpoints: ['webhook-endpoints', 'w1'],
      webhookSubscriptions: ['webhook-subscriptions', 'w1'],
      apiKeys: ['api-keys', 'w1'],
      customTables: ['custom-tables', 'w1'],
      adminUsers: ['admin-users', 'w1'],
      budgets: ['budgets', 'w1'],
      balanceSheet: ['balance-sheet', 'w1', null, 'en'],
      tablesReport: ['tables-report', 'w1', { days: 30 }],
      storageFiles: ['storage-files', 'w1', 'trash'],
      taxReturn: ['tax-return', 'w1', '2026-01-01', '2026-03-31'],
      subscriptions: ['subscriptions', 'w1', 'list', 'all'],
      subscriptionsSummary: ['subscriptions', 'w1', 'summary'],
      cryptoWallets: ['crypto', 'wallets', 'w1'],
      cryptoSummary: ['crypto', 'summary', 'w1'],
      notifications: ['notifications', 'w1'],
      searchRecent: ['search', 'w1', 'recent'],
      search: ['search', 'w1', 'query', 'rent'],
    });
  });

  it('carries the workspace id so two workspaces never share a cache entry', () => {
    const a = queryKeys.dashboard({ workspaceId: 'w1', range: '30d', date: null });
    const b = queryKeys.dashboard({ workspaceId: 'w2', range: '30d', date: null });
    expect(a).not.toEqual(b);
  });

  it('nests crypto keys under one prefix so a single invalidation sweeps the feature', () => {
    expect(queryKeys.cryptoWallets('w1')[0]).toBe('crypto');
    expect(queryKeys.cryptoSummary('w1')[0]).toBe('crypto');
  });

  // Editing a cost line changes what the plan says, so both have to fall to one
  // invalidation of the `goals` prefix.
  it('nests every goal key under one prefix', () => {
    expect(queryKeys.goalFlow({ workspaceId: 'w1', goalId: 'g1', month: '2026-09' })[0]).toBe(
      'goals',
    );
    expect(queryKeys.goalPlan({ workspaceId: 'w1', goalId: 'g1' })[0]).toBe('goals');
    expect(queryKeys.goalItems({ workspaceId: 'w1', goalId: 'g1' })[0]).toBe('goals');
  });
});
