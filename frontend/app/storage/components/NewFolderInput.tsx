'use client';

import { Box, IconButton, TextField, Typography } from '@mui/material';
import React from 'react';
import { Plus } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import type { StorageFile } from '../storageHelpers';

export interface NewFolderInputProps {
  newFolderName: string;
  folderCreatePlaceholder: string;
  folderCreateTooltip: string;
  draggingFile: StorageFile | null;
  dragDropSubtitleLabel: React.ReactNode;
  onSetNewFolderName: (name: string) => void;
  onCreateFolder: () => void;
  clampFolderName: ({ value, current }: { value: string; current: string }) => string;
}

const addBtnSx = {
  bgcolor: 'var(--primary-fill)',
  color: '#fff',
  borderRadius: tokens.radius.full,
  '&:hover': { bgcolor: 'primary.dark' },
  '&:disabled': { bgcolor: 'var(--border-color)', cursor: 'not-allowed' },
};
const textFieldSx = { flex: 1 };

function AddFolderButton({
  disabled,
  onClick,
  title,
}: {
  disabled: boolean;
  onClick: () => void;
  title: string;
}): React.JSX.Element {
  return (
    <IconButton onClick={onClick} disabled={disabled} title={title} sx={addBtnSx}>
      <Plus size={18} />
    </IconButton>
  );
}

export function NewFolderInput({
  newFolderName,
  folderCreatePlaceholder,
  folderCreateTooltip,
  draggingFile,
  dragDropSubtitleLabel,
  onSetNewFolderName,
  onCreateFolder,
  clampFolderName,
}: NewFolderInputProps): React.JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    onSetNewFolderName(clampFolderName({ value: event.target.value, current: newFolderName }));
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', gap: 1, minWidth: 220 }}>
        <TextField
          size="small"
          value={newFolderName}
          onChange={handleChange}
          placeholder={folderCreatePlaceholder}
          sx={textFieldSx}
        />
        <AddFolderButton
          disabled={!newFolderName.trim()}
          onClick={onCreateFolder}
          title={folderCreateTooltip}
        />
      </Box>
      {draggingFile && (
        <Typography style={{ fontSize: 12, color: 'var(--color-primary, #168118)' }}>
          {dragDropSubtitleLabel}
        </Typography>
      )}
    </Box>
  );
}
