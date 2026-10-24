'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { filterEnabledCategories } from '@/app/(main)/statements/[id]/edit/editHelpers';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { statementColumnWidthStyle } from '@/app/(main)/statements/components/columns/statement-columns';
import { DateFilterDropdown } from '@/app/(main)/statements/components/filters/DateFilterDropdown';
import { statementFilterSpan } from '@/app/(main)/statements/components/filters/filter-summary';
import type { StatementFilterDate } from '@/app/(main)/statements/components/filters/statement-filters';
import { useFilterSummary } from '@/app/(main)/statements/components/filters/useFilterSummary';
import { useStatementPreview } from '@/app/(main)/statements/components/hooks/useStatementPreview';
import {
  buildDateModes,
  buildDatePresets,
  buildFilterLabels,
  buildFilterOptionLabels,
  buildListHeaderLabels,
} from '@/app/(main)/statements/components/StatementsListView.utils';
import { StatementsToolbarButton } from '@/app/(main)/statements/components/StatementsToolbarButton';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { hasChosenCategory, NoCategoryBadge } from '@/app/components/categories/NoCategoryBadge';
import { DocumentThumbnailPreview } from '@/app/components/DocumentThumbnailPreview';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import { ChevronDown, X } from '@/app/components/icons';
import { PDFPreviewModal } from '@/app/components/PDFPreviewModal';
import { formatDate } from '@/app/components/transactions/helpers/transactionFormatters';
import { Alert } from '@/app/components/ui/alert';
import { Checkbox } from '@/app/components/ui/checkbox';
import { EmptyState } from '@/app/components/ui/EmptyState';
import {
  CalendarLineIcon,
  DuplicateLineIcon,
  InboxLineIcon,
  ReceiptLineIcon,
} from '@/app/components/ui/empty-state-icons';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { PageTitle } from '@/app/components/ui/page-title';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import {
  getCategoryDisplayName,
  localizeStatementCategoryName,
} from '@/app/lib/statement-categories';
import type { UseReviewInboxResult } from '../hooks/useReviewInbox';
import {
  dateFilterToRange,
  documentHref,
  documentOf,
  groupByPayee,
  payeeOf,
  REVIEW_INBOX_KINDS,
  type ReviewInboxDocument,
  type ReviewInboxItem,
  type ReviewInboxKind,
} from '../lib/review-inbox-model';

const SWIPE_THRESHOLD_PX = 80;

/** One line icon per tab, from the set every empty state uses. */
const EMPTY_ICONS: Record<ReviewInboxKind, React.ReactNode> = {
  transaction: <InboxLineIcon />,
  receipt: <ReceiptLineIcon />,
  duplicate: <DuplicateLineIcon />,
  subscription: <CalendarLineIcon />,
};

/** The checkbox slot of a Documents row and of its header. */
const SELECT_CELL_SX = {
  width: 16,
  display: 'flex',
  justifyContent: 'center',
  flexShrink: 0,
  opacity: 0.7,
} as const;

/** Review rows sit on the Documents column widths, so both lists line up the same way. */
type ReviewColumn = 'receipt' | 'merchant' | 'category' | 'amount';

/**
 * The name stops at 360px so the category sits next to it instead of across the
 * row; the room left over goes between the category and the amount.
 */
const MERCHANT_MAX_WIDTH = 360;

const reviewColumnWidthStyle = (column: ReviewColumn): React.CSSProperties => ({
  ...statementColumnWidthStyle(column),
  ...(column === 'merchant' ? { maxWidth: MERCHANT_MAX_WIDTH } : {}),
});

const columnStyle = (column: ReviewColumn): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  justifyContent: column === 'receipt' ? 'center' : column === 'amount' ? 'flex-end' : undefined,
  ...reviewColumnWidthStyle(column),
});

// No `display` here: on phones the statements stylesheet hides the column
// titles, and an inline display would win over it.
const headerStyle = (column: ReviewColumn): React.CSSProperties => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: column === 'receipt' ? 'center' : column === 'amount' ? 'right' : 'left',
  ...reviewColumnWidthStyle(column),
});

/** Same words, ignoring case and spacing: "Invoice number 29…" vs "Invoice number29…". */
function sameText(a: string, b: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase();
  return normalize(a) === normalize(b);
}

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

type Props = { state: UseReviewInboxResult };

// eslint-disable-next-line max-lines-per-function, complexity
export function ReviewInboxView({ state }: Props) {
  const t = useIntlayer('reviewInbox');
  const tOwner = useIntlayer('transactionOwner');
  const drawer = useIntlayer('transactionsDrawer');
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const router = useRouter();
  // The thumbnail opens the file in the same viewer Documents uses.
  const preview = useStatementPreview();
  const [grouped, setGrouped] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  // The row whose empty category slot was clicked: the category drawer is open for it.
  const [categoryRowId, setCategoryRowId] = useState<string | null>(null);
  const editText = useIntlayer('statementEditPage');
  const categorySelectRef = useRef<HTMLDivElement | null>(null);
  // The statements Date dropdown, so both pages filter by date the same way.
  const statementsText = useIntlayer('statementsPage');
  const filterOptionLabels = buildFilterOptionLabels(statementsText, (path, fallback) =>
    resolveLabel(getNestedValue(statementsText, path), fallback),
  );
  const listHeaderLabels = buildListHeaderLabels(statementsText);
  const datePresets = buildDatePresets(filterOptionLabels);
  const dateModes = buildDateModes(filterOptionLabels);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState<StatementFilterDate | null>(state.initialDateFilter);
  const [dateApplied, setDateApplied] = useState<StatementFilterDate | null>(
    state.initialDateFilter,
  );

  const {
    kind,
    setKind,
    reviewer,
    setReviewer,
    canFilterByReviewer,
    items,
    page,
    categories,
    selected,
    toggle,
    selectIds,
    clearSelection,
    cursor,
    setCursor,
    move,
    busy,
    approve,
  } = state;

  const applyDate = (next: StatementFilterDate | null): void => {
    const range = dateFilterToRange(next, new Date());
    setDateDraft(next);
    setDateApplied(next);
    state.setFrom(range.from);
    state.setTo(range.to);
    setDateOpen(false);
  };
  const dateLabel =
    (dateApplied?.preset && datePresets.find(o => o.value === dateApplied.preset)?.label) ||
    (dateApplied?.mode && dateModes.find(o => o.value === dateApplied.mode)?.label) ||
    buildFilterLabels(statementsText).date;

  const sourceLabels: Record<string, string> = {
    manual: drawer.categorySource.manual.value,
    rule: drawer.categorySource.rule.value,
    keyword: drawer.categorySource.keyword.value,
    learned: drawer.categorySource.learned.value,
    history: drawer.categorySource.history.value,
    ai: drawer.categorySource.ai.value,
    default: drawer.categorySource.default.value,
  };
  const issueLabels: Record<string, string> = {
    missing_amount: t.issueMissingAmount.value,
    missing_date: t.issueMissingDate.value,
    potential_duplicate: t.issuePotentialDuplicate.value,
  };
  const tabLabels: Record<ReviewInboxKind, string> = {
    transaction: t.tabTransactions.value,
    receipt: t.tabReceipts.value,
    duplicate: t.tabDuplicates.value,
    subscription: t.tabSubscriptions.value,
  };

  const summarize = useFilterSummary();
  const titleSummary = summarize(
    tabLabels[kind],
    kind === 'subscription' ? { kind: 'allTime' } : statementFilterSpan(dateApplied, new Date()),
    [
      canFilterByReviewer &&
        `${tOwner.filterLabel.value}: ${reviewer === 'me' ? tOwner.me.value : tOwner.everyone.value}`,
      state.uncategorized && t.filterUncategorized.value,
      grouped && t.groupByPayee.value,
    ].filter((part): part is string => Boolean(part)),
  );

  const groups = useMemo(() => (grouped ? groupByPayee(items) : null), [grouped, items]);
  const orderedItems = useMemo(
    () => (groups ? groups.flatMap(group => group.items) : items),
    [groups, items],
  );

  const approveWithCategory = useCallback(
    (ids?: string[]) => {
      void approve(categoryId || undefined, ids);
    },
    [approve, categoryId],
  );

  useKeyboardShortcuts(
    {
      j: () => move(1),
      k: () => move(-1),
      x: () => {
        const current = orderedItems[cursor];
        if (current) toggle(current.id);
      },
      a: () => {
        if (kind === 'transaction') approveWithCategory();
      },
      c: () => {
        categorySelectRef.current?.querySelector<HTMLElement>('button')?.focus();
      },
      // biome-ignore lint/correctness/noComponentHookFactories: a key name (tinykeys), not a component.
      Escape: () => clearSelection(),
    },
    !busy,
  );

  const openPreview = (document: ReviewInboxDocument): void =>
    preview.openPreview({
      fileId: document.id,
      fileName: document.fileName ?? 'document',
      source: document.source,
    });

  /** The amount column's actions for one row; also sizes the header's action column. */
  const renderActions = (item: ReviewInboxItem): React.ReactNode => {
    if (item.kind === 'transaction') {
      // Shown on the row under the pointer or the keyboard cursor only: a column of
      // identical buttons would outshout the rows. Bulk approval stays in the toolbar.
      return (
        <button
          type="button"
          className="seneca-review-row-approve"
          disabled={busy}
          onClick={() => approveWithCategory([item.id])}
        >
          {categoryId ? t.approveWithCategory.value : t.approveAsIs.value}
        </button>
      );
    }
    if (item.kind === 'duplicate') {
      return (
        <>
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={() => void state.resolveDuplicate(item.id, 'keep')}
          >
            {t.keep.value}
          </Button>
          <Button
            size="small"
            disabled={busy}
            onClick={() => void state.resolveDuplicate(item.id, 'confirm')}
          >
            {t.confirmDuplicate.value}
          </Button>
        </>
      );
    }
    if (item.kind === 'receipt') {
      return (
        <>
          <Button
            size="small"
            variant="outlined"
            component={Link}
            href={`/storage/receipts/${item.id}?from=review`}
          >
            {t.openReceipt.value}
          </Button>
          <Button
            size="small"
            disabled={busy || item.amount === null}
            onClick={() => void state.approveReceipt(item.id)}
          >
            {t.approveReceipt.value}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => void state.decideSubscription(item.id, 'dismiss')}
        >
          {t.dismissSubscription.value}
        </Button>
        <Button
          size="small"
          disabled={busy}
          onClick={() => void state.decideSubscription(item.id, 'confirm')}
        >
          {t.confirmSubscription.value}
        </Button>
      </>
    );
  };

  /** Name on top, date and what else is known underneath — the Documents merchant cell. */
  const renderMerchant = (item: ReviewInboxItem): React.ReactNode => {
    let title: string;
    let meta: string;
    if (item.kind === 'transaction') {
      // The payee by the name the user knows; the bank's own wording underneath,
      // unless it only repeats the name (a scan's purpose is often its vendor).
      title = item.payee?.name ?? item.counterpartyName;
      const detail = [item.counterpartyName, item.paymentPurpose].find(
        text => text && !sameText(text, title),
      );
      meta = [formatDate(item.date, locale), detail].filter(Boolean).join(' · ');
    } else if (item.kind === 'duplicate') {
      title = item.counterpartyName;
      meta = [
        formatDate(item.date, locale),
        `${t.duplicateOf.value} ${item.duplicateOfId ? item.duplicateOfId.slice(0, 8) : '—'}`,
        item.confidence !== null
          ? fill(t.confidence.value, { value: Math.round(item.confidence * 100) })
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
    } else if (item.kind === 'receipt') {
      title = item.vendor ?? '—';
      meta = [
        item.date ? formatDate(item.date, locale) : '—',
        item.issues.map(issue => issueLabels[issue] ?? issue).join(', '),
      ]
        .filter(Boolean)
        .join(' · ');
    } else {
      title = item.vendorName;
      meta = [
        item.frequency,
        item.nextChargeDate ? formatDate(item.nextChargeDate, locale) : '',
        item.confidence !== null
          ? fill(t.confidence.value, { value: Math.round(item.confidence * 100) })
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <Typography
            component="span"
            noWrap
            title={title}
            sx={{ fontWeight: 600, fontSize: 15, color: 'var(--foreground)' }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          noWrap
          title={meta}
          sx={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', mt: 0.25 }}
        >
          {meta}
        </Typography>
        {/* Phones have no category column: the category goes under the name. */}
        {isMobile && item.kind === 'transaction' ? (
          <Box sx={{ mt: 0.5, fontSize: 12, minWidth: 0 }}>{renderCategory(item)}</Box>
        ) : null}
      </Box>
    );
  };

  /** A chosen category as Documents shows it; otherwise it says there is none yet. */
  const renderCategory = (item: Extract<ReviewInboxItem, { kind: 'transaction' }>) => {
    if (!hasChosenCategory(item.categoryName)) {
      return <NoCategoryBadge onClick={() => setCategoryRowId(item.id)} />;
    }
    const category = categories.find(entry => entry.id === item.categoryId);
    const label = category
      ? getCategoryDisplayName(category, locale)
      : localizeStatementCategoryName(item.categoryName, locale);
    // "Picked by hand" is what nearly every row would say; only the other sources are news.
    const source =
      item.categorySource && item.categorySource !== 'manual'
        ? `${sourceLabels[item.categorySource] ?? item.categorySource}${
            item.categoryReason ? ` · ${item.categoryReason}` : ''
          }`
        : null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <CategoryIconBadge
          name={item.categoryName}
          color={category?.color}
          icon={category?.icon}
          size={22}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography component="span" noWrap title={label} sx={{ fontSize: 14 }}>
            {label}
          </Typography>
          {/* Who picked it — a rule, the history, the model — since that is what is being checked. */}
          {source ? (
            <Typography
              component="span"
              noWrap
              title={source}
              sx={{ fontSize: 11, color: 'var(--muted-foreground)' }}
            >
              {source}
            </Typography>
          ) : null}
        </Box>
      </Box>
    );
  };

  const showCategoryColumn = kind === 'transaction' && !isMobile;

  const renderRow = (item: ReviewInboxItem, index: number) => {
    const isCursor = index === cursor;
    const isSelected = selected.has(item.id);
    // The figure, then the currency code apart and quieter ("289.00 ILS"): a
    // bold ₪ or $ glued to the digits outweighed the payee's name.
    const amount =
      'amount' in item && item.amount !== null
        ? {
            figure: new Intl.NumberFormat(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(item.amount),
            currency: (('currency' in item && item.currency) || 'KZT').toUpperCase(),
          }
        : null;
    const document = documentOf(item);
    const href = document ? documentHref(document) : null;

    const row = (
      <Box
        key={item.id}
        data-testid="review-row"
        data-cursor={isCursor ? 'true' : undefined}
        onClick={() => {
          setCursor(index);
          if (href) router.push(href);
        }}
        className={`seneca-stmt-list-item${isSelected ? ' seneca-stmt-list-item--selected' : ''}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: href ? 'pointer' : 'default',
          // The keyboard cursor reads like a hovered row, not a framed one.
          ...(isCursor && !isSelected ? { bgcolor: 'action.hover' } : {}),
        }}
      >
        <Box sx={{ ...SELECT_CELL_SX, mr: 2 }}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggle(item.id)}
            onClick={event => event.stopPropagation()}
            aria-label={payeeOf(item)}
            style={{ height: 16, width: 16 }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
          <div style={columnStyle('receipt')}>
            {document ? (
              <DocumentThumbnailPreview
                fileId={document.id}
                fileName={document.fileName ?? payeeOf(item)}
                fileType={
                  document.source === 'receipt'
                    ? 'pdf'
                    : (document.fileType ?? document.fileName ?? '')
                }
                source={document.source}
                onOpen={() => openPreview(document)}
                testId={`review-thumbnail-${item.id}`}
              />
            ) : null}
          </div>
          <div style={columnStyle('merchant')}>{renderMerchant(item)}</div>
          {showCategoryColumn && item.kind === 'transaction' ? (
            <div style={columnStyle('category')}>{renderCategory(item)}</div>
          ) : null}
          <div style={isMobile ? { flex: '0 0 auto' } : columnStyle('amount')}>
            <span
              className={`seneca-stmt-list-item__amount ${PRIVATE_CLASS}`}
              style={{ color: 'var(--foreground)' }}
            >
              {amount ? (
                <>
                  {amount.figure}
                  <span className="seneca-stmt-list-item__currency"> {amount.currency}</span>
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
          {!isMobile && (
            <Box
              sx={{ display: 'flex', gap: 1, flex: '0 0 auto' }}
              onClick={event => event.stopPropagation()}
            >
              {renderActions(item)}
            </Box>
          )}
        </Box>
      </Box>
    );

    if (!isMobile) return row;
    return (
      <SwipeableRow
        key={item.id}
        disabled={busy || item.kind !== 'transaction'}
        onApprove={() => approveWithCategory([item.id])}
        onSkip={() => move(1)}
      >
        {row}
        {item.kind !== 'transaction' && (
          <Box sx={{ display: 'flex', gap: 1, px: 1.5, pb: 1, justifyContent: 'flex-end' }}>
            {renderActions(item)}
          </Box>
        )}
      </SwipeableRow>
    );
  };

  const allSelected = items.length > 0 && items.every(item => selected.has(item.id));
  // Column titles over the rows, on the same widths, as on Documents.
  const header = (
    <div className="seneca-stmt-list-view__desktop-header">
      <Box sx={{ ...SELECT_CELL_SX, mr: 2 }}>
        <Checkbox
          checked={allSelected}
          indeterminate={selected.size > 0 && !allSelected}
          disabled={items.length === 0}
          onCheckedChange={() =>
            allSelected ? clearSelection() : selectIds(items.map(item => item.id))
          }
          aria-label={t.selectAll.value}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        <div data-column-id="receipt" style={headerStyle('receipt')}>
          <span className="u-visually-hidden">{listHeaderLabels.receipt}</span>
        </div>
        <div data-column-id="merchant" style={headerStyle('merchant')}>
          {filterOptionLabels.columnMerchant} · {listHeaderLabels.date}
        </div>
        {showCategoryColumn ? (
          <div data-column-id="category" style={headerStyle('category')}>
            {filterOptionLabels.columnCategory}
          </div>
        ) : null}
        <div data-column-id="amount" style={headerStyle('amount')}>
          {filterOptionLabels.columnAmount}
        </div>
        {/* An invisible copy of the first row's buttons, so this column is as
            wide as theirs and Amount sits right above the amounts. */}
        {orderedItems[0] ? (
          <Box
            data-column-id="action"
            aria-hidden
            inert
            sx={{ display: 'flex', gap: 1, flex: '0 0 auto', visibility: 'hidden', height: 0 }}
          >
            {renderActions(orderedItems[0])}
          </Box>
        ) : null}
      </Box>
    </div>
  );

  const listBody = state.isPending ? (
    ['a', 'b', 'c'].map(key => (
      <Box key={key} className="seneca-stmt-list-item">
        <Skeleton variant="rounded" height={40} />
      </Box>
    ))
  ) : orderedItems.length === 0 ? (
    <EmptyState icon={EMPTY_ICONS[kind]} title={t.empty.value} compact />
  ) : groups ? (
    groups.map(group => {
      const start = orderedItems.indexOf(group.items[0]);
      return (
        <Box key={group.payee}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="subtitle2">
              {group.payee} · {group.items.length}
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => selectIds(group.items.map(item => item.id))}
            >
              {t.selectGroup.value}
            </Button>
          </Box>
          {group.items.map((item, offset) => renderRow(item, start + offset))}
        </Box>
      );
    })
  ) : (
    orderedItems.map((item, index) => renderRow(item, index))
  );

  // Laid out like the statements list: tabs with the page's controls on one
  // row, then a single white block whose first row is the list's own toolbar.
  return (
    <div className="container-shared seneca-stmt-list-view">
      <div className="seneca-stmt-list-view__header">
        <div style={{ marginBottom: 16 }}>
          <PageTitle path="/review" summary={titleSummary} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Tabs
              value={kind}
              onChange={(_event, next: ReviewInboxKind) => setKind(next)}
              variant="scrollable"
              scrollButtons={false}
              aria-label={t.title.value}
              sx={{ ...sharedMuiTabsSx, mb: 0 }}
            >
              {REVIEW_INBOX_KINDS.map(entry => {
                // Filtered by "no category", the rows tab counts what it lists.
                const count =
                  page &&
                  (entry === 'transaction' && state.uncategorized
                    ? page.total
                    : page.counts[entry]);
                return (
                  <Tab
                    key={entry}
                    value={entry}
                    label={
                      page ? (
                        <span>
                          {tabLabels[entry]}{' '}
                          <span
                            className={`seneca-review-tab-count${count === 0 ? ' seneca-review-tab-count--zero' : ''}`}
                          >
                            {count}
                          </span>
                        </span>
                      ) : (
                        tabLabels[entry]
                      )
                    }
                  />
                );
              })}
            </Tabs>
          </div>
          {canFilterByReviewer && (
            <Select
              value={reviewer}
              onChange={value => setReviewer(value === 'me' ? 'me' : 'anyone')}
              aria-label={tOwner.filterLabel.value}
              options={[
                { value: 'me', label: tOwner.me.value },
                { value: 'anyone', label: tOwner.everyone.value },
              ]}
              sx={{ minWidth: 130, backgroundColor: 'var(--card-bg)' }}
            />
          )}
          {kind !== 'subscription' && (
            <DateFilterDropdown
              open={dateOpen}
              onOpenChange={setDateOpen}
              presets={datePresets}
              modes={dateModes}
              value={dateDraft}
              onChange={setDateDraft}
              onApply={() => applyDate(dateDraft)}
              onReset={() => applyDate(null)}
              trigger={
                <StatementsToolbarButton>
                  {dateLabel}
                  <ChevronDown size={14} />
                </StatementsToolbarButton>
              }
              applyLabel={filterOptionLabels.apply}
              resetLabel={filterOptionLabels.reset}
            />
          )}
          {state.uncategorized && (
            <StatementsToolbarButton
              aria-pressed
              aria-label={`${t.clearFilter.value}: ${t.filterUncategorized.value}`}
              onClick={state.clearUncategorized}
              style={{
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
                background: 'color-mix(in srgb, var(--primary) 8%, var(--card-bg))',
              }}
            >
              {t.filterUncategorized.value}
              <X size={14} aria-hidden="true" />
            </StatementsToolbarButton>
          )}
          <StatementsToolbarButton
            aria-pressed={grouped}
            onClick={() => setGrouped(value => !value)}
            style={
              grouped
                ? {
                    borderColor: 'var(--primary)',
                    color: 'var(--primary)',
                    background: 'color-mix(in srgb, var(--primary) 8%, var(--card-bg))',
                  }
                : undefined
            }
          >
            {t.groupByPayee.value}
          </StatementsToolbarButton>
        </div>
        {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      </div>

      <div className="seneca-stmt-list-view__table">
        <div className="seneca-stmt-list-view__table-toolbar" style={{ flexWrap: 'wrap' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, minWidth: 0 }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 88 }}>
              {fill(t.selected.value, { count: selected.size })}
            </Typography>
            {kind === 'transaction' && (
              <Box
                data-testid="review-bulk-bar"
                sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
              >
                <Box ref={categorySelectRef} sx={{ minWidth: 220 }}>
                  <CategoryPickerField
                    id="review-category"
                    size="small"
                    ariaLabel={t.categoryPlaceholder.value}
                    value={categoryId}
                    categories={categories}
                    onChange={setCategoryId}
                    placeholder={t.categoryPlaceholder.value}
                  />
                </Box>
                {/* Outlined like "Approve as is" until a category is picked; then the page's one filled button. */}
                <Button
                  variant={categoryId ? 'contained' : 'outlined'}
                  disabled={busy || !categoryId || (selected.size === 0 && cursor < 0)}
                  onClick={() => approveWithCategory()}
                >
                  {t.approveWithCategory.value}
                </Button>
                <Button
                  variant="outlined"
                  disabled={busy || (selected.size === 0 && cursor < 0)}
                  onClick={() => void approve(undefined)}
                >
                  {t.approveAsIs.value}
                </Button>
              </Box>
            )}
          </Box>
          {/* The keys matter once there is something to act on. */}
          {!isMobile ? (
            selected.size > 0 ? (
              <Typography variant="caption" color="text.secondary">
                {t.shortcuts.value}
              </Typography>
            ) : null
          ) : kind === 'transaction' ? (
            <Typography variant="caption" color="text.secondary">
              {t.swipeHint.value}
            </Typography>
          ) : null}
        </div>
        {header}
        {listBody}
      </div>
      {preview.preview.fileId ? (
        <PDFPreviewModal
          isOpen={preview.preview.isOpen}
          onClose={preview.closePreview}
          fileId={preview.preview.fileId}
          fileName={preview.preview.fileName}
          source={preview.preview.source}
        />
      ) : null}
      <StatementCategoryDrawer
        open={categoryRowId !== null}
        onClose={() => setCategoryRowId(null)}
        categories={filterEnabledCategories(categories)}
        selectedCategoryId=""
        selecting={busy}
        onSelect={picked => {
          const id = categoryRowId;
          if (!(id && picked)) {
            return;
          }
          void state.setCategory(id, picked).then(() => setCategoryRowId(null));
        }}
      />
    </div>
  );
}

/** Right past the threshold approves, left skips; anything shorter snaps back. */
function SwipeableRow({
  children,
  disabled,
  onApprove,
  onSkip,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  return (
    <Box
      data-testid="swipe-row"
      onTouchStart={event => {
        if (disabled) return;
        startX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchMove={event => {
        if (startX.current === null) return;
        setDx((event.touches[0]?.clientX ?? startX.current) - startX.current);
      }}
      onTouchEnd={() => {
        if (startX.current === null) return;
        if (dx > SWIPE_THRESHOLD_PX) onApprove();
        else if (dx < -SWIPE_THRESHOLD_PX) onSkip();
        startX.current = null;
        setDx(0);
      }}
      sx={{
        transform: `translateX(${dx}px)`,
        transition: dx === 0 ? 'transform 150ms ease-out' : 'none',
        bgcolor:
          dx > SWIPE_THRESHOLD_PX
            ? 'var(--color-success-soft-bg, transparent)'
            : dx < -SWIPE_THRESHOLD_PX
              ? 'action.hover'
              : 'transparent',
      }}
    >
      {children}
    </Box>
  );
}
