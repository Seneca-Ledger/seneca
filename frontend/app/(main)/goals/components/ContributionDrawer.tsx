'use client';

import TextField from '@mui/material/TextField';
import { GoalSideDrawer } from './GoalSideDrawer';

interface ContributionDrawerProps {
  open: boolean;
  title: string;
  amount: string;
  note: string;
  saving: boolean;
  labels: { amount: string; note: string; save: string; cancel: string };
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function ContributionDrawer({
  open,
  title,
  amount,
  note,
  saving,
  labels,
  onAmountChange,
  onNoteChange,
  onClose,
  onSave,
}: ContributionDrawerProps) {
  // Zero would be a no-op row in the log; anything else, including a
  // negative withdrawal, is a real movement.
  const canSave = amount.trim() !== '' && Number(amount) !== 0;

  return (
    <GoalSideDrawer
      open={open}
      title={title}
      saving={saving}
      canSave={canSave}
      labels={labels}
      onClose={onClose}
      onSave={onSave}
    >
      <TextField
        label={labels.amount}
        type="number"
        autoFocus
        fullWidth
        value={amount}
        onChange={event => onAmountChange(event.target.value)}
        slotProps={{ htmlInput: { step: '0.01' } }}
      />
      <TextField
        label={labels.note}
        fullWidth
        value={note}
        onChange={event => onNoteChange(event.target.value)}
      />
    </GoalSideDrawer>
  );
}
