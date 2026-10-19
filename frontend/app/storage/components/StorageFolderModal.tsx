'use client';

import { Box, IconButton, Modal, Typography } from '@mui/material';
import React from 'react';
import { X } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import { StorageFoldersSidebar, type StorageFoldersSidebarProps } from './StorageFoldersSidebar';
import { StorageTagsPanel, type StorageTagsPanelProps } from './StorageTagsPanel';

type SidebarProps = Omit<StorageFoldersSidebarProps, never>;
type TagsPanelProps = Omit<StorageTagsPanelProps, never>;

export interface StorageFolderModalProps {
  modalTitle: React.ReactNode;
  modalSubtitle: React.ReactNode;
  sidebarProps: SidebarProps;
  tagsPanelProps: TagsPanelProps;
  onClose: () => void;
}

export function StorageFolderModal({
  modalTitle,
  modalSubtitle,
  sidebarProps,
  tagsPanelProps,
  onClose,
}: StorageFolderModalProps): React.JSX.Element {
  const titleId = React.useId();
  // Modal traps focus inside, closes on Escape and restores focus on unmount.
  return (
    <Modal open onClose={onClose} hideBackdrop>
      <Box tabIndex={-1} sx={{ outline: 'none' }}>
        <Box
          sx={{ position: 'fixed', inset: 0, zIndex: 70, bgcolor: 'rgba(0,0,0,0.3)' }}
          aria-hidden="true"
          onClick={onClose}
        />
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Box
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            sx={{
              display: 'flex',
              width: '100%',
              maxWidth: 1380,
              minHeight: '70vh',
              maxHeight: '90vh',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              bgcolor: 'background.paper',
            }}
          >
            <ModalHeader
              titleId={titleId}
              title={modalTitle}
              subtitle={modalSubtitle}
              onClose={onClose}
            />
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <StorageFoldersSidebar {...sidebarProps} />
              <Box
                sx={{
                  borderLeft: '1px solid var(--muted)',
                  p: 2,
                  width: 320,
                  flexShrink: 0,
                  overflowY: 'auto',
                }}
              >
                <StorageTagsPanel {...tagsPanelProps} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

interface ModalHeaderProps {
  titleId: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  onClose: () => void;
}

function ModalHeader({ titleId, title, subtitle, onClose }: ModalHeaderProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--muted)',
        px: 3,
        py: 2,
      }}
    >
      <Box>
        <Typography
          id={titleId}
          style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}
        >
          {title}
        </Typography>
        <Typography style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          {subtitle}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onClose} sx={{ borderRadius: tokens.radius.sm }}>
        <X size={18} />
      </IconButton>
    </Box>
  );
}
