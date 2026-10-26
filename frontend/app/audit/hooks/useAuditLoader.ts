import { useQuery } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { queryKeys } from '@/app/lib/query-keys';
import type { AuditEvent, AuditEventFilter } from '@/lib/api/audit';
import { fetchAuditEvents } from '@/lib/api/audit';
import { getErrorMessage } from '../helpers/audit-helpers';

export type AuditLoaderResult = {
  events: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  filters: AuditEventFilter;
  setPage: (p: number) => void;
  setLimit: (l: number) => void;
  setFilters: Dispatch<SetStateAction<AuditEventFilter>>;
  reload: () => void;
};

export function useAuditLoader(): AuditLoaderResult {
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [filters, setFilters] = useState<AuditEventFilter>({});
  const params = useMemo(() => ({ ...filters, page, limit }), [filters, page, limit]);

  const query = useQuery({
    queryKey: queryKeys.auditEvents({ workspaceId, params }),
    queryFn: () => fetchAuditEvents(params),
    // Страница и фильтры меняют ключ; лента и пагинатор остаются на экране до
    // прихода новых событий, но только в пределах одного воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  const reload = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  return {
    events: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    page,
    limit,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError
      ? getErrorMessage({ error: query.error, fallback: 'Failed to load audit events' })
      : null,
    filters,
    setPage,
    setLimit,
    setFilters,
    reload,
  };
}
