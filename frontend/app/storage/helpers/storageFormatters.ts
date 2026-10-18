// Formatter helpers extracted from StoragePageContent

import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { FileAvailabilityStatus } from '../storageHelpers';

type LocaleCode = string;

export function resolveLocaleCode(locale: LocaleCode): string {
  return resolveLocaleTag(locale);
}

export function formatDate(dateString: string, locale: LocaleCode): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return formatStoredDateWithOptions(
    date,
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
    resolveLocaleCode(locale),
  );
}

const STATUS_LABEL_MAP: Record<string, keyof StatusLabels> = {
  completed: 'completed',
  processing: 'processing',
  error: 'error',
  uploaded: 'uploaded',
  parsed: 'parsed',
};

export interface StatusLabels {
  completed: string;
  processing: string;
  error: string;
  uploaded: string;
  parsed: string;
}

export function getStatusLabel(status: string, labels: StatusLabels): string {
  const key = STATUS_LABEL_MAP[status.toLowerCase()];
  return key ? labels[key] : status;
}

const PERMISSION_LABEL_MAP: Record<string, keyof PermissionLabels> = {
  owner: 'owner',
  editor: 'editor',
  viewer: 'viewer',
  downloader: 'downloader',
};

export interface PermissionLabels {
  owner: string;
  editor: string;
  viewer: string;
  downloader: string;
  access: string;
}

export function getPermissionLabel(
  permission: string | null | undefined,
  labels: PermissionLabels,
): string {
  const normalized = (permission ?? '').toLowerCase();
  const key = PERMISSION_LABEL_MAP[normalized];
  return key ? labels[key] : labels.access;
}

export interface AvailabilityLabels {
  both: string;
  disk: string;
  db: string;
  missing: string;
}

export function getAvailabilityLabel(
  status: FileAvailabilityStatus,
  labels: AvailabilityLabels,
): string {
  const labelMap: Record<string, string> = {
    both: labels.both,
    disk: labels.disk,
    db: labels.db,
    missing: labels.missing,
  };
  return labelMap[status] ?? status;
}

export interface AvailabilityTooltips {
  both: string;
  disk: string;
  db: string;
  missing: string;
}

export function getAvailabilityTooltip(
  status: FileAvailabilityStatus,
  tooltips: AvailabilityTooltips,
): string {
  const tooltipMap: Record<string, string> = {
    both: tooltips.both,
    disk: tooltips.disk,
    db: tooltips.db,
    missing: tooltips.missing,
  };
  return tooltipMap[status] ?? status;
}

export function formatPaginationLabel(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}
