'use client';

import Skeleton from '@mui/material/Skeleton';
import { useMemo } from 'react';
import type { DonutSlice } from '@/app/components/charts/CategoryDonut';
import { categoryTones } from '@/app/components/charts/chart-theme';
import { LazyCategoryDonut } from '@/app/components/charts/lazy-charts';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { TransactionsOverview } from '@/app/lib/contracts';
import { useCategoryName } from '@/app/lib/use-category-name';
import {
  NO_ACCOUNT_SLICE,
  type OverviewSlice,
  rollUpSlices,
  UNCATEGORIZED_SLICE,
} from '../all-transactions';

// The donut's ring (outer 90%, inner 56% of its 220px box), cut out of a disc.
const DONUT_RING_SX = { mask: 'radial-gradient(circle, transparent 61px, black 62px)' };

type Labels = { uncategorized: string; noAccount: string; other: string };

function PieCard({
  loading,
  title,
  slices,
  formatAmount,
  emptyLabel,
}: {
  loading: boolean;
  title: string;
  slices: DonutSlice[];
  formatAmount: (value: number) => string;
  emptyLabel: string;
}): React.JSX.Element {
  return (
    <section className="seneca-all-tx__card seneca-all-tx__pie" aria-label={title}>
      <h2 className="seneca-all-tx__card-title">{title}</h2>
      <div className="seneca-all-tx__pie-body">
        {loading ? (
          <div className="seneca-all-tx__donut seneca-all-tx__donut--loading" aria-hidden="true">
            <Skeleton variant="circular" width={198} height={198} sx={DONUT_RING_SX} />
          </div>
        ) : slices.length === 0 ? (
          <p className="seneca-all-tx__muted">{emptyLabel}</p>
        ) : (
          <>
            <div className="seneca-all-tx__donut">
              <LazyCategoryDonut slices={slices} formatAmount={formatAmount} />
            </div>
            {/* The pie has no labels; its figures are here for screen readers. */}
            <ul className="u-visually-hidden">
              {slices.map(slice => (
                <li key={slice.key} className={PRIVATE_CLASS}>
                  {slice.name}: {formatAmount(slice.value)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function toDonut(
  slices: readonly OverviewSlice[],
  nameOf: (slice: OverviewSlice) => string,
  other: string,
): DonutSlice[] {
  const rolled = rollUpSlices(slices);
  // Tones follow the slice, not its rank this month (see categoryTones).
  const tones = categoryTones(rolled.map(slice => ({ key: slice.key, isOther: slice.isOther })));
  return rolled.map((slice, index) => ({
    key: slice.key,
    name: slice.isOther ? other : nameOf(slice),
    value: slice.value,
    color: tones[index],
  }));
}

/** Categories, source accounts and destination accounts of the period, side by side. */
export function OverviewPies({
  loading = false,
  overview,
  formatAmount,
}: {
  /** Each card draws an empty ring while the figures load. */
  loading?: boolean;
  overview: TransactionsOverview | undefined;
  formatAmount: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsPage');
  const categoryName = useCategoryName();
  const labels: Labels = {
    uncategorized: t.uncategorized.value,
    noAccount: t.noAccount.value,
    other: t.other.value,
  };

  const pies = useMemo(() => {
    const category = (slice: OverviewSlice) =>
      slice.key === UNCATEGORIZED_SLICE || !slice.name
        ? labels.uncategorized
        : categoryName(slice.name);
    const account = (slice: OverviewSlice) =>
      slice.key === NO_ACCOUNT_SLICE || !slice.name ? labels.noAccount : slice.name;
    return {
      categories: toDonut(overview?.categories ?? [], category, labels.other),
      sources: toDonut(overview?.sources ?? [], account, labels.other),
      destinations: toDonut(overview?.destinations ?? [], account, labels.other),
    };
  }, [overview, categoryName, labels.uncategorized, labels.noAccount, labels.other]);

  return (
    <div className="seneca-all-tx__pies">
      <PieCard
        loading={loading}
        title={t.categories.value}
        slices={pies.categories}
        formatAmount={formatAmount}
        emptyLabel={t.noData.value}
      />
      <PieCard
        loading={loading}
        title={t.sourceAccounts.value}
        slices={pies.sources}
        formatAmount={formatAmount}
        emptyLabel={t.noData.value}
      />
      <PieCard
        loading={loading}
        title={t.destinationAccounts.value}
        slices={pies.destinations}
        formatAmount={formatAmount}
        emptyLabel={t.noData.value}
      />
    </div>
  );
}
