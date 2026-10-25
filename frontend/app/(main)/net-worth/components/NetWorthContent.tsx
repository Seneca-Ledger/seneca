'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { LoadError } from '@/app/components/ui/load-error';
import { joinSummary, PageTitle } from '@/app/components/ui/page-title';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { NET_WORTH_RANGES, type NetWorthRange, useNetWorth } from '../hooks/useNetWorth';
import { AllocationCard } from './AllocationCard';
import { ASSET_CLASS_KEYS, InvestmentsCard } from './InvestmentsCard';
import { MetalsCard } from './MetalsCard';
import { NetWorthChart } from './NetWorthChart';
import { CardTitle, cardSx, WholeMoney } from './net-worth-ui';
import { RiskCard } from './RiskCard';

/** One folded part of Holdings: the editing lives here, out of the way of the figures. */
function HoldingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          py: 1.75,
          border: 0,
          background: 'none',
          font: 'inherit',
          fontSize: 14,
          color: 'text.primary',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {title}
        <ChevronDown
          size={16}
          aria-hidden
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </Box>
      {open && <Box sx={{ pb: 2.5 }}>{children}</Box>}
    </Box>
  );
}

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

export function NetWorthContent() {
  const t = useIntlayer('netWorthPage');
  useAttentionFocus();
  const { locale } = useLocale();
  const {
    data,
    isPending,
    isFetching,
    error,
    range,
    setRange,
    denominate,
    setDenominate,
    classify,
  } = useNetWorth();

  const currency = data?.currency ?? FALLBACK_CURRENCY;
  // Measured in metal, the figures are ounces; the money ones stay untouched
  // underneath, so the toggle changes the unit and nothing else.
  const inMetal = denominate ? (data?.denominated ?? null) : null;
  const formatOunces = (value: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ozt`;
  const show = (value: number) =>
    inMetal ? formatOunces(value) : formatMoney(value, currency, locale);
  // The chart's value lines: whole units, short enough for the axis.
  const tick = (value: number) =>
    inMetal ? formatOunces(value) : formatMoney(value, currency, locale, { notation: 'compact' });
  // The headline in whole units, the cents waiting in the tooltip.
  const showWhole = (value: number) =>
    inMetal ? (
      <PrivateAmount>{formatOunces(value)}</PrivateAmount>
    ) : (
      <WholeMoney value={value} currency={currency} locale={locale} />
    );
  const headline = inMetal ?? data;
  const isPositive = (headline?.change ?? 0) >= 0;
  const unchanged = (headline?.change ?? 0) === 0;
  const hasData = Boolean(data && (data.assetsTotal !== 0 || data.liabilitiesTotal !== 0));

  const rangeLabel = (option: NetWorthRange): string =>
    option === 'all' ? t.rangeAll.value : option.toUpperCase().replace('180D', '6M');

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <PageTitle
          path="/net-worth"
          summary={joinSummary([rangeLabel(range), denominate && t.ouncesOfGold.value])}
        />
        <TextTabs
          value={denominate ? 'XAU' : 'money'}
          onChange={next => setDenominate(next === 'money' ? null : 'XAU')}
          options={[
            { value: 'money', label: currency },
            { value: 'XAU', label: t.ouncesOfGold.value },
          ]}
          ariaLabel={t.ouncesOfGold.value}
        />
        <TextTabs<NetWorthRange>
          value={range}
          onChange={setRange}
          options={NET_WORTH_RANGES.map(option => ({ value: option, label: rangeLabel(option) }))}
          ariaLabel={t.title.value}
        />
      </Box>

      {isPending && <NetWorthSkeleton />}

      {error && <LoadError spacing={2}>{t.error}</LoadError>}

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
            data-tour-shot="net-worth-chart"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 3,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              {showWhole(headline?.current ?? 0)}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
              {/* Only the change itself carries a colour; the words around it stay neutral,
                  and so does a change of zero: no arrow, no sign, no colour. */}
              {unchanged ? null : isPositive ? (
                <ArrowUpRight size={18} color="var(--money-up)" />
              ) : (
                <ArrowDownRight size={18} color="var(--money-down)" />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color: unchanged
                    ? 'text.secondary'
                    : isPositive
                      ? 'var(--money-up)'
                      : 'var(--money-down)',
                }}
              >
                <PrivateAmount>
                  {unchanged ? '' : isPositive ? '+' : '−'}
                  {show(Math.abs(headline?.change ?? 0))}
                </PrivateAmount>
                {!unchanged &&
                  headline?.changePercent != null &&
                  ` (${isPositive ? '+' : '−'}${Math.abs(headline.changePercent)}%)`}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t.overPeriod}
              </Typography>
            </Box>
            {denominate && !inMetal && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {t.noMetalPrice}
              </Typography>
            )}
            {!inMetal && data.allTimeHigh && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {fillTemplateNodes(
                  t.allTimeHigh.value.replace(
                    '{{date}}',
                    formatStoredDateWithOptions(
                      `${data.allTimeHigh.date}T00:00:00`,
                      { day: 'numeric', month: 'long', year: 'numeric' },
                      locale,
                    ),
                  ),
                  { value: formatMoney(data.allTimeHigh.value, currency, locale) },
                )}
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
                  points={inMetal ? inMetal.series : data.series}
                  positive={isPositive}
                  formatValue={show}
                  formatTick={tick}
                />
              </Box>
            ) : (
              <EmptyState illustration="net-worth" description={t.empty} compact />
            )}

            <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.assets}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                  }}
                >
                  <WholeMoney value={data.assetsTotal} currency={currency} locale={locale} />
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.liabilities}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                  }}
                >
                  <WholeMoney value={data.liabilitiesTotal} currency={currency} locale={locale} />
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Read top to bottom: the total, how it splits, how much of it is at
              risk; the editing comes last, folded away under Holdings. */}
          <AllocationCard
            title={t.allocation.value}
            views={[
              { key: 'sheet', label: t.balanceSheet.value, items: data.breakdown },
              {
                key: 'class',
                label: t.assetClasses.value,
                items: (data.byAssetClass ?? []).map(item => ({
                  code: item.key ?? 'other',
                  name: t[
                    ASSET_CLASS_KEYS[
                      (item.key ?? 'other') as keyof typeof ASSET_CLASS_KEYS
                    ] as 'classOther'
                  ].value,
                  amount: item.amount,
                  percent: item.percent,
                })),
              },
            ]}
            currency={currency}
            locale={locale}
          />

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

          <Box sx={cardSx}>
            <CardTitle>{t.holdingsTitle}</CardTitle>
            <Box sx={{ mt: 1.5 }}>
              <HoldingsSection title={t.investmentsTitle.value}>
                <InvestmentsCard currency={currency} locale={locale} embedded />
              </HoldingsSection>
              <HoldingsSection title={t.metalsTitle.value}>
                <MetalsCard currency={currency} locale={locale} embedded />
              </HoldingsSection>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
