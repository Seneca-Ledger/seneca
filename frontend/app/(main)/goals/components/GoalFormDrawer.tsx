'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import type { GoalCover, GoalFormData } from '../hooks/useGoals';
import { GoalCoverPicker, type GoalCoverPickerLabels } from './GoalCoverPicker';
import { GoalCoverThumb } from './GoalCoverThumb';
import { GoalSideDrawer } from './GoalSideDrawer';

interface GoalFormDrawerProps {
  open: boolean;
  title: string;
  form: GoalFormData;
  saving: boolean;
  /** The cover the goal already has, shown until the picker changes it. */
  currentCover: GoalCover | null;
  labels: {
    name: string;
    target: string;
    date: string;
    save: string;
    cancel: string;
    cover: string;
    chooseCover: string;
    picker: GoalCoverPickerLabels;
  };
  onChange: (form: GoalFormData) => void;
  onClose: () => void;
  onSave: () => void;
}

export function GoalFormDrawer({
  open,
  title,
  form,
  saving,
  currentCover,
  labels,
  onChange,
  onClose,
  onSave,
}: GoalFormDrawerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const canSave = form.name.trim() !== '' && form.targetAmount > 0;

  // An untouched form (`cover === undefined`) shows what the goal already has;
  // once the picker has been used, the preview follows the pending choice. A
  // pending photo has no stored file yet, so it previews as the neutral tile
  // until the form is saved.
  const preview: GoalCover | null =
    form.cover === undefined
      ? currentCover
      : form.cover !== null && form.cover.kind === 'preset'
        ? { kind: 'preset', preset: form.cover.preset }
        : null;

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
        label={labels.name}
        autoFocus
        fullWidth
        value={form.name}
        onChange={event => onChange({ ...form, name: event.target.value })}
      />
      <TextField
        label={labels.target}
        type="number"
        fullWidth
        value={form.targetAmount || ''}
        onChange={event => onChange({ ...form, targetAmount: Number(event.target.value) })}
        slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
      />
      <CustomDatePicker
        label={labels.date}
        size="medium"
        value={form.targetDate}
        onChange={targetDate => onChange({ ...form, targetDate })}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <GoalCoverThumb cover={preview} size={56} alt={labels.cover} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {labels.cover}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => setPickerOpen(true)}>
            {labels.chooseCover}
          </Button>
        </Box>
      </Box>

      <GoalCoverPicker
        open={pickerOpen}
        selection={form.cover ?? null}
        labels={labels.picker}
        onSelect={cover => onChange({ ...form, cover })}
        onClose={() => setPickerOpen(false)}
      />
    </GoalSideDrawer>
  );
}
