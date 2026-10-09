'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { RefreshCcw, Trash2, Wallet } from '@/app/components/icons';
import type { CryptoWallet } from '../hooks/useCrypto';

type ConnectedWalletsLabels = {
  title: string;
  sync: string;
  remove: string;
  transactions: string;
  neverSynced: string;
};

type ConnectedWalletsCardProps = {
  wallets: CryptoWallet[];
  locale: string;
  busyWalletId: string | null;
  labels: ConnectedWalletsLabels;
  onSync: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * One card for all the wallets, with a hairline between them.
 *
 * A card per wallet put a border around every row and left the section's own
 * title floating outside all of them; a card inside a card would only double the
 * borders. One frame, one title, and the rows told apart by a line — which is
 * also how the rest of the app separates items of one list.
 */
export function ConnectedWalletsCard({
  wallets,
  locale,
  busyWalletId,
  labels,
  onSync,
  onRemove,
}: ConnectedWalletsCardProps): React.JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        {labels.title}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {wallets.map(wallet => (
          <Box
            key={wallet.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 0, pb: 0 },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: 1.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
                color: 'text.secondary',
              }}
            >
              <Wallet size={16} />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" fontWeight={600}>
                  {wallet.label ?? wallet.chainName}
                </Typography>
                <Chip label={wallet.chainName} size="small" variant="outlined" />
              </Box>
              {/* The full address stays visible: unlike a card number it is public,
                  and hiding it would make two wallets impossible to tell apart. */}
              {wallet.address && (
                <Typography
                  variant="caption"
                  component="p"
                  sx={{
                    color: 'text.secondary',
                    fontFamily: 'var(--font-mono, monospace)',
                    wordBreak: 'break-all',
                  }}
                >
                  {wallet.address}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {wallet.transactionCount} {labels.transactions}
                {' · '}
                {wallet.lastSyncedAt
                  ? new Date(wallet.lastSyncedAt).toLocaleString(locale)
                  : labels.neverSynced}
              </Typography>
              {wallet.lastSyncError && (
                <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                  {wallet.lastSyncError}
                </Typography>
              )}
            </Box>

            {/* Icons, not labelled buttons: two words per wallet repeated down the
                list was the loudest thing in the column. */}
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {wallet.kind === 'onchain' && (
                <Tooltip title={labels.sync}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`${labels.sync} ${wallet.label ?? wallet.chainName}`}
                      disabled={busyWalletId === wallet.id}
                      onClick={() => onSync(wallet.id)}
                    >
                      <RefreshCcw size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <Tooltip title={labels.remove}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={`${labels.remove} ${wallet.label ?? wallet.chainName}`}
                    disabled={busyWalletId === wallet.id}
                    onClick={() => onRemove(wallet.id)}
                    sx={{ '&:hover': { color: 'error.main' } }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
