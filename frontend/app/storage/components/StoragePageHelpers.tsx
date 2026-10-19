'use client';

import { Box, Modal, Typography } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import React from 'react';
import { tokens } from '@/lib/theme-tokens';
import { DropboxStorageWidget } from '../../components/DropboxStorageWidget';
import { GoogleDriveStorageWidget } from '../../components/GoogleDriveStorageWidget';
import type { FolderOption } from '../storageHelpers';

// ─── StorageProviderSelector ──────────────────────────────────────────────────

export interface StorageProviderSelectorProps {
  selectedStorageProvider: 'google' | 'dropbox';
  onSelect: (p: 'google' | 'dropbox') => void;
  locale: string;
}

export function StorageProviderSelector({
  selectedStorageProvider,
  onSelect,
  locale,
}: StorageProviderSelectorProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box sx={{ display: 'inline-flex', bgcolor: c.ink50, p: 0.5 }}>
          <Box
            component="button"
            type="button"
            onClick={() => onSelect('google')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.75,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              bgcolor: selectedStorageProvider === 'google' ? 'background.paper' : 'transparent',
            }}
          >
            <Image src="/icons/google-drive-icon.png" alt="Google Drive" width={18} height={18} />
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              Google Drive
            </Box>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => onSelect('dropbox')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.75,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              bgcolor: selectedStorageProvider === 'dropbox' ? 'background.paper' : 'transparent',
            }}
          >
            <Image src="/icons/dropbox-icon.png" alt="Dropbox" width={18} height={18} />
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              Dropbox
            </Box>
          </Box>
        </Box>
      </Box>
      {selectedStorageProvider === 'google' ? (
        <GoogleDriveStorageWidget locale={locale} />
      ) : (
        <DropboxStorageWidget locale={locale} />
      )}
    </Box>
  );
}

// ─── GmailSection ─────────────────────────────────────────────────────────────

// eslint-disable-next-line max-params
export type TxFn = (path: string[], fallback: string) => string;

export interface GmailSectionProps {
  gmailStatus: { connected?: boolean } | null;
  gmailLoading: boolean;
  router: ReturnType<typeof useRouter>;
  tx: TxFn;
}

export function GmailSection({
  gmailStatus,
  gmailLoading,
  router,
  tx,
}: GmailSectionProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const isConnected = gmailStatus?.connected === true;
  return (
    <Box sx={{ border: `1px solid ${c.ink150}`, bgcolor: 'background.paper', p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              bgcolor: c.dangerSoft,
              color: c.danger,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image src="/icons/gmail.png" alt="Gmail" width={20} height={20} />
          </Box>
          <Box>
            <Typography style={{ fontSize: 14, color: c.ink500 }}>
              {tx(['gmail', 'title'], 'Gmail Receipts')}
            </Typography>
            <Typography style={{ fontWeight: 600, color: c.ink900 }}>
              {tx(['gmail', 'subtitle'], 'Auto-imported receipts from Gmail')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Box
            component="button"
            onClick={() => router.push('/statements')}
            disabled={!isConnected || gmailLoading}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              fontSize: 14,
              fontWeight: 600,
              bgcolor: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              border: 'none',
              opacity: isConnected && !gmailLoading ? 1 : 0.5,
              '&:disabled': { cursor: 'not-allowed' },
              '&:hover': { bgcolor: 'var(--color-info-soft-text)' },
            }}
          >
            {tx(['gmail', 'viewReceipts'], 'View Receipts')}
          </Box>
          <Box
            component="button"
            onClick={() => router.push('/integrations/gmail')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              border: `1px solid ${c.ink150}`,
              px: 2,
              py: 1,
              fontSize: 14,
              fontWeight: 600,
              color: c.ink800,
              bgcolor: 'transparent',
              cursor: 'pointer',
              '&:hover': { bgcolor: c.ink50 },
            }}
          >
            {isConnected
              ? tx(['gmail', 'settings'], 'Settings')
              : tx(['gmail', 'connect'], 'Connect')}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

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
