import { useContext, useEffect, useEffectEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import type { GmailReceipt, StatementMeta, Transaction } from '../types/statement-types';
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
  gmailReceipts: GmailReceipt[];
  loading: boolean;
  workspaceTargets: WorkspaceTarget[];
  workspaceTargetKey: string;
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-params
async function fetchAllPages<T>(
  endpoint: string,
  headers: Record<string, string>,
  pageSize: number,
  workspaceId: string,
  workspaceName: string,
  getItems: (data: unknown) => T[],
  getTotal: (data: unknown, fetched: number) => number,
  nextOffset: (page: number, offset: number) => { page?: number; offset?: number },
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (results.length < total) {
    const { page: p, offset: o } = nextOffset(page, offset);
    // eslint-disable-next-line no-await-in-loop
    const response = await apiClient.get(endpoint, {
      params: p !== undefined ? { page: p, limit: pageSize } : { limit: pageSize, offset: o },
      headers,
    });
    const batch = getItems(response.data);
    results.push(
      ...batch.map(
        item =>
          ({
            ...(item as object),
            workspaceId,
            workspaceName,
          }) as T,
      ),
    );
    total = getTotal(response.data, results.length);
    if (batch.length < pageSize) {
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
 * Fetches statements (and optionally transactions) and Gmail receipts for the
 * selected workspaces. Several analytics views on one page would each run this
 * over the same data, so `useAnalyticsData` below hands them a shared result
 * when an `AnalyticsDataProvider` is above them; this is the fetching half.
 */
// eslint-disable-next-line max-lines-per-function
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
  const [gmailReceipts, setGmailReceipts] = useState<GmailReceipt[]>([]);
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
  // eslint-disable-next-line max-lines-per-function
  const loadAnalytics = useEffectEvent(async (isMounted: () => boolean): Promise<void> => {
    if (!user) {
      return;
    }

    if (workspaceTargets.length === 0) {
      setStatements([]);
      setTransactions([]);
      setGmailReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    return await (async () => {
      const allStatements: StatementMeta[] = [];
      const allTransactions: Transaction[] = [];
      const allReceipts: GmailReceipt[] = [];

      for (const target of workspaceTargets) {
        const headers = { 'X-Workspace-Id': target.id };

        // eslint-disable-next-line no-await-in-loop
        const workspaceStatements = await fetchAllPages<StatementMeta>(
          '/statements',
          headers,
          500,
          target.id,
          target.name,
          data => {
            const items = (data as { data?: unknown; items?: unknown }) ?? {};
            const raw = (items as { data?: unknown }).data ?? data ?? [];
            return Array.isArray(raw) ? raw : [];
          },
          (data, fetched) => Number((data as { total?: unknown }).total ?? fetched),
          page => ({ page }),
        );
        allStatements.push(...workspaceStatements);

        if (includeTransactions) {
          // eslint-disable-next-line no-await-in-loop
          const workspaceTransactions = await fetchAllPages<Transaction>(
            '/transactions',
            headers,
            500,
            target.id,
            target.name,
            data => {
              const raw =
                (data as { data?: unknown }).data ??
                (data as { items?: unknown }).items ??
                data ??
                [];
              return Array.isArray(raw) ? raw : [];
            },
            (data, fetched) => Number((data as { total?: unknown }).total ?? fetched),
            page => ({ page }),
          );
          allTransactions.push(...workspaceTransactions);
        }

        // eslint-disable-next-line no-await-in-loop
        const workspaceReceipts = await fetchAllPages<GmailReceipt>(
          '/integrations/gmail/receipts',
          headers,
          100,
          target.id,
          target.name,
          data => {
            const receipts = (data as { receipts?: unknown }).receipts;
            return Array.isArray(receipts) ? receipts : [];
          },
          (data, fetched) => Number((data as { total?: unknown }).total ?? fetched),
          (_, offset) => ({ offset }),
        );
        allReceipts.push(...workspaceReceipts);
      }

      if (!isMounted()) {
        return;
      }
      // Every number built from these is a statistic: unconfirmed rows stay out.
      const confirmed = keepConfirmed({ transactions: allTransactions, receipts: allReceipts });
      setStatements(allStatements);
      setTransactions(confirmed.transactions);
      setGmailReceipts(confirmed.receipts);
    })()
      .catch(async error => {
        console.error('Failed to load analytics data', error);
        if (isMounted()) {
          toast.error(errorToastMessage);
          setStatements([]);
          setTransactions([]);
          setGmailReceipts([]);
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
    gmailReceipts,
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
