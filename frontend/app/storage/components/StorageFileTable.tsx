/* eslint-disable max-lines */
'use client';

import { Box, Chip, Typography } from '@mui/material';
import React from 'react';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { Spinner } from '@/app/components/ui/spinner';
import { Checkbox } from '../../components/ui/checkbox';
import { formatPaginationLabel } from '../helpers/storageFormatters';
import { getAvailabilityChipStyle, getStatusChipStyle } from '../helpers/storageStyling';
import type { CategoryOption, StorageFile, TagOption } from '../storageHelpers';
import {
  formatFileSize,
  getBankDisplayName,
  getTagChipStyle,
  truncateFileNameForDisplay,
} from '../storageHelpers';
import { DraggableFileRow } from './DraggableFileRow';

export interface StorageFileTableProps {
  loading: boolean;
  isTrashView: boolean;
  paginatedFiles: StorageFile[];
  filteredFiles: StorageFile[];
  categories: CategoryOption[];
  categoriesLoading: boolean;
  selectedTrashIds: string[];
  selectableTrashIds: string[];
  selectedTrashIdsInView: string[];
  allTrashSelected: boolean;
  currentPage: number;
  totalPagesCount: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  emptyStateTitle: React.ReactNode;
  emptyStateSubtitle: React.ReactNode;
  tableFileNameLabel: React.ReactNode;
  tableBankLabel: React.ReactNode;
  tableAccountLabel: React.ReactNode;
  tableSizeLabel: React.ReactNode;
  tableStatusLabel: React.ReactNode;
  tableCategoryLabel: React.ReactNode;
  tableAccessLabel: React.ReactNode;
  tableCreatedAtLabel: React.ReactNode;
  tableDeletedAtLabel: React.ReactNode;
  tableActionsLabel: React.ReactNode;
  trashSelectAllLabel: string;
  trashSelectRowLabel: string;
  dragDropRowHintLabel: string;
  previewLabel: string;
  sharedLinksShortLabel: string;
  categoryNoneLabel: string;
  ownerLabel: string;
  trashRestoreActionLabel: string;
  trashDeleteActionLabel: string;
  viewTooltipLabel: string;
  downloadTooltipLabel: string;
  deleteActionLabel: string;
  paginationShownTemplate: string;
  paginationPageOfTemplate: string;
  paginationPreviousLabel: string;
  paginationNextLabel: string;
  getPermissionLabel: (permission?: string | null) => string;
  formatDate: (dateString: string) => string;
  renderTrashExpiryBadge: (deletedAt?: string | null) => React.ReactNode;
  renderAvailabilityChip: (availability?: StorageFile['fileAvailability']) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
  tagChipClass: (isActive: boolean) => string;
  onToggleTrashSelection: (fileId: string) => void;
  onToggleSelectAllTrash: () => void;
  // eslint-disable-next-line max-params
  onCategoryChange: (fileId: string, categoryId: string) => void | Promise<void>;
  onRestoreFromTrash: (file: StorageFile) => void | Promise<void>;
  onConfirmPermanentDelete: (file: StorageFile) => void | Promise<void>;
  onView: (fileId: string) => void;
  onDownload: (fileId: string, fileName: string) => void | Promise<void>;
  onConfirmDelete: (file: StorageFile) => void | Promise<void>;
  onPageChange: (page: number) => void;
  // eslint-disable-next-line max-params
  onPreviewOpen: (fileId: string, fileName: string) => void | Promise<void>;
}

// eslint-disable-next-line max-lines-per-function
export function StorageFileTable({
  loading,
  isTrashView,
  paginatedFiles,
  filteredFiles,
  categories,
  categoriesLoading,
  selectedTrashIds,
  selectableTrashIds,
  selectedTrashIdsInView,
  allTrashSelected,
  currentPage,
  totalPagesCount,
  totalItems,
  rangeStart,
  rangeEnd,
  emptyStateTitle,
  emptyStateSubtitle,
  tableFileNameLabel,
  tableBankLabel,
  tableAccountLabel,
  tableSizeLabel,
  tableStatusLabel,
  tableCategoryLabel,
  tableAccessLabel,
  tableCreatedAtLabel,
  tableDeletedAtLabel,
  tableActionsLabel,
  trashSelectAllLabel,
  trashSelectRowLabel,
  dragDropRowHintLabel,
  previewLabel,
  sharedLinksShortLabel,
  categoryNoneLabel,
  ownerLabel,
  trashRestoreActionLabel,
  trashDeleteActionLabel,
  viewTooltipLabel,
  downloadTooltipLabel,
  deleteActionLabel,
  paginationShownTemplate,
  paginationPageOfTemplate,
  getPermissionLabel,
  formatDate,
  renderTrashExpiryBadge,
  renderAvailabilityChip,
  renderStatusBadge,
  tagChipClass,
  onToggleTrashSelection,
  onToggleSelectAllTrash,
  onCategoryChange,
  onRestoreFromTrash,
  onConfirmPermanentDelete,
  onView,
  onDownload,
  onConfirmDelete,
  onPageChange,
  onPreviewOpen,
}: StorageFileTableProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          ...((loading || filteredFiles.length > 0) && {
            bgcolor: 'background.paper',
            border: '1px solid var(--border-color)',
          }),
          overflow: 'visible',
        }}
      >
        {loading ? (
          <LoadingState />
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            isTrashView={isTrashView}
            title={emptyStateTitle}
            subtitle={emptyStateSubtitle}
          />
        ) : (
          <TableBody
            isTrashView={isTrashView}
            paginatedFiles={paginatedFiles}
            categories={categories}
            categoriesLoading={categoriesLoading}
            selectedTrashIds={selectedTrashIds}
            selectableTrashIds={selectableTrashIds}
            selectedTrashIdsInView={selectedTrashIdsInView}
            allTrashSelected={allTrashSelected}
            tableFileNameLabel={tableFileNameLabel}
            tableBankLabel={tableBankLabel}
            tableAccountLabel={tableAccountLabel}
            tableSizeLabel={tableSizeLabel}
            tableStatusLabel={tableStatusLabel}
            tableCategoryLabel={tableCategoryLabel}
            tableAccessLabel={tableAccessLabel}
            tableCreatedAtLabel={tableCreatedAtLabel}
            tableDeletedAtLabel={tableDeletedAtLabel}
            tableActionsLabel={tableActionsLabel}
            trashSelectAllLabel={trashSelectAllLabel}
            trashSelectRowLabel={trashSelectRowLabel}
            dragDropRowHintLabel={dragDropRowHintLabel}
            previewLabel={previewLabel}
            sharedLinksShortLabel={sharedLinksShortLabel}
            categoryNoneLabel={categoryNoneLabel}
            ownerLabel={ownerLabel}
            trashRestoreActionLabel={trashRestoreActionLabel}
            trashDeleteActionLabel={trashDeleteActionLabel}
            viewTooltipLabel={viewTooltipLabel}
            downloadTooltipLabel={downloadTooltipLabel}
            deleteActionLabel={deleteActionLabel}
            getPermissionLabel={getPermissionLabel}
            formatDate={formatDate}
            renderTrashExpiryBadge={renderTrashExpiryBadge}
            renderAvailabilityChip={renderAvailabilityChip}
            renderStatusBadge={renderStatusBadge}
            tagChipClass={tagChipClass}
            onToggleTrashSelection={onToggleTrashSelection}
            onToggleSelectAllTrash={onToggleSelectAllTrash}
            onCategoryChange={onCategoryChange}
            onRestoreFromTrash={onRestoreFromTrash}
            onConfirmPermanentDelete={onConfirmPermanentDelete}
            onView={onView}
            onDownload={onDownload}
            onConfirmDelete={onConfirmDelete}
            onPreviewOpen={onPreviewOpen}
          />
        )}
        <PaginationFooter
          currentPage={currentPage}
          totalPagesCount={totalPagesCount}
          totalItems={totalItems}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          emptyStateTitle={emptyStateTitle}
          paginationShownTemplate={paginationShownTemplate}
          paginationPageOfTemplate={paginationPageOfTemplate}
          onPageChange={onPageChange}
        />
      </Box>
    </Box>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
      <Spinner className="h-8 w-8 text-primary" />
    </Box>
  );
}

interface EmptyStateProps {
  isTrashView: boolean;
  title: React.ReactNode;
  subtitle: React.ReactNode;
}

function EmptyState({ isTrashView, title, subtitle }: EmptyStateProps): React.JSX.Element {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
      <EmptyStateIllustration name={isTrashView ? 'trash' : 'storage'} size="lg" />
      <Typography style={{ fontSize: 18, fontWeight: 500, color: 'var(--foreground)' }}>
        {title}
      </Typography>
      <Typography style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{subtitle}</Typography>
    </Box>
  );
}

interface TableBodyProps {
  isTrashView: boolean;
  paginatedFiles: StorageFile[];
  categories: CategoryOption[];
  categoriesLoading: boolean;
  selectedTrashIds: string[];
  selectableTrashIds: string[];
  selectedTrashIdsInView: string[];
  allTrashSelected: boolean;
  tableFileNameLabel: React.ReactNode;
  tableBankLabel: React.ReactNode;
  tableAccountLabel: React.ReactNode;
  tableSizeLabel: React.ReactNode;
  tableStatusLabel: React.ReactNode;
  tableCategoryLabel: React.ReactNode;
  tableAccessLabel: React.ReactNode;
  tableCreatedAtLabel: React.ReactNode;
  tableDeletedAtLabel: React.ReactNode;
  tableActionsLabel: React.ReactNode;
  trashSelectAllLabel: string;
  trashSelectRowLabel: string;
  dragDropRowHintLabel: string;
  previewLabel: string;
  sharedLinksShortLabel: string;
  categoryNoneLabel: string;
  ownerLabel: string;
  trashRestoreActionLabel: string;
  trashDeleteActionLabel: string;
  viewTooltipLabel: string;
  downloadTooltipLabel: string;
  deleteActionLabel: string;
  getPermissionLabel: (permission?: string | null) => string;
  formatDate: (dateString: string) => string;
  renderTrashExpiryBadge: (deletedAt?: string | null) => React.ReactNode;
  renderAvailabilityChip: (availability?: StorageFile['fileAvailability']) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
  tagChipClass: (isActive: boolean) => string;
  onToggleTrashSelection: (fileId: string) => void;
  onToggleSelectAllTrash: () => void;
  // eslint-disable-next-line max-params
  onCategoryChange: (fileId: string, categoryId: string) => void | Promise<void>;
  onRestoreFromTrash: (file: StorageFile) => void | Promise<void>;
  onConfirmPermanentDelete: (file: StorageFile) => void | Promise<void>;
  onView: (fileId: string) => void;
  onDownload: (fileId: string, fileName: string) => void | Promise<void>;
  onConfirmDelete: (file: StorageFile) => void | Promise<void>;
  // eslint-disable-next-line max-params
  onPreviewOpen: (fileId: string, fileName: string) => void | Promise<void>;
}

const thStyle: React.CSSProperties = {
  padding: '16px 24px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

// eslint-disable-next-line max-lines-per-function
function TableBody({
  isTrashView,
  paginatedFiles,
  categories,
  categoriesLoading,
  selectedTrashIds,
  selectableTrashIds,
  selectedTrashIdsInView,
  allTrashSelected,
  tableFileNameLabel,
  tableBankLabel,
  tableAccountLabel,
  tableSizeLabel,
  tableStatusLabel,
  tableCategoryLabel,
  tableAccessLabel,
  tableCreatedAtLabel,
  tableDeletedAtLabel,
  tableActionsLabel,
  trashSelectAllLabel,
  trashSelectRowLabel,
  dragDropRowHintLabel,
  previewLabel,
  sharedLinksShortLabel,
  categoryNoneLabel,
  ownerLabel,
  trashRestoreActionLabel,
  trashDeleteActionLabel,
  viewTooltipLabel,
  downloadTooltipLabel,
  deleteActionLabel,
  getPermissionLabel,
  formatDate,
  renderTrashExpiryBadge,
  renderAvailabilityChip,
  renderStatusBadge,
  tagChipClass,
  onToggleTrashSelection,
  onToggleSelectAllTrash,
  onCategoryChange,
  onRestoreFromTrash,
  onConfirmPermanentDelete,
  onView,
  onDownload,
  onConfirmDelete,
  onPreviewOpen,
}: TableBodyProps): React.JSX.Element {
  const canEditFile = (file: StorageFile): boolean =>
    !file.deletedAt && (file.isOwner || file.permissionType === 'editor');

  return (
    <Box sx={{ overflowX: 'auto', overflowY: 'visible' }} data-tour-id="storage-table">
      <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--muted)' }}>
          <tr>
            {isTrashView && (
              <th style={{ ...thStyle, width: 48 }}>
                <Checkbox
                  checked={allTrashSelected}
                  indeterminate={
                    selectedTrashIdsInView.length > 0 &&
                    selectedTrashIdsInView.length < selectableTrashIds.length
                  }
                  onCheckedChange={onToggleSelectAllTrash}
                  className="h-4 w-4"
                  aria-label={trashSelectAllLabel}
                />
              </th>
            )}
            <th style={thStyle}>{tableFileNameLabel}</th>
            <th style={thStyle}>{tableBankLabel}</th>
            <th style={thStyle}>{tableAccountLabel}</th>
            <th style={thStyle}>{tableSizeLabel}</th>
            <th style={thStyle}>{tableStatusLabel}</th>
            <th style={thStyle}>{tableCategoryLabel}</th>
            <th style={thStyle}>{tableAccessLabel}</th>
            <th style={thStyle}>{isTrashView ? tableDeletedAtLabel : tableCreatedAtLabel}</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 96 }}>{tableActionsLabel}</th>
          </tr>
        </thead>
        <tbody style={{ background: 'var(--card-bg)' }}>
          {/* eslint-disable-next-line max-lines-per-function, max-params */}
          {paginatedFiles.map((file, index) => (
            <DraggableFileRow
              key={file.id}
              dataTourId={!isTrashView && index === 0 ? 'storage-file-row' : undefined}
              file={file}
              isTrashView={isTrashView}
              selectedTrashIds={selectedTrashIds}
              toggleTrashSelection={onToggleTrashSelection}
              setPreviewFileId={id => id && onPreviewOpen(id, file.fileName)}
              setPreviewFileName={() => undefined}
              setPreviewModalOpen={() => undefined}
              canEditFile={canEditFile}
              truncateFileNameForDisplay={truncateFileNameForDisplay}
              renderTrashExpiryBadge={renderTrashExpiryBadge}
              renderAvailabilityChip={renderAvailabilityChip}
              tagChipClass={tagChipClass}
              getTagChipStyle={getTagChipStyle}
              getBankDisplayName={getBankDisplayName}
              formatFileSize={formatFileSize}
              renderStatusBadge={renderStatusBadge}
              handleCategoryChange={onCategoryChange}
              categories={categories}
              categoriesLoading={categoriesLoading}
              trashSelectRowLabel={trashSelectRowLabel}
              dragDropRowHintLabel={dragDropRowHintLabel}
              previewLabel={previewLabel}
              sharedLinksShortLabel={sharedLinksShortLabel}
              categoryNoneLabel={categoryNoneLabel}
              ownerLabel={ownerLabel}
              trashRestoreActionLabel={trashRestoreActionLabel}
              trashDeleteActionLabel={trashDeleteActionLabel}
              viewTooltipLabel={viewTooltipLabel}
              downloadTooltipLabel={downloadTooltipLabel}
              deleteActionLabel={deleteActionLabel}
              getPermissionLabel={getPermissionLabel}
              formatDate={formatDate}
              handleRestoreFromTrash={onRestoreFromTrash}
              confirmPermanentDelete={onConfirmPermanentDelete}
              handleView={onView}
              handleDownload={onDownload}
              confirmDelete={onConfirmDelete}
            />
          ))}
        </tbody>
      </table>
    </Box>
  );
}

interface PaginationFooterProps {
  currentPage: number;
  totalPagesCount: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  emptyStateTitle: React.ReactNode;
  paginationShownTemplate: string;
  paginationPageOfTemplate: string;
  onPageChange: (page: number) => void;
}

function PaginationFooter({
  currentPage,
  totalPagesCount,
  totalItems,
  rangeStart,
  rangeEnd,
  emptyStateTitle,
  paginationShownTemplate,
  paginationPageOfTemplate,
  onPageChange,
}: PaginationFooterProps): React.JSX.Element {
  const shownLabel =
    totalItems === 0
      ? emptyStateTitle
      : formatPaginationLabel(paginationShownTemplate, {
          from: rangeStart,
          to: rangeEnd,
          count: totalItems,
        });
  const pageOfLabel = formatPaginationLabel(paginationPageOfTemplate, {
    page: currentPage,
    count: totalPagesCount,
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
        px: 3,
        py: 2,
        borderTop: '1px solid var(--border-color)',
      }}
      data-tour-id="pagination"
    >
      <Typography style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{shownLabel}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            minWidth: 120,
            textAlign: 'center',
          }}
        >
          {pageOfLabel}
        </Typography>
        <AppPagination page={currentPage} total={totalPagesCount} onChange={onPageChange} />
      </Box>
    </Box>
  );
}

export type { TagOption };
// Re-export chip renderers for use in the main component
export { Chip, getAvailabilityChipStyle, getStatusChipStyle };
