'use client';

import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined';
import clsx from 'clsx';
import { useMemo } from 'react';
import type { DonutSlice } from '@/app/components/charts/CategoryDonut';
import { categoryTones } from '@/app/components/charts/chart-theme';
import { LazyCategoryDonut } from '@/app/components/charts/lazy-charts';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer } from '@/app/i18n';
import { categoryReportHref } from '@/app/lib/category-report-href';
import { CategoryIconBadge } from './CategoryIconBadge';
import { useIsWideSection } from './section-span';
import { CardEmpty, ListRow } from './ui';

type TopCategory = NonNullable<DashboardData['topCategories']>[number];

interface TopCategoriesCardProps {
  categories: NonNullable<DashboardData['topCategories']>;
  formatAmount: (value: number) => string;
  /** `YYYY-MM` the card shows, so the report opens on the same month. */
  month?: string;
}

function categoryDisplayName(
  cat: TopCategory,
  labels: { uncategorized: string; other: string },
): string {
  if (cat.isOther) {
    return labels.other;
  }
  return cat.name ?? labels.uncategorized;
}

function categoryKey(cat: TopCategory): string {
  if (cat.isOther) {
    return '__other__';
  }
  return cat.id ?? '__uncategorized__';
}

/**
 * A named category opens its row in the report on the card's month; "uncategorized"
 * and the "other" rollup have no row of their own to ring there.
 */
function categoryHref(cat: TopCategory, month: string | undefined): string | undefined {
  return cat.name && !cat.isOther ? categoryReportHref(cat.name, month) : undefined;
}

export function TopCategoriesCard({ categories, formatAmount, month }: TopCategoriesCardProps) {
  const t = useIntlayer('topCategoriesCard');
  const wideText = useIntlayer('dashboardWideView');
  // With the row to itself the list can say how each total came about.
  const wide = useIsWideSection();
  const labels = useMemo(
    () => ({ uncategorized: t.uncategorized.value, other: t.other.value }),
    [t.uncategorized, t.other],
  );

  const slices = useMemo<DonutSlice[]>(() => {
    // Tones follow the category, not this month's rank (see categoryTones).
    const tones = categoryTones(
      // By name, as on the Trends tab, so a category has one colour on both.
      categories.map(cat => ({ key: cat.name ?? '__uncategorized__', isOther: cat.isOther })),
    );
    return categories.map((cat, index) => ({
      key: categoryKey(cat),
      name: categoryDisplayName(cat, labels),
      value: cat.amount,
      color: tones[index],
      href: categoryHref(cat, month),
    }));
  }, [categories, labels, month]);

  if (!categories.length) {
    return <CardEmpty icon={DonutLargeOutlined}>{t.noCategoryData}</CardEmpty>;
  }

  return (
    <div className="lumio-dashboard__categories">
      <div className="lumio-dashboard__donut">
        <LazyCategoryDonut slices={slices} formatAmount={formatAmount} />
      </div>
      <div className={clsx('lumio-dashboard__list', wide && 'lumio-dashboard__list--columns')}>
        {categories.map((cat, rank) => (
          <ListRow
            key={categoryKey(cat)}
            href={categoryHref(cat, month)}
            leading={
              <CategoryIconBadge
                name={cat.name}
                color={cat.color}
                icon={cat.icon}
                isOther={cat.isOther}
                size={32}
              />
            }
            primary={
              <>
                <span
                  className="lumio-dashboard__legend-dot"
                  style={{ background: slices[rank].color }}
                  aria-hidden="true"
                />
                {categoryDisplayName(cat, labels)}
              </>
            }
            secondary={
              wide && cat.count > 0
                ? `${wideText.operations.value}: ${cat.count} · ${wideText.averageOperation.value}: ${formatAmount(cat.amount / cat.count)}`
                : undefined
            }
            trailing={
              <>
                <span className="lumio-dashboard__muted">{cat.percent}%</span>
                <span>{formatAmount(cat.amount)}</span>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}
