import type { CustomTableRowItem } from '@/app/lib/contracts';
import type { CustomTableCellValue, CustomTableGridRow, CustomTableRowPatch } from './types';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getRecord = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

export const getNestedRecord = (value: unknown, key: string): Record<string, unknown> | null => {
  const record = getRecord(value);
  return record ? getRecord(record[key]) : null;
};

export const getNestedValue = (value: unknown, path: string[]): unknown => {
  let current: unknown = value;
  for (const segment of path) {
    const record = getRecord(current);
    if (!record) {
      return undefined;
    }
    current = record[segment];
  }
  return current;
};

export const getTranslationValue = (root: unknown, path: string[], fallback = ''): string => {
  const candidate = getNestedValue(root, path);
  if (typeof candidate === 'string') {
    return candidate;
  }
  const record = getRecord(candidate);
  return typeof record?.value === 'string' ? record.value : fallback;
};

/** Shorthand: resolve a string from an Intlayer translation tree */
export const tx = (root: unknown, path: string[], fallback = '') =>
  getTranslationValue(root, path, fallback);

export const isContentEditableTarget = (value: unknown): value is { isContentEditable: boolean } =>
  isRecord(value) && typeof value.isContentEditable === 'boolean';

const isCellValue = (value: unknown): value is CustomTableCellValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  (Array.isArray(value) && value.every(item => typeof item === 'string'));

/** Stored cells, as the grid edits them; anything else the server kept shows as its JSON. */
export const toRowPatch = (data: Readonly<Record<string, unknown>>): CustomTableRowPatch =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      isCellValue(value) ? value : JSON.stringify(value),
    ]),
  );

const toCellStyles = (
  styles: Readonly<Record<string, unknown>>,
): NonNullable<CustomTableGridRow['styles']> => {
  const result: NonNullable<CustomTableGridRow['styles']> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (!isRecord(value)) continue;
    const { importIssue, ...rest } = value;
    result[key] = typeof importIssue === 'boolean' ? { ...rest, importIssue } : rest;
  }
  return result;
};

/** A row as the server sends it, narrowed to what the grid renders. */
export const toGridRow = (row: CustomTableRowItem): CustomTableGridRow => ({
  id: row.id,
  rowNumber: row.rowNumber,
  data: toRowPatch(row.data),
  ...(row.styles ? { styles: toCellStyles(row.styles) } : {}),
  ...(row.relationLabels ? { relationLabels: row.relationLabels } : {}),
});

export const getClassificationResults = (value: unknown): Map<string, boolean | null> => {
  const payload =
    getNestedValue(value, ['data', 'items']) ??
    getNestedValue(value, ['items']) ??
    getNestedValue(value, ['data']) ??
    value;
  const items = Array.isArray(payload) ? payload : [];
  const result = new Map<string, boolean | null>();

  for (const item of items) {
    const record = getRecord(item);
    if (!record) {
      continue;
    }
    const id =
      typeof record.rowId === 'string'
        ? record.rowId
        : typeof record.id === 'string'
          ? record.id
          : null;
    if (!id) {
      continue;
    }
    result.set(id, typeof record.paid === 'boolean' ? record.paid : null);
  }

  return result;
};
