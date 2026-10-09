'use client';

import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { Checkbox } from '../ui/checkbox';
import { CategoryDropdown } from './CategoryDropdown';
import type { TransactionRowFormatters, TransactionRowHandlers } from './TransactionRow';
import type { Category, Transaction } from './types';

interface TransactionMobileCardProps {
  tx: Transaction;
  isExpanded: boolean;
  isSelected: boolean;
  categories: Category[];
  handlers: TransactionRowHandlers;
  formatters: TransactionRowFormatters;
  uncategorizedLabel: string;
  columnBinLabel: string;
  columnDateLabel: string;
}

function buildCardClass({
  isSelected,
  hasErrors,
  hasWarnings,
}: {
  isSelected: boolean;
  hasErrors?: boolean;
  hasWarnings?: boolean;
}): string {
  if (isSelected) return 'lumio-tx-card lumio-tx-card--selected';
  if (hasErrors) return 'lumio-tx-card lumio-tx-card--error';
  if (hasWarnings) return 'lumio-tx-card lumio-tx-card--warning';
  return 'lumio-tx-card';
}

function MobileAmounts({
  tx,
  formatters,
}: {
  tx: Transaction;
  formatters: TransactionRowFormatters;
}): React.ReactElement {
  const debit = Number(tx.debit);
  const credit = Number(tx.credit);
  const fmtAmt = (n: number): string =>
    formatters.formatAmount(
      formatters.resolveDisplayAmount(tx, n),
      formatters.resolveDisplayCurrency(tx),
    );
  return (
    <div className="lumio-tx-card__amounts">
      {debit > 0 && (
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{fmtAmt(debit)}</p>
      )}
      {credit > 0 && (
        <p style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{fmtAmt(credit)}</p>
      )}
      {debit <= 0 && credit <= 0 && (
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>—</p>
      )}
    </div>
  );
}

function MobileExpandedDetails({
  tx,
  formatDate,
  columnBinLabel,
  columnDateLabel,
}: {
  tx: Transaction;
  formatDate: (d: string) => string;
  columnBinLabel: string;
  columnDateLabel: string;
}): React.ReactElement {
  const t = useIntlayer('transactionsTable');
  return (
    <div className="lumio-tx-card__expanded">
      <div>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: 4,
          }}
        >
          {columnBinLabel}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}>
          {tx.counterpartyBin ?? '—'}
        </span>
      </div>
      <div>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: 4,
          }}
        >
          {t.columnCurrency}
        </span>
        <span style={{ color: 'var(--foreground)' }}>{tx.currency ?? '—'}</span>
      </div>
      <div>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: 4,
          }}
        >
          {t.columnDocNumber}
        </span>
        <span style={{ color: 'var(--foreground)' }}>{tx.documentNumber ?? '—'}</span>
      </div>
      <div>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: 4,
          }}
        >
          {columnDateLabel}
        </span>
        <span style={{ color: 'var(--foreground)' }}>{formatDate(tx.transactionDate)}</span>
      </div>
    </div>
  );
}

export function TransactionMobileCard({
  tx,
  isExpanded,
  isSelected,
  categories,
  handlers,
  formatters,
  uncategorizedLabel,
  columnBinLabel,
  columnDateLabel,
}: TransactionMobileCardProps): React.ReactElement {
  const t = useIntlayer('transactionsTable');
  return (
    <div
      data-testid={`transaction-card-${tx.id}`}
      className={buildCardClass({
        isSelected,
        hasErrors: tx.hasErrors,
        hasWarnings: tx.hasWarnings,
      })}
    >
      <div className="lumio-tx-card__body">
        <div className="lumio-tx-card__checkbox">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handlers.onSelectRow(tx.id)}
            style={{ height: 20, width: 20 }}
            aria-label={t.selectTransaction.value.replace('{name}', tx.counterpartyName)}
          />
        </div>
        <div className="lumio-tx-card__content">
          <button
            type="button"
            onClick={() => handlers.onRowClick(tx)}
            className="lumio-tx-card__clickable"
          >
            <div className="lumio-tx-card__header">
              <div className="lumio-tx-card__name">
                <p>
                  {tx.counterpartyName}
                  {tx.isVerified === false ? (
                    <span
                      data-testid="unconfirmed-badge"
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-warning-soft-text)',
                      }}
                    >
                      {t.unconfirmedBadge}
                    </span>
                  ) : null}
                </p>
                <p>{formatters.formatDate(tx.transactionDate)}</p>
              </div>
              <MobileAmounts tx={tx} formatters={formatters} />
            </div>
            <p className="lumio-tx-card__purpose">{tx.paymentPurpose || '—'}</p>
          </button>
          <div className="lumio-tx-card__footer">
            <div style={{ minWidth: 0 }}>
              <CategoryDropdown
                tx={tx}
                categories={categories}
                label={uncategorizedLabel}
                align="start"
                onUpdateCategory={handlers.onUpdateCategory}
              />
            </div>
            <button
              type="button"
              onClick={handlers.onToggleExpansion(tx.id)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? t.collapseRow.value : t.expandRow.value}
              className="lumio-tx-card__expand-btn"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {isExpanded && (
            <MobileExpandedDetails
              tx={tx}
              formatDate={formatters.formatDate}
              columnBinLabel={columnBinLabel}
              columnDateLabel={columnDateLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
