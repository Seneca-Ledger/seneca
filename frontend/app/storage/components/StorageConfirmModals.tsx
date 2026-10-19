'use client';

import { Box, Typography } from '@mui/material';
import React from 'react';
import ConfirmModal from '@/app/components/ConfirmModal';
import { Checkbox } from '@/app/components/ui/checkbox';
import type { FolderOption, StorageFile, TagOption } from '../storageHelpers';

export interface StorageConfirmModalsProps {
  deleteFolderModalOpen: boolean;
  folderToDelete: FolderOption | null;
  deleteFolderWithContents: boolean;
  deleteModalOpen: boolean;
  fileToDelete: StorageFile | null;
  permanentDeleteModalOpen: boolean;
  fileToDeletePermanently: StorageFile | null;
  bulkDeleteModalOpen: boolean;
  emptyTrashModalOpen: boolean;
  deleteTagModalOpen: boolean;
  tagToDelete: TagOption | null;
  selectedTrashCount: number;
  selectedTrashIds: string[];
  folderDeleteTitle: string;
  folderDeleteMessagePrefix: string;
  folderDeleteMessageSuffix: string;
  folderDeleteWithContentsLabel: React.ReactNode;
  folderDeleteMessageFallback: React.ReactNode;
  folderDeleteConfirm: string;
  folderDeleteCancel: string;
  deleteTitle: string;
  deleteMessagePrefix: string;
  deleteMessageSuffix: string;
  deleteMessageFallback: string;
  deleteConfirm: string;
  deleteCancel: string;
  permanentDeleteTitle: string;
  permanentDeleteMessagePrefix: string;
  permanentDeleteMessageSuffix: string;
  permanentDeleteMessageFallback: string;
  permanentDeleteConfirm: string;
  permanentDeleteCancel: string;
  bulkDeleteTitle: string;
  bulkDeleteMessageTemplate: string;
  bulkDeleteConfirm: string;
  bulkDeleteCancel: string;
  emptyTrashTitle: string;
  emptyTrashMessage: string;
  emptyTrashConfirm: string;
  emptyTrashCancel: string;
  tagDeleteTitle: string;
  tagDeleteMessagePrefix: string;
  tagDeleteMessageSuffix: string;
  tagDeleteMessageFallback: string;
  tagDeleteConfirm: string;
  tagDeleteCancel: string;
  onCloseDeleteFolder: () => void;
  onConfirmDeleteFolder: () => void;
  onSetDeleteFolderWithContents: (v: boolean) => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  onClosePermanentDelete: () => void;
  onConfirmPermanentDelete: () => void;
  onCloseBulkDelete: () => void;
  onConfirmBulkDelete: () => void;
  onCloseEmptyTrash: () => void;
  onConfirmEmptyTrash: () => void;
  onCloseDeleteTag: () => void;
  onConfirmDeleteTag: () => void;
}

function DeleteFolderMessage({
  folderToDelete,
  deleteFolderWithContents,
  messagePrefix,
  messageSuffix,
  messageFallback,
  withContentsLabel,
  onSetDeleteFolderWithContents,
}: {
  folderToDelete: FolderOption | null;
  deleteFolderWithContents: boolean;
  messagePrefix: string;
  messageSuffix: string;
  messageFallback: React.ReactNode;
  withContentsLabel: React.ReactNode;
  onSetDeleteFolderWithContents: (v: boolean) => void;
}): React.JSX.Element {
  if (!folderToDelete) {
    return (
      <Typography style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {messageFallback}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {messagePrefix}
        {folderToDelete.name}
        {messageSuffix}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontSize: 14,
          color: 'var(--text-secondary)',
        }}
      >
        <Checkbox
          checked={deleteFolderWithContents}
          onCheckedChange={onSetDeleteFolderWithContents}
          className="h-4 w-4"
        />
        {withContentsLabel}
      </Box>
    </Box>
  );
}

export function StorageConfirmModals({
  deleteFolderModalOpen,
  folderToDelete,
  deleteFolderWithContents,
  deleteModalOpen,
  fileToDelete,
  permanentDeleteModalOpen,
  fileToDeletePermanently,
  bulkDeleteModalOpen,
  emptyTrashModalOpen,
  deleteTagModalOpen,
  tagToDelete,
  selectedTrashCount,
  folderDeleteTitle,
  folderDeleteMessagePrefix,
  folderDeleteMessageSuffix,
  folderDeleteWithContentsLabel,
  folderDeleteMessageFallback,
  folderDeleteConfirm,
  folderDeleteCancel,
  deleteTitle,
  deleteMessagePrefix,
  deleteMessageSuffix,
  deleteMessageFallback,
  deleteConfirm,
  deleteCancel,
  permanentDeleteTitle,
  permanentDeleteMessagePrefix,
  permanentDeleteMessageSuffix,
  permanentDeleteMessageFallback,
  permanentDeleteConfirm,
  permanentDeleteCancel,
  bulkDeleteTitle,
  bulkDeleteMessageTemplate,
  bulkDeleteConfirm,
  bulkDeleteCancel,
  emptyTrashTitle,
  emptyTrashMessage,
  emptyTrashConfirm,
  emptyTrashCancel,
  tagDeleteTitle,
  tagDeleteMessagePrefix,
  tagDeleteMessageSuffix,
  tagDeleteMessageFallback,
  tagDeleteConfirm,
  tagDeleteCancel,
  onCloseDeleteFolder,
  onConfirmDeleteFolder,
  onSetDeleteFolderWithContents,
  onCloseDelete,
  onConfirmDelete,
  onClosePermanentDelete,
  onConfirmPermanentDelete,
  onCloseBulkDelete,
  onConfirmBulkDelete,
  onCloseEmptyTrash,
  onConfirmEmptyTrash,
  onCloseDeleteTag,
  onConfirmDeleteTag,
}: StorageConfirmModalsProps): React.JSX.Element {
  const deleteFileMsg = fileToDelete
    ? `${deleteMessagePrefix}${fileToDelete.fileName}${deleteMessageSuffix}`
    : deleteMessageFallback;
  const permanentDeleteMsg = fileToDeletePermanently
    ? `${permanentDeleteMessagePrefix}${fileToDeletePermanently.fileName}${permanentDeleteMessageSuffix}`
    : permanentDeleteMessageFallback;
  const bulkDeleteMsg = bulkDeleteMessageTemplate.replace('{count}', String(selectedTrashCount));
  const tagDeleteMsg = tagToDelete
    ? `${tagDeleteMessagePrefix}${tagToDelete.name}${tagDeleteMessageSuffix}`
    : tagDeleteMessageFallback;

  return (
    <>
      <ConfirmModal
        isOpen={deleteFolderModalOpen}
        onClose={onCloseDeleteFolder}
        onConfirm={onConfirmDeleteFolder}
        title={folderDeleteTitle}
        message={
          <DeleteFolderMessage
            folderToDelete={folderToDelete}
            deleteFolderWithContents={deleteFolderWithContents}
            messagePrefix={folderDeleteMessagePrefix}
            messageSuffix={folderDeleteMessageSuffix}
            messageFallback={folderDeleteMessageFallback}
            withContentsLabel={folderDeleteWithContentsLabel}
            onSetDeleteFolderWithContents={onSetDeleteFolderWithContents}
          />
        }
        confirmText={folderDeleteConfirm}
        cancelText={folderDeleteCancel}
        isDestructive
      />
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title={deleteTitle}
        message={deleteFileMsg}
        confirmText={deleteConfirm}
        cancelText={deleteCancel}
        isDestructive
      />
      <ConfirmModal
        isOpen={permanentDeleteModalOpen}
        onClose={onClosePermanentDelete}
        onConfirm={onConfirmPermanentDelete}
        title={permanentDeleteTitle}
        message={permanentDeleteMsg}
        confirmText={permanentDeleteConfirm}
        cancelText={permanentDeleteCancel}
        isDestructive
      />
      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        onClose={onCloseBulkDelete}
        onConfirm={onConfirmBulkDelete}
        title={bulkDeleteTitle}
        message={bulkDeleteMsg}
        confirmText={bulkDeleteConfirm}
        cancelText={bulkDeleteCancel}
        isDestructive
      />
      <ConfirmModal
        isOpen={emptyTrashModalOpen}
        onClose={onCloseEmptyTrash}
        onConfirm={onConfirmEmptyTrash}
        title={emptyTrashTitle}
        message={emptyTrashMessage}
        confirmText={emptyTrashConfirm}
        cancelText={emptyTrashCancel}
        isDestructive
      />
      <ConfirmModal
        isOpen={deleteTagModalOpen}
        onClose={onCloseDeleteTag}
        onConfirm={onConfirmDeleteTag}
        title={tagDeleteTitle}
        message={tagDeleteMsg}
        confirmText={tagDeleteConfirm}
        cancelText={tagDeleteCancel}
        isDestructive
      />
    </>
  );
}
