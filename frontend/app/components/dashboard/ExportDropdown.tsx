'use client';

import { ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText, FileType2 } from '@/app/components/icons';
import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import type { ContractInput } from '@/app/lib/query-fn-schema';

type ExportFormat = 'excel' | 'pdf' | 'csv' | 'docx';

interface Token {
  value: string;
}

interface ExportDropdownProps {
  t?: Partial<{
    button: Token;
    title: Token;
    excel: Token;
    pdf: Token;
    csv: Token;
    docx: Token;
    downloading: Token;
    success: Token;
    error: Token;
  }>;
}

const EXPORT_ITEMS: Array<{
  key: ExportFormat;
  labelKey: keyof NonNullable<ExportDropdownProps['t']>;
  icon: typeof FileSpreadsheet;
}> = [
  { key: 'excel', labelKey: 'excel', icon: FileSpreadsheet },
  { key: 'pdf', labelKey: 'pdf', icon: FileText },
  { key: 'csv', labelKey: 'csv', icon: FileType2 },
  { key: 'docx', labelKey: 'docx', icon: FileText },
];

const resolveText = (token: Token | undefined, fallback: string): string =>
  token?.value || fallback;

const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  excel: 'xlsx',
  pdf: 'pdf',
  csv: 'csv',
  docx: 'docx',
};

const resolveDownloadFileName = (format: ExportFormat, contentDisposition?: string): string => {
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1].replace(/"/g, ''));
  return `workspace-transactions.${EXPORT_EXTENSIONS[format]}`;
};

const ITEM_FALLBACKS: Record<ExportFormat, string> = {
  docx: 'Word (.docx)',
  excel: 'Excel (.xlsx)',
  pdf: 'PDF',
  csv: 'CSV',
};

function triggerDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function runExport(format: ExportFormat, t: ExportDropdownProps['t']): Promise<void> {
  const toastId = toast.loading(resolveText(t?.downloading, 'Downloading...'));
  try {
    const response = await apiClient.post(
      '/reports/workspace-export',
      { format } satisfies ContractInput<'WorkspaceExportBody'>,
      { responseType: 'blob' },
    );
    const fileName = resolveDownloadFileName(format, response.headers?.['content-disposition']);
    triggerDownload(new Blob([blobOf(response)]), fileName);
    toast.success(resolveText(t?.success, 'File downloaded successfully'), { id: toastId });
  } catch (error) {
    console.error('Failed to export workspace transactions', error);
    toast.error(resolveText(t?.error, 'Download failed'), { id: toastId });
  }
}

function ExportMenuItems({
  t,
  onExport,
}: {
  t: ExportDropdownProps['t'];
  onExport: (fmt: ExportFormat) => void;
}): React.JSX.Element {
  return (
    <>
      {EXPORT_ITEMS.map(item => {
        const Icon = item.icon;
        const label = resolveText(
          t?.[item.labelKey] as Token | undefined,
          ITEM_FALLBACKS[item.key],
        );
        return (
          <MenuItem
            key={item.key}
            data-testid={`dropdown-item-${item.key}`}
            onClick={() => onExport(item.key)}
          >
            <ListItemIcon>
              <Icon size={16} />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        );
      })}
    </>
  );
}

export function ExportDropdown({ t }: ExportDropdownProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleExport = (format: ExportFormat): void => {
    if (isLoading) return;
    setAnchorEl(null);
    setIsLoading(true);
    void runExport(format, t).finally(() => setIsLoading(false));
  };

  const buttonLabel = isLoading
    ? resolveText(t?.downloading, 'Downloading...')
    : resolveText(t?.button, 'Export');

  return (
    <>
      <Tooltip title={buttonLabel}>
        <span>
          <button
            type="button"
            disabled={isLoading}
            aria-label={buttonLabel}
            onClick={event => setAnchorEl(event.currentTarget)}
            className="seneca-dashboard-header__icon-btn"
            style={{ opacity: isLoading ? 0.6 : 1 }}
          >
            <Download size={20} />
          </button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        aria-label={resolveText(t?.title, 'Export data')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <ExportMenuItems t={t} onExport={handleExport} />
      </Menu>
    </>
  );
}
