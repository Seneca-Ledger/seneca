'use client';

import { Box, Typography } from '@mui/material';
import React from 'react';
import { RotateCcw, Trash2 } from '@/app/components/icons';

const restoreSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  border: '1px solid var(--color-success-soft-border)',
  bgcolor: 'var(--color-success-soft-bg)',
  px: 1.5,
  py: 0.75,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-success-soft-text)',
  cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--color-success-soft-bg)' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
};

const deleteSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  border: '1px solid #fecaca',
  bgcolor: 'var(--color-error-soft-bg)',
  px: 1.5,
  py: 0.75,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--destructive)',
  cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--color-error-soft-bg)' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
};

const emptySx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  border: '1px solid var(--border-color)',
  bgcolor: 'background.paper',
  px: 1.5,
  py: 0.75,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground)',
  cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--muted)' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
};

export interface StorageBulkActionsProps {
  selectedTrashCount: number;
  filesLength: number;
  filtersApplied: boolean;
  isTrashView: boolean;
  selectedTrashIds: string[];
  selectedLabel: string;
  restoreSelectedLabel: string;
  deleteSelectedLabel: string;
  emptyActionLabel: string;
  filtersTitleLabel: React.ReactNode;
  filtersButtonLabel: React.ReactNode;
  onBulkRestore: (ids: string[]) => void;
  onOpenBulkDelete: () => void;
  onOpenEmptyTrash: () => void;
}

interface TrashControlsProps {
  selectedTrashCount: number;
  filesLength: number;
  selectedTrashIds: string[];
  selectedLabel: string;
  restoreSelectedLabel: string;
  deleteSelectedLabel: string;
  emptyActionLabel: string;
  onBulkRestore: (ids: string[]) => void;
  onOpenBulkDelete: () => void;
  onOpenEmptyTrash: () => void;
}

function TrashBulkControls({
  selectedTrashCount,
  filesLength,
  selectedTrashIds,
  selectedLabel,
  restoreSelectedLabel,
  deleteSelectedLabel,
  emptyActionLabel,
  onBulkRestore,
  onOpenBulkDelete,
  onOpenEmptyTrash,
}: TrashControlsProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>
        {selectedLabel}
      </Typography>
      <Box
        component="button"
        type="button"
        onClick={() => onBulkRestore(selectedTrashIds)}
        disabled={selectedTrashCount === 0}
        sx={restoreSx}
      >
        <RotateCcw size={14} />
        {restoreSelectedLabel}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={onOpenBulkDelete}
        disabled={selectedTrashCount === 0}
        sx={deleteSx}
      >
        <Trash2 size={14} />
        {deleteSelectedLabel}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={onOpenEmptyTrash}
        disabled={filesLength === 0}
        sx={emptySx}
      >
        <Trash2 size={14} />
        {emptyActionLabel}
      </Box>
    </Box>
  );
}

export function StorageBulkActions({
  selectedTrashCount,
  filesLength,
  filtersApplied,
  isTrashView,
  selectedTrashIds,
  selectedLabel,
  restoreSelectedLabel,
  deleteSelectedLabel,
  emptyActionLabel,
  filtersTitleLabel,
  filtersButtonLabel,
  onBulkRestore,
  onOpenBulkDelete,
  onOpenEmptyTrash,
}: StorageBulkActionsProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1,
      }}
    >
      {isTrashView && (
        <TrashBulkControls
          selectedTrashCount={selectedTrashCount}
          filesLength={filesLength}
          selectedTrashIds={selectedTrashIds}
          selectedLabel={selectedLabel}
          restoreSelectedLabel={restoreSelectedLabel}
          deleteSelectedLabel={deleteSelectedLabel}
          emptyActionLabel={emptyActionLabel}
          onBulkRestore={onBulkRestore}
          onOpenBulkDelete={onOpenBulkDelete}
          onOpenEmptyTrash={onOpenEmptyTrash}
        />
      )}
      {filtersApplied && (
        <Typography style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>
          {filtersTitleLabel} · {filtersButtonLabel}
        </Typography>
      )}
    </Box>
  );
}
