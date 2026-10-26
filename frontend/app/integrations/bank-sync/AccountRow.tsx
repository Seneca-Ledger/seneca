'use client';

import { Box, Button, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import type React from 'react';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';
import {
  type BankSyncAccount,
  CONSENT_WARNING_DAYS,
  daysUntil,
  UNHEALTHY,
  type WalletOption,
} from './types';

/** One provider account: where its rows land, whether it is pulled, and how its feed is doing. */
export function AccountRow({
  account,
  wallets,
  busy,
  canSwitch,
  onPatch,
  onSwitch,
}: {
  account: BankSyncAccount;
  wallets: WalletOption[];
  busy: string | null;
  canSwitch: boolean;
  onPatch: (changes: ContractInput<'UpdateBankSyncAccountBody'>) => void;
  onSwitch: () => void;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const consentDays = daysUntil(account.consentExpiresAt);
  const health = UNHEALTHY.includes(account.health) ? account.health : null;

  return (
    <Box
      component="li"
      data-testid={`bank-sync-account-${account.id}`}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
        gap: 1,
        alignItems: 'center',
        border: '1px solid',
        borderColor: health ? 'warning.main' : 'divider',
        borderRadius: tokens.radius.sm,
        p: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 650, color: 'text.primary' }}>
          {account.name}
          {account.org ? (
            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>
              {account.org}
            </Typography>
          ) : null}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {account.balance !== null ? (
            <>
              {t.balance.value}:{' '}
              <PrivateAmount>
                {account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                {account.currency}
              </PrivateAmount>
            </>
          ) : (
            account.currency
          )}
          {' · '}
          {t.lastSync}:{' '}
          {account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleDateString() : t.never}
        </Typography>

        {health ? (
          <Typography
            data-testid={`bank-sync-health-${account.id}`}
            sx={{ fontSize: 12, color: 'warning.main', fontWeight: 650 }}
          >
            {health === 'stale' ? t.healthStale : null}
            {health === 'incomplete'
              ? fillTemplateNodes(t.healthIncomplete.value, { amount: account.balanceDrift ?? 0 })
              : null}
            {health === 'needs_reauth' ? t.healthNeedsReauth : null}
          </Typography>
        ) : null}

        {consentDays !== null && consentDays <= CONSENT_WARNING_DAYS ? (
          <Typography
            data-testid={`bank-sync-consent-${account.id}`}
            sx={{ fontSize: 12, color: consentDays < 0 ? 'error.main' : 'warning.main' }}
          >
            {consentDays < 0
              ? t.consentExpired
              : t.consentExpiring.value.replace('{days}', String(consentDays))}
          </Typography>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', mt: 1 }}>
          <TextField
            select
            size="small"
            label={t.wallet.value}
            value={account.walletId ?? ''}
            onChange={event => onPatch({ walletId: event.target.value || null })}
            disabled={busy !== null}
            sx={{ minWidth: 220 }}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="">{t.noWallet.value}</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.currency})
              </option>
            ))}
          </TextField>
          {account.walletId && canSwitch ? (
            <Button
              size="small"
              onClick={onSwitch}
              disabled={busy !== null}
              data-testid={`bank-sync-switch-${account.id}`}
            >
              {t.switchFeed}
            </Button>
          ) : null}
        </Box>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={account.enabled}
            onChange={event => onPatch({ enabled: event.target.checked })}
            disabled={busy !== null}
            slotProps={{ input: { 'aria-label': `${t.pull.value}: ${account.name}` } }}
          />
        }
        label={<Typography sx={{ fontSize: 13 }}>{t.pull}</Typography>}
        sx={{ m: 0 }}
      />
    </Box>
  );
}
