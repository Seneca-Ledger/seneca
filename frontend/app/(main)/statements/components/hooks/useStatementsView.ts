'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { applyStatementsFilters } from '@/app/(main)/statements/components/filters/statement-filters';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { usePullToRefresh } from '@/app/hooks/usePullToRefresh';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { mapReceiptsToStatements } from '../receipt-document-mapping';
import {
  buildColumnLabels,
  buildCurrencyOptions,
  buildFromOptions,
  computeActiveFilterCount,
  deriveVisibleFilterScreens,
  filterByApproved,
  paginateStatements,
} from '../StatementsListView.utils';
import { buildDocumentStatements, sortStatements } from './statements-view-documents';
import { statementsViewLabels } from './statements-view-labels';
import {
  STATEMENTS_PAGE_SIZE as PAGE_SIZE,
  type StatementsStatement as Statement,
  type StatementsView,
  type UseStatementsViewParams,
} from './statementsViewTypes';
import { useCurrentExchangeRateLabels } from './useCurrentExchangeRateLabels';
import { useExpenseDrawerRequests } from './useExpenseDrawerRequests';
import { useManualExpenseOptions } from './useManualExpenseOptions';
import { useStatementPreview } from './useStatementPreview';
import { useStatementReviewCounts } from './useStatementReviewCounts';
import { useStatementSelection } from './useStatementSelection';
import { useStatementsDuplicates } from './useStatementsDuplicates';
import { useStatementsFilterState } from './useStatementsFilterState';
import { useStatementsListData } from './useStatementsListData';
import { useStatementsRouteFilters } from './useStatementsRouteFilters';
import { useUploadSkeletonKeys } from './useUploadSkeletonKeys';

export function useStatementsView({
  router,
  searchParams,
  listScrollRef,
}: UseStatementsViewParams): StatementsView {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const isMobile = useIsMobile();
  const t = useIntlayer('statementsPage');

  const [page, setPage] = useState(1);
  // Statements are searched on the server (the term is part of the query key);
  // receipts are searched on the client in buildDocumentStatements.
  const [search, setSearch] = useState('');
  const [dateSortDirection, setDateSortDirection] = useState<'desc' | 'asc'>('desc');
  const { expenseDrawerOpen, setExpenseDrawerOpen, expenseDrawerMode } = useExpenseDrawerRequests({
    router,
    searchParams,
  });

  const labels = statementsViewLabels(t);
  const { filterOptionLabels, listHeaderLabels } = labels;

  const filterState = useStatementsFilterState({ setPage });
  const manualExpenseOptions = useManualExpenseOptions();
  const statementPreview = useStatementPreview();
  const {
    routeCategoryId,
    routeMerchant,
    routeRowsFilter,
    routeReceiptStatus,
    routeFilterLabel,
    resetRouteFilters,
  } = useStatementsRouteFilters({ router, searchParams, setPage });
  const resetAllFilters = (): void => {
    filterState.resetAllFilters();
    resetRouteFilters();
  };

  const {
    statements,
    receipts,
    isPending,
    receiptsIsPending,
    refetchStatements,
    refetchReceipts,
    refreshActiveStatements,
  } = useStatementsListData({
    appliedFilters: filterState.appliedFilters,
    categoryId: routeCategoryId,
    rowsFilter: routeRowsFilter,
    receiptStatus: routeReceiptStatus,
    search,
    user,
    page,
    pageSize: PAGE_SIZE,
    router,
    loadListErrorLabel: t.loadListError.value,
    refreshFailedLabel: t.refreshFailed.value,
  });

  // Effect events: the loaders are re-created by their hooks each render, and
  // an eslint-disable inside a hook makes React Compiler skip the whole hook.
  const loadManualExpenseOptionsEvent = useEffectEvent(() => {
    void manualExpenseOptions.loadManualExpenseOptions();
  });
  const initFiltersFromStorage = useEffectEvent(() => {
    // A chart's link brings its own period; saved filters would hide part of it.
    filterState.initFromStorage(
      searchParams.get('month'),
      Boolean(searchParams.get('transactionsFrom')),
    );
  });

  // Load manual expense options when user is available
  useEffect(() => {
    if (!user) {
      return;
    }
    loadManualExpenseOptionsEvent();
  }, [user]);

  // Init from storage
  useEffect(() => {
    initFiltersFromStorage();
  }, []);

  // Чеки вливаются в тот же список, поэтому ждём оба запроса —
  // иначе строки досыпаются в уже отрисованную таблицу.
  const listIsPending = isPending || receiptsIsPending;
  const statementReviewCounts = useStatementReviewCounts(Boolean(user));

  const receiptStatements = useMemo<Statement[]>(
    () => mapReceiptsToStatements(receipts),
    [receipts],
  );

  const uploadSkeletonKeys = useUploadSkeletonKeys({
    workspaceId,
    receiptRows: receipts,
    statements,
    limit: PAGE_SIZE,
  });
  const listSkeletonKeys = uploadSkeletonKeys;

  const documentStatements = useMemo(
    () => buildDocumentStatements({ statements, search, receiptStatements }),
    [statements, search, receiptStatements],
  );

  // Approved needs Review's counts and the row kind, which the shared filters
  // do not know, so it is applied here, before the limit cuts the list.
  const displayStatements = useMemo(
    () =>
      applyStatementsFilters(
        filterByApproved(
          documentStatements,
          filterState.appliedFilters.approved,
          statementReviewCounts,
        ),
        { ...filterState.appliedFilters, approved: null },
      ),
    [documentStatements, filterState.appliedFilters, statementReviewCounts],
  );

  const sortedDisplayStatements = useMemo(
    () => sortStatements(displayStatements, dateSortDirection),
    [displayStatements, dateSortDirection],
  );

  const paginatedDisplayStatements = useMemo(
    () => paginateStatements(sortedDisplayStatements, page, PAGE_SIZE),
    [sortedDisplayStatements, page],
  );

  const total = sortedDisplayStatements.length;
  const totalPagesCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(total, page * PAGE_SIZE);

  // Clamp page
  useEffect(() => {
    if (page > totalPagesCount) {
      setPage(totalPagesCount);
    }
  }, [page, totalPagesCount]);

  const { setDuplicateOverrides, duplicateMetaById } = useStatementsDuplicates({
    displayStatements,
    scanningLabel: listHeaderLabels.scanning,
  });

  const visibleStatementIds = useMemo(
    () => paginatedDisplayStatements.map(s => s.id),
    [paginatedDisplayStatements],
  );

  const selection = useStatementSelection({
    displayStatements,
    visibleStatementIds,
    duplicateMetaById,
    setDuplicateOverrides,
    search,
    // Опции загрузчиков растворились: search теперь часть ключа запроса,
    // silent — это isFetching, а тост об ошибке живёт в самом хуке данных.
    onRefreshStatements: async () => {
      refetchStatements();
    },
    onRefreshReceipts: async () => {
      refetchReceipts();
    },
  });

  const {
    handlers: pullToRefreshHandlers,
    pullDistance,
    isRefreshing: pullRefreshing,
    isReadyToRefresh,
  } = usePullToRefresh({
    enabled: isMobile,
    isAtTop: () => !listScrollRef.current || listScrollRef.current.scrollTop <= 0,
    onRefresh: refreshActiveStatements,
  });

  const activeFilterCount = useMemo(
    () =>
      computeActiveFilterCount(filterState.appliedFilters) +
      (routeCategoryId ? 1 : 0) +
      (routeMerchant ? 1 : 0) +
      (routeReceiptStatus ? 1 : 0),
    [filterState.appliedFilters, routeCategoryId, routeMerchant, routeReceiptStatus],
  );

  const visibleFilterScreens = useMemo(
    () => deriveVisibleFilterScreens(filterState.columns),
    [filterState.columns],
  );

  const fromOptions = useMemo(() => buildFromOptions(documentStatements), [documentStatements]);
  const currencyOptions = useMemo(
    () => buildCurrencyOptions(documentStatements),
    [documentStatements],
  );

  const columnLabels = buildColumnLabels(filterOptionLabels);
  const appliedColumnsWithLabels = useMemo(
    () => filterState.columns.map(col => ({ ...col, label: columnLabels[col.id] ?? col.label })),
    [filterState.columns, columnLabels],
  );
  const columnsWithLabels = useMemo(
    () =>
      filterState.draftColumns.map(col => ({ ...col, label: columnLabels[col.id] ?? col.label })),
    [filterState.draftColumns, columnLabels],
  );
  const currentExchangeRateLabels = useCurrentExchangeRateLabels({
    columns: appliedColumnsWithLabels,
    workspaceCurrency: currentWorkspace?.currency,
    statements: paginatedDisplayStatements,
  });

  return {
    page,
    setPage,
    search,
    applySearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    dateSortDirection,
    setDateSortDirection,
    expenseDrawerOpen,
    setExpenseDrawerOpen,
    expenseDrawerMode,
    t,
    ...labels,
    filterState,
    ...manualExpenseOptions,
    ...statementPreview,
    ...selection,
    isPending: listIsPending,
    listSkeletonKeys,
    refetchStatements,
    refetchReceipts,
    refreshActiveStatements,
    displayStatements,
    paginatedDisplayStatements,
    sortedDisplayStatements,
    total,
    totalPagesCount,
    rangeStart,
    rangeEnd,
    duplicateMetaById,
    statementReviewCounts,
    setDuplicateOverrides,
    pullToRefreshHandlers,
    pullDistance,
    pullRefreshing,
    isReadyToRefresh,
    activeFilterCount,
    routeFilterLabel,
    resetRouteFilters,
    resetAllFilters,
    visibleFilterScreens,
    fromOptions,
    currencyOptions,
    appliedColumnsWithLabels,
    columnsWithLabels,
    currentExchangeRateLabels,
    currentWorkspace,
    isMobile,
  };
}
