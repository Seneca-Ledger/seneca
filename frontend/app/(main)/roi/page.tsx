'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import { RoiProjectionChart } from './components/RoiProjectionChart';
import { buildProjection, calculateRoi, splitPayback, TABLE_YEARS } from './roi-model';

export default function RoiPage() {
  const t = useIntlayer('roiPage');
  const { locale } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.currency ?? 'USD';
  const [investment, setInvestment] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  const result = useMemo(() => {
    if (investment === '' || monthlyIncome === '') {
      return null;
    }
    return calculateRoi(Number(investment), Number(monthlyIncome));
  }, [investment, monthlyIncome]);

  const projection = useMemo(
    () => (result ? buildProjection(Number(investment), result.annualIncome) : []),
    [result, investment],
  );

  const compactMoney = (value: number) =>
    formatMoney(value, currency, locale, { notation: 'compact' });

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label={t.investmentLabel.value}
            type="number"
            size="small"
            value={investment}
            onChange={event => setInvestment(event.target.value)}
            sx={{ flex: '1 1 200px' }}
            slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
          />
          <TextField
            label={t.monthlyIncomeLabel.value}
            type="number"
            size="small"
            value={monthlyIncome}
            onChange={event => setMonthlyIncome(event.target.value)}
            sx={{ flex: '1 1 200px' }}
            slotProps={{ htmlInput: { step: '0.01' } }}
          />
        </Box>

        {result === null ? (
          <EmptyState illustration="no-data" size="sm" description={t.hint} compact />
        ) : (
          <Box sx={{ display: 'flex', gap: 4, mt: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t.annualRoi}
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: result.annualRoiPercent >= 0 ? 'success.main' : 'error.main' }}
              >
                {result.annualRoiPercent.toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t.payback}
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {result.paybackYears === null
                  ? t.neverPaysBack
                  : formatPayback(result.paybackYears, t.years.value, t.months.value)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {result !== null && result.annualIncome > 0 && (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: tokens.radius.md,
            bgcolor: 'background.paper',
            p: 3,
            mt: 3,
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.6 }}
          >
            {t.projectionTitle}
          </Typography>

          <RoiProjectionChart
            points={projection}
            compoundLabel={t.compoundLabel.value}
            simpleLabel={t.simpleLabel.value}
          />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: '0 0 60px' }}>
                {t.yearColumn}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                {t.compoundLabel}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                {t.simpleLabel}
              </Typography>
            </Box>
            {TABLE_YEARS.map(year => (
              <Box key={year} sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" sx={{ flex: '0 0 60px' }}>
                  {year}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                  {compactMoney(projection[year]?.compound ?? 0)}
                </Typography>
                <Typography variant="body2" sx={{ flexGrow: 1, color: 'text.secondary' }}>
                  {compactMoney(projection[year]?.simple ?? 0)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function formatPayback(paybackYears: number, yearsLabel: string, monthsLabel: string): string {
  const { years, months } = splitPayback(paybackYears);
  if (years === 0) {
    return `${months} ${monthsLabel}`;
  }
  return months === 0
    ? `${years} ${yearsLabel}`
    : `${years} ${yearsLabel} ${months} ${monthsLabel}`;
}
