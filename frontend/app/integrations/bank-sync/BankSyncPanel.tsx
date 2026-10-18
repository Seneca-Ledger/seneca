'use client';

import { Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';

type BankSyncAccount = {
  id: string;
  name: string;
  org: string;
  currency: string;
  enabled: boolean;
  walletId: string | null;
  lastSyncAt: string | null;
  balance: number | null;
  balanceDate: string | null;
};

type BankSyncStatus = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'needs_reauth';
  settings: {
    autoSync: boolean;
    accounts: BankSyncAccount[];
    lastSyncAt: string | null;
    lastError: string | null;
  } | null;
};

type BankSyncResult = {
  imported: number;
  statements: number;
  accounts: Array<{ id: string; imported: number; error?: string }>;
};

type WalletOption = { id: string; name: string; currency: string; isActive?: boolean };

type Message = { tone: 'ok' | 'error'; text: string };

const BASE = '/integrations/simplefin';
const BRIDGE_URL = 'https://bridge.simplefin.org';

/**
 * Bank sync through the user's own SimpleFIN Bridge account: paste the setup
 * token once, choose which accounts to pull and where their rows land, pull
 * now or every six hours. Lumio holds no bank integration of its own.
 */
export function BankSyncPanel({
  onConnectionChange,
}: {
  onConnectionChange?: () => void;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const [status, setStatus] = useState<BankSyncStatus | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [token, setToken] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [accounts, setAccounts] = useState<BankSyncAccount[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const applyStatus = (next: BankSyncStatus): void => {
    setStatus(next);
    setAutoSync(next.settings?.autoSync ?? true);
    setAccounts(next.settings?.accounts ?? []);
  };

  useEffect(() => {
    let mounted = true;
    apiQueryDecoded({ url: `${BASE}/status`, contract: 'BankSyncStatus' })
      .then(status => {
        if (mounted) applyStatus(status);
      })
      .catch(() => {
        if (mounted) setMessage({ tone: 'error', text: t.loadFailed.value });
      });
    apiQueryDecoded({ url: '/wallets', contract: 'WalletList' })
      .then(wallets => {
        if (mounted) setWallets(wallets);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [t.loadFailed.value]);

  const run = async (
    key: string,
    action: () => Promise<Message | null>,
    failure: string,
  ): Promise<void> => {
    setBusy(key);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string | string[] } } })?.response
        ?.data?.message;
      const text = Array.isArray(detail) ? detail.join(', ') : detail;
      setMessage({ tone: 'error', text: text ? `${failure}: ${text}` : failure });
    } finally {
      setBusy(null);
    }
  };

  const connect = () =>
    run(
      'connect',
      async () => {
        const response = await apiClient.post(`${BASE}/connect`, {
          setupToken: token.trim(),
        } satisfies ContractInput<'ConnectBankSyncBody'>);
        applyStatus(await checkContract('BankSyncStatus', response.data, `${BASE}/connect`));
        setToken('');
        onConnectionChange?.();
        return { tone: 'ok', text: t.connected.value };
      },
      t.connectFailed.value,
    );

  const save = () =>
    run(
      'save',
      async () => {
        const response = await apiClient.post(`${BASE}/settings`, {
          autoSync,
          accounts: accounts.map(account => ({
            id: account.id,
            enabled: account.enabled,
            walletId: account.walletId,
          })),
        });
        applyStatus(await checkContract('BankSyncStatus', response.data, `${BASE}/settings`));
        return { tone: 'ok', text: t.saved.value };
      },
      t.saveFailed.value,
    );

  const sync = () =>
    run(
      'sync',
      async () => {
        const response = await apiClient.post(`${BASE}/sync`);
        const result = await checkContract('BankSyncResult', response.data, `${BASE}/sync`);
        applyStatus(await apiQueryDecoded({ url: `${BASE}/status`, contract: 'BankSyncStatus' }));
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
    run(
      'refresh',
      async () => {
        const response = await apiClient.post(`${BASE}/accounts/refresh`);
        applyStatus(
          await checkContract('BankSyncStatus', response.data, `${BASE}/accounts/refresh`),
        );
        return { tone: 'ok', text: t.accountsRefreshed.value };
      },
      t.saveFailed.value,
    );

  const disconnect = () =>
    run(
      'disconnect',
      async () => {
        await apiClient.delete(BASE);
        applyStatus({ connected: false, status: 'disconnected', settings: null });
        onConnectionChange?.();
        return { tone: 'ok', text: t.disconnected.value };
      },
      t.disconnectFailed.value,
    );

  const updateAccount = (id: string, patch: Partial<BankSyncAccount>): void => {
    setAccounts(current =>
      current.map(account => (account.id === id ? { ...account, ...patch } : account)),
    );
  };

  const connected = Boolean(status?.connected);
  const needsReauth = status?.status === 'needs_reauth';
  const statusLabel = connected
    ? needsReauth
      ? t.needsReauth
      : t.statusConnected
    : t.statusDisconnected;

  return (
    <Stack spacing={2} data-testid="bank-sync-panel">
      <Panel>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>
              {t.status}
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: connected && !needsReauth ? 'success.main' : 'text.secondary',
              }}
            >
              {statusLabel}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
            {t.howItWorks}
          </Typography>
          {status?.settings?.lastSyncAt ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t.lastSync}: {new Date(status.settings.lastSyncAt).toLocaleString()}
            </Typography>
          ) : null}
          {status?.settings?.lastError ? (
            <Typography sx={{ fontSize: 12, color: 'error.main' }}>
              {t.lastError}: {status.settings.lastError}
            </Typography>
          ) : null}
        </Stack>
      </Panel>

      {!connected || needsReauth ? (
        <Panel>
          <Stack spacing={1.5}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
              {t.connectTitle}
            </Typography>
            <Typography sx={{ fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
              {t.tokenHelp}{' '}
              <Box
                component="a"
                href={BRIDGE_URL}
                target="_blank"
                rel="noreferrer"
                sx={{ color: 'primary.main', fontWeight: 600 }}
              >
                bridge.simplefin.org
              </Box>
            </Typography>
            <TextField
              label={t.setupToken.value}
              placeholder={t.setupTokenPlaceholder.value}
              value={token}
              onChange={event => setToken(event.target.value)}
              multiline
              minRows={2}
              size="small"
              fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'bank-sync-token' } }}
            />
            <Box>
              <Button
                variant="contained"
                onClick={() => void connect()}
                disabled={busy !== null || token.trim().length === 0}
              >
                {busy === 'connect' ? t.connecting : t.connect}
              </Button>
            </Box>
          </Stack>
        </Panel>
      ) : null}

      {connected ? (
        <Panel>
          <Stack spacing={1.5}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
                {t.accounts}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => void refresh()} disabled={busy !== null}>
                  {busy === 'refresh' ? t.refreshing : t.refreshAccounts}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void sync()}
                  disabled={busy !== null || needsReauth}
                >
                  {busy === 'sync' ? t.syncing : t.syncNow}
                </Button>
              </Box>
            </Box>
            {accounts.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.noAccounts}</Typography>
            ) : (
              <Stack spacing={1} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {accounts.map(account => (
                  <Box
                    component="li"
                    key={account.id}
                    data-testid={`bank-sync-account-${account.id}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                      gap: 1,
                      alignItems: 'center',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: tokens.radius.sm,
                      p: 1.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 650, color: 'text.primary' }}>
                        {account.name}
                        {account.org ? (
                          <Typography
                            component="span"
                            sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}
                          >
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
                        {account.lastSyncAt
                          ? new Date(account.lastSyncAt).toLocaleDateString()
                          : t.never}
                      </Typography>
                      <TextField
                        select
                        size="small"
                        label={t.wallet.value}
                        value={account.walletId ?? ''}
                        onChange={event =>
                          updateAccount(account.id, { walletId: event.target.value || null })
                        }
                        sx={{ mt: 1, minWidth: 220 }}
                        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                      >
                        <option value="">{t.noWallet.value}</option>
                        {wallets.map(wallet => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.name} ({wallet.currency})
                          </option>
                        ))}
                      </TextField>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={account.enabled}
                          onChange={event =>
                            updateAccount(account.id, { enabled: event.target.checked })
                          }
                          slotProps={{
                            input: { 'aria-label': `${t.pull.value}: ${account.name}` },
                          }}
                        />
                      }
                      label={<Typography sx={{ fontSize: 13 }}>{t.pull}</Typography>}
                      sx={{ m: 0 }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t.newAccountsOff}
            </Typography>
            <FormControlLabel
              control={
                <Switch checked={autoSync} onChange={event => setAutoSync(event.target.checked)} />
              }
              label={<Typography sx={{ fontSize: 13 }}>{t.autoSync}</Typography>}
              sx={{ m: 0 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={() => void save()} disabled={busy !== null}>
                {busy === 'save' ? t.saving : t.saveSettings}
              </Button>
              <Button color="error" onClick={() => void disconnect()} disabled={busy !== null}>
                {busy === 'disconnect' ? t.disconnecting : t.disconnect}
              </Button>
            </Box>
          </Stack>
        </Panel>
      ) : null}

      {message ? (
        <Typography
          role="status"
          sx={{ fontSize: 13, color: message.tone === 'error' ? 'error.main' : 'success.main' }}
        >
          {message.text}
        </Typography>
      ) : null}
    </Stack>
  );
}

function Panel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      {children}
    </Box>
  );
}
