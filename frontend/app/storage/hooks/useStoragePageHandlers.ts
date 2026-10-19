'use client';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useCallback } from 'react';
import type { PermissionLabels, StatusLabels } from '../helpers/storageFormatters';
import { DEFAULT_FILTERS, NO_FOLDER, type StorageFile } from '../storageHelpers';
import type { UseStorageDndReturn } from './useStorageDnd';
import type { UseStorageFiltersReturn } from './useStorageFilters';
import type { UseStorageFoldersReturn } from './useStorageFolders';
import type { StorageModalsState } from './useStorageModals';
import type { UseStorageTagsReturn } from './useStorageTags';
import type { UseStorageTrashReturn } from './useStorageTrash';

interface PageHandlersParams {
  setActiveModal: (modal: 'folders' | null) => void;
  foldersHook: UseStorageFoldersReturn;
  tagsHook: UseStorageTagsReturn;
  filtersHook: UseStorageFiltersReturn;
  dndHook: UseStorageDndReturn;
  trashHook: UseStorageTrashReturn;
  modalsHook: StorageModalsState;
  activeModal: 'folders' | null;
  isTrashView: boolean;
}

export interface PageHandlersReturn {
  openModal: (modal: 'folders') => void;
  closeModal: () => void;
  canEditFile: (file: StorageFile) => boolean;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  toggleTrashSelection: (fileId: string) => void;
  buildToggleSelectAllTrash: (
    allTrashSelected: boolean,
    selectableTrashIds: string[],
  ) => () => void;
  handleFilterChange: (field: keyof typeof DEFAULT_FILTERS, value: string) => void;
  handleResetFilters: () => void;
  handleApplyFilters: () => void;
  handlePreviewOpen: (fileId: string, fileName: string) => void;
}

interface DragMoveParams {
  foldersHook: UseStorageFoldersReturn;
  file: StorageFile;
  folderId: string | undefined;
  isNoFolder: boolean | undefined;
}

function buildDragEndMoveLogic({ foldersHook, file, folderId, isNoFolder }: DragMoveParams): void {
  const targetId = isNoFolder ? NO_FOLDER : folderId;
  if (file.folderId !== targetId) {
    void foldersHook.handleMoveToFolder(file.id, isNoFolder ? null : (folderId ?? null));
  }
}

// eslint-disable-next-line max-lines-per-function
export function useStoragePageHandlers({
  setActiveModal,
  foldersHook,
  tagsHook,
  filtersHook,
  dndHook,
  trashHook,
  modalsHook,
}: PageHandlersParams): PageHandlersReturn {
  const openModal = useCallback(
    (modal: 'folders'): void => {
      filtersHook.setFilterOpen(false);
      setActiveModal(modal);
      foldersHook.clearFolderMoveFeedback();
      foldersHook.setActiveFolderId(null);
      foldersHook.setFolderFileQuery('');
      dndHook.setFolderDropTargetId(null);
    },
    [filtersHook, setActiveModal, foldersHook, dndHook],
  );

  const closeModal = useCallback((): void => {
    setActiveModal(null);
    dndHook.setFolderModalFromDrag(false);
    foldersHook.setFolderFileQuery('');
    foldersHook.setActiveFolderId(null);
    dndHook.setFolderDropTargetId(null);
    foldersHook.setEditingFolderId(null);
    foldersHook.setEditingFolderName('');
    tagsHook.setEditingTagPickerId(() => null);
    tagsHook.setEditingTagName('');
    tagsHook.setEditingTagColor(null);
    tagsHook.setNewTagPickerOpen(false);
    foldersHook.setFolderTagPickerId(null);
    foldersHook.clearFolderMoveFeedback();
  }, [setActiveModal, dndHook, foldersHook, tagsHook]);

  const canEditFile = useCallback(
    (file: StorageFile): boolean =>
      !file.deletedAt && (file.isOwner || file.permissionType === 'editor'),
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent): void => {
      const file = event.active.data.current?.file as StorageFile | undefined;
      if (file) {
        dndHook.setDraggingFile(file);
      }
    },
    [dndHook],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event;
      if (!over) {
        dndHook.setDraggingFile(null);
        return;
      }
      const file = active.data.current?.file as StorageFile | undefined;
      const folderId = over.data.current?.folderId as string | undefined;
      const isNoFolder = over.data.current?.isNoFolder as boolean | undefined;
      if (file && (folderId || isNoFolder)) {
        buildDragEndMoveLogic({ foldersHook, file, folderId, isNoFolder });
      }
      dndHook.setDraggingFile(null);
      if (dndHook.folderModalFromDrag) {
        closeModal();
      }
    },
    [dndHook, foldersHook, closeModal],
  );

  const toggleTrashSelection = useCallback(
    (fileId: string): void => {
      trashHook.setSelectedTrashIds(prev =>
        prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId],
      );
    },
    [trashHook],
  );

  const buildToggleSelectAllTrash = useCallback(
    (allTrashSelected: boolean, selectableTrashIds: string[]): (() => void) => {
      return (): void => {
        trashHook.setSelectedTrashIds(allTrashSelected ? [] : selectableTrashIds);
      };
    },
    [trashHook],
  );

  const handleFilterChange = useCallback(
    (field: keyof typeof DEFAULT_FILTERS, value: string): void => {
      filtersHook.setStagedFilters(prev => ({ ...prev, [field]: value }));
      filtersHook.setActiveViewId(null);
    },
    [filtersHook],
  );

  const handleResetFilters = useCallback((): void => {
    filtersHook.setStagedFilters({ ...DEFAULT_FILTERS });
    filtersHook.setActiveViewId(null);
  }, [filtersHook]);

  const handleApplyFilters = useCallback((): void => {
    filtersHook.setFilters(filtersHook.stagedFilters);
    filtersHook.setActiveViewId(null);
    filtersHook.setFilterOpen(false);
  }, [filtersHook]);

  const handlePreviewOpen = useCallback(
    (fileId: string, fileName: string): void => {
      modalsHook.setPreviewFileId(fileId);
      modalsHook.setPreviewFileName(fileName);
      modalsHook.setPreviewModalOpen(true);
    },
    [modalsHook],
  );

  return {
    openModal,
    closeModal,
    canEditFile,
    handleDragStart,
    handleDragEnd,
    toggleTrashSelection,
    buildToggleSelectAllTrash,
    handleFilterChange,
    handleResetFilters,
    handleApplyFilters,
    handlePreviewOpen,
  };
}

// ─── Label helpers ────────────────────────────────────────────────────────────

interface StorageTranslations {
  statusLabels: {
    completed: { value: string };
    processing: { value: string };
    error: { value: string };
    uploaded: { value: string };
    parsed: { value: string };
  };
  permission: {
    owner: { value: string };
    editor: { value: string };
    viewer: { value: string };
    downloader: { value: string };
    access: { value: string };
  };
}

export function buildStatusLabels(t: StorageTranslations): StatusLabels {
  return {
    completed: t.statusLabels.completed.value,
    processing: t.statusLabels.processing.value,
    error: t.statusLabels.error.value,
    uploaded: t.statusLabels.uploaded.value,
    parsed: t.statusLabels.parsed.value,
  };
}

export function buildPermissionLabels(t: StorageTranslations): PermissionLabels {
  return {
    owner: t.permission.owner.value,
    editor: t.permission.editor.value,
    viewer: t.permission.viewer.value,
    downloader: t.permission.downloader.value,
    access: t.permission.access.value,
  };
}
