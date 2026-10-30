'use client';

import Skeleton from '@mui/material/Skeleton';
import clsx from 'clsx';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { TransactionsOverview } from '@/app/lib/contracts';

/** A card per month, newest first, with how many rows it holds; a click opens it. */
const LOADING_MONTHS = 6;

export function MonthsColumn({
  loading = false,
  months,
  selected,
  onSelect,
}: {
  /** While the months load, their cards are drawn empty. */
  loading?: boolean;
  months: TransactionsOverview['months'];
  /** `YYYY-MM` on screen, or null when the page shows everything. */
  selected: string | null;
  onSelect: (month: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsPage');
  const { locale } = useLocale();
  const title = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (loading && months.length === 0) {
    return (
      <nav className="seneca-all-tx__months" aria-label={t.months.value} aria-busy="true">
        {Array.from({ length: LOADING_MONTHS }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cards have no identity
          <div key={index} className="seneca-all-tx__card seneca-all-tx__month">
            <span className="seneca-all-tx__month-title">
              <Skeleton variant="text" width={110} />
            </span>
            <span className="seneca-all-tx__month-row">
              <span>{t.transactions}</span>
              <Skeleton variant="text" width={16} />
            </span>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="seneca-all-tx__months" aria-label={t.months.value}>
      {months.map(({ month, count }) => {
        const [year, index] = month.split('-').map(Number);
        const active = month === selected;
        return (
          <button
            key={month}
            type="button"
            className={clsx('seneca-all-tx__card seneca-all-tx__month', active && 'is-active')}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(month)}
          >
            <span className="seneca-all-tx__month-title">
              {title.format(new Date(Date.UTC(year, index - 1, 1)))}
            </span>
            <span className="seneca-all-tx__month-row">
              <span>{t.transactions}</span>
              <span className="seneca-all-tx__figure">{count}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
