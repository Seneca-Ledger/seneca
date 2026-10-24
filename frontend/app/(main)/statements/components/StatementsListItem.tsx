'use client';

import MuiTooltip from '@mui/material/Tooltip';
import clsx from 'clsx';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import React from 'react';
import { formatMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { hasChosenCategory, NoCategoryBadge } from '@/app/components/categories/NoCategoryBadge';
import { DocumentThumbnailPreview } from '@/app/components/DocumentThumbnailPreview';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import { AlertCircle, ChevronDown, ChevronRight, CreditCard, Tag } from '@/app/components/icons';
import { NotesBadge } from '@/app/components/notes/NotesBadge';
import { Checkbox } from '@/app/components/ui/checkbox';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer, useLocale } from '@/app/i18n';
import { categoryReportHref, tagReportHref } from '@/app/lib/category-report-href';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';
import {
  DEFAULT_STATEMENT_COLUMNS,
  type StatementColumn,
  type StatementColumnId,
  statementColumnWidthStyle,
} from './columns/statement-columns';
import { isDocumentApproved, resolveStatementSortDate } from './StatementsListView.utils';
import { useDwellLink } from './use-dwell-link';

export type StatementListItem = {
  id: string;
  source?: 'statement' | 'scan';
  receiptSource?: string;
  fileName: string;
  subject?: string;
  sender?: string;
  status: string;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  createdAt: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName: string;
  fileType: string;
  currency?: string | null;
  exported?: boolean | null;
  paid?: boolean | null;
  processedAt?: string;
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
};

type DuplicateRole = 'primary' | 'suspected';

type Props = {
  dataTourId?: string;
  statement: StatementListItem;
  viewLabel: string;
  duplicateActionLabel?: string;
  isReceipt: boolean;
  isProcessing: boolean;
  merchantLabel: string;
  amountLabel: string;
  dateLabel: string;
  onView: () => void;
  onIconClick: () => void;
  onToggleSelect?: () => void;
  selected?: boolean;
  selectionDisabled?: boolean;
  typeLabel?: string;
  isManualExpense?: boolean;
  isPossibleDuplicate?: boolean;
  duplicatePosition?: number;
  duplicateGroupSize?: number;
  duplicateRole?: DuplicateRole;
  duplicateGroupLabel?: string;
  /** The row opens or closes a run of its duplicate group: the line on the left stops there. */
  duplicateGroupStart?: boolean;
  duplicateGroupEnd?: boolean;
  duplicateReason?: string;
  viewDisabled?: boolean;
  columns?: StatementColumn[];
  currentExchangeRateLabels?: Record<string, string>;
  workspaceCurrency?: string | null;
  /** Rows of this statement still in Review, or 1 for a receipt not yet approved. */
  pendingReview?: number;
  /** Rows the statement holds; with more than one, they open under the line. */
  transactionCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Opens the category drawer for a document that has none yet. */
  onAddCategory?: () => void;
};

const EMPTY_CELL = '—';
const NUMERIC_COLUMN_IDS = new Set<StatementColumnId>(['amount', 'exchangeRate']);

const normalizeExchangeRateCurrency = (
  ...currencies: Array<string | null | undefined>
): string | null => {
  const normalized = firstNonEmpty(...currencies)?.toUpperCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'NIS' || normalized === '\u20aa') {
    return 'ILS';
  }
  return normalized;
};

const columnCellStyle = (columnId: StatementColumnId): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  justifyContent:
    columnId === 'receipt'
      ? 'center'
      : columnId === 'action' || columnId === 'amount'
        ? 'flex-end'
        : undefined,
  // The action cell stacks its button over the label sizer (see renderActionCell).
  ...(columnId === 'action'
    ? { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }
    : {}),
  ...statementColumnWidthStyle(columnId),
});

const textCellStyle = (columnId: StatementColumnId, muted = false): React.CSSProperties => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
  textAlign: NUMERIC_COLUMN_IDS.has(columnId) ? 'right' : 'left',
  color: muted ? 'var(--muted-foreground)' : 'var(--foreground)',
});

const firstNonEmpty = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

const formatBoolean = (value: boolean | null, yes: string, no: string): string => {
  if (value === null) return EMPTY_CELL;
  return value ? yes : no;
};

/** The statement's own month, `YYYY-MM`, for the report its links open. */
const statementMonth = (statement: StatementListItem): string | null => {
  const sortDate = resolveStatementSortDate(statement);
  return sortDate > 0 ? formatMonthParam(new Date(sortDate)) : null;
};

/** One tag of the Tag column: lights up on a resting pointer and opens its By tag row. */
function TagLink({
  name,
  month,
  title,
}: {
  name: string;
  month: string | null;
  title: string;
}): React.JSX.Element {
  const { lit, linkProps } = useDwellLink();
  return (
    <Link
      href={tagReportHref(name, month)}
      className={`seneca-stmt-category-link seneca-stmt-tag-link${lit ? ' seneca-stmt-category-link--lit' : ''}`}
      title={title}
      {...linkProps}
    >
      <span
        className="seneca-stmt-category-link__text"
        data-label={name}
        style={{ ...textCellStyle('tag'), width: 'auto', minWidth: 0 }}
      >
        {name}
      </span>
    </Link>
  );
}

function StatusBadge({
  status,
  isProcessing,
  errorMessage,
}: {
  status: string;
  isProcessing: boolean;
  errorMessage?: string | null;
}) {
  const listText = useIntlayer('statementsListUi');
  if (errorMessage || status === 'error') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--error">{listText.statusError}</span>
    );
  }
  if (isProcessing || status === 'processing' || status === 'uploaded') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--pending">{listText.statusPending}</span>
    );
  }
  // Parsed, but the balance did not reconcile: held out of analytics until a user
  // confirms it on the statement page.
  if (status === 'needs_review') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--review">
        {listText.statusNeedsReview}
      </span>
    );
  }
  if (status === 'completed' || status === 'parsed' || status === 'validated') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--completed">
        {listText.statusCompleted}
      </span>
    );
  }
  return null;
}

export function StatementsListItem({
  dataTourId,
  statement,
  viewLabel,
  duplicateActionLabel,
  isReceipt,
  isProcessing,
  merchantLabel,
  amountLabel,
  dateLabel,
  onView,
  onIconClick,
  onToggleSelect,
  selected = false,
  selectionDisabled = false,
  typeLabel,
  isManualExpense = false,
  isPossibleDuplicate = false,
  duplicatePosition,
  duplicateGroupSize,
  duplicateRole,
  duplicateGroupLabel,
  duplicateGroupStart = true,
  duplicateGroupEnd = true,
  duplicateReason,
  viewDisabled = false,
  columns = DEFAULT_STATEMENT_COLUMNS,
  currentExchangeRateLabels,
  workspaceCurrency,
  pendingReview = 0,
  transactionCount = 0,
  expanded = false,
  onToggleExpand,
  onAddCategory,
}: Props) {
  const { resolvedTheme } = useTheme();
  const listText = useIntlayer('statementsListUi');
  const { locale } = useLocale();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const { lit: categoryLit, linkProps: categoryLinkProps } = useDwellLink();

  const resolvedTypeLabel = typeLabel || statement.fileType;
  const isLocalReceipt = statement.source === 'scan';
  const previewSource = isLocalReceipt ? 'receipt' : 'statement';
  const hasError = !!statement.errorMessage || statement.status === 'error';
  const isPendingStatement = statement.status === 'uploaded' || statement.status === 'processing';
  const compactAmountLabel = amountLabel.replace(/\s+/g, '');
  const isZeroAmountLabel = /^0(?:[.,]0+)?\D*$/.test(compactAmountLabel);
  const isNegativeAmount = amountLabel.startsWith('-') && amountLabel !== '-';
  const isMissingAmount = amountLabel === '-';
  const showAmountLoader =
    !isReceipt && isPendingStatement && (isZeroAmountLabel || isMissingAmount);
  const resolvedDuplicateRole: DuplicateRole = duplicateRole || 'suspected';
  const resolvedDuplicateGroupLabel = duplicateGroupLabel || listText.group.value;
  const duplicateRoleLabel =
    resolvedDuplicateRole === 'primary' ? listText.rolePrimary.value : listText.roleSuspected.value;
  // Group and role go to the tooltip; the row itself only says "possible duplicate, 1 of 2".
  const duplicateBadgeLabel = isPossibleDuplicate
    ? `${resolvedDuplicateGroupLabel} · ${duplicateRoleLabel} #${duplicatePosition || 1}${duplicateGroupSize ? `/${duplicateGroupSize}` : ''}`
    : null;
  const duplicateCaption = isPossibleDuplicate
    ? listText.possibleDuplicate.value
        .replace('{position}', String(duplicatePosition || 1))
        .replace('{total}', String(duplicateGroupSize || duplicatePosition || 1))
    : null;
  const duplicateTooltipText = `${duplicateBadgeLabel ?? ''} — ${duplicateReason || listText.duplicateReasonSame.value}`;
  const reviewLabel = duplicateActionLabel || listText.review.value;
  const actionLabel = isPossibleDuplicate ? reviewLabel : viewLabel;
  // "23.00USD" → figure and currency, so the code can sit apart, smaller and grey.
  const amountParts = /^(.*\d)\s*(\D+)$/.exec(amountLabel);
  const amountFigure = amountParts ? amountParts[1] : amountLabel;
  const amountCurrency = amountParts ? amountParts[2] : null;
  const typeCaption = isManualExpense
    ? null
    : isReceipt
      ? resolvedTypeLabel
      : resolvedTypeLabel?.toUpperCase();
  const handleView = () => {
    if (viewDisabled) {
      return;
    }
    onView();
  };
  const visibleColumns = columns.filter(column => column.visible);
  const renderedColumns = visibleColumns.length > 0 ? visibleColumns : columns.slice(0, 1);
  const sourceLabel = isLocalReceipt ? listText.typeReceipt.value : statement.bankName;
  // importPreview.categoryId is deliberately not a fallback: it is a bare id,
  // and rendering it puts a raw UUID in the column.
  const categoryLabel = firstNonEmpty(statement.category?.name, statement.parsedData?.category);
  // System categories are stored by their English name; the link and the icon
  // keep that name, the reader sees it in their language.
  const categoryText = categoryLabel && localizeStatementCategoryName(categoryLabel, locale);
  const tagsLabel =
    statement.tags
      ?.map(tag => tag.name)
      .filter(Boolean)
      .join(', ') || null;
  const descriptionLabel = firstNonEmpty(
    statement.parsingDetails?.importPreview?.description,
    statement.transactionSummary?.description,
    statement.subject,
  );
  const statementCurrency = normalizeExchangeRateCurrency(
    statement.currency,
    statement.parsedData?.currency,
    statement.parsingDetails?.metadataExtracted?.currency,
    statement.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay,
  );
  const targetCurrency = normalizeExchangeRateCurrency(workspaceCurrency) ?? FALLBACK_CURRENCY;
  const usdExchangeRateLabel = targetCurrency
    ? currentExchangeRateLabels?.[`USD:${targetCurrency}`]
    : null;
  const currentExchangeRateLabel =
    statementCurrency && targetCurrency
      ? currentExchangeRateLabels?.[`${statementCurrency}:${targetCurrency}`]
      : null;
  const exchangeRateLabel =
    usdExchangeRateLabel ??
    currentExchangeRateLabel ??
    (statement.transactionSummary?.exchangeRateMixed
      ? listText.mixed.value
      : firstNonEmpty(statement.transactionSummary?.exchangeRate));
  const approvedLabel = formatBoolean(
    isDocumentApproved(statement.status, isReceipt, pendingReview),
    listText.yes.value,
    listText.no.value,
  );
  const billableLabel = formatBoolean(
    !(isMissingAmount || isZeroAmountLabel),
    listText.yes.value,
    listText.no.value,
  );
  const exportedLabel = formatBoolean(
    Boolean(statement.exported ?? statement.processedAt),
    listText.yes.value,
    listText.no.value,
  );

  const renderPlainCell = (
    columnId: StatementColumnId,
    value: string | null,
  ): React.JSX.Element => (
    <span style={textCellStyle(columnId, !value || value === EMPTY_CELL)}>
      {value || EMPTY_CELL}
    </span>
  );

  const renderTagCell = (): React.JSX.Element => {
    const tagNames = (statement.tags ?? [])
      .map(tag => tag.name?.trim())
      .filter(Boolean) as string[];
    if (tagNames.length === 0) return renderPlainCell('tag', null);
    const month = statementMonth(statement);
    return (
      <span
        title={tagsLabel ?? undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}
      >
        <Tag size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ display: 'flex', minWidth: 0, overflow: 'hidden' }}>
          {tagNames.map((name, index) => (
            <React.Fragment key={name}>
              {index > 0 ? <span style={{ flexShrink: 0 }}>,&nbsp;</span> : null}
              <TagLink
                name={name}
                month={month}
                title={listText.tagLink.value.replace('{tag}', name)}
              />
            </React.Fragment>
          ))}
        </span>
      </span>
    );
  };

  const renderCategoryCell = (): React.JSX.Element => {
    if (!hasChosenCategory(categoryLabel)) {
      // A receipt or a one-row statement is one purchase, so no category means
      // one is still to be picked. A multi-row statement's category is only the
      // majority of its rows', which carry their own (shown when opened).
      const awaitsCategory =
        (isReceipt || transactionCount <= 1) && !isProcessing && !isPendingStatement && !hasError;
      return awaitsCategory ? (
        <NoCategoryBadge onClick={onAddCategory} />
      ) : (
        renderPlainCell('category', null)
      );
    }
    return (
      <Link
        href={categoryReportHref(categoryLabel, statementMonth(statement))}
        className={`seneca-stmt-category-link${categoryLit ? ' seneca-stmt-category-link--lit' : ''}`}
        {...categoryLinkProps}
        title={listText.categoryLink.value.replace('{category}', categoryText ?? categoryLabel)}
      >
        <span className="seneca-stmt-category-link__badge">
          <CategoryIconBadge
            name={categoryLabel}
            color={statement.category?.color}
            icon={statement.category?.icon}
            size={22}
          />
        </span>
        <span
          className="seneca-stmt-category-link__text"
          data-label={categoryText}
          style={{ ...textCellStyle('category'), width: 'auto', minWidth: 0 }}
        >
          {categoryText}
        </span>
      </Link>
    );
  };

  const renderReceiptCell = (): React.JSX.Element => (
    <DocumentThumbnailPreview
      fileId={statement.id}
      fileName={statement.fileName}
      fileType={isReceipt ? 'pdf' : statement.fileType || statement.fileName || ''}
      source={previewSource}
      onOpen={onIconClick}
      testId={`statement-thumbnail-trigger-${statement.id}`}
    />
  );

  const renderMerchantCell = (): React.JSX.Element => (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, pointerEvents: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            color: c.ink900,
            fontSize: 15,
          }}
        >
          {isProcessing ? listText.processing : merchantLabel}
        </span>

        {pendingReview > 0 && !isProcessing ? (
          <span className="seneca-stmt-flag" style={{ flexShrink: 0 }}>
            {listText.toReview}
            {isReceipt ? null : ` · ${pendingReview}`}
          </span>
        ) : null}

        {hasError ? (
          <AlertCircle size={16} style={{ color: c.danger, marginLeft: 4 }} />
        ) : isManualExpense ? (
          <CreditCard
            data-testid="manual-expense-type-icon"
            size={14}
            style={{ color: c.ink500, opacity: 0.5, marginLeft: 4 }}
          />
        ) : null}
      </div>
      <div className="seneca-stmt-list-item__meta">
        {[dateLabel, typeCaption].filter(Boolean).join(' · ')}
        {duplicateCaption ? (
          <MuiTooltip title={duplicateTooltipText} placement="top" enterDelay={150}>
            <span data-testid="statement-duplicate-caption"> · {duplicateCaption}</span>
          </MuiTooltip>
        ) : null}
        {renderRowsToggle()}
        <NotesBadge entityId={statement.id} />
      </div>
    </div>
  );

  // "Transactions: 24 ▾" beside the date: a statement's rows open under its line.
  const renderRowsToggle = (): React.JSX.Element | null =>
    onToggleExpand && transactionCount > 1 ? (
      <button
        type="button"
        className="seneca-stmt-list-item__rows-toggle"
        aria-expanded={expanded}
        onClick={event => {
          event.stopPropagation();
          onToggleExpand();
        }}
      >
        {listText.transactionsCount.value.replace('{count}', String(transactionCount))}
        <ChevronDown
          size={12}
          aria-hidden
          style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}
        />
      </button>
    ) : null;

  const renderAmountCell = (): React.JSX.Element => (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <span
        className={clsx('seneca-stmt-list-item__amount', PRIVATE_CLASS)}
        style={{
          color: isNegativeAmount || hasError || isMissingAmount ? c.danger : c.ink900,
        }}
      >
        {showAmountLoader ? (
          <Spinner style={{ width: 16, height: 16, color: c.ink400 }} />
        ) : (
          <>
            {amountFigure}
            {amountCurrency ? (
              <span className="seneca-stmt-list-item__currency"> {amountCurrency}</span>
            ) : null}
          </>
        )}
      </span>
      <div
        style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
      >
        <StatusBadge
          status={statement.status}
          isProcessing={isProcessing}
          errorMessage={statement.errorMessage}
        />
      </div>
    </div>
  );

  const renderActionCell = (): React.JSX.Element => (
    <>
      {/* Every row, Review or not, is as wide as the Review label in this
          language, so the column lines up with the header and never clips it. */}
      <span
        aria-hidden
        className="seneca-stmt-list-item__view-btn seneca-stmt-list-item__action-sizer"
      >
        {reviewLabel}
      </span>
      <button
        data-testid="statement-view-icon"
        type="button"
        onClick={event => {
          event.stopPropagation();
          handleView();
        }}
        // The whole row already opens the statement, so a plain row gets a quiet
        // arrow instead of a "View" pill; a duplicate keeps its "Review" label,
        // which says something the row click does not.
        className={`seneca-stmt-list-item__view-btn ${isPossibleDuplicate ? 'seneca-stmt-list-item__view-btn--link' : 'seneca-stmt-list-item__view-btn--arrow'}`}
        aria-label={actionLabel}
        disabled={viewDisabled}
      >
        {isPossibleDuplicate ? actionLabel : <ChevronRight size={18} aria-hidden />}
      </button>
    </>
  );

  const renderColumnCell = (columnId: StatementColumnId): React.JSX.Element => {
    if (columnId === 'receipt') return renderReceiptCell();
    if (columnId === 'merchant') return renderMerchantCell();
    if (columnId === 'from')
      return renderPlainCell(
        columnId,
        firstNonEmpty(statement.user?.name, statement.user?.email, statement.sender),
      );
    if (columnId === 'to') return renderPlainCell(columnId, sourceLabel);
    if (columnId === 'category') return renderCategoryCell();
    if (columnId === 'tag') return renderTagCell();
    if (columnId === 'amount') return renderAmountCell();
    if (columnId === 'action') return renderActionCell();
    if (columnId === 'approved') return renderPlainCell(columnId, approvedLabel);
    if (columnId === 'billable') return renderPlainCell(columnId, billableLabel);
    if (columnId === 'card')
      return renderPlainCell(columnId, firstNonEmpty(statement.transactionSummary?.cardLabel));
    if (columnId === 'description') return renderPlainCell(columnId, descriptionLabel);
    if (columnId === 'exchangeRate') return renderPlainCell(columnId, exchangeRateLabel);
    if (columnId === 'exported') return renderPlainCell(columnId, exportedLabel);
    return renderPlainCell(columnId, null);
  };

  // Row styles based on duplicate/error/selected state
  const rowStyle: React.CSSProperties =
    hasError && !isPossibleDuplicate
      ? { borderColor: '#fecaca', backgroundColor: 'rgba(255,241,242,0.4)' }
      : {};

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: whole-row click is a shortcut for the buttons rendered inside this row. Giving the row role=button would nest interactive elements inside an interactive role, which is worse than the current state.
    <div
      data-tour-id={dataTourId}
      className={`seneca-stmt-list-item${selected ? ' seneca-stmt-list-item--selected' : ''}${hasError && !isPossibleDuplicate ? ' seneca-stmt-list-item--error' : ''}`}
      style={{ ...rowStyle, cursor: viewDisabled ? 'default' : 'pointer' }}
      onClick={handleView}
    >
      {isPossibleDuplicate ? (
        <span
          aria-hidden
          className={`seneca-stmt-list-item__accent${duplicateGroupStart ? ' seneca-stmt-list-item__accent--start' : ''}${duplicateGroupEnd ? ' seneca-stmt-list-item__accent--end' : ''}`}
        />
      ) : null}

      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          handleView();
        }}
        className="seneca-stmt-list-item__desktop-overlay"
        aria-label={viewLabel}
        aria-disabled={viewDisabled}
      />

      {/* Mobile layout (<768px): who and how much on the first line, when and what
          on the second — the amount never leaves the screen. Taps outside the
          checkbox and icon fall through to the overlay button and open the row. */}
      <div
        data-testid={`statement-item-mobile-${statement.id}`}
        className="seneca-stmt-list-item__mobile"
      >
        <div className="seneca-stmt-list-item__mobile-select">
          {selectionDisabled ? null : (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
              aria-label={merchantLabel}
            />
          )}
        </div>
        <button
          type="button"
          className="seneca-stmt-list-item__mobile-icon"
          onClick={event => {
            event.stopPropagation();
            onIconClick();
          }}
          aria-label={statement.fileName}
        ></button>
        <div className="seneca-stmt-list-item__mobile-body">
          <div className="seneca-stmt-list-item__mobile-line">
            <span className="seneca-stmt-list-item__mobile-merchant">
              {isProcessing ? listText.processing : merchantLabel}
            </span>
            {hasError ? <AlertCircle size={14} style={{ color: c.danger, flexShrink: 0 }} /> : null}
            <span
              className={clsx('seneca-stmt-list-item__mobile-amount', PRIVATE_CLASS)}
              style={{
                color: isNegativeAmount || hasError || isMissingAmount ? c.danger : undefined,
              }}
            >
              {showAmountLoader ? (
                <Spinner style={{ width: 14, height: 14, color: c.ink400 }} />
              ) : (
                amountLabel
              )}
            </span>
          </div>
          <div className="seneca-stmt-list-item__mobile-line seneca-stmt-list-item__mobile-meta">
            <span className="seneca-stmt-list-item__mobile-meta-text">
              {[dateLabel, isPossibleDuplicate ? duplicateCaption : categoryText || sourceLabel]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {renderRowsToggle()}
            <StatusBadge
              status={statement.status}
              isProcessing={isProcessing}
              errorMessage={statement.errorMessage}
            />
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div
        data-testid={`statement-item-desktop-${statement.id}`}
        className="seneca-stmt-list-item__desktop"
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            width: 16,
            display: 'flex',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s',
            flexShrink: 0,
            marginRight: 16,
          }}
        >
          {selectionDisabled ? (
            <span style={{ display: 'inline-flex', height: 16, width: 16 }} />
          ) : (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
              style={{ pointerEvents: 'auto', height: 16, width: 16 }}
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: 1,
            minWidth: 0,
            pointerEvents: 'auto',
          }}
        >
          {renderedColumns.map(column => (
            <div
              key={column.id}
              data-testid={`statement-column-${statement.id}-${column.id}`}
              style={columnCellStyle(column.id)}
            >
              {renderColumnCell(column.id)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
