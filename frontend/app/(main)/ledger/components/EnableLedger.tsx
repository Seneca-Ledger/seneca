'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { LedgerSettings } from '../ledger.types';

interface EnableLedgerProps {
  settings: LedgerSettings;
  canManage: boolean;
  saving: boolean;
  error: string | null;
  onEnable: (baseCurrency: string) => void;
}

/** The ledger starts off: switching it on means choosing the one currency it balances in. */
export function EnableLedger({
  settings,
  canManage,
  saving,
  error,
  onEnable,
}: EnableLedgerProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [currency, setCurrency] = useState(settings.suggestedBaseCurrency ?? 'EUR');
  const valid = /^[A-Za-z]{3}$/.test(currency);

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }}>
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={600}>
          {t.enableTitle}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t.enableText}
        </Typography>
        {canManage ? (
          <>
            <TextField
              size="small"
              label={t.baseCurrencyLabel.value}
              value={currency}
              onChange={event => setCurrency(event.target.value.toUpperCase().slice(0, 3))}
              helperText={
                settings.suggestedBaseCurrency
                  ? `${t.suggestedHint.value}: ${settings.suggestedBaseCurrency}`
                  : undefined
              }
              error={!valid}
              sx={{ maxWidth: 200 }}
            />
            {settings.pendingTransactions > 0 ? (
              <Typography variant="body2">
                {t.historyToPost}: {settings.pendingTransactions}
              </Typography>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
            <div>
              <Button
                variant="contained"
                disabled={!valid || saving}
                onClick={() => onEnable(currency)}
              >
                {t.enableButton}
              </Button>
            </div>
          </>
        ) : (
          <Alert severity="info">{t.enableForbidden}</Alert>
        )}
      </Stack>
    </Paper>
  );
}
