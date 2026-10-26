'use client';

import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { AccountRow } from './AccountRow';
import { AddBankForm } from './AddBankForm';
import { Panel } from './Panel';
import {
  BANK_SYNC_BASE,
  type BankSyncAccount,
  type BankSyncConnection,
  type FeedRef,
  type RunAction,
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
  onRun: RunAction;
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
        const response = await apiClient.post(`${base}/sync`);
        const result = await checkContract('BankSyncResult', response.data, `${base}/sync`);
        await onReload();
        const failed = result.accounts.find(account => account.error);
        if (failed) return { tone: 'error', text: `${t.syncFailed.value}: ${failed.error}` };
        if (result.imported === 0) return { tone: 'ok', text: t.nothingNew.value };
        return {
          tone: 'ok',
          text: t.synced.value
            .replace('{rows}', String(result.imported))
            .replace('{statements}', String(result.statements)),
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
        await apiClient.patch(base, {
          autoSync,
        } satisfies ContractInput<'UpdateBankSyncConnectionBody'>);
        await onReload();
        return { tone: 'ok', text: t.saved.value };
      },
      t.saveFailed.value,
    );

  /** Account changes save as they are made: a separate save button only loses them. */
  const patchAccount = (
    account: BankSyncAccount,
    changes: ContractInput<'UpdateBankSyncAccountBody'>,
  ) =>
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
