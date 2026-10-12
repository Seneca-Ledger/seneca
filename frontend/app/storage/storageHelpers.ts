import { resolveBankLogo } from '@bank-logos';
import type { PopoverProps } from '@mui/material';
import type { CSSProperties } from 'react';
import type { StorageFile as StorageFileRow, StorageFolder } from '@/app/lib/contracts';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type FileAvailabilityStatus = 'both' | 'disk' | 'db' | 'missing';

export type FileAvailability = {
  onDisk: boolean;
  inDb: boolean;
  status: FileAvailabilityStatus;
};

export interface TagOption {
  id: string;
  name: string;
  color?: string | null;
  userId?: string | null;
}

/** A folder, as `GET /storage/folders` and the file rows send it. */
export type FolderOption = StorageFolder;

export interface StorageView {
  id: string;
  name: string;
  filters?: StorageViewPayload;
  createdAt: string;
}

/** A row of the file list, as `GET /storage/files` sends it. */
export type StorageFile = StorageFileRow;

export interface CategoryOption {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  isEnabled?: boolean;
}

export type SortField = 'createdAt' | 'fileName' | 'bankName';
export type SortDirection = 'asc' | 'desc';

export interface StorageViewFilterValues {
  status?: string;
  bank?: string;
  categoryId?: string;
  ownership?: string;
  folderId?: string;
  tagIds?: string[];
}

export interface StorageViewPayload {
  searchQuery?: string;
  search?: string;
  sort?: {
    field?: SortField;
    direction?: SortDirection;
  };
  filters?: StorageViewFilterValues;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const NO_FOLDER = '__none__';
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const DEFAULT_TRASH_TTL_DAYS = 30;
export const FOLDER_NAME_MAX = 40;

export const DEFAULT_FILTERS = {
  status: '',
  bank: '',
  categoryId: '',
  ownership: '',
  folderId: '',
};

export const DEFAULT_SORT: { field: SortField; direction: SortDirection } = {
  field: 'createdAt',
  direction: 'desc',
};

// ─── MUI Slot Props ───────────────────────────────────────────────────────────

export const colorPickerPopoverSlotProps: PopoverProps['slotProps'] = {
  paper: {
    sx: {
      p: 1.5,
      mt: 1,
      border: '1px solid',
      borderColor: 'divider',
      boxShadow: '0 4px 16px -4px rgba(12,12,20,0.08)',
      overflow: 'visible',
      '&::before': {
        content: '""',
        display: 'block',
        position: 'absolute',
        top: 0,
        right: 14,
        width: 10,
        height: 10,
        bgcolor: 'background.paper',
        transform: 'translateY(-50%) rotate(45deg)',
        zIndex: 0,
        borderLeft: '1px solid',
        borderTop: '1px solid',
        borderColor: 'divider',
      },
    },
  },
};

// ─── Pure Helper Functions ────────────────────────────────────────────────────

export const getBankDisplayName = (bankName: string): string => {
  const resolved = resolveBankLogo(bankName);
  if (!resolved) {
    return bankName;
  }
  return resolved.key !== 'other' ? resolved.displayName : bankName;
};

export const getAvailabilityColor = (status: FileAvailabilityStatus): string => {
  switch (status) {
    case 'both':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-100 dark:border-green-500/30';
    case 'missing':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-100 dark:border-red-500/30';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60';
  }
};

export const getAvailabilityDot = (status: FileAvailabilityStatus): string => {
  switch (status) {
    case 'both':
      return 'bg-green-500';
    case 'missing':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

export const getTagChipStyle = (tag: TagOption): CSSProperties | undefined => {
  if (!tag.color) {
    return undefined;
  }
  return {
    borderColor: tag.color,
    color: tag.color,
  };
};

export const truncateFileNameForDisplay = (name: string, maxLength = 15): string => {
  if (!name) {
    return '';
  }
  if (name.length <= maxLength) {
    return name;
  }
  const truncated = name.slice(0, Math.max(0, maxLength - 1));
  return `${truncated}…`;
};

export const tagChipClass = (isActive: boolean): string =>
  `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
    isActive
      ? 'bg-primary/10 text-primary border-primary/30'
      : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800/60 dark:text-gray-200 dark:border-slate-700/60'
  }`;

export const getStatusTone = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  const normalized = status.toLowerCase();
  if (normalized === 'completed' || normalized === 'parsed') {
    return 'success';
  }
  if (normalized === 'processing' || normalized === 'uploaded') {
    return 'warning';
  }
  if (normalized === 'error') {
    return 'error';
  }
  return 'default';
};
