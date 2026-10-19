'use client';

import { Alert, Box, LinearProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import { formatMoney } from './tax-return.helpers';

/**
 * Turnover against the VAT registration threshold. The server answers only
 * for a business not yet registered for VAT, so for everyone else this
 * renders nothing.
 */
export function TaxThresholdCard(): React.ReactElement | null {
  const t = useIntlayer('taxReturnView');
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: queryKeys.taxThreshold(workspaceId),
    queryFn: ({ signal }) =>
      apiClient
        .get('/tax/settings/threshold', { signal })
        // No status (not a business, or registered already): null, sent as an empty body.
        .then(response =>
          checkContract('TaxThresholdStatus', response.data || null, '/tax/settings/threshold'),
        ),
    enabled: Boolean(workspaceId),
  });
  const status = query.data;
  if (!status?.threshold) {
    return null;
  }

  return (
    <Box
      data-attention="tax:threshold"
      sx={{ borderRadius: tokens.radius.lg, border: '1px solid', borderColor: 'divider', p: 2 }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
        {t.registrationThreshold.value}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
        {t.thresholdProgress.value
          .replace('{turnover}', formatMoney(status.turnover, status.currency))
          .replace('{threshold}', formatMoney(status.threshold, status.currency))
          .replace('{percent}', String(Math.round(status.percentUsed)))}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, status.percentUsed)}
        color={
          status.percentUsed >= 100 ? 'error' : status.percentUsed >= 80 ? 'warning' : 'primary'
        }
        sx={{ mt: 1, borderRadius: 999, height: 6 }}
      />
      {status.missingRateCurrencies && status.missingRateCurrencies.length > 0 ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t.thresholdMissingRates.value.replace(
            '{currencies}',
            status.missingRateCurrencies.join(', '),
          )}
        </Alert>
      ) : null}
    </Box>
  );
}
