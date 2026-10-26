'use client';

import { LazyRoiLines } from '@/app/components/charts/lazy-charts';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { ProjectionPoint } from '../roi-model';

interface RoiProjectionChartProps {
  points: ProjectionPoint[];
  compoundLabel: string;
  simpleLabel: string;
  currency: string;
}

export function RoiProjectionChart({
  points,
  compoundLabel,
  simpleLabel,
  currency,
}: RoiProjectionChartProps) {
  const t = useIntlayer('roiPage');
  const { locale } = useLocale();
  // The same compact money as the table below: symbol first, one way everywhere.
  const formatValue = (value: number) =>
    formatMoney(value, currency, locale, { notation: 'compact' });

  return (
    <div className="seneca-chart__box">
      <LazyRoiLines
        points={points}
        labels={{ compound: compoundLabel, simple: simpleLabel, year: t.yearColumn.value }}
        formatValue={formatValue}
      />
    </div>
  );
}
