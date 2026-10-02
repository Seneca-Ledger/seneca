'use client';

import { Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import { AddBankForm } from './AddBankForm';
import type { FeedRef } from './BankSyncPanel';
import { Panel } from './BankSyncPanel';
import {
  BANK_SYNC_BASE,
  type BankSyncAccount,
  type BankSyncConnection,
  type BankSyncResult,
  CONSENT_WARNING_DAYS,
  daysUntil,
  type Message,
  UNHEALTHY,
  type WalletOption,
} from './types';

/** One provider connection: what it can see, where each account lands, how it is doing. */
export function ConnectionCard({
  connection,
  wallets,
  busy,
  canSwitch,
  onRun,
  onReload,
  onConnectionChange,
  onSwitchFeed,
}: {
  connection: BankSyncConnection;
  wallets: WalletOption[];
  busy: string | null;
  canSwitch: boolean;
  onRun: (key: string, action: () => Promise<Message | null>, failure: string) => Promise<void>;
  onReload: () => Promise<void>;
  onConnectionChange?: () => void;
  onSwitchFeed: (feed: FeedRef) => void;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const [addingBank, setAddingBank] = useState(false);
  const base = `${BANK_SYNC_BASE}/connections/${connection.id}`;
  const needsReauth = connection.status === 'needs_reauth';
  const working = busy !== null;

  const sync = () =>
    onRun(
      `sync:${connection.id}`,
      async () => {
        const response = await apiClient.post<BankSyncResult>(`${base}/sync`);
        await onReload();
        const failed = response.data.accounts.find(account => account.error);
        if (failed) return { tone: 'error', text: `${t.syncFailed.value}: ${failed.error}` };
        if (response.data.imported === 0) return { tone: 'ok', text: t.nothingNew.value };
        return {
          tone: 'ok',
          text: t.synced.value
            .replace('{rows}', String(response.data.imported))
            .replace('{statements}', String(response.data.statements)),
        };
      },
      t.syncFailed.value,
    );

  const refresh = () =>
    onRun(
      `refresh:${connection.id}`,
      async () => {
        await apiClient.post(`${base}/accounts/refresh`);
        await onReload();
        return { tone: 'ok', text: t.accountsRefreshed.value };
      },
      t.saveFailed.value,
    );

  const disconnect = () =>
    onRun(
      `disconnect:${connection.id}`,
      async () => {
        await apiClient.delete(base);
        await onReload();
        onConnectionChange?.();
        return { tone: 'ok', text: t.disconnected.value };
      },
      t.disconnectFailed.value,
    );

  const setAutoSync = (autoSync: boolean) =>
    onRun(
      `autosync:${connection.id}`,
      async () => {
        await apiClient.patch(base, { autoSync });
        await onReload();
        return { tone: 'ok', text: t.saved.value };
      },
      t.saveFailed.value,
    );

  /** Account changes save as they are made: a separate save button only loses them. */
  const patchAccount = (account: BankSyncAccount, changes: Partial<BankSyncAccount>) =>
    onRun(
      `account:${account.id}`,
      async () => {
        await apiClient.patch(`${base}/accounts/${encodeURIComponent(account.id)}`, changes);
        await onReload();
        return { tone: 'ok', text: t.saved.value };
      },
      t.saveFailed.value,
    );

  return (
    <Panel>
      <Stack spacing={1.5} data-testid={`bank-sync-connection-${connection.id}`}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
              {connection.label}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {connection.provider}
              {connection.config.lastSyncAt
                ? ` · ${t.lastSync.value}: ${new Date(connection.config.lastSyncAt).toLocaleString()}`
                : ''}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: needsReauth ? 'warning.main' : 'success.main',
            }}
          >
            {needsReauth ? t.needsReauth : t.statusConnected}
          </Typography>
        </Box>

        {connection.config.lastError ? (
          <Typography sx={{ fontSize: 12, color: 'error.main' }}>
            {t.lastError}: {connection.config.lastError}
          </Typography>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => void refresh()} disabled={working}>
            {busy === `refresh:${connection.id}` ? t.refreshing : t.refreshAccounts}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => void sync()}
            disabled={working || needsReauth}
          >
            {busy === `sync:${connection.id}` ? t.syncing : t.syncNow}
          </Button>
          {connection.linkStyle === 'redirect' ? (
            <Button
              size="small"
              onClick={() => setAddingBank(current => !current)}
              disabled={working}
              data-testid={`bank-sync-add-bank-${connection.id}`}
            >
              {t.addBank}
            </Button>
          ) : null}
        </Box>

        {addingBank ? (
          <AddBankForm
            connectionId={connection.id}
            busy={busy}
            onRun={onRun}
            onDone={() => setAddingBank(false)}
          />
        ) : null}

        {connection.config.accounts.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.noAccounts}</Typography>
        ) : (
          <Stack spacing={1} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {connection.config.accounts.map(account => (
              <AccountRow
                key={account.id}
                account={account}
                wallets={wallets}
                busy={busy}
                canSwitch={canSwitch}
                onPatch={changes => void patchAccount(account, changes)}
                onSwitch={() =>
                  onSwitchFeed({
                    connectionId: connection.id,
                    accountId: account.id,
                    walletId: account.walletId as string,
                  })
                }
              />
            ))}
          </Stack>
        )}

        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t.newAccountsOff}</Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={connection.config.autoSync}
                onChange={event => void setAutoSync(event.target.checked)}
                disabled={working}
              />
            }
            label={<Typography sx={{ fontSize: 13 }}>{t.autoSync}</Typography>}
            sx={{ m: 0 }}
          />
          <Button color="error" size="small" onClick={() => void disconnect()} disabled={working}>
            {busy === `disconnect:${connection.id}` ? t.disconnecting : t.disconnect}
          </Button>
        </Box>
      </Stack>
    </Panel>
  );
}

function AccountRow({
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
  onPatch: (changes: Partial<BankSyncAccount>) => void;
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
          {account.balance !== null
            ? `${t.balance.value}: ${account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${account.currency}`
            : account.currency}
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
              ? t.healthIncomplete.value.replace('{amount}', String(account.balanceDrift ?? 0))
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
            inputProps={{ 'aria-label': `${t.pull.value}: ${account.name}` }}
          />
        }
        label={<Typography sx={{ fontSize: 13 }}>{t.pull}</Typography>}
        sx={{ m: 0 }}
      />
    </Box>
  );
}
