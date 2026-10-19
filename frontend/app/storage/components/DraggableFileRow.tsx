'use client';

import { useDraggable } from '@dnd-kit/core';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
import React from 'react';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { DocumentTypeIcon } from '@/app/components/DocumentTypeIcon';
import {
  Download,
  Eye,
  Folder,
  GripVertical,
  RotateCcw,
  Share2,
  Trash2,
} from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import type { CategoryOption, FileAvailability, StorageFile, TagOption } from '../storageHelpers';

interface DraggableFileRowProps {
  dataTourId?: string;
  file: StorageFile;
  isTrashView: boolean;
  selectedTrashIds: string[];
  toggleTrashSelection: (id: string) => void;
  setPreviewFileId: (id: string) => void;
  setPreviewFileName: (name: string) => void;
  setPreviewModalOpen: (open: boolean) => void;
  canEditFile: (file: StorageFile) => boolean;
  truncateFileNameForDisplay: (name: string, max?: number) => string;
  renderTrashExpiryBadge: (date?: string | null) => React.ReactNode;
  renderAvailabilityChip: (availability?: FileAvailability) => React.ReactNode;
  tagChipClass: (isActive: boolean) => string;
  getTagChipStyle: (tag: TagOption) => CSSProperties | undefined;
  getBankDisplayName: (name: string) => string;
  formatFileSize: (bytes: number) => string;
  renderStatusBadge: (status: string) => React.ReactNode;
  handleCategoryChange: (fileId: string, categoryId: string) => void;
  categories: CategoryOption[];
  categoriesLoading: boolean;
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
  getPermissionLabel: (perm?: string | null) => string;
  formatDate: (date: string) => string;
  handleRestoreFromTrash: (file: StorageFile) => void;
  confirmPermanentDelete: (file: StorageFile) => void;
  handleView: (id: string) => void;
  handleDownload: (id: string, name: string) => void;
  confirmDelete: (file: StorageFile) => void;
}

export const DraggableFileRow = React.memo(
  ({
    dataTourId,
    file,
    isTrashView,
    selectedTrashIds,
    toggleTrashSelection,
    setPreviewFileId,
    setPreviewFileName,
    setPreviewModalOpen,
    canEditFile,
    truncateFileNameForDisplay,
    renderTrashExpiryBadge,
    renderAvailabilityChip,
    tagChipClass,
    getTagChipStyle,
    getBankDisplayName,
    formatFileSize,
    renderStatusBadge,
    handleCategoryChange,
    categories,
    categoriesLoading,
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
    handleRestoreFromTrash,
    confirmPermanentDelete,
    handleView,
    handleDownload,
    confirmDelete,
  }: DraggableFileRowProps) => {
    const t = useIntlayer('storagePage');
    const { resolvedTheme } = useTheme();
    const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: `file-${file.id}`,
      data: { file },
      disabled: !canEditFile(file),
    });

    const style = {
      opacity: isDragging ? 0.3 : 1,
    };

    return (
      <tr ref={setNodeRef} data-tour-id={dataTourId} style={style}>
        {isTrashView && (
          <td style={{ padding: '20px 24px' }}>
            <Checkbox
              checked={selectedTrashIds.includes(file.id)}
              onCheckedChange={() => toggleTrashSelection(file.id)}
              aria-label={trashSelectRowLabel}
            />
          </td>
        )}
        <td style={{ padding: '20px 24px' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: canEditFile(file) ? 'grab' : 'default',
            }}
            {...(canEditFile(file) ? { ...attributes, ...listeners } : {})}
            title={canEditFile(file) ? dragDropRowHintLabel : undefined}
          >
            {canEditFile(file) && (
              <Box sx={{ p: 0.5, color: c.ink300, pointerEvents: 'none' }}>
                <GripVertical size={20} />
              </Box>
            )}
            <Box
              component="button"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                p: 0,
                '&:hover': { opacity: 0.8 },
              }}
              onClick={() => {
                setPreviewFileId(file.id);
                setPreviewFileName(file.fileName);
                setPreviewModalOpen(true);
              }}
              title={previewLabel}
            >
              <DocumentTypeIcon
                fileType={file.fileType}
                fileName={file.fileName}
                fileId={file.id}
                size={40}
              />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box
                component="button"
                sx={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: c.ink900,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  p: 0,
                  textAlign: 'left',
                  width: '100%',
                  '&:hover': { color: '#2563eb' },
                }}
                title={file.fileName}
                onClick={() => {
                  setPreviewFileId(file.id);
                  setPreviewFileName(file.fileName);
                  setPreviewModalOpen(true);
                }}
              >
                {truncateFileNameForDisplay(file.fileName)}
              </Box>
              <Box
                sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
              >
                {file.folder?.name && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: 12,
                      color: c.ink500,
                    }}
                  >
                    <Folder style={{ width: 14, height: 14 }} />
                    {file.folder.name}
                  </Box>
                )}
                {isTrashView && renderTrashExpiryBadge(file.deletedAt)}
                {file.sharedLinksCount > 0 && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: 12,
                      color: '#2563eb',
                    }}
                  >
                    <Share2 size={12} />
                    {file.sharedLinksCount} {sharedLinksShortLabel}
                  </Box>
                )}
                {renderAvailabilityChip(file.fileAvailability)}
              </Box>
              {file.tags && file.tags.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {file.tags.map(tag => (
                    <span key={tag.id} className={tagChipClass(false)} style={getTagChipStyle(tag)}>
                      {tag.name}
                    </span>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BankLogoAvatar bankName={file.bankName} size={28} />
            <Typography style={{ fontSize: 14, fontWeight: 500, color: c.ink800 }}>
              {getBankDisplayName(file.bankName)}
            </Typography>
          </Box>
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap' }}>
          <Typography
            component="span"
            style={{ fontSize: 14, fontFamily: 'monospace', color: c.ink700 }}
          >
            {file.accountNumber ? `••••${file.accountNumber.slice(-4)}` : '—'}
          </Typography>
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap', fontSize: 14, color: c.ink800 }}>
          {formatFileSize(file.fileSize)}
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap', fontSize: 14, color: c.ink800 }}>
          {renderStatusBadge(file.status)}
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap', fontSize: 14, color: c.ink800 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Select
              value={file.categoryId || ''}
              onChange={value => handleCategoryChange(file.id, value)}
              disabled={
                isTrashView ||
                categoriesLoading ||
                (!file.isOwner && file.permissionType !== 'editor')
              }
              options={[
                { value: '', label: categoryNoneLabel },
                ...categories
                  .filter(cat => cat.isEnabled !== false)
                  .map(cat => ({ value: cat.id, label: cat.name })),
              ]}
              sx={{ minWidth: 160, backgroundColor: 'var(--card-bg)', color: c.ink900 }}
            />
            {file.category?.isEnabled === false ? (
              <Typography style={{ fontSize: 12, fontWeight: 500, color: c.danger }}>
                {file.category.name} - {t.categoryCell.chooseCategory}
              </Typography>
            ) : null}
          </Box>
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap', fontSize: 14 }}>
          <Chip
            label={file.isOwner ? ownerLabel : getPermissionLabel(file.permissionType)}
            size="small"
            sx={{
              borderRadius: tokens.radius.sm,
              fontSize: 12,
              fontWeight: 600,
              bgcolor: file.isOwner ? c.ink50 : c.primary50,
              color: file.isOwner ? c.ink800 : c.primary,
              border: `1px solid ${file.isOwner ? c.ink150 : c.primary200}`,
            }}
          />
        </td>

        <td style={{ padding: '20px 24px', whiteSpace: 'nowrap', fontSize: 14, color: c.ink800 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <span>
              {formatDate(isTrashView && file.deletedAt ? file.deletedAt : file.createdAt)}
            </span>
          </Box>
        </td>

        <td
          style={{ padding: '20px 24px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 14 }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.5,
            }}
          >
            {isTrashView ? (
              <>
                <Tooltip title={trashRestoreActionLabel}>
                  <IconButton
                    size="small"
                    onClick={() => handleRestoreFromTrash(file)}
                    sx={{
                      color: c.success,
                      bgcolor: c.successSoft,
                      borderRadius: tokens.radius.sm,
                      '&:hover': { bgcolor: c.successSoft },
                    }}
                  >
                    <RotateCcw size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={trashDeleteActionLabel}>
                  <IconButton
                    size="small"
                    onClick={() => confirmPermanentDelete(file)}
                    sx={{
                      color: c.ink500,
                      borderRadius: tokens.radius.sm,
                      '&:hover': { color: c.danger, bgcolor: c.dangerSoft },
                    }}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title={viewTooltipLabel}>
                  <IconButton
                    size="small"
                    onClick={() => handleView(file.id)}
                    sx={{
                      color: '#2563eb',
                      bgcolor: 'var(--color-info-soft-bg)',
                      borderRadius: tokens.radius.sm,
                      '&:hover': { bgcolor: 'var(--color-info-soft-border)' },
                    }}
                  >
                    <Eye size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={downloadTooltipLabel}>
                  <IconButton
                    size="small"
                    onClick={() => handleDownload(file.id, file.fileName)}
                    sx={{
                      color: c.ink500,
                      borderRadius: tokens.radius.sm,
                      '&:hover': { color: c.ink800, bgcolor: c.ink50 },
                    }}
                  >
                    <Download size={18} />
                  </IconButton>
                </Tooltip>
                {canEditFile(file) && (
                  <Tooltip title={deleteActionLabel}>
                    <IconButton
                      size="small"
                      onClick={() => confirmDelete(file)}
                      sx={{
                        color: c.ink500,
                        borderRadius: tokens.radius.sm,
                        '&:hover': { color: c.danger, bgcolor: c.dangerSoft },
                      }}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
          </Box>
        </td>
      </tr>
    );
  },
);

DraggableFileRow.displayName = 'DraggableFileRow';
