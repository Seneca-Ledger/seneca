import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { RefObject } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { usePullToRefresh } from '@/app/hooks/usePullToRefresh';
import type { StatementExpenseMode } from '@/app/lib/statement-expense-drawer';
import type { useManualExpenseOptions } from './useManualExpenseOptions';
import type { useStatementPreview } from './useStatementPreview';
import type { useStatementsDuplicates } from './useStatementsDuplicates';
import type { useStatementsFilterState } from './useStatementsFilterState';
import type { useStatementsListData } from './useStatementsListData';

export interface StatementsStatement {
  id: string;
  source?: 'statement' | 'gmail' | 'scan';
  receiptSource?: string;
  fileName: string;
  subject?: string;
  sender?: string;
  status: string;
  totalTransactions: number;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  exported?: boolean | null;
  paid?: boolean | null;
  createdAt: string;
  processedAt?: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName: string;
  fileType: string;
  currency?: string | null;
  category?: {
    id?: string | null;
    name?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  tags?: Array<{ id?: string; name?: string; color?: string | null }>;
  transactionSummary?: {
    description?: string | null;
    exchangeRate?: string | number | null;
    exchangeRateMixed?: boolean;
    cardLabel?: string | null;
  } | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  errorMessage?: string | null;
  parsingDetails?: {
    logEntries?: Array<{ timestamp: string; level: string; message: string }>;
    detectedBy?: string;
    parserUsed?: string;
    importPreview?: {
      source?: string;
      merchant?: string;
      attachments?: number;
      description?: string;
      categoryId?: string;
    };
    metadataExtracted?: { currency?: string; headerDisplay?: { currencyDisplay?: string } };
  };
  gmailMessageId?: string;
  receivedAt?: string;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    category?: string;
    categoryId?: string;
    lineItems?: Array<{ description: string; amount?: number }>;
  };
}

export interface UseStatementsViewParams {
  router: AppRouterInstance;
  searchParams: ReadonlyURLSearchParams;
  /** Owned by the view: keeping the ref out of the returned state object lets
   * React Compiler memoize the view (an object holding a ref is treated as a ref). */
  listScrollRef: RefObject<HTMLDivElement | null>;
}

export const STATEMENTS_PAGE_SIZE = 30;

export interface StatementsViewState {
  page: number;
  setPage: (p: number) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  search: string;
  dateSortDirection: 'asc' | 'desc';
  setDateSortDirection: (d: 'asc' | 'desc') => void;
  expenseDrawerOpen: boolean;
  setExpenseDrawerOpen: (v: boolean) => void;
  expenseDrawerMode: StatementExpenseMode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  filterLabels: Record<string, string>;
  filterOptionLabels: Record<string, string>;
  listHeaderLabels: Record<string, string>;
  paginationLabels: Record<string, string>;
  uploadLabels: Record<string, string>;
  typeOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  datePresets: Array<{ value: 'thisMonth' | 'lastMonth' | 'yearToDate'; label: string }>;
  dateModes: Array<{ value: 'on' | 'after' | 'before'; label: string }>;
  groupByOptions: Array<{ value: string; label: string }>;
  hasOptions: Array<{ value: string; label: string }>;
  filterState: ReturnType<typeof useStatementsFilterState>;
  manualExpenseCategories: ReturnType<typeof useManualExpenseOptions>['manualExpenseCategories'];
  manualExpenseTaxRates: ReturnType<typeof useManualExpenseOptions>['manualExpenseTaxRates'];
  loadManualExpenseOptions: ReturnType<typeof useManualExpenseOptions>['loadManualExpenseOptions'];
  preview: ReturnType<typeof useStatementPreview>['preview'];
  openPreview: ReturnType<typeof useStatementPreview>['openPreview'];
  closePreview: ReturnType<typeof useStatementPreview>['closePreview'];
  loading: boolean;
  gmailSyncSkeletonKeys: string[];
  refetchStatements: ReturnType<typeof useStatementsListData>['refetchStatements'];
  refetchGmailReceipts: ReturnType<typeof useStatementsListData>['refetchGmailReceipts'];
  refreshActiveStatements: ReturnType<typeof useStatementsListData>['refreshActiveStatements'];
  displayStatements: StatementsStatement[];
  paginatedDisplayStatements: StatementsStatement[];
  sortedDisplayStatements: StatementsStatement[];
  total: number;
  totalPagesCount: number;
  rangeStart: number;
  rangeEnd: number;
  duplicateMetaById: ReturnType<typeof useStatementsDuplicates>['duplicateMetaById'];
  setDuplicateOverrides: ReturnType<typeof useStatementsDuplicates>['setDuplicateOverrides'];
  selectedStatementIds: string[];
  selectedActionsOpen: boolean;
  setSelectedActionsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  allVisibleSelected: boolean;
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  duplicateStatementIds: string[];
  handleToggleStatement: (id: string) => void;
  handleToggleSelectAll: () => void;
  handleExportSelected: () => Promise<void>;
  handleDeleteSelected: () => Promise<void>;
  handleMarkSelectedAsDuplicate: () => Promise<void>;
  handleDismissSelectedDuplicates: () => Promise<void>;
  handleSelectDetectedDuplicates: () => Promise<void>;
  handleMergeSelectedDuplicates: () => Promise<void>;
  pullToRefreshHandlers: ReturnType<typeof usePullToRefresh>['handlers'];
  pullDistance: number;
  pullRefreshing: boolean;
  isReadyToRefresh: boolean;
  activeFilterCount: number;
  routeFilterLabel: string | null;
  resetRouteCategoryFilter: () => void;
  visibleFilterScreens: string[];
  fromOptions: ReturnType<typeof useStatementsFilterState>['draftColumns'];
  currencyOptions: string[];
  appliedColumnsWithLabels: ReturnType<typeof useStatementsFilterState>['columns'];
  columnsWithLabels: ReturnType<typeof useStatementsFilterState>['draftColumns'];
  currentExchangeRateLabels: Record<string, string>;
  currentWorkspace: ReturnType<typeof useWorkspace>['currentWorkspace'];
  isMobile: boolean;
}
