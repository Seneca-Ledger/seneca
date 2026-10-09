'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Link from 'next/link';
import { LazyReturnsArea } from '@/app/components/charts/lazy-charts';
import { DashboardCard, KpiCard } from '@/app/components/dashboard/ui';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { RETURNS_RANGES, type ReturnsRange } from '../helpers/roi-url-state';
import { type ReturnsData, type ReturnsSource, useReturns } from '../hooks/useReturns';
import {
  excludesCrypto,
  formatSignedPercent,
  hasNothingToShow,
  rangeLabel,
} from '../returns-display';
import { ReturnsFlags } from './ReturnsFlags';
import { SourcesTable } from './SourcesTable';

/** An annual rate is only stated for a window that is at least a year long. */
const YEAR_DAYS = 365;

interface PerformanceTabProps {
  range: ReturnsRange;
  onRangeChange: (range: ReturnsRange) => void;
}

/** What the investments made over a window, against what was put into them. */
export function PerformanceTab({ range, onRangeChange }: PerformanceTabProps) {
  const t = useIntlayer('roiPage');
  const { data, isPending, isError } = useReturns(range);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_event, next: ReturnsRange | null) => next && onRangeChange(next)}
          aria-label={t.rangeLabel.value}
        >
          {RETURNS_RANGES.map(option => (
            <ToggleButton key={option} value={option} sx={{ px: 1.5, textTransform: 'none' }}>
              {rangeLabel(option, t.rangeAll.value)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {isError && <Alert severity="error">{t.loadError}</Alert>}
      {isPending && <Skeleton variant="rounded" height={320} />}
      {data && <PerformanceBody data={data} />}
    </Box>
  );
}

function PerformanceBody({ data }: { data: ReturnsData }) {
  const t = useIntlayer('roiPage');
  const { locale } = useLocale();
  const money = (value: number): string => formatMoney(value, data.currency, locale);
  const sourceName = (source: ReturnsSource): string =>
    source.kind === 'metals'
      ? t.metalsName.value
      : source.kind === 'crypto'
        ? t.cryptoName.value
        : source.name;

  if (hasNothingToShow(data)) {
    return (
      <EmptyState
        illustration="net-worth"
        description={t.empty}
        action={
          <Button component={Link} href="/net-worth" variant="outlined" size="small">
            {t.openNetWorth}
          </Button>
        }
      />
    );
  }

  const { summary } = data;
  const positive = summary.gain >= 0;
  const annual =
    data.days >= YEAR_DAYS && summary.annualizedPercent !== null
      ? t.annualizedCaption.value.replace(
          '{{rate}}',
          formatSignedPercent(summary.annualizedPercent, locale),
        )
      : null;

  return (
    <>
      <div className="lumio-dashboard__stat-grid" data-testid="returns-kpis">
        <KpiCard
          label={t.netInvested.value}
          value={money(summary.netInvested)}
          // All time, unlike the period columns below: what is in the account now.
          caption={`${t.netInvestedCaption.value} · ${t.allTime.value}`}
        />
        <KpiCard
          label={t.valueNow.value}
          value={money(summary.endValue)}
          caption={excludesCrypto(data) ? t.cryptoExcludedCaption : undefined}
        />
        <KpiCard
          label={t.gainPeriod.value}
          value={money(summary.gain)}
          tone={positive ? 'positive' : 'negative'}
          caption={
            summary.income > 0
              ? t.gainIncomeCaption.value.replace('{{income}}', money(summary.income))
              : undefined
          }
        />
        <KpiCard
          label={t.returnLabel.value}
          value={formatSignedPercent(summary.returnPercent, locale)}
          tone={summary.returnPercent === null ? 'neutral' : positive ? 'positive' : 'negative'}
          caption={annual ? `${t.methodCaption.value} · ${annual}` : t.methodCaption}
        />
      </div>

      <DashboardCard title={t.chartTitle}>
        <div className="lumio-chart__box" data-testid="returns-chart">
          <LazyReturnsArea
            points={data.series}
            positive={positive}
            locale={locale}
            formatValue={money}
            labels={{
              value: t.chartValue.value,
              netContributed: t.netInvested.value,
              gain: t.colGain.value,
            }}
          />
        </div>
      </DashboardCard>

      <ReturnsFlags flags={data.flags} sources={data.sources} sourceName={sourceName} />

      <DashboardCard title={t.sourcesTitle}>
        <SourcesTable sources={data.sources} formatMoney={money} sourceName={sourceName} />
      </DashboardCard>
    </>
  );
}
