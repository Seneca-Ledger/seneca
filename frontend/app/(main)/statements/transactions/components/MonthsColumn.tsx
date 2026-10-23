'use client';

import clsx from 'clsx';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { TransactionsOverview } from '@/app/lib/contracts';

/** A card per month, newest first, with how many rows it holds; a click opens it. */
export function MonthsColumn({
  months,
  selected,
  onSelect,
}: {
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
