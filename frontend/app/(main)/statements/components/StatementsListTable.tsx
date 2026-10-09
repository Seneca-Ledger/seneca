'use client';

import { ArrowDown } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';
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
import type { DuplicateMeta } from './hooks/useStatementSelection';
import { StatementsGmailSync } from './StatementsGmailSync';
import { StatementsListItem } from './StatementsListItem';
import {
  formatPaginationLabel,
  formatStatementAmount,
  formatStatementDate,
  getBankDisplayName,
  isGmailStatement,
  isReceiptProcessing,
  isStatementParsingInProgress,
  resolvePendingReview,
} from './StatementsListView.utils';

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
  processedAt?: string;
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
  parsingDetails?: {
    importPreview?: {
      attachments?: number;
      description?: string;
      merchant?: string;
      categoryId?: string;
    };
  };
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
  gmailSyncSkeletonKeys: string[];
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
  const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
  const resolvedName = isReceipt
    ? resolveGmailMerchantLabel({
        vendor: statement.parsedData?.vendor,
        sender: isGmailStatement(statement) ? statement.sender : undefined,
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
  onToggleSelectAll,
  onToggleSortDirection,
}: {
  allVisibleSelected: boolean;
  selectedCount: number;
  dateSortDirection: 'asc' | 'desc';
  columns?: StatementColumn[];
  labels: TableLabels;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSortDirection: () => void;
}): React.JSX.Element {
  const renderedColumns = getRenderedColumns(columns);
  const listText = useIntlayer('statementsListUi');

  return (
    <div className="lumio-stmt-list-view__desktop-header">
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
              <span className="u-visually-hidden">{column.label || labels.receipt}</span>
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
  gmailSyncSkeletonKeys,
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
  if (loading && gmailSyncSkeletonKeys.length === 0) {
    return (
      <div className="lumio-stmt-list-view__table">
        {toolbar}
        <div className="lumio-stmt-list-view__loading">
          <Spinner style={{ height: 80, width: 80, color: 'var(--primary)' }} />
        </div>
      </div>
    );
  }

  if (displayStatements.length === 0 && gmailSyncSkeletonKeys.length === 0) {
    return (
      <div className="lumio-stmt-list-view__table">
        {toolbar}
        <div className="lumio-stmt-list-view__empty">
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
      <div className="lumio-stmt-list-view__table-scroll">
        <div className="lumio-stmt-list-view__table">
          {toolbar}
          <TableDesktopHeader
            allVisibleSelected={allVisibleSelected}
            selectedCount={selectedCount}
            dateSortDirection={dateSortDirection}
            columns={columns}
            labels={labels}
            onToggleSelectAll={onToggleSelectAll}
            onToggleSortDirection={onToggleSortDirection}
          />
          <StatementsGmailSync skeletonKeys={gmailSyncSkeletonKeys} />
          {paginatedStatements.map((statement, index) => {
            const rowData = resolveStatementRowData(statement, labels.scanning);
            const duplicateMeta = duplicateMetaById.get(statement.id);
            return (
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
                duplicateGroupTone={duplicateMeta?.groupTone}
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
                columns={columns}
                currentExchangeRateLabels={currentExchangeRateLabels}
                workspaceCurrency={workspaceCurrency}
              />
            );
          })}
        </div>
      </div>
      <div className="lumio-stmt-list-view__pagination" style={{ marginTop: 24 }}>
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
