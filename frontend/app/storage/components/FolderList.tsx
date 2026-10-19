'use client';

import { Box, Typography } from '@mui/material';
import React from 'react';
import type { FolderOption, StorageFile, TagOption } from '../storageHelpers';
import { NO_FOLDER } from '../storageHelpers';
import { DroppableFolderButton } from './DroppableFolderButton';
import type { FolderItemProps } from './FolderItem';
import { FolderItem } from './FolderItem';

export interface FolderListProps {
  folders: FolderOption[];
  tags: TagOption[];
  files: StorageFile[];
  activeFolderId: string | null;
  pickedFolderId: string | null;
  editingFolderId: string | null;
  editingFolderName: string;
  folderTagPickerId: string | null;
  folderCounts: { counts: Record<string, number>; noFolder: number };
  scrollHintLabel: string;
  foldersAllLabel: React.ReactNode;
  foldersNoneLabel: React.ReactNode;
  folderListTitleLabel: React.ReactNode;
  folderListEmptyLabel: React.ReactNode;
  dragAndDropLabel: React.ReactNode;
  doneLabel: React.ReactNode;
  fileMovedToLabel: string;
  tagsTitle: React.ReactNode;
  tagsClearLabel: React.ReactNode;
  onSetActiveFolderId: (id: string | null) => void;
  onSetPickedFolderId: (id: string | null) => void;
  onSetEditingFolderName: (name: string) => void;
  onSetFolderTagPickerId: (id: string | null) => void;
  onRenameFolder: (id: string) => void;
  onCancelEditFolder: () => void;
  onUpdateFolderTag: ({ folderId, tagId }: { folderId: string; tagId: string | null }) => void;
  onConfirmDeleteFolder: (folder: FolderOption) => void;
  onStartEditFolder: (folder: FolderOption) => void;
  onHandleFolderContextMenu: ({ e, folder }: { e: React.MouseEvent; folder: FolderOption }) => void;
  canEditFolder: (folder: FolderOption) => boolean;
  clampFolderName: ({ value, current }: { value: string; current: string }) => string;
}

const allBtnBaseSx = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  border: '1px solid',
  px: 2,
  py: 1.5,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

function FolderListHeader({
  folderListTitleLabel,
  pickedFolderId,
  scrollHintLabel,
  foldersCount,
}: {
  folderListTitleLabel: React.ReactNode;
  pickedFolderId: string | null;
  scrollHintLabel: string;
  foldersCount: number;
}): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
          {folderListTitleLabel}
        </Typography>
        {pickedFolderId && (
          <Typography
            style={{
              marginTop: 2,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-primary, #168118)',
              letterSpacing: '-0.025em',
            }}
          >
            {scrollHintLabel}
          </Typography>
        )}
      </Box>
      <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
        {foldersCount}
      </Typography>
    </Box>
  );
}

function buildItemProps({
  props,
  folder,
}: {
  props: FolderListProps;
  folder: FolderOption;
}): FolderItemProps {
  return {
    folder,
    tags: props.tags,
    activeFolderId: props.activeFolderId,
    pickedFolderId: props.pickedFolderId,
    editingFolderId: props.editingFolderId,
    editingFolderName: props.editingFolderName,
    folderTagPickerId: props.folderTagPickerId,
    folderCount: props.folderCounts.counts[folder.id] ?? 0,
    dragAndDropLabel: props.dragAndDropLabel,
    doneLabel: props.doneLabel,
    fileMovedToLabel: props.fileMovedToLabel,
    tagsTitle: props.tagsTitle,
    tagsClearLabel: props.tagsClearLabel,
    onSetActiveFolderId: props.onSetActiveFolderId,
    onSetPickedFolderId: props.onSetPickedFolderId,
    onSetEditingFolderName: props.onSetEditingFolderName,
    onSetFolderTagPickerId: props.onSetFolderTagPickerId,
    onRenameFolder: props.onRenameFolder,
    onCancelEditFolder: props.onCancelEditFolder,
    onUpdateFolderTag: props.onUpdateFolderTag,
    onConfirmDeleteFolder: props.onConfirmDeleteFolder,
    onStartEditFolder: props.onStartEditFolder,
    onHandleFolderContextMenu: props.onHandleFolderContextMenu,
    canEditFolder: props.canEditFolder,
    clampFolderName: props.clampFolderName,
  };
}

function FolderListItems({ props }: { props: FolderListProps }): React.JSX.Element {
  const { folders, folderListEmptyLabel } = props;
  if (folders.length === 0) {
    return (
      <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
        {folderListEmptyLabel}
      </Typography>
    );
  }
  return (
    <>
      {folders.map(folder => (
        <FolderItem key={folder.id} {...buildItemProps({ props, folder })} />
      ))}
    </>
  );
}

function FolderListBody(props: FolderListProps): React.JSX.Element {
  const {
    files,
    activeFolderId,
    folderCounts,
    foldersAllLabel,
    foldersNoneLabel,
    onSetActiveFolderId,
  } = props;
  const isAllActive = activeFolderId === '';
  const isNoFolderActive = activeFolderId === NO_FOLDER;
  return (
    <Box
      sx={{
        mt: 1.5,
        px: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        maxHeight: '45vh',
        overflowY: 'auto',
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => onSetActiveFolderId('')}
        sx={{
          ...allBtnBaseSx,
          bgcolor: isAllActive ? 'rgba(var(--primary-rgb),0.1)' : 'transparent',
          color: isAllActive ? 'primary.main' : 'var(--foreground)',
          borderColor: isAllActive ? 'rgba(var(--primary-rgb),0.4)' : 'var(--muted)',
        }}
      >
        <Box component="span">{foldersAllLabel}</Box>
        <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {files.length}
        </Typography>
      </Box>
      <DroppableFolderButton
        isNoFolder
        active={isNoFolderActive}
        onClick={() => onSetActiveFolderId(NO_FOLDER)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          background: isNoFolderActive ? 'rgba(var(--primary-rgb),0.05)' : 'transparent',
          color: isNoFolderActive ? 'var(--primary)' : 'var(--foreground)',
          border: 'none',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box component="span">{foldersNoneLabel}</Box>
          <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {folderCounts.noFolder}
          </Typography>
        </Box>
      </DroppableFolderButton>
      <FolderListItems props={props} />
    </Box>
  );
}

export function FolderList(props: FolderListProps): React.JSX.Element {
  const { folders, pickedFolderId, scrollHintLabel, folderListTitleLabel } = props;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ border: '1px solid var(--border-color)', p: 1.5 }}>
        <FolderListHeader
          folderListTitleLabel={folderListTitleLabel}
          pickedFolderId={pickedFolderId}
          scrollHintLabel={scrollHintLabel}
          foldersCount={folders.length}
        />
        <FolderListBody {...props} />
      </Box>
    </Box>
  );
}
