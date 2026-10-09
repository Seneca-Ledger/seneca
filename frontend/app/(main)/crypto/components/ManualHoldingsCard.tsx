'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { Trash2 } from '@/app/components/icons';
import type { CryptoWallet, ManualHoldingInput } from '../hooks/useCrypto';

type ManualHoldingsCardProps = {
  /** The workspace's manual wallet, when it has one. */
  wallet: CryptoWallet | null;
  balances: { asset: string; amount: string }[];
  saving: boolean;
  labels: {
    title: string;
    add: string;
    ticker: string;
    amount: string;
    costPerUnit: string;
    save: string;
    cancel: string;
    remove: string;
  };
  onSave: (holding: ManualHoldingInput) => Promise<boolean>;
  onRemove: (asset: string) => void;
};

/**
 * Coins the user keeps themselves — on an exchange, or in cold storage. They sit
 * next to the synced wallets because they are the same thing to every number on
 * the page: part of the portfolio, part of net worth.
 */
export function ManualHoldingsCard({
  balances,
  saving,
  labels,
  onSave,
  onRemove,
}: ManualHoldingsCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');

  const submit = async (): Promise<void> => {
    const saved = await onSave({
      asset: asset.trim().toUpperCase(),
      amount: amount.trim(),
      costPerUnit: cost.trim() === '' ? undefined : Number(cost),
    });
    if (saved) {
      setAsset('');
      setAmount('');
      setCost('');
      setOpen(false);
    }
  };

  const valid = /^[A-Za-z0-9.$]{2,20}$/.test(asset.trim()) && Number(amount) > 0;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        {labels.title}
      </Typography>

      {balances.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
          {balances.map(balance => (
            <Box
              key={balance.asset}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography variant="body2">
                {balance.amount} {balance.asset}
              </Typography>
              <IconButton
                size="small"
                aria-label={`${labels.remove} ${balance.asset}`}
                onClick={() => onRemove(balance.asset)}
              >
                <Trash2 size={16} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {open ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
          <TextField
            size="small"
            label={labels.ticker}
            value={asset}
            onChange={event => setAsset(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 20 } }}
          />
          <TextField
            size="small"
            label={labels.amount}
            value={amount}
            onChange={event => setAmount(event.target.value)}
            inputMode="decimal"
          />
          <TextField
            size="small"
            label={labels.costPerUnit}
            value={cost}
            onChange={event => setCost(event.target.value)}
            inputMode="decimal"
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" size="small" disabled={!valid || saving} onClick={submit}>
              {labels.save}
            </Button>
            <Button size="small" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
          </Box>
        </Box>
      ) : (
        <Button size="small" sx={{ mt: 1 }} onClick={() => setOpen(true)}>
          {labels.add}
        </Button>
      )}
    </Paper>
  );
}
