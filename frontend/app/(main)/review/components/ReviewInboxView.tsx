'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DateFilterDropdown } from '@/app/(main)/statements/components/filters/DateFilterDropdown';
import type { StatementFilterDate } from '@/app/(main)/statements/components/filters/statement-filters';
import {
  buildDateModes,
  buildDatePresets,
  buildFilterLabels,
  buildFilterOptionLabels,
} from '@/app/(main)/statements/components/StatementsListView.utils';
import { StatementsToolbarButton } from '@/app/(main)/statements/components/StatementsToolbarButton';
import { ChevronDown } from '@/app/components/icons';
import {
  formatAmount,
  formatDate,
} from '@/app/components/transactions/helpers/transactionFormatters';
import { Alert } from '@/app/components/ui/alert';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { Select } from '@/app/components/ui/select';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import type { UseReviewInboxResult } from '../hooks/useReviewInbox';
import {
  dateFilterToRange,
  groupByPayee,
  REVIEW_INBOX_KINDS,
  type ReviewInboxItem,
  type ReviewInboxKind,
} from '../lib/review-inbox-model';

const SWIPE_THRESHOLD_PX = 80;

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
  const [grouped, setGrouped] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const categorySelectRef = useRef<HTMLDivElement | null>(null);
  // The statements Date dropdown, so both pages filter by date the same way.
  const statementsText = useIntlayer('statementsPage');
  const filterOptionLabels = buildFilterOptionLabels(statementsText, (path, fallback) =>
    resolveLabel(getNestedValue(statementsText, path), fallback),
  );
  const datePresets = buildDatePresets(filterOptionLabels);
  const dateModes = buildDateModes(filterOptionLabels);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState<StatementFilterDate | null>(null);
  const [dateApplied, setDateApplied] = useState<StatementFilterDate | null>(null);

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

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t.categoryPlaceholder.value },
      ...categories
        .filter(category => category.isEnabled !== false)
        .map(category => ({ value: category.id, label: getCategoryDisplayName(category, locale) })),
    ],
    [categories, locale, t.categoryPlaceholder.value],
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
        categorySelectRef.current?.querySelector<HTMLElement>('[role="combobox"], select')?.focus();
      },
      Escape: () => clearSelection(),
    },
    !busy,
  );

  const renderTransaction = (item: Extract<ReviewInboxItem, { kind: 'transaction' }>) => (
    <>
      <DocumentTitle
        href={
          item.receiptId
            ? `/storage/receipts/${item.receiptId}?from=review`
            : item.statementId
              ? `/statements/${item.statementId}/edit`
              : null
        }
        label={item.counterpartyName}
      />
      <Typography variant="caption" color="text.secondary" noWrap title={item.paymentPurpose}>
        {formatDate(item.date, locale)} · {item.paymentPurpose}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        {item.categoryName ? (
          <Chip size="small" label={item.categoryName} />
        ) : (
          <Chip size="small" variant="outlined" label={t.uncategorized.value} />
        )}
        {item.categorySource && (
          <Chip
            size="small"
            variant="outlined"
            label={`${sourceLabels[item.categorySource] ?? item.categorySource}${
              item.categoryReason ? ` · ${item.categoryReason}` : ''
            }`}
          />
        )}
      </Box>
    </>
  );

  const renderRow = (item: ReviewInboxItem, index: number) => {
    const isCursor = index === cursor;
    const isSelected = selected.has(item.id);
    const amount =
      'amount' in item && item.amount !== null
        ? formatAmount(item.amount, ('currency' in item && item.currency) || 'KZT', locale)
        : '—';

    let body: React.ReactNode;
    let actions: React.ReactNode;
    if (item.kind === 'transaction') {
      body = renderTransaction(item);
      actions = (
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => approveWithCategory([item.id])}
        >
          {categoryId ? t.approveWithCategory.value : t.approveAsIs.value}
        </Button>
      );
    } else if (item.kind === 'duplicate') {
      body = (
        <>
          <Typography variant="body2" fontWeight={600} noWrap>
            {item.counterpartyName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(item.date, locale)} · {t.duplicateOf.value}{' '}
            {item.duplicateOfId ? item.duplicateOfId.slice(0, 8) : '—'}
            {item.confidence !== null
              ? ` · ${fill(t.confidence.value, { value: Math.round(item.confidence * 100) })}`
              : ''}
          </Typography>
        </>
      );
      actions = (
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
    } else if (item.kind === 'receipt') {
      body = (
        <>
          <DocumentTitle
            href={`/storage/receipts/${item.id}?from=review`}
            label={item.vendor ?? '—'}
          />
          <Typography variant="caption" color="text.secondary">
            {item.date ? formatDate(item.date, locale) : '—'} ·{' '}
            {item.issues.map(issue => issueLabels[issue] ?? issue).join(', ')}
          </Typography>
        </>
      );
      actions = (
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
    } else {
      body = (
        <>
          <Typography variant="body2" fontWeight={600} noWrap>
            {item.vendorName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.frequency}
            {item.nextChargeDate ? ` · ${formatDate(item.nextChargeDate, locale)}` : ''}
            {item.confidence !== null
              ? ` · ${fill(t.confidence.value, { value: Math.round(item.confidence * 100) })}`
              : ''}
          </Typography>
        </>
      );
      actions = (
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
    }

    const row = (
      <Box
        key={item.id}
        data-testid="review-row"
        data-cursor={isCursor ? 'true' : undefined}
        onClick={() => setCursor(index)}
        className={`lumio-stmt-list-item${isSelected ? ' lumio-stmt-list-item--selected' : ''}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          // The keyboard cursor reads like a hovered row, not a framed one.
          ...(isCursor && !isSelected ? { bgcolor: 'action.hover' } : {}),
        }}
      >
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={() => toggle(item.id)}
          onClick={event => event.stopPropagation()}
          inputProps={{ 'aria-label': item.id }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>{body}</Box>
        <Typography
          variant="body2"
          sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          {amount}
        </Typography>
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1 }} onClick={event => event.stopPropagation()}>
            {actions}
          </Box>
        )}
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
            {actions}
          </Box>
        )}
      </SwipeableRow>
    );
  };

  const allSelected = items.length > 0 && items.every(item => selected.has(item.id));
  const listBody = state.isPending ? (
    ['a', 'b', 'c'].map(key => (
      <Box key={key} className="lumio-stmt-list-item">
        <Skeleton variant="rounded" height={40} />
      </Box>
    ))
  ) : orderedItems.length === 0 ? (
    <EmptyState illustration="no-data" title={t.empty.value} compact />
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
    <div className="container-shared lumio-stmt-list-view">
      <div className="lumio-stmt-list-view__header">
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
              {REVIEW_INBOX_KINDS.map(entry => (
                <Tab
                  key={entry}
                  value={entry}
                  label={page ? `${tabLabels[entry]} (${page.counts[entry]})` : tabLabels[entry]}
                />
              ))}
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

      <div className="lumio-stmt-list-view__table">
        <div className="lumio-stmt-list-view__table-toolbar" style={{ flexWrap: 'wrap' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, minWidth: 0 }}
          >
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={selected.size > 0 && !allSelected}
              disabled={items.length === 0}
              onChange={() =>
                allSelected ? clearSelection() : selectIds(items.map(item => item.id))
              }
              inputProps={{ 'aria-label': t.selectAll.value }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 88 }}>
              {fill(t.selected.value, { count: selected.size })}
            </Typography>
            {kind === 'transaction' && (
              <Box
                data-testid="review-bulk-bar"
                sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
              >
                <Box ref={categorySelectRef} sx={{ minWidth: 220 }}>
                  <Select
                    id="review-category"
                    value={categoryId}
                    onChange={setCategoryId}
                    options={categoryOptions}
                  />
                </Box>
                <Button
                  variant="contained"
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
          {!isMobile ? (
            <Typography variant="caption" color="text.secondary">
              {t.shortcuts.value}
            </Typography>
          ) : kind === 'transaction' ? (
            <Typography variant="caption" color="text.secondary">
              {t.swipeHint.value}
            </Typography>
          ) : null}
        </div>
        {listBody}
      </div>
    </div>
  );
}

/** A row's name, linked to the document it came from when there is one. */
function DocumentTitle({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <Typography variant="body2" fontWeight={600} noWrap title={label}>
        {label}
      </Typography>
    );
  }
  return (
    <Typography
      component={Link}
      href={href}
      variant="body2"
      fontWeight={600}
      noWrap
      title={label}
      onClick={event => event.stopPropagation()}
      sx={{
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
        '&:hover': { color: 'var(--primary)', textDecoration: 'underline' },
      }}
    >
      {label}
    </Typography>
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
