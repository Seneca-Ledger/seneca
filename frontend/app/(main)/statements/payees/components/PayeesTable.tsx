'use client';

import Link from 'next/link';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { type SkeletonColumn, SkeletonRows } from '@/app/components/ui/table-skeleton';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { PayeesOverview } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';

const formatDay = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(date),
  );

// The cells of a payee row while the list loads, column for column.
const LOADING_COLUMNS: SkeletonColumn[] = [
  { className: 'seneca-payees__col-icon', shape: 'circle', size: 28 },
  { shape: 'text', size: 160 },
  { shape: 'text', size: 110 },
  { className: 'seneca-all-tx__num', shape: 'text', size: 24 },
  { shape: 'text', size: 90 },
  { className: 'seneca-all-tx__num', shape: 'text', size: 80 },
];

/** One row per payee: its mark, name, usual category, how often, when last, how much. */
export function PayeesTable({
  rows,
  currency,
}: {
  /** Null while the list loads: the header stays, the rows are placeholders. */
  rows: PayeesOverview['rows'] | null;
  currency: string;
}): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const { locale } = useLocale();

  return (
    <div className="seneca-all-tx__table-wrap">
      <table className="seneca-all-tx__table">
        <thead>
          <tr>
            <th className="seneca-payees__col-icon" />
            <th>{t.columnPayee}</th>
            <th>{t.columnCategory}</th>
            <th className="seneca-all-tx__num">{t.columnCount}</th>
            <th className="seneca-all-tx__col-date">{t.columnLast}</th>
            <th className="seneca-all-tx__num">{t.columnAmount}</th>
          </tr>
        </thead>
        {rows === null ? (
          <SkeletonRows columns={LOADING_COLUMNS} rows={8} />
        ) : (
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td className="seneca-payees__col-icon">
                  <VendorIcon vendorName={row.name} size={28} />
                </td>
                <td data-label={t.columnPayee.value}>
                  <Link href={`/statements/payees/${row.id}`} className="seneca-all-tx__link">
                    {row.name}
                  </Link>
                </td>
                <td className="seneca-all-tx__muted" data-label={t.columnCategory.value}>
                  {row.category ? localizeStatementCategoryName(row.category.name, locale) : '—'}
                </td>
                <td className="seneca-all-tx__num" data-label={t.columnCount.value}>
                  {row.count}
                </td>
                <td className="seneca-all-tx__muted" data-label={t.columnLast.value}>
                  {row.lastSeen ? formatDay(row.lastSeen, locale) : '—'}
                </td>
                <td
                  className="seneca-all-tx__num seneca-all-tx__figure"
                  data-label={t.columnAmount.value}
                >
                  <PrivateAmount>{formatMoney(row.amount, currency, locale)}</PrivateAmount>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
