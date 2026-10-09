import type { CustomTableGridRow, CustomTableRowPatch } from './types';

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

export const getCreatedRowResponse = (value: unknown): CustomTableGridRow | null => {
  const record = getRecord(value);
  if (!record) {
    return null;
  }

  const idCandidate = record.id ?? record.rowId ?? record.row_id;
  const rowNumberCandidate = record.rowNumber ?? record.row_number;
  const id = typeof idCandidate === 'string' ? idCandidate : null;
  const rowNumber = typeof rowNumberCandidate === 'number' ? rowNumberCandidate : null;
  const data = getRecord(record.data) as CustomTableRowPatch | null;
  const styles = getRecord(record.styles) as CustomTableGridRow['styles'] | null;

  return {
    id: id ?? `temp-${Date.now()}`,
    rowNumber: rowNumber ?? 1,
    data: data ?? {},
    ...(styles ? { styles } : {}),
  };
};

export const getResponseItems = (value: unknown): CustomTableGridRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map(item => {
    const styles = getRecord(item.styles) as CustomTableGridRow['styles'] | null;
    return {
      id: typeof item.id === 'string' ? item.id : String(item.rowNumber ?? ''),
      rowNumber: typeof item.rowNumber === 'number' ? item.rowNumber : 0,
      data: (getRecord(item.data) as CustomTableRowPatch | null) ?? {},
      ...(styles ? { styles } : {}),
    };
  });
};

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
