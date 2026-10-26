'use client';

import { Fragment, useState } from 'react';
import { ArrowDown } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { useIntlayer } from '@/app/i18n';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { resolveReceiptMerchantLabel } from '@/app/lib/receipt-merchant';
import {
  getStatementDisplayMerchant,
  getStatementMerchantLabel,
  isManualExpenseStatement,
} from '@/app/lib/statement-status';
import {
  DEFAULT_STATEMENT_COLUMNS,
  type StatementColumn,
  type StatementColumnId,
  statementColumnWidthStyle,
} from './columns/statement-columns';
import { type CategoryTarget, DocumentCategoryDrawer } from './DocumentCategoryDrawer';
import type { DuplicateMeta } from './hooks/useStatementSelection';
import { StatementsListItem } from './StatementsListItem';
import {
  formatPaginationLabel,
  formatStatementAmount,
  formatStatementDate,
  getBankDisplayName,
  isReceiptProcessing,
  isStatementParsingInProgress,
  resolvePendingReview,
} from './StatementsListView.utils';
import { StatementsUploadSkeletons } from './StatementsUploadSkeletons';
import { StatementTransactionsPanel } from './StatementTransactionsPanel';

interface StatementForTable {
  id: string;
  source?: string;
  bankName: string;
  status: string;
  fileName: string;
  fileType: string;
  subject?: string;
  sender?: string;
  exported?: boolean | null;
  paid?: boolean | null;
  processedAt?: string | null;
  receivedAt?: string;
  createdAt: string;
  parsedData?: {
    vendor?: string;
    amount?: number;
    currency?: string;
    date?: string;
    category?: string;
    categoryId?: string;
    lineItems?: Array<{ description: string; amount?: number }>;
  };
  category?: {
    id?: string | null;
    name?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  tags?: Array<{ id?: string; name?: string; color?: string | null }>;
  totalTransactions?: number | string | null;
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
  parsingDetails?: StatementParsingDetails | null;
}

interface TableLabels {
  merchant: string;
  date: string;
  amount: string;
  action: string;
  receipt: string;
  scanning: string;
  emptyTitle: string;
  emptyDescription: string;
  paginationShown: string;
  paginationPageOf: string;
}

interface Props {
  /** The list's own toolbar, drawn inside the white block above the rows. */
  toolbar?: React.ReactNode;
  loading: boolean;
  displayStatements: StatementForTable[];
  paginatedStatements: StatementForTable[];
  skeletonKeys: string[];
  allVisibleSelected: boolean;
  selectedCount: number;
  selectedStatementIds: string[];
  dateSortDirection: 'asc' | 'desc';
  page: number;
  totalPagesCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  duplicateMetaById: Map<string, DuplicateMeta>;
  /** Rows each statement still has in Review, by statement id. */
  statementReviewCounts?: Record<string, number>;
  columns?: StatementColumn[];
  currentExchangeRateLabels?: Record<string, string>;
  workspaceCurrency?: string | null;
  viewLabel: string;
  reviewDuplicateLabel: string;
  labels: TableLabels;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSortDirection: () => void;
  onToggleStatement: (id: string) => void;
  onView: (statement: StatementForTable) => void;
  onIconClick: (statement: StatementForTable) => void;
  onPageChange: (page: number) => void;
}

const NUMERIC_COLUMN_IDS = new Set<StatementColumnId>(['amount', 'exchangeRate']);
const columnHeaderStyle = (columnId: StatementColumnId): React.CSSProperties => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--muted-foreground)',
  textAlign:
    columnId === 'receipt'
      ? 'center'
      : NUMERIC_COLUMN_IDS.has(columnId) || columnId === 'action'
        ? 'right'
        : 'left',
  ...statementColumnWidthStyle(columnId),
});

const getRenderedColumns = (
  columns: StatementColumn[] = DEFAULT_STATEMENT_COLUMNS,
): StatementColumn[] => {
  const visibleColumns = columns.filter(column => column.visible);
  return visibleColumns.length > 0 ? visibleColumns : columns.slice(0, 1);
};

const NO_REVIEW_COUNTS: Record<string, number> = {};

/** What the From column shows for a row; mirrors the cell in StatementsListItem. */
const fromValue = (statement: StatementForTable): string =>
  (statement.user?.name || statement.user?.email || statement.sender || '').trim();

/**
 * From says nothing when every row on the page has the same value there (all
 * "camera-scan", say), so the column steps aside until the rows differ.
 */
const withoutUniformFrom = (
  columns: StatementColumn[] | undefined,
  statements: StatementForTable[],
): StatementColumn[] | undefined => {
  if (!columns?.some(column => column.id === 'from' && column.visible)) {
    return columns;
  }
  if (new Set(statements.map(fromValue)).size > 1) {
    return columns;
  }
  return columns.map(column => (column.id === 'from' ? { ...column, visible: false } : column));
};

interface StatementRowData {
  isReceipt: boolean;
  merchantLabel: string;
  isManualExpense: boolean;
  allowAttachFallback: boolean;
  isProcessingReceipt: boolean;
  isProcessingStatement: boolean;
  amountLabel: string;
  dateLabel: string;
}

function resolveStatementRowData(
  statement: StatementForTable,
  scanningLabel: string,
): StatementRowData {
  const isReceipt = statement.source === 'scan';
  const resolvedName = isReceipt
    ? resolveReceiptMerchantLabel({
        vendor: statement.parsedData?.vendor,
        subject: statement.subject,
        fallback: statement.fileName,
      })
    : getStatementDisplayMerchant(statement, getBankDisplayName(statement.bankName));
  const merchantLabel = isReceipt
    ? resolvedName
    : getStatementMerchantLabel(statement.status, resolvedName, scanningLabel);
  const isManualExpense = !isReceipt && isManualExpenseStatement(statement);
  const manualAttachmentCount = Number(statement.parsingDetails?.importPreview?.attachments ?? 0);
  const allowAttachFallback =
    isManualExpense &&
    !isReceipt &&
    (manualAttachmentCount === 0 || statement.fileName.toLowerCase().startsWith('manual-expense-'));
  return {
    isReceipt,
    merchantLabel,
    isManualExpense,
    allowAttachFallback,
    isProcessingReceipt: isReceiptProcessing(statement),
    isProcessingStatement: isStatementParsingInProgress(statement),
    amountLabel: formatStatementAmount(statement),
    dateLabel: formatStatementDate(statement),
  };
}

function TableDesktopHeader({
  allVisibleSelected,
  selectedCount,
  dateSortDirection,
  columns = DEFAULT_STATEMENT_COLUMNS,
  labels,
  reviewLabel,
  onToggleSelectAll,
  onToggleSortDirection,
}: {
  allVisibleSelected: boolean;
  selectedCount: number;
  dateSortDirection: 'asc' | 'desc';
  columns?: StatementColumn[];
  labels: TableLabels;
  reviewLabel: string;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSortDirection: () => void;
}): React.JSX.Element {
  const renderedColumns = getRenderedColumns(columns);
  const listText = useIntlayer('statementsListUi');

  return (
    <div className="seneca-stmt-list-view__desktop-header">
      <div
        style={{
          width: 16,
          display: 'flex',
          justifyContent: 'center',
          opacity: 0.7,
          flexShrink: 0,
          marginRight: 16,
        }}
      >
        <Checkbox
          checked={allVisibleSelected}
          indeterminate={selectedCount > 0 && !allVisibleSelected}
          onCheckedChange={onToggleSelectAll}
          aria-label={listText.selectAllStatements.value}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
        {renderedColumns.map(column => (
          <div key={column.id} data-column-id={column.id} style={columnHeaderStyle(column.id)}>
            {column.id === 'merchant' ? (
              // Dates live under each merchant name, so the date sort sits here
              // instead of in a column of its own.
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {column.label}
                <button
                  type="button"
                  data-testid="statements-date-sort"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    padding: 0,
                    opacity: 0.75,
                  }}
                  onClick={onToggleSortDirection}
                  aria-label={
                    dateSortDirection === 'desc'
                      ? listText.sortByDateAsc.value
                      : listText.sortByDateDesc.value
                  }
                >
                  · {labels.date}
                  <ArrowDown
                    size={12}
                    style={{
                      transition: 'transform 0.2s',
                      transform: dateSortDirection === 'asc' ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </button>
              </span>
            ) : column.id === 'receipt' || column.id === 'action' ? (
              // The arrow column needs no visible title; screen readers keep it.
              <>
                <span className="u-visually-hidden">{column.label || labels.receipt}</span>
                {column.id === 'action' ? (
                  // Gives the column the width the rows' Review label takes.
                  <span
                    aria-hidden
                    className="seneca-stmt-list-item__view-btn seneca-stmt-list-item__action-sizer"
                  >
                    {reviewLabel}
                  </span>
                ) : null}
              </>
            ) : (
              column.label
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatementsListTable({
  toolbar,
  loading,
  displayStatements,
  paginatedStatements,
  skeletonKeys,
  allVisibleSelected,
  selectedCount,
  selectedStatementIds,
  dateSortDirection,
  page,
  totalPagesCount,
  rangeStart,
  rangeEnd,
  total,
  duplicateMetaById,
  statementReviewCounts = NO_REVIEW_COUNTS,
  columns,
  currentExchangeRateLabels,
  workspaceCurrency,
  viewLabel,
  reviewDuplicateLabel,
  labels,
  onToggleSelectAll,
  onToggleSortDirection,
  onToggleStatement,
  onView,
  onIconClick,
  onPageChange,
}: Props): React.JSX.Element {
  const listText = useIntlayer('statementsListUi');
  // Statements whose rows are open under their line; each loads its rows on opening.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  // The document whose "Add category" opened the category drawer.
  const [categoryTarget, setCategoryTarget] = useState<CategoryTarget | null>(null);
  const toggleExpanded = (id: string): void =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const shownColumns = withoutUniformFrom(columns, paginatedStatements);
  if (loading && skeletonKeys.length === 0) {
    return (
      <div className="seneca-stmt-list-view__table">
        {toolbar}
        <SnapshotSkeleton id="statements-list" loading fallback="list" />
      </div>
    );
  }

  if (displayStatements.length === 0 && skeletonKeys.length === 0) {
    return (
      <div className="seneca-stmt-list-view__table">
        {toolbar}
        <div className="seneca-stmt-list-view__empty">
          <EmptyStateIllustration name="statements" size="lg" />
          <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--foreground)' }}>
            {labels.emptyTitle}
          </h3>
          <p style={{ marginTop: 4, color: 'var(--muted-foreground)' }}>
            {labels.emptyDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="seneca-stmt-list-view__table-scroll">
        <div className="seneca-stmt-list-view__table">
          {toolbar}
          <SnapshotSkeleton id="statements-list" loading={false}>
            <TableDesktopHeader
              allVisibleSelected={allVisibleSelected}
              selectedCount={selectedCount}
              dateSortDirection={dateSortDirection}
              columns={shownColumns}
              labels={labels}
              reviewLabel={reviewDuplicateLabel}
              onToggleSelectAll={onToggleSelectAll}
              onToggleSortDirection={onToggleSortDirection}
            />
            <StatementsUploadSkeletons skeletonKeys={skeletonKeys} />
            {paginatedStatements.map((statement, index) => {
              const rowData = resolveStatementRowData(statement, labels.scanning);
              const duplicateMeta = duplicateMetaById.get(statement.id);
              // Neighbours in the same group share one unbroken line on the left.
              const sameGroup = (other: StatementForTable | undefined): boolean =>
                Boolean(
                  duplicateMeta &&
                    other &&
                    duplicateMetaById.get(other.id)?.groupKey === duplicateMeta.groupKey,
                );
              const transactionCount = rowData.isReceipt
                ? 0
                : Number(statement.totalTransactions ?? 0);
              const expanded = transactionCount > 1 && expandedIds.has(statement.id);
              return (
                <Fragment key={statement.id}>
                  <StatementsListItem
                    key={statement.id}
                    dataTourId={index === 0 ? 'statement-row-primary' : undefined}
                    statement={statement as Parameters<typeof StatementsListItem>[0]['statement']}
                    viewLabel={viewLabel}
                    isReceipt={rowData.isReceipt}
                    isProcessing={rowData.isProcessingReceipt}
                    merchantLabel={rowData.merchantLabel}
                    amountLabel={rowData.amountLabel}
                    dateLabel={rowData.dateLabel}
                    isPossibleDuplicate={Boolean(duplicateMeta)}
                    duplicatePosition={duplicateMeta?.position}
                    duplicateGroupSize={duplicateMeta?.total}
                    duplicateRole={duplicateMeta?.role}
                    duplicateGroupLabel={duplicateMeta?.groupLabel}
                    duplicateGroupStart={!sameGroup(paginatedStatements[index - 1])}
                    duplicateGroupEnd={!sameGroup(paginatedStatements[index + 1])}
                    duplicateReason={duplicateMeta?.reason}
                    duplicateActionLabel={reviewDuplicateLabel}
                    pendingReview={resolvePendingReview(
                      statement,
                      rowData.isReceipt,
                      statementReviewCounts,
                    )}
                    typeLabel={rowData.isReceipt ? listText.typeReceipt.value : statement.fileType}
                    isManualExpense={rowData.isManualExpense}
                    viewDisabled={rowData.isProcessingStatement}
                    onView={() => onView(statement)}
                    onIconClick={() => onIconClick(statement)}
                    onToggleSelect={() => onToggleStatement(statement.id)}
                    selected={selectedStatementIds.includes(statement.id)}
                    columns={shownColumns}
                    currentExchangeRateLabels={currentExchangeRateLabels}
                    workspaceCurrency={workspaceCurrency}
                    transactionCount={transactionCount}
                    expanded={expanded}
                    onToggleExpand={() => toggleExpanded(statement.id)}
                    onAddCategory={() => setCategoryTarget(statement)}
                  />
                  {expanded ? <StatementTransactionsPanel statementId={statement.id} /> : null}
                </Fragment>
              );
            })}
          </SnapshotSkeleton>
        </div>
      </div>
      <DocumentCategoryDrawer target={categoryTarget} onClose={() => setCategoryTarget(null)} />
      <div className="seneca-stmt-list-view__pagination" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          {formatPaginationLabel(labels.paginationShown, {
            from: rangeStart,
            to: rangeEnd,
            count: total,
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              minWidth: 120,
              textAlign: 'center',
            }}
          >
            {formatPaginationLabel(labels.paginationPageOf, { page, count: totalPagesCount })}
          </span>
          <AppPagination page={page} total={totalPagesCount} onChange={onPageChange} />
        </div>
      </div>
    </>
  );
}
