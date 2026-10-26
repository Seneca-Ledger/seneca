'use client';

import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';

export type CustomTableExportFormat = 'csv' | 'xlsx';

export interface CustomTableExportParams {
  /** Активные фильтры текущего вида (JSON, как в GET /rows). */
  filters?: string;
  /** Активная сортировка текущего вида (JSON, как в GET /rows). */
  sort?: string;
  /** Ключи колонок в порядке отображения; пусто — все колонки таблицы. */
  columnKeys?: string[];
}

const FALLBACK_FILE_NAME = 'table_export';

function parseFileName(headerValue: string | undefined, format: CustomTableExportFormat): string {
  const fallback = `${FALLBACK_FILE_NAME}.${format}`;
  if (!headerValue) {
    return fallback;
  }
  const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ? decodeURIComponent(plainMatch[1]) : fallback;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Выгружает таблицу через бэкенд. Файл собирает сервер: он же применяет
 * фильтры и сортировку, поэтому выгрузка совпадает с тем, что видно в гриде.
 */
export async function downloadTableExport(
  tableId: string,
  format: CustomTableExportFormat,
  params: CustomTableExportParams = {},
): Promise<void> {
  const response = await apiClient.get(`/custom-tables/${tableId}/export`, {
    responseType: 'blob',
    params: {
      format,
      filters: params.filters,
      sort: params.sort,
      columns: params.columnKeys?.length ? params.columnKeys.join(',') : undefined,
    },
  });

  const fileName = parseFileName(response.headers['content-disposition'], format);
  triggerBlobDownload(blobOf(response), fileName);
}
