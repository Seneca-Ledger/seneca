'use client';

import { Box, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import { AddConnectionForm } from './AddConnectionForm';
import { ConnectionCard } from './ConnectionCard';
import { SwitchFeedDialog } from './SwitchFeedDialog';
import {
  BANK_SYNC_BASE,
  type BankSyncConnection,
  type BankSyncProviderInfo,
  type Message,
  UNHEALTHY,
  type WalletOption,
} from './types';

export type FeedRef = { connectionId: string; accountId: string; walletId: string };

/**
 * Bank sync through the user's own provider account. Lumio holds no bank
 * integration and no provider contract of its own, which is also the only
 * arrangement in which this is free: every provider's free tier covers the
 * accounts of the person who linked them and nothing else.
 *
 * A workspace may hold several connections, including several with the same
 * provider, and each wallet's feed can be moved to another provider without
 * losing its history.
 */
export function BankSyncPanel({
  onConnectionChange,
}: {
  onConnectionChange?: () => void;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const [providers, setProviders] = useState<BankSyncProviderInfo[]>([]);
  const [connections, setConnections] = useState<BankSyncConnection[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [switching, setSwitching] = useState<FeedRef | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const response = await apiClient.get<BankSyncConnection[]>(`${BANK_SYNC_BASE}/connections`);
    setConnections(Array.isArray(response.data) ? response.data : []);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [providerList, connectionList, walletList] = await Promise.all([
          apiClient.get<BankSyncProviderInfo[]>(`${BANK_SYNC_BASE}/providers`),
          apiClient.get<BankSyncConnection[]>(`${BANK_SYNC_BASE}/connections`),
          apiClient.get<WalletOption[]>('/wallets').catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        setProviders(Array.isArray(providerList.data) ? providerList.data : []);
        setConnections(Array.isArray(connectionList.data) ? connectionList.data : []);
        setWallets(Array.isArray(walletList.data) ? walletList.data : []);
      } catch {
        if (mounted) setMessage({ tone: 'error', text: t.loadFailed.value });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t.loadFailed.value]);

  /** Runs one action, turning whatever the server says into something readable. */
  const run = useCallback(
    async (key: string, action: () => Promise<Message | null>, failure: string): Promise<void> => {
      setBusy(key);
      setMessage(null);
      try {
        setMessage(await action());
      } catch (error) {
        setMessage({ tone: 'error', text: `${failure}${explain(error)}` });
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const feeds = useMemo(
    () =>
      connections.flatMap(connection =>
        connection.config.accounts.map(account => ({ connection, account })),
      ),
    [connections],
  );

  /**
   * The feeds worth moving: not delivering, and there is somewhere to move them
   * to. Saying so is the whole point — a feed that quietly stops is the failure
   * people only notice months later.
   */
  const ailing = useMemo(
    () =>
      feeds.filter(
        ({ connection, account }) =>
          account.walletId !== null &&
          (UNHEALTHY.includes(account.health) || connection.status === 'needs_reauth'),
      ),
    [feeds],
  );

  const canSwitch = connections.length > 1;

  return (
    <Stack spacing={2} data-testid="bank-sync-panel">
      <Panel>
        <Stack spacing={1}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>
            {t.status}
          </Typography>
          <Typography sx={{ fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
            {t.howItWorks}
          </Typography>
        </Stack>
      </Panel>

      {ailing.length > 0 && canSwitch ? (
        <Box
          role="status"
          data-testid="bank-sync-unhealthy-banner"
          sx={{
            border: '1px solid',
            borderColor: 'warning.main',
            borderRadius: tokens.radius.md,
            p: 2,
          }}
        >
          <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
            {t.unhealthyBanner.value.replace(
              '{accounts}',
              ailing.map(f => f.account.name).join(', '),
            )}
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {ailing.map(({ connection, account }) => (
              <Box
                component="button"
                type="button"
                key={`${connection.id}:${account.id}`}
                data-testid={`bank-sync-switch-suggestion-${account.id}`}
                onClick={() =>
                  setSwitching({
                    connectionId: connection.id,
                    accountId: account.id,
                    walletId: account.walletId as string,
                  })
                }
                sx={{
                  border: 'none',
                  background: 'none',
                  p: 0,
                  cursor: 'pointer',
                  color: 'primary.main',
                  fontSize: 13,
                  fontWeight: 650,
                  textAlign: 'left',
                }}
              >
                {t.switchFeedFor.value.replace('{account}', account.name)}
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      {connections.length === 0 ? (
        <Panel>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.noConnections}</Typography>
        </Panel>
      ) : (
        connections.map(connection => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            wallets={wallets}
            busy={busy}
            canSwitch={canSwitch}
            onRun={run}
            onReload={reload}
            onConnectionChange={onConnectionChange}
            onSwitchFeed={setSwitching}
          />
        ))
      )}

      <AddConnectionForm
        providers={providers}
        busy={busy}
        onRun={run}
        onReload={reload}
        onConnectionChange={onConnectionChange}
      />

      {switching ? (
        <SwitchFeedDialog
          feed={switching}
          connections={connections}
          wallets={wallets}
          onClose={() => setSwitching(null)}
          onRun={run}
          onReload={reload}
        />
      ) : null}

      {message ? (
        <Typography
          role="status"
          data-testid="bank-sync-message"
          sx={{ fontSize: 13, color: message.tone === 'error' ? 'error.main' : 'success.main' }}
        >
          {message.text}
        </Typography>
      ) : null}
    </Stack>
  );
}

/** Pulls the server's own words out, including the re-link hint the API sends. */
function explain(error: unknown): string {
  const data = (
    error as {
      response?: {
        data?: { message?: string | string[]; error?: { message?: string } };
      };
    }
  )?.response?.data;
  const detail = data?.error?.message ?? data?.message;
  const text = Array.isArray(detail) ? detail.join(', ') : detail;
  return text ? `: ${text}` : '';
}

export function Panel({ children }: { children: React.ReactNode }): React.JSX.Element {
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
