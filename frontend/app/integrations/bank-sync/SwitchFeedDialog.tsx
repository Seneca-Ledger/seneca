'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import {
  BANK_SYNC_BASE,
  type BankSyncConnection,
  type FeedRef,
  type RunAction,
  type WalletOption,
} from './types';

/**
 * Moves a wallet's feed to another provider. Nothing is deleted: the new feed
 * starts the day after the wallet's last known row, so the history stays and the
 * replayed months do not come back as duplicates.
 */
export function SwitchFeedDialog({
  feed,
  connections,
  wallets,
  onClose,
  onRun,
  onReload,
}: {
  feed: FeedRef;
  connections: BankSyncConnection[];
  wallets: WalletOption[];
  onClose: () => void;
  onRun: RunAction;
  onReload: () => Promise<void>;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const [target, setTarget] = useState('');

  const wallet = wallets.find(item => item.id === feed.walletId);

  /** Every account that is free to take this wallet, outside the feed being replaced. */
  const options = useMemo(
    () =>
      connections.flatMap(connection =>
        connection.config.accounts
          .filter(
            account =>
              !(connection.id === feed.connectionId && account.id === feed.accountId) &&
              (account.walletId === null || account.walletId === feed.walletId),
          )
          .map(account => ({
            value: `${connection.id}::${account.id}`,
            label: `${connection.label} · ${account.org || connection.provider} · ${account.name}`,
          })),
      ),
    [connections, feed],
  );

  const confirm = () =>
    onRun(
      'switch',
      async () => {
        const [toConnectionId, toAccountId] = target.split('::');
        const url = `${BANK_SYNC_BASE}/feeds/switch`;
        const response = await apiClient.post(url, {
          walletId: feed.walletId,
          toConnectionId,
          toAccountId,
        } satisfies ContractInput<'SwitchBankSyncFeedBody'>);
        const { syncFrom } = await checkContract('BankSyncFeedSwitched', response.data, url);
        await onReload();
        onClose();
        return {
          tone: 'ok',
          text: syncFrom
            ? t.switchDoneFrom.value.replace('{date}', new Date(syncFrom).toLocaleDateString())
            : t.switchDone.value,
        };
      },
      t.switchFailed.value,
    );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{t.switchFeedTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} data-testid="bank-sync-switch-dialog">
          <Typography sx={{ fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
            {t.switchFeedHelp.value.replace('{wallet}', wallet?.name ?? '')}
          </Typography>
          {options.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {t.noSwitchTarget}
            </Typography>
          ) : (
            <TextField
              select
              size="small"
              label={t.switchTo.value}
              value={target}
              onChange={event => setTarget(event.target.value)}
              fullWidth
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="">{t.chooseAccount.value}</option>
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.cancel}</Button>
        <Box>
          <Button
            variant="contained"
            onClick={() => void confirm()}
            disabled={target.length === 0}
            data-testid="bank-sync-switch-confirm"
          >
            {t.switchFeed}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
