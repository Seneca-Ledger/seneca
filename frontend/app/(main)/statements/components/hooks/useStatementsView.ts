'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { applyStatementsFilters } from '@/app/(main)/statements/components/filters/statement-filters';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { usePullToRefresh } from '@/app/hooks/usePullToRefresh';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { fetchExchangeRate } from '@/app/lib/exchange-rate';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import {
  type OpenExpenseDrawerEventDetail,
  resolveExpenseDrawerMode,
  STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT,
  type StatementExpenseMode,
} from '@/app/lib/statement-expense-drawer';
import { mapReceiptsToStatements } from '../receipt-document-mapping';
import {
  buildColumnLabels,
  buildCurrencyOptions,
  buildDateModes,
  buildDatePresets,
  buildFilterLabels,
  buildFilterOptionLabels,
  buildFromOptions,
  buildGroupByOptions,
  buildHasOptions,
  buildListHeaderLabels,
  buildPaginationLabels,
  buildStatusOptions,
  buildTypeOptions,
  buildUploadLabels,
  computeActiveFilterCount,
  deriveVisibleFilterScreens,
  type FilterLabels,
  type FilterOptionLabels,
  filterByApproved,
  isReceiptDerivedStatement,
  paginateStatements,
  resolveStatementSortDate,
} from '../StatementsListView.utils';
import type { StatementUploadLabels } from '../statement-upload';
import {
  STATEMENTS_PAGE_SIZE as PAGE_SIZE,
  type StatementsStatement as Statement,
  type UseStatementsViewParams,
} from './statementsViewTypes';
import { useManualExpenseOptions } from './useManualExpenseOptions';
import { useStatementPreview } from './useStatementPreview';
import { useStatementReviewCounts } from './useStatementReviewCounts';
import { type MergeDuplicatesPlan, useStatementSelection } from './useStatementSelection';
import { useStatementsDuplicates } from './useStatementsDuplicates';
import { useStatementsFilterState } from './useStatementsFilterState';
import { useStatementsListData } from './useStatementsListData';
import { useUploadSkeletonKeys } from './useUploadSkeletonKeys';

interface DocumentStatementsParams {
  statements: Statement[];
  search: string;
  receiptStatements: Statement[];
}

const normalizeCurrencyCode = (currency: string | null | undefined): string | null => {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  if (normalized === 'NIS' || normalized === '\u20aa') {
    return 'ILS';
  }
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
};

const resolveStatementCurrency = (statement: Statement): string | null =>
  normalizeCurrencyCode(
    statement.currency ||
      statement.parsedData?.currency ||
      statement.parsingDetails?.metadataExtracted?.currency ||
      statement.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay,
  );

const formatCurrentExchangeRateLabel = (from: string, to: string, rate: number): string => {
  const formattedRate = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: rate >= 10 ? 2 : 4,
  }).format(rate);
  return `1 ${from} = ${formattedRate} ${to}`;
};

function resolveRouteFilterLabel(
  routeCategoryId: string | null,
  routeReceiptStatus: string | null,
): string | null {
  if (routeCategoryId === 'uncategorized') {
    return 'Missing category';
  }
  if (routeCategoryId) {
    return 'Category filter';
  }
  return routeReceiptStatus ? 'Status filter' : null;
}

const SEARCH_AMOUNT_PATTERN = /^\d[\d ]*(?:[.,](\d{1,2}))?$/;

/**
 * Same reading as the server's search: "12" finds 12.49, "12.5" finds 12.57,
 * "12.50" only 12.50, and "1 200,50" is 1200.50.
 */
function matchesSearchAmount(amount: number | string | null | undefined, q: string): boolean {
  const match = SEARCH_AMOUNT_PATTERN.exec(q);
  const value = Math.abs(Number(amount));
  if (!match || amount === null || amount === undefined || !Number.isFinite(value)) {
    return false;
  }
  const scale = match[1]?.length ?? 0;
  const [whole, cents] = value.toFixed(2).split('.');
  const truncated = scale > 0 ? `${whole}.${cents.slice(0, scale)}` : whole;
  return Number(truncated) === Number(q.replace(/ /g, '').replace(',', '.'));
}

// Receipts come from their own paged endpoint, so the search reaches them here,
// on the fields a receipt row has.
function matchesSearch(s: Statement, q: string): boolean {
  return (
    s.fileName.toLowerCase().includes(q) ||
    (s.subject ?? '').toLowerCase().includes(q) ||
    (s.sender ?? '').toLowerCase().includes(q) ||
    (s.parsedData?.vendor ?? '').toLowerCase().includes(q) ||
    (s.category?.name ?? '').toLowerCase().includes(q) ||
    matchesSearchAmount(s.totalDebit, q)
  );
}

/**
 * Every document: uploaded statements plus receipts. A scan's own statement is
 * left out, its receipt row stands for it.
 */
function buildDocumentStatements({
  statements,
  search,
  receiptStatements,
}: DocumentStatementsParams): Statement[] {
  const baseStatements = statements.filter(s => !isReceiptDerivedStatement(s));
  const q = search.trim().toLowerCase();
  const receiptFiltered =
    q.length > 0 ? receiptStatements.filter(s => matchesSearch(s, q)) : receiptStatements;

  return [...receiptFiltered, ...baseStatements].sort(
    (a, b) => resolveStatementSortDate(b) - resolveStatementSortDate(a),
  );
}

function sortStatements(statements: Statement[], direction: 'asc' | 'desc'): Statement[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...statements].sort((l, r) => {
    const diff = resolveStatementSortDate(l) - resolveStatementSortDate(r);
    if (diff !== 0) {
      return diff * factor;
    }
    // One period from two accounts: the statement added later counts as the newer one, so
    // the order does not hang on the ids, which are random.
    const added = Date.parse(l.createdAt ?? '') - Date.parse(r.createdAt ?? '');
    if (added) {
      return added * factor;
    }
    return l.id.localeCompare(r.id) * factor;
  });
}

export function useStatementsView({
  router,
  searchParams,
  listScrollRef,
}: UseStatementsViewParams): {
  // state
  page: number;
  setPage: (p: number) => void;
  search: string;
  /** Sets the search and goes back to the first page. */
  applySearch: (value: string) => void;
  dateSortDirection: 'asc' | 'desc';
  setDateSortDirection: (d: 'asc' | 'desc') => void;
  expenseDrawerOpen: boolean;
  setExpenseDrawerOpen: (v: boolean) => void;
  expenseDrawerMode: StatementExpenseMode;
  // labels
  t: ReturnType<typeof useIntlayer<'statementsPage'>>;
  filterLabels: FilterLabels;
  filterOptionLabels: FilterOptionLabels;
  listHeaderLabels: Record<string, string>;
  paginationLabels: Record<string, string>;
  uploadLabels: StatementUploadLabels;
  // options
  typeOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  datePresets: Array<{ value: 'thisMonth' | 'lastMonth' | 'yearToDate'; label: string }>;
  dateModes: Array<{ value: 'on' | 'after' | 'before'; label: string }>;
  groupByOptions: Array<{ value: string; label: string }>;
  hasOptions: Array<{ value: string; label: string }>;
  // hooks
  filterState: ReturnType<typeof useStatementsFilterState>;
  manualExpenseCategories: ReturnType<typeof useManualExpenseOptions>['manualExpenseCategories'];
  manualExpenseTaxRates: ReturnType<typeof useManualExpenseOptions>['manualExpenseTaxRates'];
  loadManualExpenseOptions: ReturnType<typeof useManualExpenseOptions>['loadManualExpenseOptions'];
  preview: ReturnType<typeof useStatementPreview>['preview'];
  openPreview: ReturnType<typeof useStatementPreview>['openPreview'];
  closePreview: ReturnType<typeof useStatementPreview>['closePreview'];
  // data
  isPending: boolean;
  /** Placeholder rows above the list for local uploads the server does not list yet. */
  listSkeletonKeys: string[];
  refetchStatements: ReturnType<typeof useStatementsListData>['refetchStatements'];
  refetchReceipts: ReturnType<typeof useStatementsListData>['refetchReceipts'];
  refreshActiveStatements: ReturnType<typeof useStatementsListData>['refreshActiveStatements'];
  // derived
  displayStatements: Statement[];
  paginatedDisplayStatements: Statement[];
  sortedDisplayStatements: Statement[];
  total: number;
  totalPagesCount: number;
  rangeStart: number;
  rangeEnd: number;
  duplicateMetaById: ReturnType<typeof useStatementsDuplicates>['duplicateMetaById'];
  /** Rows each statement still has in Review, by statement id. */
  statementReviewCounts: Record<string, number>;
  setDuplicateOverrides: ReturnType<typeof useStatementsDuplicates>['setDuplicateOverrides'];
  // selection
  selectedStatementIds: string[];
  setSelectedStatementIds: (ids: string[]) => void;
  selectedActionsOpen: boolean;
  setSelectedActionsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  allVisibleSelected: boolean;
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  duplicateStatementIds: string[];
  handleToggleStatement: (id: string) => void;
  handleToggleSelectAll: (checked: boolean) => void;
  handleExportSelected: () => Promise<void>;
  handleDeleteSelected: () => Promise<void>;
  handleMarkSelectedAsDuplicate: () => void;
  handleDismissSelectedDuplicates: () => void;
  handleSelectDetectedDuplicates: () => void;
  handleMergeSelectedDuplicates: () => void;
  mergePlan: MergeDuplicatesPlan | null;
  mergeRunning: boolean;
  confirmMergeSelectedDuplicates: () => Promise<void>;
  cancelMergeSelectedDuplicates: () => void;
  // pull-to-refresh
  pullToRefreshHandlers: ReturnType<typeof usePullToRefresh>['handlers'];
  pullDistance: number;
  pullRefreshing: boolean;
  isReadyToRefresh: boolean;
  // computed
  activeFilterCount: number;
  routeFilterLabel: string | null;
  resetRouteFilters: () => void;
  resetAllFilters: () => void;
  visibleFilterScreens: string[];
  fromOptions: ReturnType<typeof buildFromOptions>;
  currencyOptions: string[];
  appliedColumnsWithLabels: ReturnType<typeof useStatementsFilterState>['columns'];
  columnsWithLabels: ReturnType<typeof useStatementsFilterState>['draftColumns'];
  currentExchangeRateLabels: Record<string, string>;
  // workspace
  currentWorkspace: ReturnType<typeof useWorkspace>['currentWorkspace'];
  isMobile: boolean;
} {
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
  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [expenseDrawerMode, setExpenseDrawerMode] = useState<StatementExpenseMode>('scan');
  const [currentExchangeRateLabels, setCurrentExchangeRateLabels] = useState<
    Record<string, string>
  >({});

  const tx = (path: string[], fallback: string): string =>
    resolveLabel(getNestedValue(t, path), fallback);

  const filterLabels = buildFilterLabels(t);
  const filterOptionLabels = buildFilterOptionLabels(t, tx);
  const listHeaderLabels = buildListHeaderLabels(t);
  const paginationLabels = buildPaginationLabels(tx);
  const uploadLabels = buildUploadLabels(t);

  const typeOptions = buildTypeOptions(filterOptionLabels);
  const statusOptions = buildStatusOptions(filterOptionLabels);
  const datePresets = buildDatePresets(filterOptionLabels);
  const dateModes = buildDateModes(filterOptionLabels);
  const groupByOptions = buildGroupByOptions(filterOptionLabels);
  const hasOptions = buildHasOptions(filterOptionLabels);

  const filterState = useStatementsFilterState({ setPage });
  const { manualExpenseCategories, manualExpenseTaxRates, loadManualExpenseOptions } =
    useManualExpenseOptions();
  const { preview, openPreview, closePreview } = useStatementPreview();
  const routeCategoryId = useMemo(() => {
    const categoryId = searchParams.get('categoryId');
    if (categoryId) {
      return categoryId;
    }
    return searchParams.get('missingCategory') === 'true' ? 'uncategorized' : null;
  }, [searchParams]);
  // A chart links its category or merchant with its period: only that period's rows count.
  const routeMerchant = searchParams.get('merchant');
  const transactionsFrom = searchParams.get('transactionsFrom');
  const transactionsTo = searchParams.get('transactionsTo');
  const routeRowsFilter = useMemo(
    () =>
      routeMerchant || transactionsFrom || transactionsTo
        ? {
            ...(routeMerchant ? { merchant: routeMerchant } : {}),
            ...(transactionsFrom ? { transactionsFrom } : {}),
            ...(transactionsTo ? { transactionsTo } : {}),
          }
        : null,
    [routeMerchant, transactionsFrom, transactionsTo],
  );
  const routeReceiptStatus = useMemo(() => searchParams.get('status') || null, [searchParams]);
  const routeFilterLabel =
    resolveRouteFilterLabel(routeCategoryId, routeReceiptStatus) ??
    (routeMerchant ? 'Merchant filter' : null);
  // Dashboard widgets link here with the filter in the query string, where the
  // drawer never shows it. Resetting has to clear it too, or the list stays
  // filtered by something the user cannot see.
  const resetRouteFilters = useCallback((): void => {
    if (!(routeCategoryId || routeReceiptStatus || routeMerchant)) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('categoryId');
    nextParams.delete('missingCategory');
    nextParams.delete('merchant');
    nextParams.delete('transactionsFrom');
    nextParams.delete('transactionsTo');
    nextParams.delete('status');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/statements/submit?${nextQuery}` : '/statements/submit');
    setPage(1);
  }, [routeCategoryId, routeReceiptStatus, routeMerchant, router, searchParams]);

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
    loadListErrorLabel: resolveLabel(t.loadListError, 'Failed to load statements'),
    refreshFailedLabel: resolveLabel(t.refreshFailed, 'Failed to refresh statements'),
  });

  // Effect events: the loaders are re-created by their hooks each render, and
  // an eslint-disable inside a hook makes React Compiler skip the whole hook.
  const loadManualExpenseOptionsEvent = useEffectEvent(() => {
    void loadManualExpenseOptions();
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

  // Open expense drawer from event
  useEffect(() => {
    const handleOpen = (event: Event): void => {
      const detail = (event as CustomEvent<OpenExpenseDrawerEventDetail>).detail;
      setExpenseDrawerMode(resolveExpenseDrawerMode(detail?.mode));
      setExpenseDrawerOpen(true);
    };
    window.addEventListener(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, handleOpen);
    return () => window.removeEventListener(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, handleOpen);
  }, []);

  // Open expense drawer from URL params
  useEffect(() => {
    const requestedMode = searchParams.get('openExpenseDrawer');
    if (!requestedMode) {
      return;
    }
    setExpenseDrawerMode(resolveExpenseDrawerMode(requestedMode));
    setExpenseDrawerOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('openExpenseDrawer');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/statements/submit?${nextQuery}` : '/statements/submit');
  }, [searchParams, router]);

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

  const {
    selectedStatementIds,
    setSelectedStatementIds,
    selectedActionsOpen,
    setSelectedActionsOpen,
    allVisibleSelected,
    selectedCount,
    hasSelectedDuplicates,
    duplicateStatementIds,
    handleToggleStatement,
    handleToggleSelectAll,
    handleExportSelected,
    handleDeleteSelected,
    handleMarkSelectedAsDuplicate,
    handleDismissSelectedDuplicates,
    handleSelectDetectedDuplicates,
    handleMergeSelectedDuplicates,
    mergePlan,
    mergeRunning,
    confirmMergeSelectedDuplicates,
    cancelMergeSelectedDuplicates,
  } = useStatementSelection({
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
  const exchangeRateColumnVisible = appliedColumnsWithLabels.some(
    column => column.id === 'exchangeRate' && column.visible,
  );
  const exchangeRateTargetCurrency =
    normalizeCurrencyCode(currentWorkspace?.currency) ?? FALLBACK_CURRENCY;
  const exchangeRateSourceCurrencies = useMemo(() => {
    if (!exchangeRateColumnVisible) {
      return [];
    }
    const currencies = new Set<string>(['USD']);
    for (const statement of paginatedDisplayStatements) {
      const currency = resolveStatementCurrency(statement);
      if (currency && currency !== exchangeRateTargetCurrency) {
        currencies.add(currency);
      }
    }
    return Array.from(currencies).sort();
  }, [exchangeRateColumnVisible, exchangeRateTargetCurrency, paginatedDisplayStatements]);

  useEffect(() => {
    if (!exchangeRateColumnVisible) {
      setCurrentExchangeRateLabels({});
      return;
    }

    const localLabels: Record<string, string> =
      exchangeRateTargetCurrency === 'USD'
        ? { 'USD:USD': formatCurrentExchangeRateLabel('USD', 'USD', 1) }
        : {};
    const sourceCurrenciesToLoad = exchangeRateSourceCurrencies.filter(
      from => from !== exchangeRateTargetCurrency,
    );

    if (sourceCurrenciesToLoad.length === 0) {
      setCurrentExchangeRateLabels(localLabels);
      return;
    }

    let cancelled = false;
    const target = exchangeRateTargetCurrency;

    const loadCurrentRates = async (): Promise<void> => {
      const entries = await Promise.all(
        sourceCurrenciesToLoad.map(async from => {
          const key = `${from}:${target}`;
          const rate = await fetchExchangeRate(from, target);
          if (rate === null) {
            return [key, null] as const;
          }
          return [key, formatCurrentExchangeRateLabel(from, target, rate)] as const;
        }),
      );

      if (cancelled) {
        return;
      }
      setCurrentExchangeRateLabels({
        ...localLabels,
        ...entries.reduce<Record<string, string>>((acc, [key, label]) => {
          if (label) {
            acc[key] = label;
          }
          return acc;
        }, {}),
      });
    };

    void loadCurrentRates();

    return () => {
      cancelled = true;
    };
  }, [exchangeRateColumnVisible, exchangeRateSourceCurrencies, exchangeRateTargetCurrency]);

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
    filterLabels,
    filterOptionLabels,
    listHeaderLabels,
    paginationLabels,
    uploadLabels,
    typeOptions,
    statusOptions,
    datePresets,
    dateModes,
    groupByOptions,
    hasOptions,
    filterState,
    manualExpenseCategories,
    manualExpenseTaxRates,
    loadManualExpenseOptions,
    preview,
    openPreview,
    closePreview,
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
    selectedStatementIds,
    setSelectedStatementIds,
    selectedActionsOpen,
    setSelectedActionsOpen,
    allVisibleSelected,
    selectedCount,
    hasSelectedDuplicates,
    duplicateStatementIds,
    handleToggleStatement,
    handleToggleSelectAll,
    handleExportSelected,
    handleDeleteSelected,
    handleMarkSelectedAsDuplicate,
    handleDismissSelectedDuplicates,
    handleSelectDetectedDuplicates,
    handleMergeSelectedDuplicates,
    mergePlan,
    mergeRunning,
    confirmMergeSelectedDuplicates,
    cancelMergeSelectedDuplicates,
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
