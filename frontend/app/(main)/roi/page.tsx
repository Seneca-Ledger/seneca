'use client';

import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import { RoiProjectionChart } from './components/RoiProjectionChart';
import { buildProjection, calculateRoi, parseAmount, splitPayback, TABLE_YEARS } from './roi-model';

/** The block reads as one column, not two fields stretched across the screen. */
const BLOCK_MAX_WIDTH = 600;

/**
 * An amount with its label above it, the currency inside, an example as the
 * placeholder, and thousands grouped once the field is left — raw while typing,
 * so the caret never jumps.
 */
function AmountField({
  label,
  value,
  onChange,
  currencySymbol,
  locale,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currencySymbol: string;
  locale: string;
}) {
  const [focused, setFocused] = useState(false);
  const parsed = parseAmount(value);
  const shown =
    focused || parsed === null
      ? value
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(parsed);
  return (
    <TextField
      label={label}
      size="small"
      value={shown}
      placeholder={new Intl.NumberFormat(locale).format(10000)}
      onChange={event => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { inputMode: 'decimal' },
        input: {
          startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
        },
      }}
    />
  );
}

export default function RoiPage() {
  const t = useIntlayer('roiPage');
  const { locale } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.currency ?? 'USD';
  const [investment, setInvestment] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  const investmentValue = parseAmount(investment);
  const incomeValue = parseAmount(monthlyIncome);
  // Worked out as the user types; until both amounts read as numbers there is
  // nothing to say, and no error either.
  const result = useMemo(
    () =>
      investmentValue === null || incomeValue === null
        ? null
        : calculateRoi(investmentValue, incomeValue),
    [investmentValue, incomeValue],
  );

  const projection = useMemo(
    () =>
      result && investmentValue !== null
        ? buildProjection(investmentValue, result.annualIncome)
        : [],
    [result, investmentValue],
  );
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find(part => part.type === 'currency')?.value ?? currency;

  const compactMoney = (value: number) =>
    formatMoney(value, currency, locale, { notation: 'compact' });

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box sx={{ maxWidth: BLOCK_MAX_WIDTH, mx: 'auto' }}>
        <Typography component="h1" sx={{ fontSize: 20, fontWeight: 500 }}>
          {t.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 0.5, mb: 2.5 }}>
          {t.explainer}
        </Typography>

        <Box
          data-tour-shot="roi-inputs"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: tokens.radius.md,
            bgcolor: 'background.paper',
            p: 3,
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <AmountField
              label={t.investmentLabel.value}
              value={investment}
              onChange={setInvestment}
              currencySymbol={currencySymbol}
              locale={locale}
            />
            <AmountField
              label={t.monthlyIncomeLabel.value}
              value={monthlyIncome}
              onChange={setMonthlyIncome}
              currencySymbol={currencySymbol}
              locale={locale}
            />
          </Box>

          {/* The answer has its place from the start: a grey dash until both
              amounts are in, then the figure, without the layout moving. */}
          <Box sx={{ mt: 3, minHeight: 104 }} aria-live="polite">
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.payback}</Typography>
            <Typography
              data-testid="roi-payback"
              sx={{
                fontSize: 32,
                fontWeight: 500,
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                color: result === null ? 'var(--muted-foreground)' : 'text.primary',
              }}
            >
              {result === null
                ? '—'
                : result.paybackYears === null
                  ? t.neverPaysBack
                  : formatPayback(result.paybackYears, t.years.value, t.months.value)}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: 0.5 }}>
              {result === null ? (
                t.hint
              ) : (
                <>
                  {t.annualRoi}:{' '}
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      color: result.annualRoiPercent < 0 ? 'var(--money-down)' : 'text.primary',
                    }}
                  >
                    {result.annualRoiPercent.toFixed(1)}%
                  </Box>
                </>
              )}
            </Typography>
          </Box>
        </Box>
        {result !== null && result.annualIncome > 0 && (
          <Box
            data-tour-shot="roi-chart"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 3,
              mt: 3,
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{t.projectionTitle}</Typography>

            <RoiProjectionChart
              points={projection}
              compoundLabel={t.compoundLabel.value}
              simpleLabel={t.simpleLabel.value}
            />

            <Box
              data-tour-shot="roi-table"
              sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}
            >
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
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{ flexGrow: 1, fontVariantNumeric: 'tabular-nums' }}
                  >
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
