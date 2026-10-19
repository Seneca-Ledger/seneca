'use client';

import type { DuplicateMeta } from '@/app/(main)/statements/components/hooks/useStatementSelection';
import { StatementsListItem } from '@/app/(main)/statements/components/StatementsListItem';
import {
  formatPaginationLabel,
  formatStatementAmount,
  formatStatementDate,
  getBankDisplayName,
  isGmailStatement,
  isReceiptProcessing,
  isStatementParsingInProgress,
} from '@/app/(main)/statements/components/StatementsListView.utils';
import { ArrowDown } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { Spinner } from '@/app/components/ui/spinner';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';
import {
  getStatementDisplayMerchant,
  getStatementMerchantLabel,
  isManualExpenseStatement,
} from '@/app/lib/statement-status';
import { StatementsGmailSync } from './StatementsGmailSync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatementForTable {
  id: string;
  source?: 'statement' | 'gmail' | 'scan';
  status: string;
  bankName: string;
  fileName: string;
  fileType: string;
  subject?: string;
  sender?: string;
  createdAt: string;
  parsedData?: {
    vendor?: string;
    amount?: number;
    currency?: string;
    date?: string;
  };
  parsingDetails?: StatementParsingDetails | null;
}

interface ListHeaderLabels {
  receipt: string;
  merchant: string;
  date: string;
  amount: string;
  action: string;
  scanning: string;
}

interface PaginationLabels {
  shown: string;
  previous: string;
  next: string;
  pageOf: string;
}

interface EmptyLabels {
  title: string;
  description: string;
}

export interface StatementsListTableProps {
  loading: boolean;
  gmailSyncSkeletonKeys: string[];
  displayStatements: StatementForTable[];
  paginatedDisplayStatements: StatementForTable[];
  duplicateMetaById: Map<string, DuplicateMeta>;
  selectedStatementIds: string[];
  allVisibleSelected: boolean;
  selectedCount: number;
  listHeaderLabels: ListHeaderLabels;
  emptyLabels: EmptyLabels;
  paginationLabels: PaginationLabels;
  viewLabel: string;
  reviewDuplicateLabel: string;
  dateSortDirection: 'asc' | 'desc';
  page: number;
  total: number;
  totalPagesCount: number;
  rangeStart: number;
  rangeEnd: number;
  stage: string;
  hasGmailReceipts: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleStatement: (id: string) => void;
  onView: (statement: StatementForTable) => void;
  onIconClick: (statement: StatementForTable) => void;
  onSortDate: () => void;
  onPageChange: (page: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMerchantLabel({
  statement,
  scanningLabel,
}: {
  statement: StatementForTable;
  scanningLabel: string;
}): string {
  const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
  const resolvedName = isReceipt
    ? resolveGmailMerchantLabel({
        vendor: statement.parsedData?.vendor,
        sender: isGmailStatement(statement as Parameters<typeof isGmailStatement>[0])
          ? statement.sender
          : undefined,
        subject: statement.subject,
        fallback: statement.fileName,
      })
    : getStatementDisplayMerchant(
        statement as Parameters<typeof getStatementDisplayMerchant>[0],
        getBankDisplayName(statement.bankName),
      );
  return isReceipt
    ? resolvedName
    : getStatementMerchantLabel(statement.status, resolvedName, scanningLabel);
}

function resolveIsManualExpense(statement: StatementForTable): boolean {
  const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
  return (
    !isReceipt &&
    isManualExpenseStatement(statement as Parameters<typeof isManualExpenseStatement>[0])
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({
  emptyLabels,
  stage,
  hasGmailReceipts,
}: {
  emptyLabels: EmptyLabels;
  stage: string;
  hasGmailReceipts: boolean;
}): React.JSX.Element {
  return (
    <div className="seneca-stmt-list-view__empty">
      <EmptyStateIllustration name="statements" size="lg" />
      <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--foreground)' }}>
        {emptyLabels.title}
      </h3>
      <p style={{ marginTop: 4, color: 'var(--muted-foreground)' }}>{emptyLabels.description}</p>
      {stage === 'submit' && hasGmailReceipts ? (
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--muted-foreground)' }}>
          Gmail receipts are loaded
        </p>
      ) : null}
    </div>
  );
}

function TableHeader({
  allVisibleSelected,
  selectedCount,
  listHeaderLabels,
  dateSortDirection,
  onToggleSelectAll,
  onSortDate,
}: {
  allVisibleSelected: boolean;
  selectedCount: number;
  listHeaderLabels: ListHeaderLabels;
  dateSortDirection: 'asc' | 'desc';
  onToggleSelectAll: (checked: boolean) => void;
  onSortDate: () => void;
}): React.JSX.Element {
  return (
    <div className="seneca-stmt-list-view__desktop-header">
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            marginRight: 16,
          }}
        >
          <div style={{ width: 16, display: 'flex', justifyContent: 'center', opacity: 0.7 }}>
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={selectedCount > 0 && !allVisibleSelected}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all statements"
            />
          </div>
          <div
            style={{
              width: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-foreground)',
            }}
          >
            <span className="sr-only">{listHeaderLabels.receipt}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--muted-foreground)',
            }}
          >
            {listHeaderLabels.merchant}
            <span style={{ padding: '0 4px', color: 'var(--border-color)' }}>•</span>
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
              }}
              onClick={onSortDate}
              aria-label={`Sort by date ${dateSortDirection === 'desc' ? 'ascending' : 'descending'}`}
            >
              {listHeaderLabels.date}
              <ArrowDown
                size={12}
                style={{
                  transition: 'transform 0.2s',
                  transform: dateSortDirection === 'asc' ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 24,
          flexShrink: 0,
          width: 420,
          paddingLeft: 16,
        }}
      >
        <div
          style={{
            width: 128,
            textAlign: 'right',
            color: 'var(--muted-foreground)',
            paddingRight: 4,
          }}
        >
          {listHeaderLabels.amount}
        </div>
        <div style={{ width: 144, textAlign: 'right', color: 'var(--muted-foreground)' }}>
          {listHeaderLabels.action}
        </div>
      </div>
    </div>
  );
}

function PaginationBar({
  paginationLabels,
  rangeStart,
  rangeEnd,
  total,
  page,
  totalPagesCount,
  onPageChange,
}: {
  paginationLabels: PaginationLabels;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  page: number;
  totalPagesCount: number;
  onPageChange: (page: number) => void;
}): React.JSX.Element {
  return (
    <div className="seneca-stmt-list-view__pagination" style={{ marginTop: 24 }}>
      <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
        {formatPaginationLabel(paginationLabels.shown, {
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
          {formatPaginationLabel(paginationLabels.pageOf, { page, count: totalPagesCount })}
        </span>
        <AppPagination page={page} total={totalPagesCount} onChange={onPageChange} />
      </div>
    </div>
  );
}

interface RowProps {
  statement: StatementForTable;
  index: number;
  duplicateMeta: DuplicateMeta | undefined;
  selectedStatementIds: string[];
  listHeaderLabels: ListHeaderLabels;
  viewLabel: string;
  reviewDuplicateLabel: string;
  onToggleStatement: (id: string) => void;
  onView: (s: StatementForTable) => void;
  onIconClick: (s: StatementForTable) => void;
}

function StatementRow({
  statement,
  index,
  duplicateMeta,
  selectedStatementIds,
  listHeaderLabels,
  viewLabel,
  reviewDuplicateLabel,
  onToggleStatement,
  onView,
  onIconClick,
}: RowProps): React.JSX.Element {
  const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
  const merchantLabel = buildMerchantLabel({ statement, scanningLabel: listHeaderLabels.scanning });
  const amountLabel = formatStatementAmount(
    statement as Parameters<typeof formatStatementAmount>[0],
  );
  const dateLabel = formatStatementDate(statement as Parameters<typeof formatStatementDate>[0]);
  const isProcessingReceipt = isReceiptProcessing(
    statement as Parameters<typeof isReceiptProcessing>[0],
  );
  const isProcessingStatement = isStatementParsingInProgress(
    statement as Parameters<typeof isStatementParsingInProgress>[0],
  );

  return (
    <StatementsListItem
      key={statement.id}
      dataTourId={index === 0 ? 'statement-row-primary' : undefined}
      statement={statement as Parameters<typeof StatementsListItem>[0]['statement']}
      viewLabel={viewLabel}
      isReceipt={isReceipt}
      isProcessing={isProcessingReceipt}
      merchantLabel={merchantLabel}
      amountLabel={amountLabel}
      dateLabel={dateLabel}
      isPossibleDuplicate={Boolean(duplicateMeta)}
      duplicatePosition={duplicateMeta?.position}
      duplicateGroupSize={duplicateMeta?.total}
      duplicateRole={duplicateMeta?.role}
      duplicateGroupLabel={duplicateMeta?.groupLabel}
      duplicateReason={duplicateMeta?.reason}
      duplicateActionLabel={reviewDuplicateLabel}
      typeLabel={isReceipt ? 'Receipt' : statement.fileType}
      isManualExpense={resolveIsManualExpense(statement)}
      viewDisabled={isProcessingStatement}
      onView={() => onView(statement)}
      onIconClick={() => onIconClick(statement)}
      onToggleSelect={() => onToggleStatement(statement.id)}
      selected={selectedStatementIds.includes(statement.id)}
    />
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function StatementsListTable({
  loading,
  gmailSyncSkeletonKeys,
  displayStatements,
  paginatedDisplayStatements,
  duplicateMetaById,
  selectedStatementIds,
  allVisibleSelected,
  selectedCount,
  listHeaderLabels,
  emptyLabels,
  paginationLabels,
  viewLabel,
  reviewDuplicateLabel,
  dateSortDirection,
  page,
  total,
  totalPagesCount,
  rangeStart,
  rangeEnd,
  stage,
  hasGmailReceipts,
  onToggleSelectAll,
  onToggleStatement,
  onView,
  onIconClick,
  onSortDate,
  onPageChange,
}: StatementsListTableProps): React.JSX.Element {
  if (loading && gmailSyncSkeletonKeys.length === 0) {
    return (
      <div className="seneca-stmt-list-view__loading">
        <Spinner style={{ height: 80, width: 80, color: 'var(--primary)' }} />
      </div>
    );
  }

  if (displayStatements.length === 0 && gmailSyncSkeletonKeys.length === 0) {
    return (
      <EmptyState emptyLabels={emptyLabels} stage={stage} hasGmailReceipts={hasGmailReceipts} />
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
          <Checkbox
            checked={allVisibleSelected}
            indeterminate={selectedCount > 0 && !allVisibleSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all statements"
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Select all
          </span>
        </div>
        <TableHeader
          allVisibleSelected={allVisibleSelected}
          selectedCount={selectedCount}
          listHeaderLabels={listHeaderLabels}
          dateSortDirection={dateSortDirection}
          onToggleSelectAll={onToggleSelectAll}
          onSortDate={onSortDate}
        />
        <StatementsGmailSync gmailSyncSkeletonKeys={gmailSyncSkeletonKeys} />
        {paginatedDisplayStatements.map((statement, index) => (
          <StatementRow
            key={statement.id}
            statement={statement}
            index={index}
            duplicateMeta={duplicateMetaById.get(statement.id)}
            selectedStatementIds={selectedStatementIds}
            listHeaderLabels={listHeaderLabels}
            viewLabel={viewLabel}
            reviewDuplicateLabel={reviewDuplicateLabel}
            onToggleStatement={onToggleStatement}
            onView={onView}
            onIconClick={onIconClick}
          />
        ))}
      </div>
      <PaginationBar
        paginationLabels={paginationLabels}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={total}
        page={page}
        totalPagesCount={totalPagesCount}
        onPageChange={onPageChange}
      />
    </>
  );
}
