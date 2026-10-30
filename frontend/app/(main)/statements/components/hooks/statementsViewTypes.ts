import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { RefObject } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { usePullToRefresh } from '@/app/hooks/usePullToRefresh';
import type { useIntlayer } from '@/app/i18n';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import type { StatementExpenseMode } from '@/app/lib/statement-expense-drawer';
import type {
  buildFromOptions,
  FilterLabels,
  FilterOptionLabels,
} from '../StatementsListView.utils';
import type { StatementUploadLabels } from '../statement-upload';
import type { useManualExpenseOptions } from './useManualExpenseOptions';
import type { useStatementPreview } from './useStatementPreview';
import type { MergeDuplicatesPlan } from './useStatementSelection';
import type { useStatementsDuplicates } from './useStatementsDuplicates';
import type { useStatementsFilterState } from './useStatementsFilterState';
import type { useStatementsListData } from './useStatementsListData';

export interface StatementsStatement {
  id: string;
  /** A scan's hidden statement, which holds its transactions; a row's own id is the receipt. */
  statementId?: string | null;
  source?: 'statement' | 'scan';
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
  processedAt?: string | null;
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
  parsingDetails?: StatementParsingDetails | null;
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

/** Everything the documents list page reads from useStatementsView. */
export interface StatementsView {
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
  displayStatements: StatementsStatement[];
  paginatedDisplayStatements: StatementsStatement[];
  sortedDisplayStatements: StatementsStatement[];
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
}
