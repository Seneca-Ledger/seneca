import type { useIntlayer } from '@/app/i18n';

type StoragePageT = ReturnType<typeof useIntlayer<'storagePage'>>;

export function buildFileToasts(t: StoragePageT): Record<string, string> {
  return {
    loadFilesFailed: t.toasts.loadFilesFailed.value,
    downloaded: t.toasts.downloaded.value,
    downloadFailed: t.toasts.downloadFailed.value,
    categoryUpdated: t.toasts.categoryUpdated.value,
    categoryUpdateFailed: t.toasts.categoryUpdateFailed.value,
    deleteLoading: t.delete.loading.value,
    deleteSuccess: t.delete.success.value,
    deleteError: t.delete.error.value,
    trashRestoreLoading: t.trash.restoreLoading.value,
    trashRestoreSuccess: t.trash.restoreSuccess.value,
    trashRestoreFailed: t.trash.restoreFailed.value,
    trashDeleteLoading: t.trash.deleteLoading.value,
    trashDeleteSuccess: t.trash.deleteSuccess.value,
    trashDeleteFailed: t.trash.deleteFailed.value,
  };
}

export function buildFolderToasts(
  t: StoragePageT,
  tx: (p: string[]) => string,
): Record<string, string> {
  return {
    loadFoldersFailed: t.toasts.loadFoldersFailed.value,
    folderNameRequired: t.toasts.folderNameRequired.value,
    folderNameTooLong: t.folders.nameTooLong.value,
    folderCreated: t.toasts.folderCreated.value,
    folderCreateFailed: t.toasts.folderCreateFailed.value,
    folderRenamed: t.toasts.folderRenamed.value,
    folderRenameFailed: t.toasts.folderRenameFailed.value,
    folderTagUpdateFailed: t.toasts.folderTagUpdateFailed.value,
    folderDeleteLoading: t.toasts.folderDeleteLoading.value,
    folderDeleted: t.toasts.folderDeleted.value,
    folderDeleteFailed: t.toasts.folderDeleteFailed.value,
    folderUpdated: t.toasts.folderUpdated.value,
    folderUpdateFailed: t.toasts.folderUpdateFailed.value,
    fileMovedTo: tx(['toasts', 'fileMovedTo']),
  };
}

export function buildTagToasts(t: StoragePageT): Record<string, string> {
  return {
    loadTagsFailed: t.toasts.loadTagsFailed.value,
    tagNameRequired: t.toasts.tagNameRequired.value,
    tagCreated: t.toasts.tagCreated.value,
    tagCreateFailed: t.toasts.tagCreateFailed.value,
    tagRenamed: t.toasts.tagRenamed.value,
    tagRenameFailed: t.toasts.tagRenameFailed.value,
    tagDeleteLoading: t.toasts.tagDeleteLoading.value,
    tagDeleted: t.toasts.tagDeleted.value,
    tagDeleteFailed: t.toasts.tagDeleteFailed.value,
  };
}

export function buildViewToasts(t: StoragePageT): Record<string, string> {
  return {
    loadViewsFailed: t.toasts.loadViewsFailed.value,
    viewNameRequired: t.toasts.viewNameRequired.value,
    viewSaved: t.toasts.viewSaved.value,
    viewSaveFailed: t.toasts.viewSaveFailed.value,
    viewDeleted: t.toasts.viewDeleted.value,
    viewDeleteFailed: t.toasts.viewDeleteFailed.value,
  };
}
