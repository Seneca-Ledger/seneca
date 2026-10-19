'use client';

import { useMemo } from 'react';
import { LazyRoiLines } from '@/app/components/charts/lazy-charts';
import { useIntlayer, useLocale } from '@/app/i18n';
import { COMPACT_NOTATION_CEILING } from '@/app/lib/format-money';
import type { ProjectionPoint } from '../roi-model';

interface RoiProjectionChartProps {
  points: ProjectionPoint[];
  compoundLabel: string;
  simpleLabel: string;
}

export function RoiProjectionChart({
  points,
  compoundLabel,
  simpleLabel,
}: RoiProjectionChartProps) {
  const t = useIntlayer('roiPage');
  const { locale } = useLocale();
  const compactFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [locale],
  );
  const scientificFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'scientific', maximumFractionDigits: 1 }),
    [locale],
  );
  const formatValue = (value: number) =>
    Math.abs(value) >= COMPACT_NOTATION_CEILING
      ? scientificFormatter.format(value)
      : compactFormatter.format(value);

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
