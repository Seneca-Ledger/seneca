'use client';

import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import clsx from 'clsx';
import type React from 'react';
import { useMemo } from 'react';
import { parseDateOnly, resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { useCategoryName } from '@/app/lib/use-category-name';
import { CategoryIconBadge } from './CategoryIconBadge';
import { useIsWideSection } from './section-span';
import { CardEmpty, CardLink, DashboardCard, ListRow } from './ui';

/** What a half-width card lists; with the row to itself it lists all the API sends. */
const NARROW_LIMIT = 6;

interface RecentTransactionsCardProps {
  transactions: DashboardData['recentTransactions'];
  formatAmount: (value: number) => string;
  viewAllHref: string;
}

export function RecentTransactionsCard({
  transactions,
  formatAmount,
  viewAllHref,
}: RecentTransactionsCardProps): React.JSX.Element {
  const t = useIntlayer('recentTransactionsCard');
  const { locale } = useLocale();
  const wide = useIsWideSection();
  const categoryName = useCategoryName();
  const shown = wide ? transactions : transactions.slice(0, NARROW_LIMIT);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(resolveLocale(locale), { day: 'numeric', month: 'short' }),
    [locale],
  );

  return (
    <DashboardCard title={t.title} action={<CardLink href={viewAllHref}>{t.viewAll}</CardLink>}>
      {transactions.length === 0 ? (
        <CardEmpty icon={ReceiptLongOutlined}>{t.empty}</CardEmpty>
      ) : (
        <div className="seneca-dashboard__list">
          {shown.map(tx => {
            const isPositive = tx.amount >= 0;
            const categoryLabel = tx.categoryName
              ? categoryName(tx.categoryName)
              : t.uncategorized.value;
            return (
              <ListRow
                key={tx.id}
                href={tx.href ?? undefined}
                leading={
                  <div title={categoryLabel}>
                    <CategoryIconBadge
                      name={tx.categoryName}
                      color={tx.categoryColor}
                      icon={tx.categoryIcon}
                      size={36}
                    />
                  </div>
                }
                primary={tx.description}
                secondary={
                  wide
                    ? dateFormatter.format(parseDateOnly(tx.date))
                    : `${dateFormatter.format(parseDateOnly(tx.date))} · ${tx.account}`
                }
                trailing={
                  <>
                    {/* With room, category and account get columns of their own. */}
                    {wide && (
                      <>
                        <span className="seneca-dashboard__recent-col">{categoryLabel}</span>
                        <span className="seneca-dashboard__recent-col">{tx.account}</span>
                      </>
                    )}
                    <span
                      className={clsx(
                        'seneca-dashboard__recent-amount',
                        isPositive && 'seneca-dashboard__amount--positive',
                        PRIVATE_CLASS,
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {formatAmount(tx.amount)}
                    </span>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
