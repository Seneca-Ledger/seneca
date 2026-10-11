import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import type { ContextInput } from './build-context';

/**
 * Reads the workspace summary from the existing dashboard endpoints.
 *
 * These are already workspace-scoped and covered by tests, so the AI feature
 * adds no new query surface over financial data — it reuses the same aggregates
 * the dashboard renders.
 */

const RANGE = '90d';
const TREND_DAYS = 90;

export async function fetchContextInput(): Promise<ContextInput> {
  const [dashboard, trends] = await Promise.all([
    apiQueryDecoded({ url: '/dashboard', params: { range: RANGE }, contract: 'DashboardResponse' }),
    apiQueryDecoded({
      url: '/dashboard/trends',
      params: { days: TREND_DAYS },
      contract: 'DashboardTrendsResponse',
    }),
  ]);

  return {
    snapshot: dashboard.snapshot,
    // `name` is null for uncategorized spend; the prompt needs a word, not "null".
    topCategories: dashboard.topCategories.map(category => ({
      name: category.name ?? 'Uncategorized',
      amount: category.amount,
      count: category.count,
    })),
    topMerchants: [...dashboard.topMerchants],
    incomeSources: [...trends.counterparties],
    cashFlow: [...dashboard.cashFlow],
    uncategorizedTransactions: dashboard.dataHealth.uncategorizedTransactions,
  };
}

export interface SearchHit {
  transactionId: string;
  counterpartyName: string;
  paymentPurpose: string;
  transactionDate: string;
  amount: number | null;
  currency: string;
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  truncated: boolean;
  pendingEmbeddings: number;
}

/**
 * Pulls the transactions most similar to the question.
 *
 * Aggregates answer "how much on food", but not "when did I last pay the
 * pharmacy" — that needs the individual rows.
 */
export async function searchTransactions(query: string, limit = 8): Promise<SearchResult> {
  const response = await apiClient.post<SearchResult>('/ai-analysis/search', {
    query,
    limit,
  } satisfies ContractInput<'SearchTransactionsBody'>);
  return response.data;
}
