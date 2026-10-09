'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { Checkbox } from '../ui/checkbox';
import { CategoryDropdown } from './CategoryDropdown';
import { TransactionExpandedRow } from './TransactionExpandedRow';
import type {
  SortState,
  Transaction,
  TransactionRowFormatters,
  TransactionRowHandlers,
} from './types';

export type { TransactionRowFormatters, TransactionRowHandlers };

interface TransactionRowProps {
  tx: Transaction;
  isExpanded: boolean;
  isSelected: boolean;
  categories: import('./types').Category[];
  handlers: TransactionRowHandlers;
  formatters: TransactionRowFormatters;
  categoryLabel: string;
  uncategorizedLabel: string;
  columnBinLabel: string;
  columnDateLabel: string;
}

interface SortIconProps {
  sort: SortState;
  field: SortState['by'];
}

export function SortIcon({ sort, field }: SortIconProps): React.ReactElement {
  if (sort.by !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
  return sort.order === 'asc' ? (
    <ChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
  ) : (
    <ChevronDown size={12} />
  );
}

interface AmountCellProps {
  amount: number;
  tx: Transaction;
  formatters: TransactionRowFormatters;
  color: string;
}

function AmountCell({ amount, tx, formatters, color }: AmountCellProps): React.ReactElement {
  if (amount <= 0) return <span style={{ color: 'var(--muted-foreground)' }}>—</span>;
  return (
    <span style={{ fontWeight: 700, color }}>
      {formatters.formatAmount(
        formatters.resolveDisplayAmount(tx, amount),
        formatters.resolveDisplayCurrency(tx),
      )}
    </span>
  );
}

function buildRowClass({
  isSelected,
  hasErrors,
  hasWarnings,
}: {
  isSelected: boolean;
  hasErrors?: boolean;
  hasWarnings?: boolean;
}): string {
  let cls = 'lumio-tx-table__row';
  if (isSelected) cls += ' lumio-tx-table__row--selected';
  else if (hasErrors) cls += ' lumio-tx-table__row--error';
  else if (hasWarnings) cls += ' lumio-tx-table__row--warning';
  return cls;
}

export function TransactionRow({
  tx,
  isExpanded,
  isSelected,
  categories,
  handlers,
  formatters,
  categoryLabel,
  columnBinLabel,
  columnDateLabel,
}: TransactionRowProps): React.ReactElement {
  const t = useIntlayer('transactionsTable');
  const rowCls = buildRowClass({
    isSelected,
    hasErrors: tx.hasErrors,
    hasWarnings: tx.hasWarnings,
  });
  const handleKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlers.onRowClick(tx);
    }
  };
  return (
    <React.Fragment>
      <tr
        onClick={() => handlers.onRowClick(tx)}
        onKeyDown={handleKey}
        tabIndex={0}
        aria-label={t.transactionFrom.value.replace('{name}', tx.counterpartyName)}
        className={rowCls}
      >
        <td className="lumio-tx-table__td--center">
          <button
            type="button"
            className="lumio-tx-table__expand-btn"
            onClick={handlers.onToggleExpansion(tx.id)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t.collapseRow.value : t.expandRow.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="lumio-tx-table__td" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={handlers.onSelectRow(tx.id)}
            style={{ height: 20, width: 20 }}
          />
        </td>
        <td
          className="lumio-tx-table__td--nowrap"
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatters.formatDate(tx.transactionDate)}
        </td>
        <td
          className="lumio-tx-table__td"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}
        >
          <div style={{ maxWidth: 200 }} title={tx.counterpartyName}>
            {tx.counterpartyName}
            {tx.splitGroupId && (
              <span
                style={{
                  marginLeft: 8,
                  border: '1px solid var(--border-color)',
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--muted-foreground)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.splitBadge}
              </span>
            )}
            {tx.transferPairId && (
              <span
                style={{
                  marginLeft: 8,
                  border: '1px solid var(--border-color)',
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--muted-foreground)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tx.transferPairKind === 'reimbursement' ? t.reimbursementBadge : t.transferBadge}
              </span>
            )}
            {tx.isVerified === false && (
              <span
                data-testid="unconfirmed-badge"
                style={{
                  marginLeft: 8,
                  border: '1px solid var(--color-warning-soft-border)',
                  background: 'var(--color-warning-soft-bg)',
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-warning-soft-text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.unconfirmedBadge}
              </span>
            )}
          </div>
        </td>
        <td
          className="lumio-tx-table__td"
          style={{ fontSize: 14, color: 'var(--muted-foreground)' }}
        >
          <div
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              maxWidth: 300,
            }}
            title={tx.paymentPurpose}
          >
            {tx.paymentPurpose || '—'}
          </div>
        </td>
        <td className="lumio-tx-table__td--nowrap-right" style={{ fontSize: 14 }}>
          <AmountCell
            amount={Number(tx.debit)}
            tx={tx}
            formatters={formatters}
            color="var(--foreground)"
          />
        </td>
        <td className="lumio-tx-table__td--nowrap-right" style={{ fontSize: 14 }}>
          <AmountCell amount={Number(tx.credit)} tx={tx} formatters={formatters} color="#16a34a" />
        </td>
        <td className="lumio-tx-table__td" onClick={e => e.stopPropagation()}>
          <CategoryDropdown
            tx={tx}
            categories={categories}
            label={categoryLabel}
            align="end"
            onUpdateCategory={handlers.onUpdateCategory}
          />
        </td>
      </tr>
      {isExpanded && (
        <TransactionExpandedRow
          tx={tx}
          formatDate={formatters.formatDate}
          columnBinLabel={columnBinLabel}
          columnDateLabel={columnDateLabel}
        />
      )}
    </React.Fragment>
  );
}
