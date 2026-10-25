// Computation helpers extracted from StoragePageContent

import { Box, Chip } from '@mui/material';
import React from 'react';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import {
  DEFAULT_TRASH_TTL_DAYS,
  type FileAvailability,
  MS_PER_DAY,
  NO_FOLDER,
  type StorageFile,
} from '../storageHelpers';
import { getAvailabilityLabel, getAvailabilityTooltip } from './storageFormatters';
import { getAvailabilityChipStyle, getStatusChipStyle } from './storageStyling';

// ─── Folder / Tag counts ──────────────────────────────────────────────────────

export function buildFolderCounts(files: StorageFile[]): {
  counts: Record<string, number>;
  noFolder: number;
} {
  const counts: Record<string, number> = {};
  let noFolder = 0;
  for (const file of files) {
    if (file.folderId) {
      counts[file.folderId] = (counts[file.folderId] || 0) + 1;
    } else {
      noFolder += 1;
    }
  }
  return { counts, noFolder };
}

export function buildTagCounts(files: StorageFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    for (const tag of file.tags || []) {
      counts[tag.id] = (counts[tag.id] || 0) + 1;
    }
  }
  return counts;
}

// ─── Filtering / Sorting / Pagination ────────────────────────────────────────

interface FilterParams {
  files: StorageFile[];
  isTrashView: boolean;
  searchQuery: string;
  filters: {
    status: string;
    bank: string;
    categoryId: string;
    ownership: string;
    folderId: string;
  };
}

export function buildFilteredFiles({
  files,
  isTrashView,
  searchQuery,
  filters,
}: FilterParams): StorageFile[] {
  return files.filter(file => {
    const isDeleted = !!file.deletedAt;
    if (isTrashView ? !isDeleted : isDeleted) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      file.fileName.toLowerCase().includes(q) ||
      (file.bankName || '').toLowerCase().includes(q) ||
      (file.accountNumber || '').toLowerCase().includes(q) ||
      (file.category?.name || '').toLowerCase().includes(q) ||
      (file.tags || [])
        .map(t => t.name.toLowerCase())
        .join(' ')
        .includes(q);
    const matchesStatus = !filters.status || file.status === filters.status;
    const matchesBank = !filters.bank || file.bankName === filters.bank;
    const matchesCategory = !filters.categoryId || file.categoryId === filters.categoryId;
    const matchesOwnership =
      !filters.ownership || (filters.ownership === 'owned' ? file.isOwner : !file.isOwner);
    const matchesFolder = filters.folderId
      ? filters.folderId === NO_FOLDER
        ? !file.folderId
        : file.folderId === filters.folderId
      : true;
    return (
      matchesSearch &&
      matchesStatus &&
      matchesBank &&
      matchesCategory &&
      matchesOwnership &&
      matchesFolder
    );
  });
}

interface SortParams {
  filteredFiles: StorageFile[];
  sort: { field: string; direction: string };
  locale: string;
}

export function buildSortedFiles({ filteredFiles, sort, locale }: SortParams): StorageFile[] {
  const multiplier = sort.direction === 'asc' ? 1 : -1;
  return [...filteredFiles].sort((a, b) => {
    if (sort.field === 'fileName') {
      return a.fileName.localeCompare(b.fileName, locale) * multiplier;
    }
    if (sort.field === 'bankName') {
      return a.bankName.localeCompare(b.bankName, locale) * multiplier;
    }
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
  });
}

interface PaginationParams {
  sortedFiles: StorageFile[];
  page: number;
  pageSize: number;
}

export function buildPaginatedData({ sortedFiles, page, pageSize }: PaginationParams): {
  totalItems: number;
  totalPagesCount: number;
  currentPage: number;
  rangeStart: number;
  rangeEnd: number;
  paginatedFiles: StorageFile[];
} {
  const totalItems = sortedFiles.length;
  const totalPagesCount = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const currentPage = Math.min(page, totalPagesCount);
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(totalItems, currentPage * pageSize);
  const paginatedFiles = sortedFiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return { totalItems, totalPagesCount, currentPage, rangeStart, rangeEnd, paginatedFiles };
}

// ─── Folder modal files ───────────────────────────────────────────────────────

interface FolderModalFilesParams {
  files: StorageFile[];
  folderFileQuery: string;
  activeFolderId: string | null;
}

export function buildFolderModalFiles({
  files,
  folderFileQuery,
  activeFolderId,
}: FolderModalFilesParams): StorageFile[] {
  const query = folderFileQuery.trim().toLowerCase();
  return files.filter(file => {
    const matchesFolder =
      activeFolderId === ''
        ? true
        : activeFolderId === NO_FOLDER
          ? !file.folderId
          : file.folderId === activeFolderId;
    if (!matchesFolder) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      file.fileName.toLowerCase().includes(query) ||
      file.bankName.toLowerCase().includes(query) ||
      (file.folder?.name || '').toLowerCase().includes(query) ||
      (file.tags || [])
        .map(t => t.name.toLowerCase())
        .join(' ')
        .includes(query)
    );
  });
}

// ─── Render functions ─────────────────────────────────────────────────────────

interface AvailabilityChipLabels {
  both: string;
  disk: string;
  db: string;
  missing: string;
}

interface AvailabilityChipTooltips {
  both: string;
  disk: string;
  db: string;
  missing: string;
}

interface StatusChipLabels {
  completed: string;
  processing: string;
  error: string;
  uploaded: string;
  parsed: string;
}

interface RenderFunctionParams {
  locale: string;
  trashTtlDays: number;
  t: {
    trash: {
      expiresToday: { value: string };
      expiresIn: { value: string };
    };
    availability: {
      labels: AvailabilityChipLabels;
      tooltips: {
        both: { value: string };
        disk: { value: string };
        db: { value: string };
        missing: { value: string };
      };
    };
    statusLabels: StatusChipLabels;
  };
  getStatusTone: (status: string) => 'success' | 'warning' | 'error' | 'default';
  boundGetStatusLabel: (status: string) => string;
}

function resolveLocale(locale: string): string {
  return resolveLocaleTag(locale);
}

function buildRenderTrashExpiryBadge({
  locale,
  trashTtlDays,
  t,
}: Pick<RenderFunctionParams, 'locale' | 'trashTtlDays' | 't'>): (
  deletedAt?: string | null,
) => React.ReactNode {
  return function renderTrashExpiryBadge(deletedAt?: string | null): React.ReactNode {
    if (!deletedAt) {
      return null;
    }
    const deletedDate = new Date(deletedAt);
    if (Number.isNaN(deletedDate.getTime())) {
      return null;
    }
    const days = trashTtlDays || DEFAULT_TRASH_TTL_DAYS;
    const expiresAt = new Date(deletedDate.getTime() + days * MS_PER_DAY);
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / MS_PER_DAY);
    const isExpired = daysLeft <= 0;
    const label = isExpired
      ? t.trash.expiresToday.value
      : t.trash.expiresIn.value.replace('{days}', String(daysLeft));
    const chipSx = isExpired
      ? { bgcolor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
      : daysLeft <= 3
        ? { bgcolor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
        : { bgcolor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' };
    return React.createElement(Chip, {
      label,
      size: 'small',
      title: formatStoredDate(expiresAt, resolveLocale(locale)),
      sx: {
        borderRadius: tokens.radius.full,
        fontSize: 11,
        fontWeight: 600,
        height: 'auto',
        py: 0.25,
        ...chipSx,
      },
    });
  };
}

function buildRenderAvailabilityChip({
  t,
}: Pick<RenderFunctionParams, 't'>): (availability?: FileAvailability) => React.ReactNode {
  const labels: AvailabilityChipLabels = t.availability.labels;
  const tooltips: AvailabilityChipTooltips = {
    both: t.availability.tooltips.both.value,
    disk: t.availability.tooltips.disk.value,
    db: t.availability.tooltips.db.value,
    missing: t.availability.tooltips.missing.value,
  };
  return function renderAvailabilityChip(availability?: FileAvailability): React.ReactNode {
    if (!availability) {
      return null;
    }
    const { status } = availability;
    const { dotColor, chipSx } = getAvailabilityChipStyle(status);
    return React.createElement(Chip, {
      label: React.createElement(
        Box,
        { sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5 } },
        React.createElement(Box, {
          sx: {
            width: 8,
            height: 8,
            borderRadius: tokens.radius.full,
            bgcolor: dotColor,
            flexShrink: 0,
          },
        }),
        getAvailabilityLabel(status, labels),
      ),
      size: 'small',
      title: getAvailabilityTooltip(status, tooltips),
      sx: {
        borderRadius: tokens.radius.full,
        fontSize: 11,
        fontWeight: 600,
        height: 'auto',
        py: 0.25,
        ...chipSx,
      },
    });
  };
}

function buildRenderStatusBadge({
  boundGetStatusLabel,
  getStatusTone,
}: Pick<RenderFunctionParams, 'boundGetStatusLabel' | 'getStatusTone'>): (
  status: string,
) => React.ReactNode {
  return function renderStatusBadge(status: string): React.ReactNode {
    const tone = getStatusTone(status);
    const { dotColor, chipSx } = getStatusChipStyle(tone);
    return React.createElement(Chip, {
      label: React.createElement(
        Box,
        { sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5 } },
        React.createElement(Box, {
          sx: {
            width: 8,
            height: 8,
            borderRadius: tokens.radius.full,
            bgcolor: dotColor,
            flexShrink: 0,
          },
        }),
        boundGetStatusLabel(status),
      ),
      size: 'small',
      sx: {
        borderRadius: tokens.radius.full,
        fontSize: 12,
        fontWeight: 500,
        height: 'auto',
        py: 0.5,
        ...chipSx,
      },
    });
  };
}

export function buildRenderFunctions(params: RenderFunctionParams): {
  renderTrashExpiryBadge: (deletedAt?: string | null) => React.ReactNode;
  renderAvailabilityChip: (availability?: FileAvailability) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
} {
  return {
    renderTrashExpiryBadge: buildRenderTrashExpiryBadge(params),
    renderAvailabilityChip: buildRenderAvailabilityChip(params),
    renderStatusBadge: buildRenderStatusBadge(params),
  };
}
