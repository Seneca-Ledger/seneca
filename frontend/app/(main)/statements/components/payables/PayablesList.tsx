'use client';

import { useTheme } from 'next-themes';
import React from 'react';
import { Edit3, MoreHorizontal } from '@/app/components/icons';
import { Badge } from '@/app/components/ui/badge';
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
import { useIsMobile } from '@/app/hooks/useIsMobile';
import type { Payable } from '@/app/lib/payables-api';
import { tokens } from '@/lib/theme-tokens';
import {
  formatMoney,
  formatPayableDate,
  getPayableStatusVariant,
  isPayableOverdue,
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

// eslint-disable-next-line max-params
const fillTemplate = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );

// eslint-disable-next-line max-lines-per-function, complexity
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
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

  if (items.length === 0) {
    return (
      <div className="lumio-payable-list__empty">
        <EmptyStateIllustration name={emptyIllustration} size="md" />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: c.ink900 }}>{emptyTitle}</h3>
        <p style={{ marginTop: 8, fontSize: 14, color: c.ink500 }}>{emptyDescription}</p>
      </div>
    );
  }

  const rangeStart =
    pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);
  const safeRangeStart = pagination.totalItems === 0 ? 0 : Math.min(rangeStart, rangeEnd);

  // eslint-disable-next-line max-lines-per-function
  const renderActions = (payable: Payable): React.JSX.Element => {
    const canMarkPaid = payable.status !== 'paid' && payable.status !== 'archived';

    return (
      <div className="lumio-payable-list__actions">
        {canMarkPaid ? (
          <Button
            size="sm"
            variant="soft"
            onClick={() => onMarkPaid(payable)}
            disabled={actionState?.markingPaidId === payable.id}
          >
            {labels.markPaid}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => onEdit(payable)}>
          <Edit3 size={16} />
          {labels.edit}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={labels.actions}>
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ minWidth: 180 }}>
            <DropdownMenuItem onClick={() => onArchive(payable)}>{labels.archive}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(payable)}>{labels.delete}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="lumio-payable-list">
      {isMobile ? (
        <div className="lumio-payable-list__mobile-rows">
          {items.map(payable => {
            const overdue = isPayableOverdue(payable);
            return (
              <div
                key={payable.id}
                data-attention={`payable:${payable.id}`}
                className="lumio-payable-list__mobile-row"
              >
                <div className="lumio-payable-list__mobile-row-top">
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: c.ink900 }}>
                      {payable.vendor}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14, color: c.ink500 }}>
                      {labels.dueDate}: {formatPayableDate(payable.dueDate, locale)}
                    </div>
                  </div>
                  <Badge variant={getPayableStatusVariant(payable.status, overdue)}>
                    {labels.statusLabels[overdue ? 'overdue' : payable.status] || payable.status}
                  </Badge>
                </div>
                <div className="lumio-payable-list__mobile-row-data">
                  <span style={{ color: c.ink500 }}>{labels.amount}</span>
                  <span style={{ fontWeight: 600, color: c.ink900 }}>
                    {formatMoney(payable.amount, payable.currency, locale)}
                    {toNumber(payable.paidAmount) > 0 && (
                      <span style={{ display: 'block', fontWeight: 400, color: c.ink500 }}>
                        {formatMoney(payable.paidAmount, payable.currency, locale)}{' '}
                        {labels.amountPaid}
                      </span>
                    )}
                  </span>
                </div>
                <div className="lumio-payable-list__mobile-row-data">
                  <span style={{ color: c.ink500 }}>{labels.source}</span>
                  <span style={{ fontWeight: 500, color: c.ink800 }}>
                    {labels.sourceLabels[payable.source] || payable.source}
                  </span>
                </div>
                {renderActions(payable)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lumio-payable-list__table-wrap">
          <table className="lumio-payable-list__table">
            <thead className="lumio-payable-list__thead">
              <tr>
                <th className="lumio-payable-list__th">{labels.vendor}</th>
                <th className="lumio-payable-list__th">{labels.dueDate}</th>
                <th className="lumio-payable-list__th">{labels.source}</th>
                <th className="lumio-payable-list__th">{labels.status}</th>
                <th className="lumio-payable-list__th lumio-payable-list__th--right">
                  {labels.amount}
                </th>
                <th className="lumio-payable-list__th lumio-payable-list__th--right">
                  {labels.actions}
                </th>
              </tr>
            </thead>
            <tbody className="lumio-payable-list__tbody">
              {items.map(payable => {
                const overdue = isPayableOverdue(payable);

                return (
                  <tr key={payable.id} data-attention={`payable:${payable.id}`}>
                    <td
                      className="lumio-payable-list__td"
                      style={{ fontWeight: 500, color: c.ink900 }}
                    >
                      {payable.vendor}
                    </td>
                    <td className="lumio-payable-list__td" style={{ color: c.ink700 }}>
                      {formatPayableDate(payable.dueDate, locale)}
                    </td>
                    <td className="lumio-payable-list__td" style={{ color: c.ink700 }}>
                      {labels.sourceLabels[payable.source] || payable.source}
                    </td>
                    <td className="lumio-payable-list__td">
                      <Badge variant={getPayableStatusVariant(payable.status, overdue)}>
                        {labels.statusLabels[overdue ? 'overdue' : payable.status] ||
                          payable.status}
                      </Badge>
                    </td>
                    <td
                      className="lumio-payable-list__td"
                      style={{ textAlign: 'right', fontWeight: 600, color: c.ink900 }}
                    >
                      {formatMoney(payable.amount, payable.currency, locale)}
                      {/* A bill nobody has fully paid is not the same as an unpaid one. */}
                      {toNumber(payable.paidAmount) > 0 && (
                        <div style={{ fontWeight: 400, fontSize: 13, color: c.ink500 }}>
                          {formatMoney(payable.paidAmount, payable.currency, locale)}{' '}
                          {labels.amountPaid}
                        </div>
                      )}
                    </td>
                    <td className="lumio-payable-list__td">{renderActions(payable)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="lumio-payable-list__pagination-row">
        <div style={{ fontSize: 14, color: c.ink500 }}>
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
    </div>
  );
}

export default PayablesList;
