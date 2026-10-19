'use client';

import { Box, IconButton, TextField } from '@mui/material';
import React from 'react';
import { Check, X } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import type { FolderOption } from '../storageHelpers';

export interface FolderEditRowProps {
  folder: FolderOption;
  editingFolderName: string;
  onSetEditingFolderName: (name: string) => void;
  onRenameFolder: (id: string) => void;
  onCancelEditFolder: () => void;
  clampFolderName: ({ value, current }: { value: string; current: string }) => string;
}

const confirmBtnSx = {
  bgcolor: 'var(--primary-fill)',
  color: '#fff',
  borderRadius: tokens.radius.full,
  '&:hover': { bgcolor: 'primary.dark' },
};
const cancelBtnSx = {
  border: '1px solid var(--border-color)',
  borderRadius: tokens.radius.full,
  color: 'var(--muted-foreground)',
  '&:hover': { bgcolor: 'var(--muted)' },
};
const textFieldSx = { flex: 1 };

export function FolderEditRow({
  folder,
  editingFolderName,
  onSetEditingFolderName,
  onRenameFolder,
  onCancelEditFolder,
  clampFolderName,
}: FolderEditRowProps): React.JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onSetEditingFolderName(
      clampFolderName({ value: event.target.value, current: editingFolderName }),
    );
  };
  const handleConfirm = (event: React.MouseEvent): void => {
    event.stopPropagation();
    onRenameFolder(folder.id);
  };
  const handleCancel = (event: React.MouseEvent): void => {
    event.stopPropagation();
    onCancelEditFolder();
  };
  return (
    <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', gap: 1 }}>
      <TextField
        size="small"
        value={editingFolderName}
        onChange={handleChange}
        onClick={e => e.stopPropagation()}
        sx={textFieldSx}
      />
      <IconButton size="small" onClick={handleConfirm} sx={confirmBtnSx}>
        <Check size={16} />
      </IconButton>
      <IconButton size="small" onClick={handleCancel} sx={cancelBtnSx}>
        <X size={16} />
      </IconButton>
    </Box>
  );
}
