'use client';

import React from 'react';
import { MoreHorizontal } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  EmptyStateIllustration,
  type EmptyStateIllustrationName,
} from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer } from '@/app/i18n';
import type { Payable } from '@/app/lib/payables-api';
import {
  formatMoney,
  formatPayableDate,
  isPayableOverdue,
  parsePayableDate,
  toNumber,
} from './payables-utils';

interface PayablesListProps {
  items: Payable[];
  locale?: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIllustration?: EmptyStateIllustrationName;
  labels: {
    vendor: string;
    dueDate: string;
    amount: string;
    source: string;
    status: string;
    actions: string;
    markPaid: string;
    edit: string;
    archive: string;
    delete: string;
    pageShown: string;
    statusLabels: Record<string, string>;
    sourceLabels: Record<string, string>;
    /** Reads under the amount of a partly settled bill: "400 paid". */
    amountPaid: string;
  };
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  actionState?: {
    markingPaidId?: string | null;
    archivingId?: string | null;
    deletingId?: string | null;
  };
  onEdit: (payable: Payable) => void;
  onMarkPaid: (payable: Payable) => void;
  onArchive: (payable: Payable) => void;
  onDelete: (payable: Payable) => void;
}

const fillTemplate = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );

/** Whole days a due date is behind today, by the calendar. */
function daysOverdue(dueDate: string | null | undefined): number {
  const due = parsePayableDate(dueDate);
  if (!due) {
    return 0;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

type StatusTone = 'overdue' | 'done' | 'partial' | 'neutral';

function toneOf(payable: Payable, overdue: boolean): StatusTone {
  if (overdue) {
    return 'overdue';
  }
  if (payable.status === 'paid') {
    return 'done';
  }
  return payable.status === 'partially_paid' ? 'partial' : 'neutral';
}

function PayablesList({
  items,
  locale = 'en',
  emptyTitle,
  emptyDescription,
  emptyIllustration = 'payables',
  labels,
  pagination,
  actionState,
  onEdit,
  onMarkPaid,
  onArchive,
  onDelete,
}: PayablesListProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const unbookedText = useIntlayer('payablesUnbooked');

  if (items.length === 0) {
    return (
      <div className="seneca-payable-list__empty">
        <EmptyStateIllustration name={emptyIllustration} size="md" />
        <h3 className="seneca-payable-list__empty-title">{emptyTitle}</h3>
        <p className="seneca-payable-list__empty-text">{emptyDescription}</p>
      </div>
    );
  }

  const rangeStart =
    pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);
  const safeRangeStart = pagination.totalItems === 0 ? 0 : Math.min(rangeStart, rangeEnd);
  // A column that says the same thing on every row says nothing.
  const showSource = new Set(items.map(item => item.source)).size > 1;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  /** A quiet status: a dot and a word; an overdue one says for how long, in terracotta. */
  const renderStatus = (payable: Payable): React.JSX.Element => {
    const overdue = isPayableOverdue(payable);
    const tone = toneOf(payable, overdue);
    const label = labels.statusLabels[overdue ? 'overdue' : payable.status] || payable.status;
    return (
      <span className={`seneca-payable-status seneca-payable-status--${tone}`}>
        {label}
        {overdue && (
          <span className="seneca-payable-status__since">
            {' · '}
            {relative.format(-daysOverdue(payable.dueDate), 'day')}
          </span>
        )}
        {/* Paid on paper, with no money in an account yet: it waits for its bank row. */}
        {!overdue && toNumber(payable.unbookedAmount) > 0 && (
          <span className="seneca-payable-status__unbooked">
            {' · '}
            {unbookedText.notInAccount.value}
          </span>
        )}
      </span>
    );
  };

  /** One line of money; a partly settled bill adds what has come in so far. */
  const renderAmount = (payable: Payable): React.JSX.Element => (
    <>
      <PrivateAmount>{formatMoney(payable.amount, payable.currency, locale)}</PrivateAmount>
      {payable.status === 'partially_paid' && toNumber(payable.paidAmount) > 0 && (
        <span className="seneca-payable-list__amount-note">
          <PrivateAmount>{formatMoney(payable.paidAmount, payable.currency, locale)}</PrivateAmount>{' '}
          {labels.amountPaid}
        </span>
      )}
    </>
  );

  const renderActions = (payable: Payable): React.JSX.Element => {
    const canMarkPaid = payable.status !== 'paid' && payable.status !== 'archived';
    return (
      // The row opens the bill; its own controls must not open it as well.
      // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's click
      // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard reaches the buttons themselves
      <div className="seneca-payable-list__actions" onClick={event => event.stopPropagation()}>
        {canMarkPaid ? (
          <button
            type="button"
            className="seneca-payable-list__mark"
            onClick={() => onMarkPaid(payable)}
            disabled={actionState?.markingPaidId === payable.id}
          >
            {labels.markPaid}
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={labels.actions}>
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ minWidth: 180 }}>
            <DropdownMenuItem onClick={() => onEdit(payable)}>{labels.edit}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(payable)}>{labels.archive}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(payable)}>{labels.delete}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="seneca-payable-list">
      {isMobile ? (
        <div className="seneca-payable-list__mobile-rows">
          {items.map(payable => (
            <div
              key={payable.id}
              data-attention={`payable:${payable.id}`}
              className="seneca-payable-list__mobile-row"
            >
              <div className="seneca-payable-list__mobile-row-top">
                <button
                  type="button"
                  className="seneca-payable-list__vendor"
                  onClick={() => onEdit(payable)}
                >
                  {payable.vendor}
                </button>
                <span className="seneca-payable-list__amount">{renderAmount(payable)}</span>
              </div>
              <div className="seneca-payable-list__mobile-row-data">
                <span className="seneca-payable-list__muted">
                  {formatPayableDate(payable.dueDate, locale)}
                  {showSource && ` · ${labels.sourceLabels[payable.source] || payable.source}`}
                </span>
                {renderStatus(payable)}
              </div>
              {renderActions(payable)}
            </div>
          ))}
        </div>
      ) : (
        <div className="seneca-payable-list__table-wrap">
          <table className="seneca-payable-list__table">
            <thead className="seneca-payable-list__thead">
              <tr>
                <th className="seneca-payable-list__th">{labels.vendor}</th>
                <th className="seneca-payable-list__th">{labels.dueDate}</th>
                {showSource && <th className="seneca-payable-list__th">{labels.source}</th>}
                <th className="seneca-payable-list__th">{labels.status}</th>
                <th className="seneca-payable-list__th seneca-payable-list__th--right">
                  {labels.amount}
                </th>
                <th className="seneca-payable-list__th seneca-payable-list__th--right">
                  <span className="u-visually-hidden">{labels.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="seneca-payable-list__tbody">
              {items.map(payable => (
                <tr
                  key={payable.id}
                  data-attention={`payable:${payable.id}`}
                  className="seneca-payable-list__row"
                  onClick={() => onEdit(payable)}
                >
                  <td className="seneca-payable-list__td">
                    {/* The keyboard way into the bill; a click anywhere on the row does the same. */}
                    <button
                      type="button"
                      className="seneca-payable-list__vendor"
                      onClick={event => {
                        event.stopPropagation();
                        onEdit(payable);
                      }}
                    >
                      {payable.vendor}
                    </button>
                  </td>
                  <td className="seneca-payable-list__td seneca-payable-list__muted">
                    {formatPayableDate(payable.dueDate, locale)}
                  </td>
                  {showSource && (
                    <td className="seneca-payable-list__td seneca-payable-list__muted">
                      {labels.sourceLabels[payable.source] || payable.source}
                    </td>
                  )}
                  <td className="seneca-payable-list__td">{renderStatus(payable)}</td>
                  <td className="seneca-payable-list__td seneca-payable-list__amount">
                    {renderAmount(payable)}
                  </td>
                  <td className="seneca-payable-list__td">{renderActions(payable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* One page needs neither a page count nor page buttons. */}
      {pagination.totalPages > 1 && (
        <div className="seneca-payable-list__pagination-row">
          <div className="seneca-payable-list__muted">
            {fillTemplate(labels.pageShown, {
              from: safeRangeStart,
              to: rangeEnd,
              count: pagination.totalItems,
            })}
          </div>
          <AppPagination
            page={pagination.page}
            total={pagination.totalPages}
            onChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
}

export default PayablesList;
