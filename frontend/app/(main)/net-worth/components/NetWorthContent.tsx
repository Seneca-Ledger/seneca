'use client';

import Box from '@mui/material/Box';
import { LoadError } from '@/app/components/ui/load-error';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import { useNetWorth } from '../hooks/useNetWorth';
import { AllocationCard } from './AllocationCard';
import { AttributionCard } from './AttributionCard';
import { HoldingsSection } from './HoldingsSection';
import { ASSET_CLASS_KEYS, InvestmentsCard } from './InvestmentsCard';
import { MetalsCard } from './MetalsCard';
import { NetWorthControls } from './NetWorthControls';
import { NetWorthHeadline } from './NetWorthHeadline';
import { NetWorthSkeleton } from './NetWorthSkeleton';
import { CardTitle, cardSx } from './net-worth-ui';
import { RiskCard } from './RiskCard';

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
    custom,
    view,
    excluded,
    setRange,
    setCustom,
    setView,
    setExcluded,
    denominate,
    setDenominate,
    classify,
  } = useNetWorth();

  const currency = data?.currency ?? FALLBACK_CURRENCY;
  // Measured in metal, the figures are ounces; the money ones stay untouched
  // underneath, so the toggle changes the unit and nothing else.
  const inMetal = denominate ? (data?.denominated ?? null) : null;

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}>
      <NetWorthControls
        currency={currency}
        range={range}
        custom={custom}
        view={view}
        window={data ? { from: data.from, to: data.to } : null}
        lines={data?.assetLines ?? (isPending ? null : [])}
        excluded={excluded}
        denominate={denominate}
        setRange={setRange}
        setCustom={setCustom}
        setView={setView}
        setExcluded={setExcluded}
        setDenominate={setDenominate}
      />

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
          <NetWorthHeadline
            data={data}
            inMetal={inMetal}
            denominate={denominate}
            view={view}
            locale={locale}
          />

          <AttributionCard
            attribution={data.attribution}
            savings={data.savings}
            formatMoney={value => formatMoney(value, currency, locale)}
            labels={{
              title: t.changeTitle.value,
              hint: t.changeHint.value,
              savings: t.savingsRate.value,
              kinds: {
                money: t.changeMoney.value,
                revaluation: t.changeRevaluation.value,
                fx: t.changeFx.value,
              },
            }}
          />

          {/* Read top to bottom: the total, what moved it, how it splits, how
              much of it is at risk; the editing comes last, folded away under Holdings. */}
          <AllocationCard
            title={t.allocation.value}
            views={[
              { key: 'sheet', label: t.balanceSheet.value, items: data.breakdown },
              {
                key: 'class',
                label: t.assetClasses.value,
                items: data.byAssetClass.map(item => ({
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
