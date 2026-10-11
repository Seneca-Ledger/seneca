'use client';

import toast from 'react-hot-toast';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import api from '../../lib/api';
import { FOLDER_NAME_MAX, type FolderOption, type StorageFile } from '../storageHelpers';

interface Messages {
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

export interface HandlerDeps {
  messages: Messages;
  newFolderName: string;
  editingFolderName: string;
  folderToDelete: FolderOption | null;
  deleteFolderWithContents: boolean;
  activeFolderId: string | null;
  editingFolderId: string | null;
  folderTagPickerId: string | null;
  folders: FolderOption[];
  setFolders: React.Dispatch<React.SetStateAction<FolderOption[]>>;
  setFiles: React.Dispatch<React.SetStateAction<StorageFile[]>>;
  setNewFolderName: (v: string) => void;
  setEditingFolderId: (v: string | null) => void;
  setEditingFolderName: (v: string) => void;
  setFolderTagPickerId: (v: string | null) => void;
  setDeleteFolderModalOpen: (v: boolean) => void;
  setFolderToDelete: (v: FolderOption | null) => void;
  setDeleteFolderWithContents: (v: boolean) => void;
  setActiveFolderId: (v: string | null) => void;
  setFolderContextMenu: (v: { x: number; y: number; folder: FolderOption } | null) => void;
  setPickedFolderId: (v: string | null) => void;
  setFolderMoveMessage: (tone: 'success' | 'error', message: string) => void;
}

function validateFolderName(name: string, messages: Messages): boolean {
  if (!name) {
    toast.error(messages.folderNameRequired);
    return false;
  }
  if (name.length > FOLDER_NAME_MAX) {
    toast.error(messages.folderNameTooLong);
    return false;
  }
  return true;
}

function applyFolderRename(
  prev: FolderOption[],
  folderId: string,
  data: Partial<FolderOption>,
): FolderOption[] {
  return prev.map(f => (f.id === folderId ? { ...f, ...data } : f));
}

function applyFilesFolderRename(
  prev: StorageFile[],
  folderId: string,
  newName: string,
): StorageFile[] {
  return prev.map(file => {
    if (file.folderId !== folderId) {
      return file;
    }
    const folder = file.folder
      ? { ...file.folder, name: newName }
      : { id: folderId, name: newName };
    return { ...file, folder };
  });
}

function applyFolderDelete(
  prev: StorageFile[],
  folderId: string,
  removeContents: boolean,
): StorageFile[] {
  if (removeContents) {
    return prev.filter(f => f.folderId !== folderId);
  }
  return prev.map(f => (f.folderId === folderId ? { ...f, folderId: null, folder: null } : f));
}

export async function loadFoldersHandler(
  messages: Messages,
  setFolders: React.Dispatch<React.SetStateAction<FolderOption[]>>,
): Promise<void> {
  try {
    const response = await api.get('/storage/folders');
    setFolders(response.data || []);
  } catch (error) {
    console.error('Failed to load folders:', error);
    toast.error(messages.loadFoldersFailed);
  }
}

export async function createFolderHandler(deps: HandlerDeps): Promise<void> {
  const name = deps.newFolderName.trim();
  if (!validateFolderName(name, deps.messages)) {
    return;
  }
  try {
    const response = await api.post('/storage/folders', {
      name,
    } satisfies ContractInput<'CreateFolderBody'>);
    deps.setFolders(prev => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
    deps.setNewFolderName('');
    toast.success(deps.messages.folderCreated);
  } catch (error) {
    console.error('Failed to create folder:', error);
    toast.error(deps.messages.folderCreateFailed);
  }
}

export async function renameFolderHandler(deps: HandlerDeps, folderId: string): Promise<void> {
  const name = deps.editingFolderName.trim();
  if (!validateFolderName(name, deps.messages)) {
    return;
  }
  try {
    const response = await api.patch(`/storage/folders/${folderId}`, {
      name,
    } satisfies ContractInput<'UpdateFolderBody'>);
    deps.setFolders(prev => applyFolderRename(prev, folderId, response.data));
    deps.setFiles(prev => applyFilesFolderRename(prev, folderId, response.data?.name || name));
    deps.setEditingFolderId(null);
    deps.setEditingFolderName('');
    toast.success(deps.messages.folderRenamed);
  } catch (error) {
    console.error('Failed to rename folder:', error);
    toast.error(deps.messages.folderRenameFailed);
  }
}

export async function updateFolderTagHandler(
  deps: HandlerDeps,
  folderId: string,
  tagId: string | null,
): Promise<void> {
  try {
    const response = await api.patch(`/storage/folders/${folderId}`, {
      tagId,
    } satisfies ContractInput<'UpdateFolderBody'>);
    deps.setFolders(prev => applyFolderRename(prev, folderId, response.data));
    deps.setFolderTagPickerId(null);
  } catch (error) {
    console.error('Failed to update folder tag:', error);
    toast.error(deps.messages.folderTagUpdateFailed);
  }
}

export async function deleteFolderHandler(deps: HandlerDeps): Promise<void> {
  const targetFolder = deps.folderToDelete;
  const removeContents = deps.deleteFolderWithContents;
  if (!targetFolder) {
    return;
  }
  const toastId = toast.loading(deps.messages.folderDeleteLoading);
  try {
    await api.delete(`/storage/folders/${targetFolder.id}`, {
      params: { deleteFiles: removeContents },
    });
    deps.setFolders(prev => prev.filter(f => f.id !== targetFolder.id));
    deps.setFiles(prev => applyFolderDelete(prev, targetFolder.id, removeContents));
    if (deps.activeFolderId === targetFolder.id) {
      deps.setActiveFolderId('');
    }
    if (deps.editingFolderId === targetFolder.id) {
      deps.setEditingFolderId(null);
      deps.setEditingFolderName('');
    }
    if (deps.folderTagPickerId === targetFolder.id) {
      deps.setFolderTagPickerId(null);
    }
    toast.success(deps.messages.folderDeleted, { id: toastId });
  } catch (error) {
    console.error('Failed to delete folder:', error);
    toast.error(deps.messages.folderDeleteFailed, { id: toastId });
  }
}

export async function moveToFolderHandler(
  deps: HandlerDeps,
  fileId: string,
  folderId: string | null,
): Promise<void> {
  try {
    await api.patch(`/storage/files/${fileId}/folder`, {
      folderId,
    } satisfies ContractInput<'MoveFileBody'>);
    deps.setFiles(prev =>
      prev.map(file => {
        if (file.id !== fileId) {
          return file;
        }
        const folder = folderId ? (deps.folders.find(f => f.id === folderId) ?? null) : null;
        return { ...file, folderId, folder };
      }),
    );
    const folderName = folderId ? deps.folders.find(f => f.id === folderId)?.name : null;
    const message = folderName
      ? `${deps.messages.fileMovedTo} "${folderName}"`
      : deps.messages.folderUpdated;
    toast.success(message);
    deps.setFolderMoveMessage('success', message);
  } catch (error) {
    console.error('Failed to move file to folder:', error);
    toast.error(deps.messages.folderUpdateFailed);
    deps.setFolderMoveMessage('error', deps.messages.folderUpdateFailed);
  }
}
