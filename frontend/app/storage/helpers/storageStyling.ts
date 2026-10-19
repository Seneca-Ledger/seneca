// Styling helpers extracted from StoragePageContent
import type { SxProps, Theme } from '@mui/material';
import { tokens } from '@/lib/theme-tokens';

export function tagChipSx(isActive: boolean): SxProps<Theme> {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    border: '1px solid',
    borderColor: isActive ? 'rgba(var(--primary-rgb),0.3)' : '#e5e7eb',
    borderRadius: tokens.radius.sm,
    px: 1,
    py: 0.25,
    fontSize: 11,
    fontWeight: 600,
    bgcolor: isActive ? 'rgba(var(--primary-rgb),0.1)' : '#f9fafb',
    color: isActive ? 'var(--primary)' : '#374151',
    cursor: 'pointer',
  };
}

export function listToggleSx(isActive: boolean): SxProps<Theme> {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
    border: '1px solid',
    px: 2,
    py: 1,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    bgcolor: isActive ? 'rgba(var(--primary-rgb),0.1)' : 'background.paper',
    color: isActive ? 'primary.main' : '#4b5563',
    borderColor: isActive ? 'rgba(var(--primary-rgb),0.3)' : '#e5e7eb',
    '&:hover': isActive ? {} : { bgcolor: '#f9fafb' },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  };
}

export interface TrashChipStyle {
  bgcolor: string;
  color: string;
  border: string;
}

export function getTrashChipSx(daysLeft: number): TrashChipStyle {
  if (daysLeft <= 0) {
    return { bgcolor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
  }
  if (daysLeft <= 3) {
    return { bgcolor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' };
  }
  return { bgcolor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' };
}

export interface AvailabilityChipStyle {
  dotColor: string;
  chipSx: SxProps<Theme>;
}

export function getAvailabilityChipStyle(status: string): AvailabilityChipStyle {
  const isMissing = status === 'missing';
  const isBoth = status === 'both';
  const dotColor = isBoth ? '#22c55e' : isMissing ? '#ef4444' : '#3b82f6';
  const chipSx: SxProps<Theme> = isMissing
    ? { bgcolor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
    : isBoth
      ? { bgcolor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }
      : { bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  return { dotColor, chipSx };
}

export interface StatusChipStyle {
  dotColor: string;
  chipSx: SxProps<Theme>;
}

const STATUS_DOT_MAP: Record<string, string> = {
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
};

const STATUS_CHIP_MAP: Record<string, SxProps<Theme>> = {
  success: { bgcolor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
  warning: { bgcolor: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' },
  error: { bgcolor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
};

const STATUS_DOT_DEFAULT = '#9ca3af';
const STATUS_CHIP_DEFAULT: SxProps<Theme> = {
  bgcolor: '#f3f4f6',
  color: '#374151',
  border: '1px solid #e5e7eb',
};

export function getStatusChipStyle(tone: string): StatusChipStyle {
  return {
    dotColor: STATUS_DOT_MAP[tone] ?? STATUS_DOT_DEFAULT,
    chipSx: STATUS_CHIP_MAP[tone] ?? STATUS_CHIP_DEFAULT,
  };
}
