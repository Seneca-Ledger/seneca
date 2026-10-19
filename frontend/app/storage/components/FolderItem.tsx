'use client';

import { Box } from '@mui/material';
import React from 'react';
import type { FolderOption, TagOption } from '../storageHelpers';
import { DroppableFolderButton } from './DroppableFolderButton';
import { FolderEditRow } from './FolderEditRow';
import { FolderTagPicker } from './FolderTagPicker';
import { FolderViewRow } from './FolderViewRow';

export interface FolderItemProps {
  folder: FolderOption;
  tags: TagOption[];
  activeFolderId: string | null;
  pickedFolderId: string | null;
  editingFolderId: string | null;
  editingFolderName: string;
  folderTagPickerId: string | null;
  folderCount?: number;
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

const baseButtonStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  border: '1px solid',
};
const pickedButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: 'var(--primary)',
  background: 'rgba(var(--primary-rgb),0.05)',
  cursor: 'ns-resize',
  boxShadow: '0 4px 16px -4px rgba(12,12,20,0.08)',
  zIndex: 10,
};
const activeButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: 'rgba(var(--primary-rgb),0.3)',
  background: 'rgba(var(--primary-rgb),0.05)',
  cursor: 'pointer',
  boxShadow: 'none',
};
const inactiveButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: 'var(--muted)',
  background: 'transparent',
  cursor: 'pointer',
  boxShadow: 'none',
};

function getFolderButtonStyle({
  isPicked,
  isActive,
}: {
  isPicked: boolean;
  isActive: boolean;
}): React.CSSProperties {
  if (isPicked) {
    return pickedButtonStyle;
  }
  if (isActive) {
    return activeButtonStyle;
  }
  return inactiveButtonStyle;
}

function FolderItemContent({
  folder,
  editingFolderId,
  editingFolderName,
  pickedFolderId,
  isPicked,
  dragAndDropLabel,
  doneLabel,
  fileMovedToLabel,
  onSetPickedFolderId,
  onHandleFolderContextMenu,
  canEditFolder,
  onSetEditingFolderName,
  onRenameFolder,
  onCancelEditFolder,
  clampFolderName,
}: {
  folder: FolderOption;
  editingFolderId: string | null;
  editingFolderName: string;
  pickedFolderId: string | null;
  isPicked: boolean;
  dragAndDropLabel: React.ReactNode;
  doneLabel: React.ReactNode;
  fileMovedToLabel: string;
  onSetPickedFolderId: (id: string | null) => void;
  onHandleFolderContextMenu: ({ e, folder }: { e: React.MouseEvent; folder: FolderOption }) => void;
  canEditFolder: (folder: FolderOption) => boolean;
  onSetEditingFolderName: (name: string) => void;
  onRenameFolder: (id: string) => void;
  onCancelEditFolder: () => void;
  clampFolderName: ({ value, current }: { value: string; current: string }) => string;
}): React.JSX.Element {
  if (editingFolderId === folder.id) {
    return (
      <FolderEditRow
        folder={folder}
        editingFolderName={editingFolderName}
        onSetEditingFolderName={onSetEditingFolderName}
        onRenameFolder={onRenameFolder}
        onCancelEditFolder={onCancelEditFolder}
        clampFolderName={clampFolderName}
      />
    );
  }
  return (
    <FolderViewRow
      folder={folder}
      isPicked={isPicked}
      pickedFolderId={pickedFolderId}
      dragAndDropLabel={dragAndDropLabel}
      doneLabel={doneLabel}
      fileMovedToLabel={fileMovedToLabel}
      onSetPickedFolderId={onSetPickedFolderId}
      onHandleFolderContextMenu={onHandleFolderContextMenu}
      canEditFolder={canEditFolder}
    />
  );
}

export function FolderItem({
  folder,
  tags,
  activeFolderId,
  pickedFolderId,
  editingFolderId,
  editingFolderName,
  folderTagPickerId,
  dragAndDropLabel,
  doneLabel,
  fileMovedToLabel,
  tagsTitle,
  tagsClearLabel,
  onSetActiveFolderId,
  onSetPickedFolderId,
  onSetEditingFolderName,
  onSetFolderTagPickerId,
  onRenameFolder,
  onCancelEditFolder,
  onUpdateFolderTag,
  onConfirmDeleteFolder,
  onStartEditFolder,
  onHandleFolderContextMenu,
  canEditFolder,
  clampFolderName,
}: FolderItemProps): React.JSX.Element {
  const isPicked = pickedFolderId === folder.id;
  const isActive = activeFolderId === folder.id;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <DroppableFolderButton
        folderId={folder.id}
        active={isActive}
        onClick={() => onSetActiveFolderId(folder.id)}
        onContextMenu={e => onHandleFolderContextMenu({ e, folder })}
        style={getFolderButtonStyle({ isPicked, isActive })}
      >
        <FolderItemContent
          folder={folder}
          editingFolderId={editingFolderId}
          editingFolderName={editingFolderName}
          pickedFolderId={pickedFolderId}
          isPicked={isPicked}
          dragAndDropLabel={dragAndDropLabel}
          doneLabel={doneLabel}
          fileMovedToLabel={fileMovedToLabel}
          onSetPickedFolderId={onSetPickedFolderId}
          onHandleFolderContextMenu={onHandleFolderContextMenu}
          canEditFolder={canEditFolder}
          onSetEditingFolderName={onSetEditingFolderName}
          onRenameFolder={onRenameFolder}
          onCancelEditFolder={onCancelEditFolder}
          clampFolderName={clampFolderName}
        />
      </DroppableFolderButton>
      {folderTagPickerId === folder.id && canEditFolder(folder) && (
        <FolderTagPicker
          folder={folder}
          tags={tags}
          tagsTitle={tagsTitle}
          tagsClearLabel={tagsClearLabel}
          onUpdateFolderTag={onUpdateFolderTag}
          onConfirmDeleteFolder={onConfirmDeleteFolder}
          onStartEditFolder={onStartEditFolder}
          onSetFolderTagPickerId={onSetFolderTagPickerId}
        />
      )}
    </Box>
  );
}
