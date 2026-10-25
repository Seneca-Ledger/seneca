'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { MoreHorizontal, RefreshCcw } from '@/app/components/icons';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import type { CryptoWallet } from '../hooks/useCrypto';
import { shortenAddress } from './address';

type ConnectedWalletsLabels = {
  title: string;
  sync: string;
  remove: string;
  transactions: string;
  neverSynced: string;
  /** "{{chain}} wallet", for a wallet whose name is just its network. */
  walletOfChain: string;
  copyAddress: string;
  copied: string;
  /** "Synced today, {{time}}" */
  syncedToday: string;
  /** "Synced {{date}}" */
  syncedOn: string;
  moreActions: string;
  /** "Remove {{name}}? …" */
  removeConfirm: string;
  cancel: string;
};

type ConnectedWalletsCardProps = {
  wallets: CryptoWallet[];
  locale: string;
  busyWalletId: string | null;
  labels: ConnectedWalletsLabels;
  onSync: (id: string) => void;
  onRemove: (id: string) => void;
};

/** "Tron" named "Tron" says the network twice; it becomes "Tron wallet". */
function walletName(wallet: CryptoWallet, labels: ConnectedWalletsLabels): string {
  const label = wallet.label?.trim();
  return !label || label.toLowerCase() === wallet.chainName.toLowerCase()
    ? labels.walletOfChain.replace('{{chain}}', wallet.chainName)
    : label;
}

/** "Synced today, 12:45", or "Synced Oct 14": no seconds, no numeric date. */
function syncedLabel(iso: string, locale: string, labels: ConnectedWalletsLabels): string {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
      date,
    );
    return labels.syncedToday.replace('{{time}}', time);
  }
  const day = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
  return labels.syncedOn.replace('{{date}}', day);
}

/** The shortened address; a click copies the whole one. */
function AddressCopy({
  address,
  labels,
}: {
  address: string;
  labels: ConnectedWalletsLabels;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip title={copied ? labels.copied : labels.copyAddress}>
      <Box
        component="button"
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label={`${labels.copyAddress}: ${address}`}
        sx={{
          p: 0,
          border: 0,
          background: 'none',
          font: 'inherit',
          fontSize: 13,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
          cursor: 'copy',
          '&:hover': { color: 'text.primary' },
        }}
      >
        {shortenAddress(address)}
      </Box>
    </Tooltip>
  );
}

/**
 * The wallets as a narrow list beside Holdings: reference information, not a
 * card of its own. Each row says its network and its size in one grey line;
 * the actions show on the row under the pointer, and removing one is in the
 * "…" menu behind a confirmation, away from the sync button it sat next to.
 */
export function ConnectedWalletsCard({
  wallets,
  locale,
  busyWalletId,
  labels,
  onSync,
  onRemove,
}: ConnectedWalletsCardProps): React.JSX.Element {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; wallet: CryptoWallet } | null>(null);
  const [confirming, setConfirming] = useState<CryptoWallet | null>(null);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
        }}
      >
        {labels.title}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
        {wallets.map(wallet => {
          const name = walletName(wallet, labels);
          return (
            <Box
              key={wallet.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0, pb: 0 },
                '& .wallet-actions': { opacity: 0, transition: 'opacity 0.15s' },
                '&:hover .wallet-actions, &:focus-within .wallet-actions': { opacity: 1 },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    fontWeight: 500,
                  }}
                >
                  {name}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {wallet.chainName} · {wallet.transactionCount} {labels.transactions}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  {wallet.address && <AddressCopy address={wallet.address} labels={labels} />}
                  <Typography sx={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {wallet.lastSyncedAt
                      ? syncedLabel(wallet.lastSyncedAt, locale, labels)
                      : labels.neverSynced}
                  </Typography>
                </Box>
                {wallet.lastSyncError && (
                  <Typography
                    sx={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', mt: 0.25 }}
                  >
                    {wallet.lastSyncError}
                  </Typography>
                )}
              </Box>

              <Box className="wallet-actions" sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                {wallet.kind === 'onchain' && (
                  <Tooltip title={labels.sync}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`${labels.sync} ${name}`}
                        disabled={busyWalletId === wallet.id}
                        onClick={() => onSync(wallet.id)}
                      >
                        <RefreshCcw size={15} />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                <IconButton
                  size="small"
                  aria-label={`${labels.moreActions}: ${name}`}
                  aria-haspopup="menu"
                  disabled={busyWalletId === wallet.id}
                  onClick={event => setMenu({ anchor: event.currentTarget, wallet })}
                >
                  <MoreHorizontal size={16} />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Menu anchorEl={menu?.anchor ?? null} open={menu !== null} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setConfirming(menu?.wallet ?? null);
            setMenu(null);
          }}
          sx={{ color: 'var(--money-down)' }}
        >
          {labels.remove}
        </MenuItem>
      </Menu>

      {confirming && (
        <ModalShell
          isOpen
          onClose={() => setConfirming(null)}
          title={labels.remove}
          size="sm"
          footer={
            <ModalFooter
              onCancel={() => setConfirming(null)}
              cancelText={labels.cancel}
              onConfirm={() => {
                onRemove(confirming.id);
                setConfirming(null);
              }}
              confirmText={labels.remove}
              confirmVariant="destructive"
            />
          }
        >
          <Typography variant="body2">
            {labels.removeConfirm.replace('{{name}}', walletName(confirming, labels))}
          </Typography>
        </ModalShell>
      )}
    </Paper>
  );
}
