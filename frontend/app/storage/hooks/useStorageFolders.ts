'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import api from '../../lib/api';
import { FOLDER_NAME_MAX, type FolderOption, type StorageFile } from '../storageHelpers';

interface UseStorageFoldersMessages {
  loadFoldersFailed: string;
  folderNameRequired: string;
  folderNameTooLong: string;
  folderCreated: string;
  folderCreateFailed: string;
  folderRenamed: string;
  folderRenameFailed: string;
  folderTagUpdateFailed: string;
  folderDeleteLoading: string;
  folderDeleted: string;
  folderDeleteFailed: string;
  folderUpdated: string;
  folderUpdateFailed: string;
  fileMovedTo: string;
}

export interface UseStorageFoldersReturn {
  folders: FolderOption[];
  setFolders: React.Dispatch<React.SetStateAction<FolderOption[]>>;
  newFolderName: string;
  setNewFolderName: React.Dispatch<React.SetStateAction<string>>;
  editingFolderId: string | null;
  setEditingFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  editingFolderName: string;
  setEditingFolderName: React.Dispatch<React.SetStateAction<string>>;
  folderTagPickerId: string | null;
  setFolderTagPickerId: React.Dispatch<React.SetStateAction<string | null>>;
  deleteFolderModalOpen: boolean;
  setDeleteFolderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  folderToDelete: FolderOption | null;
  deleteFolderWithContents: boolean;
  setDeleteFolderWithContents: React.Dispatch<React.SetStateAction<boolean>>;
  folderMoveFeedback: { tone: 'success' | 'error'; message: string } | null;
  activeFolderId: string | null;
  setActiveFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  folderFileQuery: string;
  setFolderFileQuery: React.Dispatch<React.SetStateAction<string>>;
  folderContextMenu: { x: number; y: number; folder: FolderOption } | null;
  setFolderContextMenu: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; folder: FolderOption } | null>
  >;
  pickedFolderId: string | null;
  setPickedFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  loadFolders: () => Promise<void>;
  handleCreateFolder: () => Promise<void>;
  handleStartEditFolder: (folder: FolderOption) => void;
  handleRenameFolder: (folderId: string) => Promise<void>;
  handleCancelEditFolder: () => void;
  handleUpdateFolderTag: (folderId: string, tagId: string | null) => Promise<void>;
  confirmDeleteFolder: (folder: FolderOption) => void;
  closeDeleteFolderModal: () => void;
  handleDeleteFolder: () => Promise<void>;
  handleMoveFolderIdx: (fromId: string, toIdx: number, finalize?: boolean) => void;
  handleFolderContextMenu: (event: React.MouseEvent, folder: FolderOption) => void;
  handleMoveToFolder: (fileId: string, folderId: string | null) => Promise<void>;
  canEditFolder: (folder: FolderOption) => boolean;
  clampFolderName: (value: string, previous: string) => string;
  clearFolderMoveFeedback: () => void;
}

export function useStorageFolders(
  messages: UseStorageFoldersMessages,
  setFiles: React.Dispatch<React.SetStateAction<StorageFile[]>>,
  isFolderModalOpen: boolean,
): UseStorageFoldersReturn {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [folderTagPickerId, setFolderTagPickerId] = useState<string | null>(null);
  const [deleteFolderModalOpen, setDeleteFolderModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderOption | null>(null);
  const [deleteFolderWithContents, setDeleteFolderWithContents] = useState(false);
  const [folderMoveFeedback, setFolderMoveFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderFileQuery, setFolderFileQuery] = useState('');
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    folder: FolderOption;
  } | null>(null);
  const [pickedFolderId, setPickedFolderId] = useState<string | null>(null);

  const folderMoveFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTime = useRef<number>(0);

  // Close context menu on click/scroll outside
  useEffect(() => {
    const handleClickOutside = (): void => setFolderContextMenu(null);
    if (folderContextMenu) {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleClickOutside, true);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, [folderContextMenu]);

  const clearFolderMoveFeedback = (): void => {
    if (folderMoveFeedbackTimeout.current) {
      clearTimeout(folderMoveFeedbackTimeout.current);
      folderMoveFeedbackTimeout.current = null;
    }
    setFolderMoveFeedback(null);
  };

  const setFolderMoveMessage = (tone: 'success' | 'error', message: string): void => {
    clearFolderMoveFeedback();
    setFolderMoveFeedback({ tone, message });
    folderMoveFeedbackTimeout.current = setTimeout(() => {
      setFolderMoveFeedback(null);
      folderMoveFeedbackTimeout.current = null;
    }, 3500);
  };

  const loadFolders = async (): Promise<void> => {
    await (async () => {
      setFolders(await apiQueryDecoded({ url: '/storage/folders', contract: 'StorageFolderList' }));
    })().catch(async error => {
      console.error('Failed to load folders:', error);
      toast.error(messages.loadFoldersFailed);
    });
  };

  const handleCreateFolder = async (): Promise<void> => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error(messages.folderNameRequired);
      return;
    }
    if (name.length > FOLDER_NAME_MAX) {
      toast.error(messages.folderNameTooLong);
      return;
    }

    await (async () => {
      const response = await api.post('/storage/folders', {
        name,
      } satisfies ContractInput<'CreateFolderBody'>);
      const folder = await checkContract('StorageFolder', response.data, '/storage/folders');
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      toast.success(messages.folderCreated);
    })().catch(async error => {
      console.error('Failed to create folder:', error);
      toast.error(messages.folderCreateFailed);
    });
  };

  const handleStartEditFolder = (folder: FolderOption): void => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setFolderTagPickerId(null);
  };

  const handleRenameFolder = async (folderId: string): Promise<void> => {
    const name = editingFolderName.trim();
    if (!name) {
      toast.error(messages.folderNameRequired);
      return;
    }
    if (name.length > FOLDER_NAME_MAX) {
      toast.error(messages.folderNameTooLong);
      return;
    }

    await (async () => {
      const response = await api.patch(`/storage/folders/${folderId}`, {
        name,
      } satisfies ContractInput<'UpdateFolderBody'>);
      const updated = await checkContract('StorageFolder', response.data, '/storage/folders/:id');
      setFolders(prev =>
        prev.map(folder => (folder.id === folderId ? { ...folder, ...updated } : folder)),
      );
      const newName = updated.name || name;
      setFiles(prev =>
        prev.map(file => {
          if (file.folderId !== folderId) {
            return file;
          }
          const folder = file.folder
            ? { ...file.folder, name: newName }
            : { id: folderId, name: newName, userId: null, tagId: null };
          return { ...file, folder };
        }),
      );
      setEditingFolderId(null);
      setEditingFolderName('');
      toast.success(messages.folderRenamed);
    })().catch(async error => {
      console.error('Failed to rename folder:', error);
      toast.error(messages.folderRenameFailed);
    });
  };

  const handleCancelEditFolder = (): void => {
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleUpdateFolderTag = async (folderId: string, tagId: string | null): Promise<void> => {
    await (async () => {
      const response = await api.patch(`/storage/folders/${folderId}`, {
        tagId,
      } satisfies ContractInput<'UpdateFolderBody'>);
      const updated = await checkContract('StorageFolder', response.data, '/storage/folders/:id');
      setFolders(prev =>
        prev.map(folder => (folder.id === folderId ? { ...folder, ...updated } : folder)),
      );
      setFolderTagPickerId(null);
    })().catch(async error => {
      console.error('Failed to update folder tag:', error);
      toast.error(messages.folderTagUpdateFailed);
    });
  };

  const closeDeleteFolderModal = (): void => {
    setDeleteFolderModalOpen(false);
    setFolderToDelete(null);
    setDeleteFolderWithContents(false);
  };

  const confirmDeleteFolder = (folder: FolderOption): void => {
    setFolderToDelete(folder);
    setDeleteFolderWithContents(false);
    setDeleteFolderModalOpen(true);
    setFolderTagPickerId(null);
  };

  const handleDeleteFolder = async (): Promise<void> => {
    const targetFolder = folderToDelete;
    const removeContents = deleteFolderWithContents;
    if (!targetFolder) {
      return;
    }
    const toastId = toast.loading(messages.folderDeleteLoading);

    await (async () => {
      await api.delete(`/storage/folders/${targetFolder.id}`, {
        params: { deleteFiles: removeContents },
      });
      setFolders(prev => prev.filter(folder => folder.id !== targetFolder.id));
      if (removeContents) {
        setFiles(prev => prev.filter(file => file.folderId !== targetFolder.id));
      } else {
        setFiles(prev =>
          prev.map(file =>
            file.folderId === targetFolder.id ? { ...file, folderId: null, folder: null } : file,
          ),
        );
      }
      if (activeFolderId === targetFolder.id) {
        setActiveFolderId('');
      }
      if (editingFolderId === targetFolder.id) {
        setEditingFolderId(null);
        setEditingFolderName('');
      }
      if (folderTagPickerId === targetFolder.id) {
        setFolderTagPickerId(null);
      }
      toast.success(messages.folderDeleted, { id: toastId });
    })().catch(async error => {
      console.error('Failed to delete folder:', error);
      toast.error(messages.folderDeleteFailed, { id: toastId });
    });
  };

  const handleMoveFolderIdx = (fromId: string, toIdx: number, finalize = true): void => {
    const fromIdx = folders.findIndex(f => f.id === fromId);
    if (fromIdx === -1) {
      return;
    }
    const newFolders = [...folders];
    const [movedFolder] = newFolders.splice(fromIdx, 1);
    newFolders.splice(toIdx, 0, movedFolder);
    setFolders(newFolders);
    if (finalize) {
      setPickedFolderId(null);
      toast.success(messages.folderUpdated);
    }
  };

  // Wheel-based folder reordering when a folder is "picked" in the modal
  const moveFolderByWheel = useEffectEvent((fromId: string, toIdx: number) =>
    handleMoveFolderIdx(fromId, toIdx, false),
  );
  useEffect(() => {
    if (!(pickedFolderId && isFolderModalOpen)) {
      return;
    }

    const handleWheelMove = (idx: number, deltaY: number): void => {
      const now = Date.now();
      if (deltaY > 0 && idx < folders.length - 1) {
        moveFolderByWheel(pickedFolderId, idx + 1);
        lastWheelTime.current = now;
      } else if (deltaY < 0 && idx > 0) {
        moveFolderByWheel(pickedFolderId, idx - 1);
        lastWheelTime.current = now;
      }
    };

    const handleWheel = (e: WheelEvent): void => {
      const now = Date.now();
      if (now - lastWheelTime.current < 80) {
        return;
      }
      const idx = folders.findIndex(f => f.id === pickedFolderId);
      if (idx === -1 || Math.abs(e.deltaY) < 10) {
        return;
      }
      handleWheelMove(idx, e.deltaY);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [pickedFolderId, folders, isFolderModalOpen]);

  const handleFolderContextMenu = (event: React.MouseEvent, folder: FolderOption): void => {
    event.preventDefault();
    setFolderContextMenu({ x: event.clientX, y: event.clientY, folder });
  };

  const handleMoveToFolder = async (fileId: string, folderId: string | null): Promise<void> => {
    await (async () => {
      await api.patch(`/storage/files/${fileId}/folder`, {
        folderId,
      } satisfies ContractInput<'MoveFileBody'>);
      setFiles(prev =>
        prev.map(file =>
          file.id === fileId
            ? {
                ...file,
                folderId,
                folder: folderId ? (folders.find(folder => folder.id === folderId) ?? null) : null,
              }
            : file,
        ),
      );
      const folderName = folderId ? folders.find(f => f.id === folderId)?.name : null;
      const message = folderName
        ? `${messages.fileMovedTo} "${folderName}"`
        : messages.folderUpdated;
      toast.success(message);
      setFolderMoveMessage('success', message);
    })().catch(async error => {
      console.error('Failed to move file to folder:', error);
      toast.error(messages.folderUpdateFailed);
      setFolderMoveMessage('error', messages.folderUpdateFailed);
    });
  };

  const canEditFolder = (folder: FolderOption): boolean => folder.userId !== null;

  const clampFolderName = (value: string, previous: string): string => {
    if (value.length <= FOLDER_NAME_MAX) {
      return value;
    }
    if (previous.length <= FOLDER_NAME_MAX) {
      toast.error(messages.folderNameTooLong);
    }
    return value.slice(0, FOLDER_NAME_MAX);
  };

  return {
    folders,
    setFolders,
    newFolderName,
    setNewFolderName,
    editingFolderId,
    setEditingFolderId,
    editingFolderName,
    setEditingFolderName,
    folderTagPickerId,
    setFolderTagPickerId,
    deleteFolderModalOpen,
    setDeleteFolderModalOpen,
    folderToDelete,
    deleteFolderWithContents,
    setDeleteFolderWithContents,
    folderMoveFeedback,
    activeFolderId,
    setActiveFolderId,
    folderFileQuery,
    setFolderFileQuery,
    folderContextMenu,
    setFolderContextMenu,
    pickedFolderId,
    setPickedFolderId,
    loadFolders,
    handleCreateFolder,
    handleStartEditFolder,
    handleRenameFolder,
    handleCancelEditFolder,
    handleUpdateFolderTag,
    confirmDeleteFolder,
    closeDeleteFolderModal,
    handleDeleteFolder,
    handleMoveFolderIdx,
    handleFolderContextMenu,
    handleMoveToFolder,
    canEditFolder,
    clampFolderName,
    clearFolderMoveFeedback,
  };
}
