/**
 * Фабрика ключей React Query.
 *
 * workspaceId — обязательный сегмент в каждом ключе: apiClient подставляет
 * заголовок X-Workspace-Id из localStorage, поэтому один и тот же URL в разных
 * воркспейсах возвращает разные данные и обязан кэшироваться раздельно.
 *
 * Префиксные сегменты подобраны так, чтобы инвалидация сметала фичу целиком:
 * invalidateQueries({ queryKey: ['crypto'] }).
 */
export const queryKeys = {
  dashboard: (o: { workspaceId: string | null; range: string; date: string | null }) =>
    ['dashboard', o.workspaceId, o.range, o.date] as const,
  dashboardCashFlowEntries: (o: { workspaceId: string | null; month: string }) =>
    ['dashboard', 'cash-flow-entries', o.workspaceId, o.month] as const,
  dashboardSetupProgress: (workspaceId: string | null) =>
    ['dashboard', 'setup-progress', workspaceId] as const,
  statements: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['statements', o.workspaceId, o.params] as const,
  receiptDocuments: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['receipt-documents', o.workspaceId, o.params] as const,
  transactions: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['transactions', o.workspaceId, o.params] as const,
  categories: (workspaceId: string | null) => ['categories', workspaceId] as const,
  payees: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['payees', o.workspaceId, o.params] as const,
  payee: (workspaceId: string | null, id: string) => ['payees', workspaceId, 'one', id] as const,
  reviewInbox: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['review-inbox', o.workspaceId, o.params] as const,
  reviewInboxCounts: (workspaceId: string | null, reviewer?: string) =>
    ['review-inbox', workspaceId, 'counts', reviewer ?? 'anyone'] as const,
  reviewInboxByStatement: (workspaceId: string | null) =>
    ['review-inbox', workspaceId, 'statements'] as const,
  wallets: (workspaceId: string | null) => ['wallets', workspaceId] as const,
  payablePaymentCandidates: (o: { workspaceId: string | null; payableId: string }) =>
    ['payables', o.workspaceId, o.payableId, 'payment-candidates'] as const,
  payablePayments: (o: { workspaceId: string | null; payableId: string }) =>
    ['payables', o.workspaceId, o.payableId, 'payments'] as const,
  // Tile-server configuration is the same in every workspace, hence no workspace segment.
  mapStyles: () => ['map-styles'] as const,
  categoryUsage: (workspaceId: string | null) => ['categories', workspaceId, 'usage'] as const,
  // The Tags page list with usage counts; the tag pickers read it too.
  tags: (workspaceId: string | null) => ['tags', workspaceId] as const,
  receiptTags: (workspaceId: string | null, receiptId: string) =>
    ['tags', workspaceId, 'receipt', receiptId] as const,
  statementTags: (workspaceId: string | null, statementId: string) =>
    ['tags', workspaceId, 'statement', statementId] as const,
  // Under the tags prefix: a tag saved anywhere refreshes the By tag figures too.
  transactionTagLinks: (workspaceId: string | null) =>
    ['tags', workspaceId, 'transaction-links'] as const,
  goalsList: (workspaceId: string | null) => ['goals', 'list', workspaceId] as const,
  // Sits under the plain list prefix, so a contribution invalidates both.
  goalsMonth: (o: { workspaceId: string | null; month: string }) =>
    ['goals', 'list', o.workspaceId, o.month] as const,
  goalFlow: (o: { workspaceId: string | null; goalId: string; month: string }) =>
    ['goals', 'flow', o.workspaceId, o.goalId, o.month] as const,
  goalPlan: (o: { workspaceId: string | null; goalId: string }) =>
    ['goals', 'plan', o.workspaceId, o.goalId] as const,
  spendFlow: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['reports', 'spend-flow', o.workspaceId, o.params] as const,
  goalItems: (o: { workspaceId: string | null; goalId: string }) =>
    ['goals', 'items', o.workspaceId, o.goalId] as const,
  // Локаль в ключе: сервер отдаёт текст совета на языке интерфейса, поэтому
  // один и тот же воркспейс на разных языках — разные данные.
  insights: (workspaceId: string | null, locale: string) =>
    ['insights', workspaceId, locale] as const,
  /** Префикс без локали — чтобы инвалидация сметала совет на всех языках. */
  insightsAll: (workspaceId: string | null) => ['insights', workspaceId] as const,
  // The date is part of the key: a new day is a new quote without waiting for staleness.
  dailyQuote: (workspaceId: string | null, date: string, locale: string) =>
    ['daily-quote', workspaceId, date, locale] as const,
  integrationCatalogStatuses: (workspaceId: string | null) =>
    ['integration-status', workspaceId, 'catalog'] as const,
  webhookEndpoints: (workspaceId: string | null) => ['webhook-endpoints', workspaceId] as const,
  webhookDeliveries: (workspaceId: string | null, subscriptionId: string) =>
    ['webhook-deliveries', workspaceId, subscriptionId] as const,
  branches: (workspaceId: string | null) => ['branches', workspaceId] as const,
  webhookSubscriptions: (workspaceId: string | null) =>
    ['webhook-subscriptions', workspaceId] as const,
  apiKeys: (workspaceId: string | null) => ['api-keys', workspaceId] as const,
  customTables: (workspaceId: string | null) => ['custom-tables', workspaceId] as const,
  adminUsers: (workspaceId: string | null) => ['admin-users', workspaceId] as const,
  budgets: (workspaceId: string | null) => ['budgets', workspaceId] as const,
  // Under the budgets prefix, so editing a budget refreshes past months as well.
  budgetsAt: (workspaceId: string | null, date: string) =>
    ['budgets', workspaceId, 'at', date] as const,
  // Under the budgets prefix, so saving or deleting a budget refreshes the plan-vs-actual too.
  stoicBalance: (workspaceId: string | null) => ['budgets', workspaceId, 'stoic-balance'] as const,
  balanceSheet: (o: { workspaceId: string | null; date: string | null; locale: string }) =>
    ['balance-sheet', o.workspaceId, o.date, o.locale] as const,
  tablesReport: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['tables-report', o.workspaceId, o.params] as const,
  storageFiles: (o: { workspaceId: string | null; listMode: 'active' | 'trash' }) =>
    ['storage-files', o.workspaceId, o.listMode] as const,
  taxReturn: (o: { workspaceId: string | null; periodStart: string; periodEnd: string }) =>
    ['tax-return', o.workspaceId, o.periodStart, o.periodEnd] as const,
  // Under the 'tax-return' prefix, so whatever refreshes the return refreshes it too.
  taxUstva: (o: { workspaceId: string | null; periodStart: string; periodEnd: string }) =>
    ['tax-return', o.workspaceId, 'ustva', o.periodStart, o.periodEnd] as const,
  // Prefix ['tax-settings', workspaceId] covers the VAT status, the reserve and its amount.
  taxSettings: (workspaceId: string | null) => ['tax-settings', workspaceId] as const,
  taxReserveSettings: (workspaceId: string | null) =>
    ['tax-settings', workspaceId, 'reserve'] as const,
  taxReserve: (workspaceId: string | null) =>
    ['tax-settings', workspaceId, 'reserve', 'amount'] as const,
  taxThreshold: (workspaceId: string | null) => ['tax-settings', workspaceId, 'threshold'] as const,
  taxVatFiling: (workspaceId: string | null) =>
    ['tax-settings', workspaceId, 'vat-filing'] as const,
  taxDeadlines: (workspaceId: string | null) => ['tax-settings', workspaceId, 'deadlines'] as const,
  taxOfficialRates: (workspaceId: string | null) =>
    ['tax-settings', workspaceId, 'official-rates'] as const,
  // Prefix ['datev', workspaceId] covers the settings, the mapping and the previews.
  datevSettings: (workspaceId: string | null) => ['datev', workspaceId, 'settings'] as const,
  datevMapping: (o: { workspaceId: string | null; year: number }) =>
    ['datev', o.workspaceId, 'mapping', o.year] as const,
  datevPreview: (o: { workspaceId: string | null; from: string; to: string }) =>
    ['datev', o.workspaceId, 'preview', o.from, o.to] as const,
  taxYearReport: (o: { workspaceId: string | null; year: number }) =>
    ['tax-year', o.workspaceId, o.year] as const,
  // The jurisdiction catalogue is global reference data (JWT-only on the server), the one
  // place a key rightly has no workspace segment.
  taxJurisdictions: () => ['tax-jurisdictions'] as const,
  taxJurisdictionRates: (o: { code: string | null; date: string }) =>
    ['tax-jurisdictions', o.code, 'rates', o.date] as const,
  // Prefix ['income-tax', workspaceId] invalidates every part of the declaration at once.
  incomeTaxDisclaimer: (workspaceId: string | null) =>
    ['income-tax', workspaceId, 'disclaimer'] as const,
  incomeTaxProfile: (o: { workspaceId: string | null; taxYear: number }) =>
    ['income-tax', o.workspaceId, 'profile', o.taxYear] as const,
  incomeTaxMappings: (o: { workspaceId: string | null; taxYear: number }) =>
    ['income-tax', o.workspaceId, 'mappings', o.taxYear] as const,
  incomeTaxDraft: (o: { workspaceId: string | null; taxYear: number }) =>
    ['income-tax', o.workspaceId, 'draft', o.taxYear] as const,
  subscriptions: (o: { workspaceId: string | null; status: string }) =>
    ['subscriptions', o.workspaceId, 'list', o.status] as const,
  subscriptionsSummary: (workspaceId: string | null) =>
    ['subscriptions', workspaceId, 'summary'] as const,
  subscriptionsDuplicates: (workspaceId: string | null) =>
    ['subscriptions', workspaceId, 'duplicates'] as const,
  subscriptionsUpcoming: (o: { workspaceId: string | null; days: number }) =>
    ['subscriptions', o.workspaceId, 'upcoming', o.days] as const,
  subscriptionsChargeCalendar: (o: { workspaceId: string | null; months: number }) =>
    ['subscriptions', o.workspaceId, 'charge-calendar', o.months] as const,
  subscriptionsMonthStatus: (workspaceId: string | null) =>
    ['subscriptions', workspaceId, 'month-status'] as const,
  subscriptionDetail: (o: { workspaceId: string | null; id: string }) =>
    ['subscriptions', o.workspaceId, 'detail', o.id] as const,
  subscriptionChargeCandidates: (o: {
    workspaceId: string | null;
    vendorName: string;
    statementId: string | null;
  }) => ['subscriptions', o.workspaceId, 'charge-candidates', o.vendorName, o.statementId] as const,
  auditEvents: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['audit-events', o.workspaceId, o.params] as const,
  forecast: (o: { workspaceId: string | null; days: number; scenario: string }) =>
    ['forecast', o.workspaceId, o.days, o.scenario] as const,
  investments: (workspaceId: string | null) => ['investments', workspaceId] as const,
  metals: (workspaceId: string | null) => ['metals', workspaceId] as const,
  reconciliation: (workspaceId: string | null) => ['reconciliation', workspaceId] as const,
  cashFlowMap: (o: { workspaceId: string | null; params: string }) =>
    ['reports', o.workspaceId, 'cash-flow-map', o.params] as const,
  netWorth: (o: {
    workspaceId: string | null;
    range: string;
    denominate?: string | null;
    to?: string | null;
  }) => ['net-worth', o.workspaceId, o.range, o.denominate ?? null, o.to ?? null] as const,
  cryptoWallets: (workspaceId: string | null) => ['crypto', 'wallets', workspaceId] as const,
  cryptoSummary: (workspaceId: string | null) => ['crypto', 'summary', workspaceId] as const,
  // Under cryptoSummary, so whatever refreshes the crypto page refreshes the dashboard card too.
  cryptoMonthSummary: (workspaceId: string | null, month: string) =>
    ['crypto', 'summary', workspaceId, month] as const,
  cryptoTransactions: (workspaceId: string | null) =>
    ['crypto', 'transactions', workspaceId] as const,
  cryptoNetworks: (workspaceId: string | null) => ['crypto', 'networks', workspaceId] as const,
  cryptoHistory: (workspaceId: string | null) => ['crypto', 'history', workspaceId] as const,
  cryptoGains: (workspaceId: string | null, year: number | null) =>
    ['crypto', 'gains', workspaceId, year] as const,
  notifications: (workspaceId: string | null) => ['notifications', workspaceId] as const,
  searchRecent: (workspaceId: string | null) => ['search', workspaceId, 'recent'] as const,
  search: (o: { workspaceId: string | null; q: string }) =>
    ['search', o.workspaceId, 'query', o.q] as const,
  notes: (o: { workspaceId: string | null; entityType: string; entityId: string }) =>
    ['notes', o.workspaceId, o.entityType, o.entityId] as const,
  noteCounts: (o: { workspaceId: string | null; entityType: string; entityIds: string[] }) =>
    ['notes', 'counts', o.workspaceId, o.entityType, o.entityIds] as const,
  workspaceMembers: (workspaceId: string | null) => ['workspace-members', workspaceId] as const,
  // Every ledger key starts ['ledger', workspaceId]: one invalidation refreshes the whole ledger
  // after a posting, since an entry moves the journal, the reports and the backlog at once.
  ledgerSettings: (workspaceId: string | null) => ['ledger', workspaceId, 'settings'] as const,
  ledgerIntegrity: (workspaceId: string | null) => ['ledger', workspaceId, 'integrity'] as const,
  ledgerAccounts: (workspaceId: string | null) => ['ledger', workspaceId, 'accounts'] as const,
  ledgerEntries: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['ledger', o.workspaceId, 'entries', o.params] as const,
  ledgerEntry: (o: { workspaceId: string | null; id: string | null }) =>
    ['ledger', o.workspaceId, 'entry', o.id] as const,
  ledgerTrialBalance: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['ledger', o.workspaceId, 'trial-balance', o.params] as const,
  ledgerAccountCard: (o: {
    workspaceId: string | null;
    accountId: string | null;
    params: Record<string, unknown>;
  }) => ['ledger', o.workspaceId, 'account-card', o.accountId, o.params] as const,
  invoices: (o: { workspaceId: string | null; params: Record<string, unknown> }) =>
    ['invoices', o.workspaceId, o.params] as const,
  invoice: (o: { workspaceId: string | null; id: string | null }) =>
    ['invoices', o.workspaceId, o.id] as const,
  invoicesAgeing: (workspaceId: string | null) => ['invoices', workspaceId, 'ageing'] as const,
  invoiceSettings: (workspaceId: string | null) => ['invoices', workspaceId, 'settings'] as const,
  peppolConnection: (workspaceId: string | null) =>
    ['integrations', workspaceId, 'peppol'] as const,
  peppolTransmissions: (o: {
    workspaceId: string | null;
    kind: 'invoice' | 'credit_note';
    documentId: string;
  }) => ['invoices', o.workspaceId, 'peppol', o.kind, o.documentId] as const,
  clients: (workspaceId: string | null) => ['clients', workspaceId] as const,
  taxRateOptions: (workspaceId: string | null) => ['tax-rates', workspaceId, 'options'] as const,
  taxRatesInForce: (o: { workspaceId: string | null; date: string }) =>
    ['tax-rates', o.workspaceId, 'in-force', o.date] as const,
  // Under 'transactions': it is the receipt's row that carries the tax, so an
  // edit that refreshes the figures refreshes it too.
  receiptTax: (o: { workspaceId: string | null; receiptId: string }) =>
    ['transactions', 'receipt-tax', o.workspaceId, o.receiptId] as const,
  /** Instance-wide (the running containers), so the one key without a workspace. */
  systemUpdate: () => ['system-update'] as const,
  workspaceVersions: (workspaceId: string | null) => ['workspace-versions', workspaceId] as const,
} as const;
