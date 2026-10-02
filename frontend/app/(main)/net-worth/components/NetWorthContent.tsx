'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { ArrowDownRight, ArrowUpRight } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import {
  NET_WORTH_RANGES,
  type NetWorthAssetLine,
  type NetWorthRange,
  type NetWorthView,
  useNetWorth,
} from '../hooks/useNetWorth';
import { setNetWorthDisplay, useNetWorthDisplay } from '../net-worth-display';
import { AccountFilter } from './AccountFilter';
import { AllocationCard } from './AllocationCard';
import { CustomRange } from './CustomRange';
import { ASSET_CLASS_KEYS, InvestmentsCard } from './InvestmentsCard';
import { NetWorthChart } from './NetWorthChart';
import { RiskCard } from './RiskCard';

function NetWorthSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: tokens.radius.md,
          bgcolor: 'background.paper',
          p: 3,
        }}
      >
        <Skeleton variant="text" width={220} height={44} />
        <Skeleton variant="text" width={160} height={20} sx={{ mt: 1 }} />
        <Skeleton variant="rounded" height={220} sx={{ mt: 2, borderRadius: tokens.radius.md }} />
        <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
          <Box>
            <Skeleton variant="text" width={60} height={16} />
            <Skeleton variant="text" width={100} height={22} />
          </Box>
          <Box>
            <Skeleton variant="text" width={80} height={16} />
            <Skeleton variant="text" width={100} height={22} />
          </Box>
        </Box>
      </Box>
      <Skeleton variant="rounded" height={140} sx={{ borderRadius: tokens.radius.md }} />
      <Skeleton variant="rounded" height={200} sx={{ borderRadius: tokens.radius.md }} />
    </Box>
  );
}

type RangeControlsProps = {
  range: NetWorthRange;
  custom: ReturnType<typeof useNetWorth>['custom'];
  view: NetWorthView;
  data: { from: string; to: string } | undefined;
  setRange: (range: NetWorthRange) => void;
  setCustom: ReturnType<typeof useNetWorth>['setCustom'];
  setView: (view: NetWorthView) => void;
  lines: NetWorthAssetLine[];
  excluded: string[];
  setExcluded: (ids: string[]) => void;
  t: ReturnType<typeof useIntlayer<'netWorthPage'>>;
};

/** Which window, and which shape of it. */
function RangeControls({
  range,
  custom,
  view,
  data,
  setRange,
  setCustom,
  setView,
  lines,
  excluded,
  setExcluded,
  t,
}: RangeControlsProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-end' }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={custom ? null : range}
          onChange={(_event, next: NetWorthRange | null) => next && setRange(next)}
          aria-label={t.title.value}
        >
          {NET_WORTH_RANGES.map(option => (
            <ToggleButton key={option} value={option} sx={{ px: 1.5, textTransform: 'none' }}>
              {option === 'all' ? t.rangeAll : option.toUpperCase().replace('180D', '6M')}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <AccountFilter
          lines={lines}
          excluded={excluded}
          onChange={setExcluded}
          labels={{ accounts: t.accountsFilter.value, showAll: t.accountsShowAll.value }}
        />

        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_event, next: NetWorthView | null) => next && setView(next)}
        >
          <ToggleButton value="performance" sx={{ px: 1.5, textTransform: 'none' }}>
            {t.viewPerformance}
          </ToggleButton>
          <ToggleButton value="breakdown" sx={{ px: 1.5, textTransform: 'none' }}>
            {t.viewBreakdown}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <CustomRange
        value={custom}
        fallback={data ? { from: data.from, to: data.to } : null}
        onChange={setCustom}
        labels={{
          custom: t.rangeCustom.value,
          from: t.rangeFrom.value,
          to: t.rangeTo.value,
        }}
      />
    </Box>
  );
}

export function NetWorthContent() {
  const t = useIntlayer('netWorthPage');
  useAttentionFocus();
  const { locale } = useLocale();
  const display = useNetWorthDisplay();
  const {
    data,
    isPending,
    isFetching,
    error,
    range,
    custom,
    view,
    excluded,
    setRange,
    setCustom,
    setView,
    setExcluded,
    classify,
  } = useNetWorth();

  const currency = data?.currency ?? 'KZT';
  const isPositive = (data?.change ?? 0) >= 0;
  const hasData = Boolean(data && (data.assetsTotal !== 0 || data.liabilitiesTotal !== 0));

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 3, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t.subtitle}
          </Typography>
        </Box>

        <RangeControls
          range={range}
          custom={custom}
          view={view}
          data={data}
          setRange={setRange}
          setCustom={setCustom}
          setView={setView}
          lines={data?.assetLines ?? []}
          excluded={excluded}
          setExcluded={setExcluded}
          t={t}
        />
      </Box>

      {isPending && <NetWorthSkeleton />}

      {error && (
        <Typography color="error" sx={{ py: 2, textAlign: 'center' }}>
          {t.error}
        </Typography>
      )}

      {data && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            // Фоновое обновление не гасит карточки скелетоном — только приглушает.
            opacity: isFetching ? 0.6 : 1,
            transition: 'opacity 150ms ease',
          }}
        >
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 3,
            }}
          >
            <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.1 }}>
              {formatMoney(data.current, currency, locale)}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
              {isPositive ? (
                <ArrowUpRight size={18} color={tokens.color.success} />
              ) : (
                <ArrowDownRight size={18} color={tokens.color.danger} />
              )}
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: isPositive ? 'success.main' : 'error.main' }}
              >
                {isPositive ? '+' : '−'}
                {formatMoney(Math.abs(data.change), currency, locale)}
                {data.changePercent !== null &&
                  ` (${isPositive ? '+' : '−'}${Math.abs(data.changePercent)}%)`}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t.overPeriod}
              </Typography>
            </Box>
            {display.allTimeHigh && data.allTimeHigh && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {t.allTimeHigh.value
                  .replace('{{value}}', formatMoney(data.allTimeHigh.value, currency, locale))
                  .replace('{{date}}', data.allTimeHigh.date)}
              </Typography>
            )}

            {data.missingRates && data.missingRates.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {`${t.missingRates.value}: ${data.missingRates.join(', ')}`}
              </Alert>
            )}

            {hasData ? (
              <Box sx={{ mt: 2 }}>
                <NetWorthChart
                  points={data.series}
                  positive={isPositive}
                  view={view}
                  zeroBaseline={display.zeroBaseline}
                  formatValue={value => formatMoney(value, currency, locale)}
                  labels={{
                    assets: t.assets.value,
                    liabilities: t.liabilities.value,
                    net: t.title.value,
                  }}
                />
              </Box>
            ) : (
              <EmptyState illustration="reports" description={t.empty} compact />
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                variant={display.zeroBaseline ? 'filled' : 'outlined'}
                label={t.axisFromZero.value}
                onClick={() => setNetWorthDisplay({ zeroBaseline: !display.zeroBaseline })}
              />
              <Chip
                size="small"
                variant={display.allTimeHigh ? 'filled' : 'outlined'}
                label={t.showAllTimeHigh.value}
                onClick={() => setNetWorthDisplay({ allTimeHigh: !display.allTimeHigh })}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.assets}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatMoney(data.assetsTotal, currency, locale)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.liabilities}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatMoney(data.liabilitiesTotal, currency, locale)}
                </Typography>
              </Box>
            </Box>
          </Box>

          <AllocationCard
            title={t.allocation.value}
            items={data.breakdown}
            currency={currency}
            locale={locale}
          />

          <AllocationCard
            title={t.assetClasses.value}
            items={(data.byAssetClass ?? []).map(item => ({
              code: item.key ?? 'other',
              name: t[
                ASSET_CLASS_KEYS[
                  (item.key ?? 'other') as keyof typeof ASSET_CLASS_KEYS
                ] as 'classOther'
              ].value,
              amount: item.amount,
              percent: item.percent,
            }))}
            currency={currency}
            locale={locale}
          />

          <InvestmentsCard currency={currency} locale={locale} />

          <RiskCard
            byRisk={data.byRisk}
            byRole={data.byRole}
            riskyPercent={data.riskyPercent}
            lines={data.assetLines}
            currency={currency}
            locale={locale}
            labels={{
              title: t.riskTitle.value,
              riskyShare: t.riskyShare.value,
              riskyHint: t.riskyHint.value,
              unclassified: t.unclassified.value,
              riskColumn: t.riskColumn.value,
              roleColumn: t.roleColumn.value,
              risk: {
                low: t.riskLow.value,
                medium: t.riskMedium.value,
                high: t.riskHigh.value,
              },
              role: {
                income: t.roleIncome.value,
                neutral: t.roleNeutral.value,
                drain: t.roleDrain.value,
              },
            }}
            onClassify={classify}
          />
        </Box>
      )}
    </Box>
  );
}
