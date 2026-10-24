import { useContext, useEffect, useEffectEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import type { ReceiptDocument, StatementMeta, Transaction } from '../types/statement-types';
import { AnalyticsDataContext } from './analytics-data-context';
import { keepConfirmed } from './confirmed-analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspaceTarget = { id: string; name: string };

export type WorkspaceFilterValue = 'current' | 'all' | string;

type WorkspaceLike = { id: string; name?: string | null };

export interface UseAnalyticsDataParams {
  user: unknown;
  currentWorkspace: WorkspaceLike | null | undefined;
  workspaces: WorkspaceLike[];
  workspaceFilter: WorkspaceFilterValue;
  currentWorkspaceLabel: string;
  /** Whether to also fetch /transactions (TopMerchants, TopCategories). Default false. */
  includeTransactions?: boolean;
  errorToastMessage?: string;
}

export interface UseAnalyticsDataResult {
  statements: StatementMeta[];
  transactions: Transaction[];
  receipts: ReceiptDocument[];
  loading: boolean;
  workspaceTargets: WorkspaceTarget[];
  workspaceTargetKey: string;
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

/** Every page of a list, `load` fetching one by its number and offset. */
async function fetchAllPages<T>(
  pageSize: number,
  load: (page: number, offset: number) => Promise<{ items: readonly T[]; total: number }>,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (results.length < total) {
    const batch = await load(page, offset);
    results.push(...batch.items);
    total = batch.total;
    if (batch.items.length < pageSize) {
      break;
    }
    page += 1;
    offset += pageSize;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches statements (and optionally transactions) and receipts for the
 * selected workspaces. Several analytics views on one page would each run this
 * over the same data, so `useAnalyticsData` below hands them a shared result
 * when an `AnalyticsDataProvider` is above them; this is the fetching half.
 */
export function useAnalyticsDataFetch(
  {
    user,
    currentWorkspace,
    workspaces,
    workspaceFilter,
    currentWorkspaceLabel,
    includeTransactions = false,
    errorToastMessage = 'Failed to load data',
  }: UseAnalyticsDataParams,
  enabled = true,
): UseAnalyticsDataResult {
  const [statements, setStatements] = useState<StatementMeta[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<ReceiptDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const currentWorkspaceId = currentWorkspace?.id;
  const currentWorkspaceName = currentWorkspace?.name;
  const workspaceTargets = useMemo<WorkspaceTarget[]>(() => {
    if (workspaceFilter === 'all') {
      const all = workspaces.map(ws => ({ id: ws.id, name: ws.name || 'Workspace' }));
      if (all.length > 0) {
        return all;
      }
    }
    if (workspaceFilter === 'current') {
      if (currentWorkspaceId) {
        return [{ id: currentWorkspaceId, name: currentWorkspaceName || currentWorkspaceLabel }];
      }
      return [];
    }
    const selected = workspaces.find(ws => ws.id === workspaceFilter);
    return [{ id: workspaceFilter, name: selected?.name || currentWorkspaceLabel }];
  }, [
    workspaceFilter,
    workspaces,
    currentWorkspaceId,
    currentWorkspaceName,
    currentWorkspaceLabel,
  ]);

  const workspaceTargetKey = useMemo(
    () => workspaceTargets.map(t => t.id).join(','),
    [workspaceTargets],
  );

  // Effect event so the effect below depends only on the user/workspace key
  // while always calling the latest loader (no eslint-disable, which would make
  // React Compiler skip this hook).
  const loadAnalytics = useEffectEvent(async (isMounted: () => boolean): Promise<void> => {
    if (!user) {
      return;
    }

    if (workspaceTargets.length === 0) {
      setStatements([]);
      setTransactions([]);
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    return await (async () => {
      const allStatements: StatementMeta[] = [];
      const allTransactions: Transaction[] = [];
      const allReceipts: ReceiptDocument[] = [];

      for (const target of workspaceTargets) {
        const headers = { 'X-Workspace-Id': target.id };

        const tag = { workspaceId: target.id, workspaceName: target.name };

        const workspaceStatements = await fetchAllPages(500, async page => {
          const response = await apiClient.get('/statements', {
            params: { page, limit: 500 },
            headers,
          });
          const list = await checkContract('StatementListPage', response.data, '/statements');
          return { items: list.data, total: list.total };
        });
        allStatements.push(
          ...workspaceStatements.map((statement): StatementMeta => ({ ...statement, ...tag })),
        );

        if (includeTransactions) {
          const workspaceTransactions = await fetchAllPages(500, async page => {
            const response = await apiClient.get('/transactions', {
              params: { page, limit: 500 },
              headers,
            });
            const list = await checkContract('TransactionListPage', response.data, '/transactions');
            return { items: list.data, total: list.total };
          });
          allTransactions.push(
            ...workspaceTransactions.map(
              (transaction): Transaction => ({ ...transaction, ...tag }),
            ),
          );
        }

        const workspaceReceipts = await fetchAllPages(100, async (_, offset) => {
          const response = await apiClient.get('/receipts/documents', {
            params: { limit: 100, offset },
            headers,
          });
          // Unchecked: the receipt documents list has no response contract.
          const list = response.data as { receipts?: ReceiptDocument[]; total?: number } | null;
          const items = Array.isArray(list?.receipts) ? list.receipts : [];
          return { items, total: Number(list?.total ?? items.length) };
        });
        allReceipts.push(...workspaceReceipts.map(receipt => ({ ...receipt, ...tag })));
      }

      if (!isMounted()) {
        return;
      }
      // Every number built from these is a statistic: unconfirmed rows stay out.
      const confirmed = keepConfirmed({ transactions: allTransactions, receipts: allReceipts });
      setStatements(allStatements);
      setTransactions(confirmed.transactions);
      setReceipts(confirmed.receipts);
    })()
      .catch(async error => {
        console.error('Failed to load analytics data', error);
        if (isMounted()) {
          toast.error(errorToastMessage);
          setStatements([]);
          setTransactions([]);
          setReceipts([]);
        }
      })
      .finally(async () => {
        if (isMounted()) {
          setLoading(false);
        }
      });
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let isMounted = true;
    void loadAnalytics(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [user, workspaceTargetKey, enabled]);

  return {
    statements,
    transactions,
    receipts,
    loading,
    workspaceTargets,
    workspaceTargetKey,
  };
}

/**
 * The analytics data for these params: shared with the rest of the page when an
 * `AnalyticsDataProvider` is above this call, fetched on its own otherwise.
 * Callers pass their own params either way — only the provider-less path uses
 * them, and the provider is set up to fetch the superset its children need.
 */
export function useAnalyticsData(params: UseAnalyticsDataParams): UseAnalyticsDataResult {
  const shared = useContext(AnalyticsDataContext);
  const own = useAnalyticsDataFetch(params, shared === null);
  return shared ?? own;
}
