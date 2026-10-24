'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { useWorkspaceId } from '../../hooks/useWorkspaceId';
import api from '../../lib/api';
import { blobOf } from '../../lib/blob-of';
import { queryKeys } from '../../lib/query-keys';
import type { StorageFile } from '../storageHelpers';

interface UseStorageFilesMessages {
  loadFilesFailed: string;
  downloaded: string;
  downloadFailed: string;
  categoryUpdated: string;
  categoryUpdateFailed: string;
  deleteLoading: string;
  deleteSuccess: string;
  deleteError: string;
  trashRestoreLoading: string;
  trashRestoreSuccess: string;
  trashRestoreFailed: string;
  trashDeleteLoading: string;
  trashDeleteSuccess: string;
  trashDeleteFailed: string;
}

export interface UseStorageFilesReturn {
  files: StorageFile[];
  setFiles: React.Dispatch<React.SetStateAction<StorageFile[]>>;
  loading: boolean;
  deleteModalOpen: boolean;
  setDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileToDelete: StorageFile | null;
  setFileToDelete: React.Dispatch<React.SetStateAction<StorageFile | null>>;
  permanentDeleteModalOpen: boolean;
  setPermanentDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileToDeletePermanently: StorageFile | null;
  setFileToDeletePermanently: React.Dispatch<React.SetStateAction<StorageFile | null>>;
  refreshFiles: () => void;
  handleView: (fileId: string) => void;
  handleDownload: (fileId: string, fileName: string) => Promise<void>;
  handleCategoryChange: (fileId: string, categoryId: string) => Promise<void>;
  confirmDelete: (file: StorageFile) => void;
  handleDelete: () => Promise<void>;
  confirmPermanentDelete: (file: StorageFile) => void;
  handlePermanentDelete: () => Promise<void>;
  handleRestoreFromTrash: (file: StorageFile) => Promise<void>;
  handleBulkRestore: (ids: string[]) => Promise<void>;
  handleBulkDeleteFromTrash: (ids: string[]) => Promise<void>;
  handleEmptyTrash: () => Promise<void>;
}

export function useStorageFiles(
  messages: UseStorageFilesMessages,
  listMode: 'active' | 'trash',
): UseStorageFilesReturn {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<StorageFile | null>(null);
  const [permanentDeleteModalOpen, setPermanentDeleteModalOpen] = useState(false);
  const [fileToDeletePermanently, setFileToDeletePermanently] = useState<StorageFile | null>(null);

  const queryKey = queryKeys.storageFiles({ workspaceId, listMode });

  const filesQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/storage/files',
        params: listMode === 'trash' ? { deleted: 'only' } : undefined,
        signal,
        contract: 'StorageFileList',
      }),
    enabled: Boolean(workspaceId),
  });

  const loadFailed = filesQuery.isError;
  const loadFailedMessage = messages.loadFilesFailed;
  useEffect(() => {
    if (loadFailed) {
      toast.error(loadFailedMessage, { id: 'storage-files-load' });
    }
  }, [loadFailed, loadFailedMessage]);

  const files = filesQuery.data ?? [];

  /**
   * Точечные правки списка (переименование, снятие тега, перенос в корзину)
   * пишутся прямо в кэш — сигнатура осталась той же, что у useState, поэтому
   * вызовы `setFiles(prev => ...)` по всему модулю не менялись.
   */
  const setFiles: React.Dispatch<React.SetStateAction<StorageFile[]>> = useCallback(
    update => {
      queryClient.setQueryData<StorageFile[]>(
        queryKeys.storageFiles({ workspaceId, listMode }),
        previous => {
          const current = previous ?? [];
          return typeof update === 'function' ? update(current) : update;
        },
      );
    },
    [queryClient, workspaceId, listMode],
  );

  const refreshFiles = useCallback((): void => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.storageFiles({ workspaceId, listMode }),
    });
  }, [queryClient, workspaceId, listMode]);

  const handleView = (fileId: string): void => {
    const file = files.find(f => f.id === fileId);
    if (
      file &&
      (file.status === 'completed' || file.status === 'parsed' || file.status === 'validated')
    ) {
      router.push(`/statements/${fileId}/edit`);
    } else {
      router.push(`/storage/${fileId}`);
    }
  };

  const handleDownload = async (fileId: string, fileName: string): Promise<void> => {
    await (async () => {
      const response = await api.get(`/storage/files/${fileId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([blobOf(response)]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(messages.downloaded);
    })().catch(async error => {
      console.error('Failed to download file:', error);
      toast.error(messages.downloadFailed);
    });
  };

  const handleCategoryChange = async (fileId: string, categoryId: string): Promise<void> => {
    await (async () => {
      const response = await api.patch(`/storage/files/${fileId}/category`, {
        categoryId: categoryId || null,
      } satisfies ContractInput<'UpdateFileCategoryBody'>);
      const updated = await checkContract(
        'FileCategoryUpdate',
        response.data,
        '/storage/files/:id/category',
      );
      setFiles(prev =>
        prev.map(file =>
          file.id === fileId
            ? { ...file, categoryId: updated.categoryId, category: updated.category }
            : file,
        ),
      );
      // A file's category reaches its rows (a scan's own), so the figures move.
      invalidateFinancialData();
      toast.success(messages.categoryUpdated);
    })().catch(async error => {
      console.error('Failed to update file category:', error);
      toast.error(messages.categoryUpdateFailed);
    });
  };

  const confirmDelete = (file: StorageFile): void => {
    setFileToDelete(file);
    setDeleteModalOpen(true);
  };

  const handleDelete = async (): Promise<void> => {
    if (!fileToDelete) {
      return;
    }
    const toastId = toast.loading(messages.deleteLoading);

    await (async () => {
      await api.post(`/storage/files/${fileToDelete.id}/trash`);
      setFiles(prev => prev.filter(file => file.id !== fileToDelete.id));
      // A trashed statement's rows stop counting.
      invalidateFinancialData();
      toast.success(messages.deleteSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to move file to trash:', error);
      toast.error(messages.deleteError, { id: toastId });
    });

    setFileToDelete(null);
  };

  const confirmPermanentDelete = (file: StorageFile): void => {
    setFileToDeletePermanently(file);
    setPermanentDeleteModalOpen(true);
  };

  const handlePermanentDelete = async (): Promise<void> => {
    if (!fileToDeletePermanently) {
      return;
    }
    const toastId = toast.loading(messages.trashDeleteLoading);

    await (async () => {
      await api.delete(`/storage/files/${fileToDeletePermanently.id}/trash`);
      setFiles(prev => prev.filter(file => file.id !== fileToDeletePermanently.id));
      toast.success(messages.trashDeleteSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to permanently delete file:', error);
      toast.error(messages.trashDeleteFailed, { id: toastId });
    });

    setFileToDeletePermanently(null);
  };

  const handleRestoreFromTrash = async (file: StorageFile): Promise<void> => {
    const toastId = toast.loading(messages.trashRestoreLoading);

    await (async () => {
      await api.post(`/storage/files/${file.id}/trash/restore`);
      setFiles(prev => prev.filter(item => item.id !== file.id));
      invalidateFinancialData();
      toast.success(messages.trashRestoreSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to restore file from trash:', error);
      toast.error(messages.trashRestoreFailed, { id: toastId });
    });
  };

  const handleBulkRestore = async (ids: string[]): Promise<void> => {
    if (!ids.length) {
      return;
    }
    const toastId = toast.loading(messages.trashRestoreLoading);

    await (async () => {
      await api.post('/storage/files/trash/bulk/restore', {
        statementIds: ids,
      } satisfies ContractInput<'BulkFileActionBody'>);
      setFiles(prev => prev.filter(file => !ids.includes(file.id)));
      invalidateFinancialData();
      toast.success(messages.trashRestoreSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to restore files from trash:', error);
      toast.error(messages.trashRestoreFailed, { id: toastId });
    });
  };

  const handleBulkDeleteFromTrash = async (ids: string[]): Promise<void> => {
    if (!ids.length) {
      return;
    }
    const toastId = toast.loading(messages.trashDeleteLoading);

    await (async () => {
      await api.post('/storage/files/bulk/trash/delete', {
        statementIds: ids,
      } satisfies ContractInput<'BulkFileActionBody'>);
      setFiles(prev => prev.filter(file => !ids.includes(file.id)));
      toast.success(messages.trashDeleteSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to delete files from trash:', error);
      toast.error(messages.trashDeleteFailed, { id: toastId });
    });
  };

  const handleEmptyTrash = async (): Promise<void> => {
    const ids = files.map(file => file.id);
    await handleBulkDeleteFromTrash(ids);
  };

  return {
    files,
    setFiles,
    loading: filesQuery.isPending,
    deleteModalOpen,
    setDeleteModalOpen,
    fileToDelete,
    setFileToDelete,
    permanentDeleteModalOpen,
    setPermanentDeleteModalOpen,
    fileToDeletePermanently,
    setFileToDeletePermanently,
    refreshFiles,
    handleView,
    handleDownload,
    handleCategoryChange,
    confirmDelete,
    handleDelete,
    confirmPermanentDelete,
    handlePermanentDelete,
    handleRestoreFromTrash,
    handleBulkRestore,
    handleBulkDeleteFromTrash,
    handleEmptyTrash,
  };
}
