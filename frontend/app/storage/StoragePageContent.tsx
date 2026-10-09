'use client';

import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { Box, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { DocumentTypeIcon } from '../components/DocumentTypeIcon';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { getNestedValue, resolveLabel } from '../lib/side-panel-utils';
import { StorageBulkActions } from './components/StorageBulkActions';
import { StorageConfirmModals } from './components/StorageConfirmModals';
import { StorageFileTable } from './components/StorageFileTable';
import { StorageFilterModal } from './components/StorageFilterModal';
import { StorageFolderModal } from './components/StorageFolderModal';
import { StorageHeader } from './components/StorageHeader';
import {
  FolderContextMenu,
  GmailSection,
  StorageProviderSelector,
} from './components/StoragePageHelpers';
import {
  buildFilteredFiles,
  buildFolderCounts,
  buildFolderModalFiles,
  buildPaginatedData,
  buildRenderFunctions,
  buildSortedFiles,
  buildTagCounts,
} from './helpers/storageComputations';
import { formatDate, getPermissionLabel, getStatusLabel } from './helpers/storageFormatters';
import { useGmailIntegration } from './hooks/useGmailIntegration';
import { useStorageDnd } from './hooks/useStorageDnd';
import { useStorageFiles } from './hooks/useStorageFiles';
import { useStorageFilters } from './hooks/useStorageFilters';
import { useStorageFolders } from './hooks/useStorageFolders';
import { useStorageModals } from './hooks/useStorageModals';
import {
  buildPermissionLabels,
  buildStatusLabels,
  useStoragePageHandlers,
} from './hooks/useStoragePageHandlers';
import { useStorageTags } from './hooks/useStorageTags';
import { useStorageTrash } from './hooks/useStorageTrash';
import { type FilterSnapshot, useStorageViews } from './hooks/useStorageViews';
import type { StorageViewPayload } from './storageHelpers';
import { formatFileSize, getStatusTone, NO_FOLDER, tagChipClass } from './storageHelpers';

/**
 * Storage page - displays all files with sharing and permissions
 */
// eslint-disable-next-line max-lines-per-function, complexity
function StoragePageContent({
  initialList = 'active',
}: {
  initialList?: 'active' | 'trash';
}): React.JSX.Element {
  const router = useRouter();
  const t = useIntlayer('storagePage');
  const { locale } = useLocale();

  const tx = useCallback(
    (path: string[], fallback: string) => resolveLabel(getNestedValue(t, path), fallback),
    [t],
  );

  const filtersHook = useStorageFilters(
    { loadCategoriesFailed: t.toasts.loadCategoriesFailed.value },
    initialList,
  );
  const filesHook = useStorageFiles(
    {
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
    },
    filtersHook.activeList,
  );
  const [activeModal, setActiveModal] = useState<'folders' | null>(null);
  const foldersHook = useStorageFolders(
    {
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
      fileMovedTo: tx(['toasts', 'fileMovedTo'], 'File moved to folder'),
    },
    filesHook.setFiles,
    activeModal === 'folders',
  );
  const tagsHook = useStorageTags(
    {
      loadTagsFailed: t.toasts.loadTagsFailed.value,
      tagNameRequired: t.toasts.tagNameRequired.value,
      tagCreated: t.toasts.tagCreated.value,
      tagCreateFailed: t.toasts.tagCreateFailed.value,
      tagRenamed: t.toasts.tagRenamed.value,
      tagRenameFailed: t.toasts.tagRenameFailed.value,
      tagDeleteLoading: t.toasts.tagDeleteLoading.value,
      tagDeleted: t.toasts.tagDeleted.value,
      tagDeleteFailed: t.toasts.tagDeleteFailed.value,
    },
    filesHook.setFiles,
    foldersHook.setFolders,
  );
  const viewsHook = useStorageViews(
    {
      loadViewsFailed: t.toasts.loadViewsFailed.value,
      viewNameRequired: t.toasts.viewNameRequired.value,
      viewSaved: t.toasts.viewSaved.value,
      viewSaveFailed: t.toasts.viewSaveFailed.value,
      viewDeleted: t.toasts.viewDeleted.value,
      viewDeleteFailed: t.toasts.viewDeleteFailed.value,
    },
    filtersHook.setActiveViewId,
    filtersHook.setFilters,
    filtersHook.setStagedFilters,
    filtersHook.setSearchQuery,
    filtersHook.setSort,
  );
  const dndHook = useStorageDnd();
  const trashHook = useStorageTrash(filesHook.files, {
    activeList: filtersHook.activeList,
    searchQuery: filtersHook.searchQuery,
    filters: filtersHook.filters,
    sort: filtersHook.sort,
  });
  const modalsHook = useStorageModals();
  const { gmailStatus, gmailLoading } = useGmailIntegration();
  const [selectedStorageProvider, setSelectedStorageProvider] = useState<'google' | 'dropbox'>(
    'google',
  );

  const isTrashView = filtersHook.activeList === 'trash';
  const isFolderActive = activeModal === 'folders';

  // Effect events: the hook objects below are re-created every render, and an
  // eslint-disable inside a component makes React Compiler skip it entirely.
  const loadLookups = useEffectEvent(() => {
    void filtersHook.loadCategories();
    void tagsHook.loadTags();
    void foldersHook.loadFolders();
    void viewsHook.loadViews();
  });
  const clampPage = useEffectEvent((maxPage: number) => {
    if (filtersHook.page > maxPage) {
      filtersHook.setPage(maxPage);
    }
  });
  const stageFilters = useEffectEvent(() => {
    if (filtersHook.filterOpen) {
      filtersHook.setStagedFilters(filtersHook.filters);
    }
  });

  useEffect(() => {
    loadLookups();
  }, []);

  useLockBodyScroll(activeModal !== null || filtersHook.filterOpen);

  const {
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
  } = useStoragePageHandlers({
    setActiveModal,
    foldersHook,
    tagsHook,
    filtersHook,
    dndHook,
    trashHook,
    modalsHook,
    activeModal,
    isTrashView,
  });

  const statusLabels = useMemo(() => buildStatusLabels(t), [t]);
  const permissionLabels = useMemo(() => buildPermissionLabels(t), [t]);
  const trashTtlDays = useMemo((): number => {
    const parsed = Number.parseInt(process.env.NEXT_PUBLIC_STORAGE_TRASH_TTL_DAYS || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
  }, []);

  const boundFormatDate = useCallback((ds: string): string => formatDate(ds, locale), [locale]);
  const boundGetStatusLabel = useCallback(
    (s: string): string => getStatusLabel(s, statusLabels),
    [statusLabels],
  );
  const boundGetPermissionLabel = useCallback(
    (p?: string | null): string => getPermissionLabel(p, permissionLabels),
    [permissionLabels],
  );

  const { renderTrashExpiryBadge, renderAvailabilityChip, renderStatusBadge } = useMemo(
    () =>
      buildRenderFunctions({
        locale,
        trashTtlDays,
        t: t as unknown as Parameters<typeof buildRenderFunctions>[0]['t'],
        getStatusTone,
        boundGetStatusLabel,
      }),
    [locale, trashTtlDays, t, boundGetStatusLabel],
  );

  const folderCounts = useMemo(() => buildFolderCounts(filesHook.files), [filesHook.files]);
  const tagCounts = useMemo(() => buildTagCounts(filesHook.files), [filesHook.files]);
  const bankOptions = useMemo(
    () => Array.from(new Set(filesHook.files.map(f => f.bankName).filter(Boolean))),
    [filesHook.files],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(filesHook.files.map(f => f.status).filter(Boolean))),
    [filesHook.files],
  );

  const filteredFiles = useMemo(
    () =>
      buildFilteredFiles({
        files: filesHook.files,
        isTrashView,
        searchQuery: filtersHook.searchQuery,
        filters: filtersHook.filters,
      }),
    [filesHook.files, isTrashView, filtersHook.searchQuery, filtersHook.filters],
  );
  const sortedFiles = useMemo(
    () => buildSortedFiles({ filteredFiles, sort: filtersHook.sort, locale }),
    [filteredFiles, filtersHook.sort, locale],
  );
  const { totalItems, totalPagesCount, currentPage, rangeStart, rangeEnd, paginatedFiles } =
    useMemo(
      () =>
        buildPaginatedData({ sortedFiles, page: filtersHook.page, pageSize: filtersHook.pageSize }),
      [sortedFiles, filtersHook.page, filtersHook.pageSize],
    );
  const folderModalFiles = useMemo(
    () =>
      buildFolderModalFiles({
        files: filesHook.files,
        folderFileQuery: foldersHook.folderFileQuery,
        activeFolderId: foldersHook.activeFolderId,
      }),
    [filesHook.files, foldersHook.folderFileQuery, foldersHook.activeFolderId],
  );

  const selectableTrashIds = useMemo(
    () => (isTrashView ? filteredFiles.map(f => f.id) : []),
    [filteredFiles, isTrashView],
  );
  const selectedTrashIdsInView = useMemo(
    () => trashHook.selectedTrashIds.filter(id => selectableTrashIds.includes(id)),
    [trashHook.selectedTrashIds, selectableTrashIds],
  );
  const allTrashSelected =
    selectableTrashIds.length > 0 && selectedTrashIdsInView.length === selectableTrashIds.length;
  const selectedTrashCount = trashHook.selectedTrashIds.length;
  const activeFolderLabel = useMemo(() => {
    if (foldersHook.activeFolderId === '') {
      return t.folders.all;
    }
    if (foldersHook.activeFolderId === NO_FOLDER) {
      return t.folders.none;
    }
    return (
      foldersHook.folders.find(f => f.id === foldersHook.activeFolderId)?.name ?? t.folders.all
    );
  }, [foldersHook.activeFolderId, foldersHook.folders, t]);

  useEffect(() => {
    clampPage(totalPagesCount);
  }, [filtersHook.page, totalPagesCount]);

  useEffect(() => {
    stageFilters();
  }, [filtersHook.filterOpen, filtersHook.filters]);

  const filtersApplied = !!(
    filtersHook.filters.status ||
    filtersHook.filters.bank ||
    filtersHook.filters.categoryId ||
    filtersHook.filters.ownership ||
    filtersHook.filters.folderId
  );
  const sortKey = `${filtersHook.sort.field}:${filtersHook.sort.direction}`;
  const viewPayload: FilterSnapshot = {
    searchQuery: filtersHook.searchQuery,
    filterOpen: filtersHook.filterOpen,
    filters: filtersHook.filters,
    stagedFilters: filtersHook.stagedFilters,
    sort: filtersHook.sort,
  };
  const emptyStateTitle = isTrashView ? t.trash.empty.title : t.empty.title;
  const emptyStateSubtitle = isTrashView ? t.trash.empty.subtitle : t.empty.subtitle;

  return (
    <DndContext
      sensors={dndHook.sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box
        className="container-shared"
        sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: 'var(--lumio-page-top, 32px)', pb: 4 }}
      >
        {!isTrashView && (
          <StorageHeader
            isTrashView={isTrashView}
            isFolderActive={isFolderActive}
            draggingFile={dndHook.draggingFile}
            searchQuery={filtersHook.searchQuery}
            sortKey={sortKey}
            filtersApplied={filtersApplied}
            searchPlaceholder={t.searchPlaceholder.value}
            searchFilesLabel={t.searchFiles.value}
            sortNewest={t.sort.newest}
            sortOldest={t.sort.oldest}
            sortNameAsc={t.sort.nameAsc}
            sortNameDesc={t.sort.nameDesc}
            sortBankAsc={t.sort.bankAsc}
            sortBankDesc={t.sort.bankDesc}
            foldersTitleLabel={t.folders.title}
            tabsAllLabel={t.tabs.all}
            tabsTrashLabel={t.tabs.trash}
            filtersButtonLabel={t.filters.button}
            activeModal={activeModal}
            onSearchChange={filtersHook.handleSearchChange}
            onSortChange={filtersHook.handleSortChange}
            onOpenFilters={() => filtersHook.setFilterOpen(true)}
            onListChangeActive={() => filtersHook.handleListChange('active')}
            onListChangeTrash={() => filtersHook.handleListChange('trash')}
            onOpenFolderModal={() => {
              dndHook.setFolderModalFromDrag(false);
              openModal('folders');
            }}
            onFolderDragOver={() => {
              if (activeModal !== 'folders') {
                dndHook.setFolderModalFromDrag(true);
                openModal('folders');
              }
            }}
          />
        )}
        <StorageProviderSelector
          selectedStorageProvider={selectedStorageProvider}
          onSelect={setSelectedStorageProvider}
          locale={locale}
        />
        {!isTrashView && (
          <GmailSection
            gmailStatus={gmailStatus}
            gmailLoading={gmailLoading}
            router={router}
            tx={tx}
          />
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            bgcolor: 'var(--muted)',
            border: '1px solid var(--border-color)',
            mb: 0,
          }}
        >
          <Typography style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
            {isTrashView ? t.trash.title : t.subtitle}
          </Typography>
          <StorageBulkActions
            selectedTrashCount={selectedTrashCount}
            filesLength={filesHook.files.length}
            filtersApplied={filtersApplied}
            isTrashView={isTrashView}
            selectedTrashIds={trashHook.selectedTrashIds}
            selectedLabel={t.trash.selectedLabel.value.replace(
              '{count}',
              String(selectedTrashCount),
            )}
            restoreSelectedLabel={t.trash.restoreSelected.value}
            deleteSelectedLabel={t.trash.deleteSelected.value}
            emptyActionLabel={t.trash.emptyAction.value}
            filtersTitleLabel={t.filters.title}
            filtersButtonLabel={t.filters.button}
            onBulkRestore={filesHook.handleBulkRestore}
            onOpenBulkDelete={() => trashHook.setBulkDeleteModalOpen(true)}
            onOpenEmptyTrash={() => trashHook.setEmptyTrashModalOpen(true)}
          />
        </Box>
        <StorageFileTable
          loading={filesHook.loading}
          isTrashView={isTrashView}
          paginatedFiles={paginatedFiles}
          filteredFiles={filteredFiles}
          categories={filtersHook.categories}
          categoriesLoading={filtersHook.categoriesLoading}
          selectedTrashIds={trashHook.selectedTrashIds}
          selectableTrashIds={selectableTrashIds}
          selectedTrashIdsInView={selectedTrashIdsInView}
          allTrashSelected={allTrashSelected}
          currentPage={currentPage}
          totalPagesCount={totalPagesCount}
          totalItems={totalItems}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          emptyStateTitle={emptyStateTitle}
          emptyStateSubtitle={emptyStateSubtitle}
          tableFileNameLabel={t.table.fileName}
          tableBankLabel={t.table.bank}
          tableAccountLabel={t.table.account}
          tableSizeLabel={t.table.size}
          tableStatusLabel={t.table.status}
          tableCategoryLabel={t.table.category}
          tableAccessLabel={t.table.access}
          tableCreatedAtLabel={t.table.createdAt}
          tableDeletedAtLabel={t.table.deletedAt}
          tableActionsLabel={t.table.actions}
          trashSelectAllLabel={t.trash.selectAll.value}
          trashSelectRowLabel={t.trash.selectRow.value}
          dragDropRowHintLabel={t.dragDrop.rowHint.value}
          previewLabel={t.preview.value}
          sharedLinksShortLabel={resolveLabel(t.sharedLinksShort, 'links')}
          categoryNoneLabel={resolveLabel(t.categoryCell.none, 'No category')}
          ownerLabel={t.permission.owner.value}
          trashRestoreActionLabel={t.trash.restoreAction.value}
          trashDeleteActionLabel={t.trash.deleteAction.value}
          viewTooltipLabel={t.actions.tooltipView.value}
          downloadTooltipLabel={t.actions.tooltipDownload.value}
          deleteActionLabel={t.actions.delete.value}
          paginationShownTemplate={tx(['pagination', 'shown'], 'Showing {from}–{to} of {count}')}
          paginationPageOfTemplate={tx(['pagination', 'pageOf'], 'Page {page} of {count}')}
          paginationPreviousLabel={tx(['pagination', 'previous'], 'Previous')}
          paginationNextLabel={tx(['pagination', 'next'], 'Next')}
          getPermissionLabel={boundGetPermissionLabel}
          formatDate={boundFormatDate}
          renderTrashExpiryBadge={renderTrashExpiryBadge}
          renderAvailabilityChip={renderAvailabilityChip}
          renderStatusBadge={renderStatusBadge}
          tagChipClass={tagChipClass}
          onToggleTrashSelection={toggleTrashSelection}
          onToggleSelectAllTrash={buildToggleSelectAllTrash(allTrashSelected, selectableTrashIds)}
          onCategoryChange={filesHook.handleCategoryChange}
          onRestoreFromTrash={filesHook.handleRestoreFromTrash}
          onConfirmPermanentDelete={filesHook.confirmPermanentDelete}
          onView={filesHook.handleView}
          onDownload={filesHook.handleDownload}
          onConfirmDelete={filesHook.confirmDelete}
          onPageChange={filtersHook.setPage}
          onPreviewOpen={handlePreviewOpen}
        />
        <DragOverlay style={{ pointerEvents: 'none' }}>
          {dndHook.draggingFile ? (
            <Box
              sx={{
                bgcolor: 'background.paper',
                p: 2,
                border: '1px solid rgba(var(--primary-rgb),0.5)',
                opacity: 0.9,
                width: 300,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ p: 1, bgcolor: 'var(--muted)' }}>
                  <DocumentTypeIcon
                    fileType={dndHook.draggingFile.fileType}
                    fileName={dndHook.draggingFile.fileName}
                    fileId={dndHook.draggingFile.id}
                    size={24}
                  />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dndHook.draggingFile.fileName}
                  </Box>
                  <Box style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {formatFileSize(dndHook.draggingFile.fileSize)}
                  </Box>
                </Box>
              </Box>
            </Box>
          ) : null}
        </DragOverlay>
        {activeModal === 'folders' && (
          <StorageFolderModal
            modalTitle={t.modals.foldersTitle}
            modalSubtitle={t.modals.foldersSubtitle}
            onClose={closeModal}
            sidebarProps={{
              folders: foldersHook.folders,
              tags: tagsHook.tags,
              files: filesHook.files,
              activeFolderId: foldersHook.activeFolderId,
              pickedFolderId: foldersHook.pickedFolderId,
              editingFolderId: foldersHook.editingFolderId,
              editingFolderName: foldersHook.editingFolderName,
              folderTagPickerId: foldersHook.folderTagPickerId,
              folderCounts,
              draggingFile: dndHook.draggingFile,
              folderMoveFeedback: foldersHook.folderMoveFeedback,
              activeFolderLabel,
              newFolderName: foldersHook.newFolderName,
              onSetNewFolderName: foldersHook.setNewFolderName,
              onCreateFolder: () => {
                void foldersHook.handleCreateFolder();
              },
              folderFileQuery: foldersHook.folderFileQuery,
              folderModalFiles,
              folderCreatePlaceholder: t.folders.createPlaceholder.value,
              folderCreateTooltip: t.folders.createTooltip.value,
              scrollHintLabel: t.scrollHint.value,
              foldersAllLabel: t.folders.all,
              foldersNoneLabel: t.folders.none,
              folderListTitleLabel: t.modals.folderListTitle,
              folderListEmptyLabel: t.modals.folderListEmpty,
              dragAndDropLabel: t.dragAndDrop.value,
              doneLabel: t.done.value,
              fileMovedToLabel: tx(['toasts', 'fileMovedTo'], 'File moved to folder'),
              tagsTitle: t.tags.title,
              tagsClearLabel: t.tags.clear,
              dragDropSubtitleLabel: t.dragDrop.subtitle,
              dragDropTitleLabel: t.dragDrop.title,
              modalsFilesLabel: t.modals.filesLabel,
              modalsFileSearchPlaceholder: t.modals.fileSearchPlaceholder.value,
              modalsFilesEmpty: t.modals.filesEmpty,
              dragDropRowHintLabel: t.dragDrop.rowHint.value,
              tableFromLabel: tx(['table', 'from'], 'from'),
              onSetActiveFolderId: foldersHook.setActiveFolderId,
              onSetPickedFolderId: foldersHook.setPickedFolderId,
              onSetEditingFolderName: foldersHook.setEditingFolderName,
              onSetFolderTagPickerId: foldersHook.setFolderTagPickerId,
              onRenameFolder: id => {
                void foldersHook.handleRenameFolder(id);
              },
              onCancelEditFolder: foldersHook.handleCancelEditFolder,
              onUpdateFolderTag: ({ folderId, tagId }) => {
                void foldersHook.handleUpdateFolderTag(folderId, tagId);
              },
              onConfirmDeleteFolder: foldersHook.confirmDeleteFolder,
              onStartEditFolder: foldersHook.handleStartEditFolder,
              onHandleFolderContextMenu: ({ e, folder }) =>
                foldersHook.handleFolderContextMenu(e, folder),
              canEditFolder: foldersHook.canEditFolder,
              clampFolderName: ({ value, current }) => foldersHook.clampFolderName(value, current),
              onSetFolderFileQuery: foldersHook.setFolderFileQuery,
              canEditFile,
            }}
            tagsPanelProps={{
              tags: tagsHook.tags,
              tagCounts,
              newTagName: tagsHook.newTagName,
              newTagColor: tagsHook.newTagColor,
              newTagPickerOpen: tagsHook.newTagPickerOpen,
              newTagAnchorEl: tagsHook.newTagAnchorEl,
              editingTagId: tagsHook.editingTagId,
              editingTagName: tagsHook.editingTagName,
              editingTagColor: tagsHook.editingTagColor,
              editingTagPickerId: tagsHook.editingTagPickerId,
              editingTagAnchorEl: tagsHook.editingTagAnchorEl,
              tagsTitleLabel: t.tags.title,
              tagsCreatePlaceholder: t.tags.createPlaceholder.value,
              tagsCreateTooltip: t.tags.createTooltip.value,
              tagColorLabel: t.tagColor.value,
              tagsRenameTooltip: t.tags.renameTooltip.value,
              tagsDeleteTooltip: t.tags.deleteTooltip.value,
              tagsEmpty: t.tags.empty,
              onSetNewTagName: tagsHook.setNewTagName,
              onSetNewTagColor: tagsHook.setNewTagColor,
              onSetNewTagPickerOpen: tagsHook.setNewTagPickerOpen,
              onSetNewTagAnchorEl: (el: HTMLElement | null) =>
                tagsHook.setNewTagAnchorEl(el as HTMLButtonElement | null),
              onSetEditingTagName: tagsHook.setEditingTagName,
              onSetEditingTagColor: tagsHook.setEditingTagColor,
              onSetEditingTagPickerId: tagsHook.setEditingTagPickerId,
              onSetEditingTagAnchorEl: (el: HTMLElement | null) =>
                tagsHook.setEditingTagAnchorEl(el as HTMLButtonElement | null),
              onCreateTag: () => {
                void tagsHook.handleCreateTag();
              },
              onStartEditTag: tagsHook.handleStartEditTag,
              onRenameTag: id => {
                void tagsHook.handleRenameTag(id);
              },
              onCancelEditTag: tagsHook.handleCancelEditTag,
              onConfirmDeleteTag: tagsHook.confirmDeleteTag,
              canEditTag: tagsHook.canEditTag,
            }}
          />
        )}
        {filtersHook.filterOpen && (
          <StorageFilterModal
            stagedFilters={filtersHook.stagedFilters}
            statusOptions={statusOptions}
            bankOptions={bankOptions}
            categories={filtersHook.categories}
            folders={foldersHook.folders}
            views={viewsHook.views}
            viewsLoading={viewsHook.viewsLoading}
            viewName={viewsHook.viewName}
            viewSaving={viewsHook.viewSaving}
            activeViewId={filtersHook.activeViewId}
            viewPayload={viewPayload}
            filtersTitle={t.filters.title.toString()}
            filtersStatusLabel={t.filters.status}
            filtersBankLabel={t.filters.bank}
            filtersCategoryLabel={t.filters.category}
            filtersAccessTypeLabel={t.filters.accessType}
            filtersFolderLabel={t.filters.folder}
            filtersAllOption={t.filters.all}
            filtersOwnedOption={t.filters.owned}
            filtersSharedOption={t.filters.shared}
            folderNoneLabel={t.folders.none}
            filtersReset={t.filters.reset}
            filtersApply={t.filters.apply}
            viewCreateTitle={String(t.modals.viewCreateTitle.value).replace(':', '')}
            viewNamePlaceholder={t.views.namePlaceholder.value}
            viewSaveTooltip={t.views.saveTooltip.value}
            viewsTitleLabel={t.views.title}
            viewsEmpty={t.views.empty}
            viewDeleteLabel={t.views.delete.value}
            getStatusLabel={boundGetStatusLabel}
            onClose={() => filtersHook.setFilterOpen(false)}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            onApplyFilters={handleApplyFilters}
            onSetViewName={viewsHook.setViewName}
            onSaveView={(payload: StorageViewPayload) => {
              void viewsHook.handleSaveView(payload as FilterSnapshot);
            }}
            onDeleteView={viewsHook.handleDeleteView}
            onApplyView={view => {
              viewsHook.applyView(view);
              filtersHook.setFilterOpen(false);
            }}
          />
        )}
        <StorageConfirmModals
          deleteFolderModalOpen={foldersHook.deleteFolderModalOpen}
          folderToDelete={foldersHook.folderToDelete}
          deleteFolderWithContents={foldersHook.deleteFolderWithContents}
          deleteModalOpen={filesHook.deleteModalOpen}
          fileToDelete={filesHook.fileToDelete}
          permanentDeleteModalOpen={filesHook.permanentDeleteModalOpen}
          fileToDeletePermanently={filesHook.fileToDeletePermanently}
          bulkDeleteModalOpen={trashHook.bulkDeleteModalOpen}
          emptyTrashModalOpen={trashHook.emptyTrashModalOpen}
          deleteTagModalOpen={tagsHook.deleteTagModalOpen}
          tagToDelete={tagsHook.tagToDelete}
          selectedTrashCount={selectedTrashCount}
          selectedTrashIds={trashHook.selectedTrashIds}
          folderDeleteTitle={t.folders.deleteTitle.value}
          folderDeleteMessagePrefix={t.folders.deleteMessagePrefix.value}
          folderDeleteMessageSuffix={t.folders.deleteMessageSuffix.value}
          folderDeleteWithContentsLabel={t.folders.deleteWithContents}
          folderDeleteMessageFallback={t.folders.deleteMessageFallback}
          folderDeleteConfirm={t.folders.deleteConfirm.value}
          folderDeleteCancel={t.folders.deleteCancel.value}
          deleteTitle={t.delete.title.value}
          deleteMessagePrefix={t.delete.messagePrefix.value}
          deleteMessageSuffix={t.delete.messageSuffix.value}
          deleteMessageFallback={t.delete.messageFallback.value}
          deleteConfirm={t.delete.confirm.value}
          deleteCancel={t.delete.cancel.value}
          permanentDeleteTitle={t.permanentDelete.title.value}
          permanentDeleteMessagePrefix={t.permanentDelete.messagePrefix.value}
          permanentDeleteMessageSuffix={t.permanentDelete.messageSuffix.value}
          permanentDeleteMessageFallback={t.permanentDelete.messageFallback.value}
          permanentDeleteConfirm={t.permanentDelete.confirm.value}
          permanentDeleteCancel={t.permanentDelete.cancel.value}
          bulkDeleteTitle={t.trash.bulkDeleteTitle.value}
          bulkDeleteMessageTemplate={t.trash.bulkDeleteMessage.value}
          bulkDeleteConfirm={t.trash.bulkDeleteConfirm.value}
          bulkDeleteCancel={t.trash.bulkDeleteCancel.value}
          emptyTrashTitle={t.trash.emptyTitle.value}
          emptyTrashMessage={t.trash.emptyMessage.value}
          emptyTrashConfirm={t.trash.emptyConfirm.value}
          emptyTrashCancel={t.trash.emptyCancel.value}
          tagDeleteTitle={t.tags.deleteTitle.value}
          tagDeleteMessagePrefix={t.tags.deleteMessagePrefix.value}
          tagDeleteMessageSuffix={t.tags.deleteMessageSuffix.value}
          tagDeleteMessageFallback={t.tags.deleteMessageFallback.value}
          tagDeleteConfirm={t.tags.deleteConfirm.value}
          tagDeleteCancel={t.tags.deleteCancel.value}
          onCloseDeleteFolder={foldersHook.closeDeleteFolderModal}
          onConfirmDeleteFolder={() => {
            void foldersHook.handleDeleteFolder();
          }}
          onSetDeleteFolderWithContents={foldersHook.setDeleteFolderWithContents}
          onCloseDelete={() => {
            filesHook.setDeleteModalOpen(false);
            filesHook.setFileToDelete(null);
          }}
          onConfirmDelete={() => {
            void filesHook.handleDelete();
          }}
          onClosePermanentDelete={() => {
            filesHook.setPermanentDeleteModalOpen(false);
            filesHook.setFileToDeletePermanently(null);
          }}
          onConfirmPermanentDelete={() => {
            void filesHook.handlePermanentDelete();
          }}
          onCloseBulkDelete={() => trashHook.setBulkDeleteModalOpen(false)}
          onConfirmBulkDelete={() => {
            void filesHook.handleBulkDeleteFromTrash(trashHook.selectedTrashIds);
          }}
          onCloseEmptyTrash={() => trashHook.setEmptyTrashModalOpen(false)}
          onConfirmEmptyTrash={() => {
            void filesHook.handleEmptyTrash();
          }}
          onCloseDeleteTag={() => {
            tagsHook.setDeleteTagModalOpen(false);
            tagsHook.setTagToDelete(null);
          }}
          onConfirmDeleteTag={() => {
            void tagsHook.handleDeleteTag();
          }}
        />
        {modalsHook.previewModalOpen && modalsHook.previewFileId && (
          <PDFPreviewModal
            isOpen={modalsHook.previewModalOpen}
            onClose={() => {
              modalsHook.setPreviewModalOpen(false);
              modalsHook.setPreviewFileId(null);
              modalsHook.setPreviewFileName('');
            }}
            fileId={modalsHook.previewFileId}
            fileName={modalsHook.previewFileName}
          />
        )}
        <FolderContextMenu
          folderContextMenu={foldersHook.folderContextMenu}
          setFolderContextMenu={foldersHook.setFolderContextMenu}
          setFolderTagPickerId={foldersHook.setFolderTagPickerId}
          handleStartEditFolder={foldersHook.handleStartEditFolder}
          confirmDeleteFolder={foldersHook.confirmDeleteFolder}
          tagsTitle={t.tags.title.value}
          renameTooltip={t.folders.renameTooltip.value}
          deleteTooltip={t.folders.deleteTooltip.value}
        />
      </Box>
    </DndContext>
  );
}

export default StoragePageContent;
