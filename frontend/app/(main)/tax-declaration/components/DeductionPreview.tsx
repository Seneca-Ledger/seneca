'use client';

import { Box, LinearProgress, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { Home } from '@/app/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { DE_HOME_OFFICE_CAP_EUR, type HomeOfficeAllowance } from '../tax-declaration.helpers';

/**
 * Live total of the German home-office allowance as the user types. It shows
 * the deduction, not "tax saved": what a deduction saves depends on the
 * marginal rate, which this app does not estimate for every year it drafts.
 */
export function DeductionPreview({
  allowance,
  currency,
}: {
  allowance: HomeOfficeAllowance;
  currency: string;
}): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const { locale } = useLocale();
  const share = Math.round((allowance.amount / DE_HOME_OFFICE_CAP_EUR) * 100);

  return (
    <Card>
      <CardHeader style={{ padding: 16, paddingBottom: 4 }}>
        <CardTitle>{t.deductionPreviewTitle}</CardTitle>
      </CardHeader>
      <CardContent style={{ paddingTop: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 1,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: theme => alpha(theme.palette.primary.main, 0.12),
            }}
          >
            <Home size={20} aria-hidden />
          </Box>
          <Typography
            aria-live="polite"
            sx={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              color: allowance.amount > 0 ? 'text.primary' : 'text.disabled',
            }}
          >
            {formatMoney(allowance.amount, currency, locale)}
          </Typography>
        </Box>

        {allowance.basis ? (
          <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary' }}>
            {allowance.units}{' '}
            {allowance.basis === 'days' ? t.deductionDaysBasis : t.deductionStudyBasis}
            {allowance.capped ? <> · {t.deductionCapReached}</> : null}
          </Typography>
        ) : (
          <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary' }}>
            {t.deductionEmpty}
          </Typography>
        )}

        <LinearProgress
          variant="determinate"
          value={share}
          aria-hidden
          sx={{
            mt: 2,
            height: 4,
            borderRadius: 999,
            bgcolor: theme => alpha(theme.palette.text.primary, 0.08),
          }}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 0.5,
            fontSize: 12,
            color: 'text.disabled',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{formatMoney(0, currency, locale)}</span>
          <span>{formatMoney(DE_HOME_OFFICE_CAP_EUR, currency, locale)}</span>
        </Box>

        {allowance.exclusive ? (
          <Typography sx={{ mt: 2, fontSize: 13, color: 'warning.main' }}>
            {t.deductionExclusive}
          </Typography>
        ) : null}

        <Typography sx={{ mt: 2, fontSize: 12, color: 'text.secondary' }}>
          {t.deductionFootnote}
        </Typography>
      </CardContent>
    </Card>
  );
}
