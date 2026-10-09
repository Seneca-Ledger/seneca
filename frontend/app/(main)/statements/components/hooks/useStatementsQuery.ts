'use client';

import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { hasProcessingStatements } from '@/app/lib/statement-status';
import type { StatementFilters } from '../filters/statement-filters';
import {
  buildStatementRequestParams,
  isReceiptDerivedStatement,
} from '../StatementsListView.utils';

/** Minimal shape required by the data-loading hook. */
export interface StatementRecord {
  id: string;
  fileName: string;
  status: string;
}

const POLL_INTERVAL_MS = 4000;

/**
 * Пока хоть одна выписка обрабатывается — опрашиваем раз в 4с, иначе не
 * опрашиваем вовсе. Функция от данных, а не эффект с интервалом: предикат
 * считается по свежеполученному ответу и интервал не пересоздаётся на каждый тик.
 *
 * Выписки из скана чеков в счёт не идут: скан разбирается прямо в запросе
 * загрузки, и без суммы такая выписка остаётся `uploaded` навсегда.
 */
export function statementsRefetchInterval(data: unknown): number | false {
  if (!Array.isArray(data)) return false;
  const rows = data as Array<
    Parameters<typeof isReceiptDerivedStatement>[0] & { status?: string | null }
  >;
  return hasProcessingStatements(rows.filter(row => !isReceiptDerivedStatement(row)))
    ? POLL_INTERVAL_MS
    : false;
}

export interface UseStatementsQueryParams {
  appliedFilters: StatementFilters;
  categoryId?: string | null;
  search: string;
  enabled: boolean;
}

export function useStatementsQuery<T extends StatementRecord = StatementRecord>({
  appliedFilters,
  categoryId,
  search,
  enabled,
}: UseStatementsQueryParams): UseQueryResult<T[], Error> {
  const workspaceId = useWorkspaceId();
  const params = buildStatementRequestParams({ appliedFilters, categoryId, search });

  return useQuery({
    queryKey: queryKeys.statements({ workspaceId, params }),
    // fileType выводится здесь, а не в select: structural sharing должен
    // применяться к уже производному массиву, иначе каждый опрос отдаёт новые
    // референсы и перерисовывает весь список.
    queryFn: async ({ signal }) => {
      const payload = await apiQuery<StatementRecord[] | null>({
        url: '/statements',
        params,
        signal,
      });
      const rows = Array.isArray(payload) ? payload : [];
      return rows.map(stmt => ({
        ...stmt,
        fileType: stmt.fileName?.toLowerCase().includes('pdf') ? 'pdf' : 'file',
      })) as unknown as T[];
    },
    enabled,
    refetchInterval: query => statementsRefetchInterval(query.state.data),
    // Смена фильтра или поиска не должна ронять список в скелетон.
    placeholderData: keepPreviousData,
  });
}
