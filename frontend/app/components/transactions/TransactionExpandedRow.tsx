'use client';

import { useIntlayer } from '@/app/i18n';
import type { Transaction } from './types';

interface TransactionExpandedRowProps {
  tx: Transaction;
  formatDate: (d: string) => string;
  columnBinLabel: string;
  columnDateLabel: string;
}

interface FieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

function ExpandedField({ label, value, mono }: FieldProps): React.ReactElement {
  return (
    <div className="seneca-tx-table__expanded-field">
      <label>{label}</label>
      <span
        style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, color: 'var(--foreground)' }}
      >
        {value}
      </span>
    </div>
  );
}

export function TransactionExpandedRow({
  tx,
  formatDate,
  columnBinLabel,
  columnDateLabel,
}: TransactionExpandedRowProps): React.ReactElement {
  const t = useIntlayer('transactionsTable');
  return (
    <tr className="seneca-tx-table__expanded-row">
      <td colSpan={2} />
      <td colSpan={7} style={{ padding: '12px 16px' }}>
        <div className="seneca-tx-table__expanded-content">
          <ExpandedField label={columnBinLabel} value={tx.counterpartyBin ?? '—'} mono />
          <ExpandedField label={t.columnCurrency.value} value={tx.currency ?? '—'} />
          <ExpandedField label={t.columnDocNumber.value} value={tx.documentNumber ?? '—'} />
          <ExpandedField label={columnDateLabel} value={formatDate(tx.transactionDate)} />
        </div>
      </td>
    </tr>
  );
}
