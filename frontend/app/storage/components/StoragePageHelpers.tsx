'use client';

import { Box, Modal } from '@mui/material';
import { useTheme } from 'next-themes';
import React from 'react';
import { tokens } from '@/lib/theme-tokens';
import type { FolderOption } from '../storageHelpers';

// ─── FolderContextMenu ────────────────────────────────────────────────────────

export interface FolderContextMenuProps {
  folderContextMenu: { x: number; y: number; folder: FolderOption } | null;
  setFolderContextMenu: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; folder: FolderOption } | null>
  >;
  setFolderTagPickerId: (id: string | null) => void;
  handleStartEditFolder: (folder: FolderOption) => void;
  confirmDeleteFolder: (folder: FolderOption) => void;
  tagsTitle: string;
  renameTooltip: string;
  deleteTooltip: string;
}

export function FolderContextMenu({
  folderContextMenu,
  setFolderContextMenu,
  setFolderTagPickerId,
  handleStartEditFolder,
  confirmDeleteFolder,
  tagsTitle,
  renameTooltip,
  deleteTooltip,
}: FolderContextMenuProps): React.JSX.Element | null {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  if (!folderContextMenu) {
    return null;
  }
  const topOffset =
    typeof window !== 'undefined' && folderContextMenu.y + 160 > window.innerHeight
      ? folderContextMenu.y - 160
      : folderContextMenu.y;
  const leftOffset =
    typeof window !== 'undefined' && folderContextMenu.x + 200 > window.innerWidth
      ? folderContextMenu.x - 200
      : folderContextMenu.x;
  // Modal keeps focus inside the menu, closes it on Escape and restores focus.
  return (
    <Modal open onClose={() => setFolderContextMenu(null)} hideBackdrop>
      <Box
        tabIndex={-1}
        sx={{
          position: 'fixed',
          zIndex: 100,
          minWidth: 200,
          overflow: 'hidden',
          border: `1px solid ${c.ink150}`,
          bgcolor: 'background.paper',
          boxShadow: 24,
          outline: 'none',
        }}
        style={{ top: topOffset, left: leftOffset }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key !== 'Escape') {
            e.stopPropagation();
          }
        }}
        role="presentation"
      >
        <Box sx={{ p: 0.75, display: 'flex', flexDirection: 'column' }}>
          <Box
            component="button"
            type="button"
            onClick={() => {
              setFolderTagPickerId(folderContextMenu.folder.id);
              setFolderContextMenu(null);
            }}
            sx={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              fontSize: 14,
              color: c.ink800,
              bgcolor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              '&:hover': { bgcolor: c.ink50 },
            }}
          >
            <span>{tagsTitle}</span>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => {
              handleStartEditFolder(folderContextMenu.folder);
              setFolderContextMenu(null);
            }}
            sx={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              fontSize: 14,
              color: c.ink800,
              bgcolor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              '&:hover': { bgcolor: c.ink50 },
            }}
          >
            <span>{renameTooltip}</span>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => {
              confirmDeleteFolder(folderContextMenu.folder);
              setFolderContextMenu(null);
            }}
            sx={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              fontSize: 14,
              color: c.danger,
              bgcolor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              '&:hover': { bgcolor: c.dangerSoft },
            }}
          >
            <span>{deleteTooltip}</span>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
