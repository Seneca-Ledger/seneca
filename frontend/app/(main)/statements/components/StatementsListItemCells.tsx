'use client';

import MuiTooltip from '@mui/material/Tooltip';
import clsx from 'clsx';
import React from 'react';
import { AlertCircle, ChevronDown, ChevronRight, CreditCard, Tag } from '@/app/components/icons';
import { NotesBadge } from '@/app/components/notes/NotesBadge';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import type { StatementColumnId as ColumnId } from './columns/statement-columns';
import { EMPTY_CELL, textCellStyle } from './statements-list-item.cells';
import type { StatementListItem } from './statements-list-item.types';

import { StatusBadge, statementMonth, TagLink } from './statements-list-item-parts';

type Colors = typeof tokens.color | typeof tokens.dark.color;

export function PlainCell({ columnId, value }: { columnId: ColumnId; value: string | null }) {
  return (
    <span style={textCellStyle(columnId, !value || value === EMPTY_CELL)}>
      {value || EMPTY_CELL}
    </span>
  );
}

/** The Tag column: each tag a link to its report for the document's month. */
export function TagCell({
  statement,
  tagsLabel,
}: {
  statement: StatementListItem;
  tagsLabel: string | null;
}): React.JSX.Element {
  const listText = useIntlayer('statementsListUi');
  const tagNames = (statement.tags ?? []).map(tag => tag.name?.trim()).filter(Boolean) as string[];
  if (tagNames.length === 0) return <PlainCell columnId="tag" value={null} />;
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
            {index > 0 ? <span style={{ flexShrink: 0 }}>{',\u00A0'}</span> : null}
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
}

/** "Transactions: 24 ▾" beside the date: a statement's rows open under its line. */
export function RowsToggle({
  transactionCount,
  expanded,
  onToggleExpand,
}: {
  transactionCount: number;
  expanded: boolean;
  onToggleExpand?: () => void;
}): React.JSX.Element | null {
  const listText = useIntlayer('statementsListUi');
  return onToggleExpand && transactionCount > 1 ? (
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
}

/** The Merchant column: who, the Review flag, and when and what underneath. */
export function MerchantCell(props: {
  c: Colors;
  statementId: string;
  merchantLabel: string;
  isProcessing: boolean;
  isReceipt: boolean;
  isManualExpense: boolean;
  hasError: boolean;
  pendingReview: number;
  dateLabel: string;
  typeCaption: string | null | undefined;
  duplicateCaption: string | null;
  duplicateTooltipText: string;
  rowsToggle: React.ReactNode;
}): React.JSX.Element {
  const listText = useIntlayer('statementsListUi');
  const { c, merchantLabel, isProcessing, isReceipt, isManualExpense, hasError, pendingReview } =
    props;
  const { dateLabel, typeCaption, duplicateCaption, duplicateTooltipText, rowsToggle } = props;
  const statement = { id: props.statementId };
  return (
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
        {rowsToggle}
        <NotesBadge entityId={statement.id} />
      </div>
    </div>
  );
}

/** The Amount column: the figure with its currency apart, and the status under it. */
export function AmountCell(props: {
  c: Colors;
  amountFigure: string;
  amountCurrency: string | null;
  danger: boolean;
  showLoader: boolean;
  status: string;
  isProcessing: boolean;
  errorMessage?: string | null;
}): React.JSX.Element {
  const { c, amountFigure, amountCurrency, danger, showLoader } = props;
  const { status, isProcessing, errorMessage } = props;
  return (
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
          color: danger ? c.danger : c.ink900,
          whiteSpace: amountFigure.includes('\n') ? 'pre-line' : undefined,
        }}
      >
        {showLoader ? (
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
        <StatusBadge status={status} isProcessing={isProcessing} errorMessage={errorMessage} />
      </div>
    </div>
  );
}

/** The Action column: a quiet arrow, or "Review" for a possible duplicate. */
export function ActionCell(props: {
  reviewLabel: string;
  actionLabel: string;
  isPossibleDuplicate: boolean;
  viewDisabled: boolean;
  onView: () => void;
}): React.JSX.Element {
  const { reviewLabel, actionLabel, isPossibleDuplicate, viewDisabled, onView } = props;
  return (
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
          onView();
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
}
