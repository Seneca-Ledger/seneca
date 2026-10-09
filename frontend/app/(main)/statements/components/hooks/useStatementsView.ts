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
import { STATEMENTS_GMAIL_SYNC_STORAGE_KEY } from '@/app/lib/statement-upload-actions';
import { mapGmailReceiptsToStatements } from '../gmail-receipt-mapping';
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

function matchesSearch(s: Statement, q: string): boolean {
  return (
    s.fileName.toLowerCase().includes(q) ||
    (s.subject ?? '').toLowerCase().includes(q) ||
    (s.sender ?? '').toLowerCase().includes(q) ||
    (s.parsedData?.vendor ?? '').toLowerCase().includes(q)
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
    return l.id.localeCompare(r.id) * factor;
  });
}

// eslint-disable-next-line max-lines-per-function
export function useStatementsView({
  router,
  searchParams,
  listScrollRef,
}: UseStatementsViewParams): {
  // state
  page: number;
  setPage: (p: number) => void;
  search: string;
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
  /** Placeholder rows above the list: local uploads first, then Gmail sync. */
  listSkeletonKeys: string[];
  refetchStatements: ReturnType<typeof useStatementsListData>['refetchStatements'];
  refetchGmailReceipts: ReturnType<typeof useStatementsListData>['refetchGmailReceipts'];
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
  // The page has no search box any more; the list is narrowed by the filter
  // chips and the route alone, and the query key keeps its shape.
  const search = '';
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
  const routeReceiptStatus = useMemo(() => searchParams.get('status') || null, [searchParams]);
  const routeFilterLabel = resolveRouteFilterLabel(routeCategoryId, routeReceiptStatus);
  // Dashboard widgets link here with the filter in the query string, where the
  // drawer never shows it. Resetting has to clear it too, or the list stays
  // filtered by something the user cannot see.
  const resetRouteFilters = useCallback((): void => {
    if (!(routeCategoryId || routeReceiptStatus)) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('categoryId');
    nextParams.delete('missingCategory');
    nextParams.delete('status');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/statements/submit?${nextQuery}` : '/statements/submit');
    setPage(1);
  }, [routeCategoryId, routeReceiptStatus, router, searchParams]);

  const resetAllFilters = (): void => {
    filterState.resetAllFilters();
    resetRouteFilters();
  };

  const {
    statements,
    gmailReceipts,
    isPending,
    gmailIsPending,
    gmailSyncSkeletonKeys,
    setGmailSyncSkeletonKeys,
    refetchStatements,
    refetchGmailReceipts,
    refreshActiveStatements,
  } = useStatementsListData<Statement>({
    appliedFilters: filterState.appliedFilters,
    categoryId: routeCategoryId,
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
    filterState.initFromStorage();
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

  // Clear Gmail sync skeletons
  useEffect(() => {
    if (gmailSyncSkeletonKeys.length === 0) {
      return;
    }
    if (gmailReceipts.length === 0) {
      return;
    }
    setGmailSyncSkeletonKeys([]);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STATEMENTS_GMAIL_SYNC_STORAGE_KEY);
    }
  }, [gmailReceipts.length, gmailSyncSkeletonKeys.length, setGmailSyncSkeletonKeys]);

  // Gmail-чеки вливаются в тот же список, поэтому ждём оба запроса —
  // иначе строки досыпаются в уже отрисованную таблицу.
  const listIsPending = isPending || gmailIsPending;
  const statementReviewCounts = useStatementReviewCounts(Boolean(user));

  const receiptStatements = useMemo<Statement[]>(
    () => mapGmailReceiptsToStatements(gmailReceipts),
    [gmailReceipts],
  );

  const uploadSkeletonKeys = useUploadSkeletonKeys({
    workspaceId,
    receiptRows: gmailReceipts,
    statements,
    limit: PAGE_SIZE,
  });
  const listSkeletonKeys = useMemo(
    () => [...uploadSkeletonKeys, ...gmailSyncSkeletonKeys],
    [uploadSkeletonKeys, gmailSyncSkeletonKeys],
  );

  const documentStatements = useMemo(
    () => buildDocumentStatements({ statements, search, receiptStatements }),
    [statements, search, receiptStatements],
  );

  const displayStatements = useMemo(
    () => applyStatementsFilters(documentStatements, filterState.appliedFilters),
    [documentStatements, filterState.appliedFilters],
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
    onRefreshGmail: async () => {
      refetchGmailReceipts();
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
      (routeReceiptStatus ? 1 : 0),
    [filterState.appliedFilters, routeCategoryId, routeReceiptStatus],
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
    refetchGmailReceipts,
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
