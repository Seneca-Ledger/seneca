'use client';

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { Panel } from './Panel';
import { BANK_SYNC_BASE, type BankSyncProviderInfo, type RunAction } from './types';

const BRIDGE_URL = 'https://bridge.simplefin.org';
const ENABLE_BANKING_URL = 'https://enablebanking.com/cp';

/**
 * Adds one provider connection. Which fields appear follows how the provider
 * links: a pasted token, or the application credentials the user registered
 * themselves before authorizing banks in the browser.
 */
export function AddConnectionForm({
  providers,
  busy,
  onRun,
  onReload,
  onConnectionChange,
}: {
  providers: BankSyncProviderInfo[];
  busy: string | null;
  onRun: RunAction;
  onReload: () => Promise<void>;
  onConnectionChange?: () => void;
}): React.JSX.Element | null {
  const t = useIntlayer('bankSyncPanel');
  const [provider, setProvider] = useState('');
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  if (providers.length === 0) return null;
  const chosen = providers.find(item => item.key === provider) ?? null;
  const working = busy !== null;

  const reset = (): void => {
    setToken('');
    setApplicationId('');
    setPrivateKey('');
    setLabel('');
  };

  const addToken = () =>
    onRun(
      'add',
      async () => {
        await apiClient.post(`${BANK_SYNC_BASE}/connections/token`, {
          provider,
          setupToken: token.trim(),
          ...(label.trim() ? { label: label.trim() } : {}),
        } satisfies ContractInput<'ConnectBankSyncTokenBody'>);
        await onReload();
        reset();
        onConnectionChange?.();
        return { tone: 'ok', text: t.connected.value };
      },
      t.connectFailed.value,
    );

  const addRedirect = () =>
    onRun(
      'add',
      async () => {
        await apiClient.post(`${BANK_SYNC_BASE}/connections/redirect`, {
          provider,
          secrets: { applicationId: applicationId.trim(), privateKey },
          ...(label.trim() ? { label: label.trim() } : {}),
        } satisfies ContractInput<'CreateBankSyncRedirectBody'>);
        await onReload();
        reset();
        onConnectionChange?.();
        return { tone: 'ok', text: t.connected.value };
      },
      t.connectFailed.value,
    );

  const ready =
    chosen?.linkStyle === 'token'
      ? token.trim().length > 0
      : applicationId.trim().length > 0 && privateKey.trim().length > 0;

  return (
    <Panel>
      <Stack spacing={1.5} data-testid="bank-sync-add-connection">
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
          {t.connectTitle}
        </Typography>

        <TextField
          select
          size="small"
          label={t.provider.value}
          value={provider}
          onChange={event => {
            setProvider(event.target.value);
            reset();
          }}
          sx={{ maxWidth: 320 }}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          <option value="">{t.chooseProvider.value}</option>
          {providers.map(item => (
            <option key={item.key} value={item.key}>
              {item.key === 'simplefin' ? t.providerSimplefin.value : null}
              {item.key === 'enablebanking' ? t.providerEnableBanking.value : null}
              {item.key !== 'simplefin' && item.key !== 'enablebanking' ? item.key : null}
            </option>
          ))}
        </TextField>

        {chosen ? (
          <TextField
            size="small"
            label={t.connectionLabel.value}
            placeholder={t.connectionLabelPlaceholder.value}
            value={label}
            onChange={event => setLabel(event.target.value)}
            sx={{ maxWidth: 320 }}
            slotProps={{ htmlInput: { 'data-testid': 'bank-sync-label' } }}
          />
        ) : null}

        {chosen?.linkStyle === 'token' ? (
          <>
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
          </>
        ) : null}

        {chosen?.linkStyle === 'redirect' ? (
          <>
            <Typography sx={{ fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
              {t.credentialsHelp}{' '}
              <Box
                component="a"
                href={ENABLE_BANKING_URL}
                target="_blank"
                rel="noreferrer"
                sx={{ color: 'primary.main', fontWeight: 600 }}
              >
                enablebanking.com
              </Box>
            </Typography>
            <TextField
              label={t.applicationId.value}
              value={applicationId}
              onChange={event => setApplicationId(event.target.value)}
              size="small"
              sx={{ maxWidth: 420 }}
              slotProps={{ htmlInput: { 'data-testid': 'bank-sync-application-id' } }}
            />
            <TextField
              label={t.privateKey.value}
              placeholder={t.privateKeyPlaceholder.value}
              value={privateKey}
              onChange={event => setPrivateKey(event.target.value)}
              multiline
              minRows={3}
              size="small"
              fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'bank-sync-private-key' } }}
            />
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t.restrictedProductionNote}
            </Typography>
          </>
        ) : null}

        {chosen ? (
          <Box>
            <Button
              variant="contained"
              onClick={() => void (chosen.linkStyle === 'token' ? addToken() : addRedirect())}
              disabled={working || !ready}
              data-testid="bank-sync-add-submit"
            >
              {busy === 'add' ? t.connecting : t.connect}
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Panel>
  );
}
