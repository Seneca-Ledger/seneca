'use client';

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { BANK_SYNC_BASE, type BankSyncInstitution, type Message } from './types';

/**
 * Authorizes one more bank inside a redirect-style connection. The consent
 * ceiling the bank advertises is passed back on the way out, because asking for
 * the default instead is what turns this into a quarterly chore.
 */
export function AddBankForm({
  connectionId,
  busy,
  onRun,
  onDone,
}: {
  connectionId: string;
  busy: string | null;
  onRun: (key: string, action: () => Promise<Message | null>, failure: string) => Promise<void>;
  onDone: () => void;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const [country, setCountry] = useState('');
  const [banks, setBanks] = useState<BankSyncInstitution[] | null>(null);
  const [bank, setBank] = useState('');
  const base = `${BANK_SYNC_BASE}/connections/${connectionId}`;
  const working = busy !== null;

  const load = () =>
    onRun(
      `banks:${connectionId}`,
      async () => {
        const response = await apiClient.get<BankSyncInstitution[]>(
          `${base}/institutions?country=${encodeURIComponent(country.trim().toUpperCase())}`,
        );
        const list = Array.isArray(response.data) ? response.data : [];
        setBanks(list);
        setBank('');
        return list.length === 0 ? { tone: 'error', text: t.noBanksForCountry.value } : null;
      },
      t.loadFailed.value,
    );

  const authorize = () =>
    onRun(
      `authorize:${connectionId}`,
      async () => {
        const chosen = banks?.find(item => item.name === bank);
        if (!chosen) return { tone: 'error', text: t.noBanksForCountry.value };
        const response = await apiClient.post<{ url: string; state: string }>(
          `${base}/links/begin`,
          {
            institution: chosen.name,
            country: chosen.country,
            redirectUrl: `${window.location.origin}/integrations/bank-sync/callback`,
            ...(chosen.maxConsentValiditySeconds
              ? { maxConsentValiditySeconds: chosen.maxConsentValiditySeconds }
              : {}),
          },
        );
        // The callback page finishes the link, so it needs to know which
        // connection and which state this redirect belongs to.
        window.sessionStorage.setItem(
          'bankSyncPendingLink',
          JSON.stringify({ connectionId, state: response.data.state }),
        );
        onDone();
        window.location.assign(response.data.url);
        return null;
      },
      t.authorizeFailed.value,
    );

  return (
    <Stack spacing={1.5} data-testid={`bank-sync-add-bank-form-${connectionId}`}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.addBankHelp}</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label={t.country.value}
          placeholder="FI"
          value={country}
          onChange={event => setCountry(event.target.value.toUpperCase().slice(0, 2))}
          sx={{ width: 120 }}
          slotProps={{ htmlInput: { 'data-testid': 'bank-sync-country' } }}
        />
        <Button
          size="small"
          onClick={() => void load()}
          disabled={working || country.trim().length !== 2}
        >
          {t.findBanks}
        </Button>
      </Box>

      {banks && banks.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label={t.bank.value}
            value={bank}
            onChange={event => setBank(event.target.value)}
            sx={{ minWidth: 260 }}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="">{t.chooseBank.value}</option>
            {banks.map(item => (
              <option key={item.name} value={item.name}>
                {item.beta ? `${item.name} (beta)` : item.name}
              </option>
            ))}
          </TextField>
          <Button
            size="small"
            variant="contained"
            onClick={() => void authorize()}
            disabled={working || bank.length === 0}
            data-testid="bank-sync-authorize"
          >
            {t.authorize}
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
