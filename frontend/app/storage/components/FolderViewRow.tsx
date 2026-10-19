'use client';

import { Box, IconButton, Typography } from '@mui/material';
import React from 'react';
import toast from 'react-hot-toast';
import { Folder, MoreVertical } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import type { FolderOption } from '../storageHelpers';

export interface FolderViewRowProps {
  folder: FolderOption;
  isPicked: boolean;
  pickedFolderId: string | null;
  dragAndDropLabel: React.ReactNode;
  doneLabel: React.ReactNode;
  fileMovedToLabel: string;
  onSetPickedFolderId: (id: string | null) => void;
  onHandleFolderContextMenu: ({ e, folder }: { e: React.MouseEvent; folder: FolderOption }) => void;
  canEditFolder: (folder: FolderOption) => boolean;
}

const doneBtnSx = {
  ml: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  bgcolor: 'var(--primary-fill)',
  color: '#fff',
  px: 1.5,
  py: 0.5,
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  '&:hover': { bgcolor: 'primary.dark' },
};
const dragBtnSx = {
  ml: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  px: 1,
  py: 0.5,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--muted-foreground)',
  border: 'none',
  bgcolor: 'transparent',
  cursor: 'pointer',
  opacity: 0,
  // Revealed on row hover and on keyboard focus (the row wrapper is role="button").
  '[role="button"]:hover &, &:focus-visible': { opacity: 1 },
  '&:hover': { color: 'primary.main', bgcolor: 'rgba(var(--primary-rgb),0.05)' },
};
const menuBtnSx = {
  color: 'var(--muted-foreground)',
  borderRadius: tokens.radius.full,
  '&:hover': { bgcolor: 'var(--muted)' },
};
const nameSx: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--foreground)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function FolderActionButton({
  folder,
  isPicked,
  pickedFolderId,
  doneLabel,
  dragAndDropLabel,
  fileMovedToLabel,
  onSetPickedFolderId,
}: {
  folder: FolderOption;
  isPicked: boolean;
  pickedFolderId: string | null;
  doneLabel: React.ReactNode;
  dragAndDropLabel: React.ReactNode;
  fileMovedToLabel: string;
  onSetPickedFolderId: (id: string | null) => void;
}): React.JSX.Element | null {
  if (pickedFolderId === null) {
    return (
      <Box
        component="button"
        type="button"
        sx={dragBtnSx}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onSetPickedFolderId(folder.id);
        }}
      >
        {dragAndDropLabel}
      </Box>
    );
  }
  if (isPicked) {
    return (
      <Box
        component="button"
        type="button"
        sx={doneBtnSx}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onSetPickedFolderId(null);
          toast.success(`${fileMovedToLabel} "${folder.name}"`);
        }}
      >
        {doneLabel}
      </Box>
    );
  }
  return null;
}

export function FolderViewRow({
  folder,
  isPicked,
  pickedFolderId,
  dragAndDropLabel,
  doneLabel,
  fileMovedToLabel,
  onSetPickedFolderId,
  onHandleFolderContextMenu,
  canEditFolder,
}: FolderViewRowProps): React.JSX.Element {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          textAlign: 'left',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Folder
            style={{ width: 16, height: 16, color: folder.tag?.color ?? 'var(--muted-foreground)' }}
          />
          <Typography style={nameSx}>{folder.name}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderActionButton
          folder={folder}
          isPicked={isPicked}
          pickedFolderId={pickedFolderId}
          doneLabel={doneLabel}
          dragAndDropLabel={dragAndDropLabel}
          fileMovedToLabel={fileMovedToLabel}
          onSetPickedFolderId={onSetPickedFolderId}
        />
        {canEditFolder(folder) && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="small"
              sx={menuBtnSx}
              onClick={e => {
                e.stopPropagation();
                onHandleFolderContextMenu({ e, folder });
              }}
            >
              <MoreVertical size={16} />
            </IconButton>
          </Box>
        )}
      </Box>
    </>
  );
}
