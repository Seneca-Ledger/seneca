import { getQueryClient } from './query-client';

/**
 * Query roots (first element of a key in `query-keys.ts`) whose answers are
 * computed from transactions, receipts or statements: every figure that moves
 * when a document or a row is edited, approved or deleted.
 */
export const FINANCIAL_QUERY_ROOTS = [
  'statements',
  'receipt-documents',
  'review-inbox',
  'transactions',
  'dashboard',
  'reports',
  'budgets',
  'goals',
  'forecast',
  'net-worth',
  'balance-sheet',
  'insights',
  'subscriptions',
  'payables',
  'wallets',
  'reconciliation',
  'ledger',
  'tables-report',
  'categories',
  'payees',
  // Match counts and the preview of what a rule would file.
  'categorization-rules',
  'search',
  'tax-return',
  'tax-settings',
  'tax-year',
  'income-tax',
  'datev',
] as const;

/**
 * Query roots that do not read transactions, receipts or statements, so an
 * edit to one leaves them alone. Every root in `query-keys.ts` is in one of the
 * two lists; a test enforces it, so a new kind of figure cannot be forgotten.
 */
export const NON_FINANCIAL_QUERY_ROOTS = [
  'admin-users',
  'api-keys',
  'audit-events',
  'clients',
  'crypto',
  'custom-tables',
  'daily-quote',
  'integrations',
  'integration-status',
  'investments',
  'invoices',
  'map-styles',
  'metals',
  'notes',
  'notifications',
  'storage-files',
  'system-update',
  'tax-jurisdictions',
  'tax-rates',
  'webhook-endpoints',
  'webhook-subscriptions',
  'workspace-members',
  'workspace-versions',
] as const;

/**
 * Marks every figure built from transactions, receipts or statements stale:
 * the lists of documents and the Review queue, and the dashboard, reports,
 * budgets, goals, forecast, net worth and tax pages that sum them. Open pages
 * refetch now; the rest refetch when visited, instead of showing the old
 * numbers for the 30 s staleTime.
 */
export function invalidateFinancialData(): void {
  const queryClient = getQueryClient();
  for (const root of FINANCIAL_QUERY_ROOTS) {
    void queryClient.invalidateQueries({ queryKey: [root] });
  }
}

/**
 * After a document changed on its own page (edited, approved, re-categorised,
 * deleted). A document is where the numbers come from, so this refreshes every
 * figure, not only the lists that show it.
 */
export function invalidateDocumentLists(): void {
  invalidateFinancialData();
}
