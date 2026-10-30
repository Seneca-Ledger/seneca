import {
  getAllowedStatementFilterKeys,
  resetDisallowedStatementFilters,
  type StatementColumn,
  type StatementColumnId,
} from './columns/statement-columns';
import {
  getVisibleFilterScreens,
  resetHiddenStatementFilters,
  type StatementFilterScreen,
  type StatementsQueryParams,
  serializeStatementFiltersToQuery,
} from './filters/server-statement-filters';
import type { StatementFilters } from './filters/statement-filters';
import {
  ReceiptDerivedStatementCandidate,
  StatementViewAction,
  StatementViewCandidate,
} from './statement-state';
import { UI_ONLY_BANK_FILTER_IDS } from './statements-list.types';

export type RowsFilter = Pick<
  StatementsQueryParams,
  'merchant' | 'transactionsFrom' | 'transactionsTo'
>;

export const buildStatementRequestParams = ({
  appliedFilters,
  categoryId,
  rowsFilter,
  search,
}: {
  appliedFilters: StatementFilters;
  categoryId?: string | null;
  /** A merchant, and the window the category's or merchant's rows must fall in. */
  rowsFilter?: RowsFilter | null;
  search?: string;
}): StatementsQueryParams => {
  const serverSafeFilters: StatementFilters = {
    ...appliedFilters,
    type: appliedFilters.type === 'receipt' ? null : appliedFilters.type,
    from: appliedFilters.from.filter(value => !UI_ONLY_BANK_FILTER_IDS.has(value.toLowerCase())),
    to: appliedFilters.to.filter(value => !UI_ONLY_BANK_FILTER_IDS.has(value.toLowerCase())),
  };

  return {
    ...serializeStatementFiltersToQuery(serverSafeFilters),
    ...(categoryId ? { categoryId } : {}),
    ...(rowsFilter ?? {}),
    ...(search ? { search } : {}),
  };
};

export const isReceiptDerivedStatement = (statement: ReceiptDerivedStatementCandidate): boolean => {
  return (
    statement.parsingDetails?.detectedBy === 'receipt-scan' ||
    statement.parsingDetails?.importPreview?.source === 'receipt-scan'
  );
};

export const resolveStatementViewAction = (
  statement: StatementViewCandidate,
): StatementViewAction => {
  if (statement.source === 'scan') {
    return { type: 'route', href: `/storage/receipts/${statement.id}` };
  }

  // `needs_review` belongs here too: the statement is parsed and has transactions
  // to inspect, and the edit page is where the balance discrepancy is confirmed.
  // Routing it to storage instead would hide the only way to release it.
  if (
    statement.status === 'completed' ||
    statement.status === 'parsed' ||
    statement.status === 'validated' ||
    statement.status === 'needs_review'
  ) {
    return { type: 'route', href: `/statements/${statement.id}/edit` };
  }

  return { type: 'route', href: `/storage/${statement.id}` };
};

export const SETTLED_RECEIPT_STATUSES = new Set(['approved', 'rejected', 'failed']);

/**
 * How much of a document still waits in Review: a statement's undecided rows,
 * or one for a receipt that has not been approved (or dropped) yet.
 */
export const resolvePendingReview = (
  document: { id: string; status: string },
  isReceipt: boolean,
  statementReviewCounts: Record<string, number>,
): number => {
  if (isReceipt) {
    return SETTLED_RECEIPT_STATUSES.has(document.status) ? 0 : 1;
  }
  return statementReviewCounts[document.id] ?? 0;
};

export const PARSED_STATEMENT_STATUSES = new Set(['completed', 'parsed', 'validated']);

/**
 * The Approved column: a person has confirmed the document. A receipt once it
 * is approved; a statement once its file is parsed and none of its rows still
 * waits in Review. A receipt's status is the receipt's own, never a parse status.
 */
export const isDocumentApproved = (
  status: string,
  isReceipt: boolean,
  pendingReview: number,
): boolean => {
  const normalized = status.toLowerCase();
  if (isReceipt) {
    return normalized === 'approved';
  }
  return PARSED_STATEMENT_STATUSES.has(normalized) && pendingReview === 0;
};

/** The Approved filter, by the same rule as the Approved column. */
export const filterByApproved = <T extends { id: string; status: string; source?: string }>(
  documents: T[],
  approved: boolean | null,
  statementReviewCounts: Record<string, number>,
): T[] => {
  if (approved === null) {
    return documents;
  }
  return documents.filter(document => {
    const isReceipt = document.source === 'scan';
    const pending = resolvePendingReview(document, isReceipt, statementReviewCounts);
    return isDocumentApproved(document.status, isReceipt, pending) === approved;
  });
};

export const paginateStatements = <T>(statements: T[], page: number, pageSize: number): T[] => {
  if (pageSize <= 0) {
    return [];
  }
  const currentPage = Math.max(1, page);
  const start = (currentPage - 1) * pageSize;
  return statements.slice(start, start + pageSize);
};

export const deriveVisibleFilterScreens = (
  columns: Array<Pick<StatementColumn, 'id' | 'visible'>>,
): StatementFilterScreen[] => {
  const visibleColumnIds = columns.filter(column => column.visible).map(column => column.id);
  return getVisibleFilterScreens(visibleColumnIds);
};

export const formatPaginationLabel = (
  template: string,
  values: Record<string, string | number>,
): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );

export const reconcileFiltersWithColumns = ({
  columns,
  appliedFilters,
  draftFilters,
}: {
  columns: StatementColumn[];
  appliedFilters: StatementFilters;
  draftFilters: StatementFilters;
}): {
  allowedFilterKeys: Array<keyof StatementFilters>;
  nextAppliedFilters: StatementFilters;
  nextDraftFilters: StatementFilters;
} => {
  const visibleColumnIds = columns.filter(column => column.visible).map(column => column.id);
  const allowedFilterKeys = getAllowedStatementFilterKeys(visibleColumnIds as StatementColumnId[]);

  return {
    allowedFilterKeys,
    nextAppliedFilters: resetDisallowedStatementFilters(appliedFilters, allowedFilterKeys),
    nextDraftFilters: resetHiddenStatementFilters(draftFilters, allowedFilterKeys),
  };
};

// ---------------------------------------------------------------------------
// Label builder helpers (extracted from StatementsListView for reuse)
// ---------------------------------------------------------------------------
