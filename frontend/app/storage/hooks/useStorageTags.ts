'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import api from '../../lib/api';
import type { FolderOption, StorageFile, TagOption } from '../storageHelpers';

interface UseStorageTagsMessages {
  loadTagsFailed: string;
  tagNameRequired: string;
  tagCreated: string;
  tagCreateFailed: string;
  tagRenamed: string;
  tagRenameFailed: string;
  tagDeleteLoading: string;
  tagDeleted: string;
  tagDeleteFailed: string;
}

export interface UseStorageTagsReturn {
  tags: TagOption[];
  setTags: React.Dispatch<React.SetStateAction<TagOption[]>>;
  newTagName: string;
  setNewTagName: React.Dispatch<React.SetStateAction<string>>;
  newTagColor: string;
  setNewTagColor: React.Dispatch<React.SetStateAction<string>>;
  editingTagId: string | null;
  setEditingTagId: React.Dispatch<React.SetStateAction<string | null>>;
  editingTagName: string;
  setEditingTagName: React.Dispatch<React.SetStateAction<string>>;
  editingTagColor: string | null;
  setEditingTagColor: React.Dispatch<React.SetStateAction<string | null>>;
  newTagPickerOpen: boolean;
  setNewTagPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newTagAnchorEl: HTMLButtonElement | null;
  setNewTagAnchorEl: React.Dispatch<React.SetStateAction<HTMLButtonElement | null>>;
  editingTagPickerId: string | null;
  setEditingTagPickerId: React.Dispatch<React.SetStateAction<string | null>>;
  editingTagAnchorEl: HTMLButtonElement | null;
  setEditingTagAnchorEl: React.Dispatch<React.SetStateAction<HTMLButtonElement | null>>;
  deleteTagModalOpen: boolean;
  setDeleteTagModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tagToDelete: TagOption | null;
  setTagToDelete: React.Dispatch<React.SetStateAction<TagOption | null>>;
  loadTags: () => Promise<void>;
  handleCreateTag: () => Promise<void>;
  handleStartEditTag: (tag: TagOption) => void;
  handleRenameTag: (tagId: string) => Promise<void>;
  handleCancelEditTag: () => void;
  confirmDeleteTag: (tag: TagOption) => void;
  handleDeleteTag: () => Promise<void>;
  canEditTag: (tag: TagOption) => boolean;
}

export function useStorageTags(
  messages: UseStorageTagsMessages,
  setFiles: React.Dispatch<React.SetStateAction<StorageFile[]>>,
  setFolders: React.Dispatch<React.SetStateAction<FolderOption[]>>,
): UseStorageTagsReturn {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#168118');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState<string | null>(null);
  const [newTagPickerOpen, setNewTagPickerOpen] = useState(false);
  const [newTagAnchorEl, setNewTagAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [editingTagPickerId, setEditingTagPickerId] = useState<string | null>(null);
  const [editingTagAnchorEl, setEditingTagAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [deleteTagModalOpen, setDeleteTagModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagOption | null>(null);

  const loadTags = async (): Promise<void> => {
    await (async () => {
      setTags(await apiQueryDecoded({ url: '/storage/tags', contract: 'StorageTagList' }));
    })().catch(async error => {
      console.error('Failed to load tags:', error);
      toast.error(messages.loadTagsFailed);
    });
  };

  const handleCreateTag = async (): Promise<void> => {
    const name = newTagName.trim();
    if (!name) {
      toast.error(messages.tagNameRequired);
      return;
    }

    await (async () => {
      const payload = { name, color: newTagColor || undefined };
      const response = await api.post(
        '/storage/tags',
        payload satisfies ContractInput<'CreateTagBody'>,
      );
      const tag = await checkContract('StorageTag', response.data, '/storage/tags');
      setTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      toast.success(messages.tagCreated);
    })().catch(async error => {
      console.error('Failed to create tag:', error);
      toast.error(messages.tagCreateFailed);
    });
  };

  const handleStartEditTag = (tag: TagOption): void => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagColor(tag.color ?? '#168118');
    setEditingTagPickerId(null);
  };

  const handleRenameTag = async (tagId: string): Promise<void> => {
    const name = editingTagName.trim();
    if (!name) {
      toast.error(messages.tagNameRequired);
      return;
    }

    await (async () => {
      const response = await api.patch(`/storage/tags/${tagId}`, {
        name,
        color: editingTagColor,
      } satisfies ContractInput<'UpdateTagBody'>);
      const updated = await checkContract('StorageTag', response.data, '/storage/tags/:id');
      setTags(prev => prev.map(tag => (tag.id === tagId ? { ...tag, ...updated } : tag)));
      setFolders(prev =>
        prev.map(folder =>
          folder.tagId === tagId || folder.tag?.id === tagId
            ? {
                ...folder,
                tag: { ...folder.tag, ...updated },
              }
            : folder,
        ),
      );
      const updatedName = (updated.name as string | undefined) || name;
      const updatedColor = (updated.color as string | null | undefined) ?? editingTagColor ?? null;
      setFiles(prev =>
        prev.map(file => ({
          ...file,
          tags: (file.tags || []).map(tag =>
            tag.id === tagId ? { ...tag, name: updatedName, color: updatedColor } : tag,
          ),
        })),
      );
      setEditingTagId(null);
      setEditingTagName('');
      setEditingTagColor(null);
      toast.success(messages.tagRenamed);
    })().catch(async error => {
      console.error('Failed to rename tag:', error);
      toast.error(messages.tagRenameFailed);
    });
  };

  const handleCancelEditTag = (): void => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagColor(null);
    setEditingTagPickerId(null);
  };

  const confirmDeleteTag = (tag: TagOption): void => {
    setTagToDelete(tag);
    setDeleteTagModalOpen(true);
  };

  const handleDeleteTag = async (): Promise<void> => {
    if (!tagToDelete) {
      return;
    }
    const toastId = toast.loading(messages.tagDeleteLoading);

    await (async () => {
      await api.delete(`/storage/tags/${tagToDelete.id}`);
      setTags(prev => prev.filter(tag => tag.id !== tagToDelete.id));
      setFolders(prev =>
        prev.map(folder =>
          folder.tagId === tagToDelete.id ? { ...folder, tagId: null, tag: null } : folder,
        ),
      );
      setFiles(prev =>
        prev.map(file => ({
          ...file,
          tags: (file.tags || []).filter(tag => tag.id !== tagToDelete.id),
        })),
      );
      toast.success(messages.tagDeleted, { id: toastId });
    })()
      .catch(async error => {
        console.error('Failed to delete tag:', error);
        toast.error(messages.tagDeleteFailed, { id: toastId });
      })
      .finally(async () => {
        setTagToDelete(null);
        setDeleteTagModalOpen(false);
      });
  };

  const canEditTag = (tag: TagOption): boolean => tag.userId !== null;

  return {
    tags,
    setTags,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    editingTagId,
    setEditingTagId,
    editingTagName,
    setEditingTagName,
    editingTagColor,
    setEditingTagColor,
    newTagPickerOpen,
    setNewTagPickerOpen,
    newTagAnchorEl,
    setNewTagAnchorEl,
    editingTagPickerId,
    setEditingTagPickerId,
    editingTagAnchorEl,
    setEditingTagAnchorEl,
    deleteTagModalOpen,
    setDeleteTagModalOpen,
    tagToDelete,
    setTagToDelete,
    loadTags,
    handleCreateTag,
    handleStartEditTag,
    handleRenameTag,
    handleCancelEditTag,
    confirmDeleteTag,
    handleDeleteTag,
    canEditTag,
  };
}
