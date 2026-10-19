'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { Trash2 } from '@/app/components/icons';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import type { ManualHoldingInput } from '../hooks/useCrypto';

type ManualHoldingsDialogProps = {
  open: boolean;
  onClose: () => void;
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

/** Labels stay above the fields, so a filled-in form still says what each value is. */
const LABEL_ON_TOP = { inputLabel: { shrink: true } } as const;

/**
 * Coins the user keeps themselves — on an exchange, or in cold storage. They
 * count like the synced wallets in every number on the page, so they show in
 * Holdings; this dialog, opened from there, is where they are added and removed
 * — a whole card for one link left a hole beside the wallets.
 */
export function ManualHoldingsDialog({
  open,
  onClose,
  balances,
  saving,
  labels,
  onSave,
  onRemove,
}: ManualHoldingsDialogProps): React.JSX.Element | null {
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');

  if (!open) {
    return null;
  }

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
      onClose();
    }
  };

  const valid = /^[A-Za-z0-9.$]{2,20}$/.test(asset.trim()) && Number(amount) > 0;

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={labels.title}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText={labels.cancel}
          onConfirm={() => void submit()}
          confirmText={labels.save}
          isConfirmLoading={saving}
          isConfirmDisabled={!valid || saving}
        />
      }
    >
      {balances.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
          {balances.map(balance => (
            <Box
              key={balance.asset}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
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

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, pt: 1 }}>
        <TextField
          size="small"
          label={labels.ticker}
          value={asset}
          onChange={event => setAsset(event.target.value)}
          slotProps={{ ...LABEL_ON_TOP, htmlInput: { maxLength: 20 } }}
        />
        <TextField
          size="small"
          label={labels.amount}
          value={amount}
          onChange={event => setAmount(event.target.value)}
          slotProps={{ ...LABEL_ON_TOP, htmlInput: { inputMode: 'decimal' } }}
        />
        <TextField
          size="small"
          label={labels.costPerUnit}
          value={cost}
          onChange={event => setCost(event.target.value)}
          slotProps={{ ...LABEL_ON_TOP, htmlInput: { inputMode: 'decimal' } }}
        />
      </Box>
    </ModalShell>
  );
}
