import apiClient from '@/app/lib/api';
import { getCreatedRowResponse } from '../utils/tableHelpers';
import type { CustomTableGridRow, CustomTableRowPatch } from '../utils/types';
import { isDraftRowId } from './draftRowHelpers';

export function applyRowDataPatch(
  rows: CustomTableGridRow[],
  rowId: string,
  patch: CustomTableRowPatch,
): CustomTableGridRow[] {
  return rows.map(r => (r.id === rowId ? { ...r, data: { ...(r.data || {}), ...patch } } : r));
}

function extractPayload(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }
  const d = data as Record<string, unknown>;
  // A row itself has a `data` field with cell values, so the envelope is only
  // unwrapped when the outer object is not a row; otherwise the cells would be
  // parsed instead of the row and the id would be replaced by a draft one.
  if (typeof d.id === 'string' || typeof d.rowNumber === 'number') {
    return data;
  }
  return d.data ?? d.item ?? data;
}

export function parseCreateRowResponse(data: unknown, rowCount: number): CustomTableGridRow | null {
  const payload = extractPayload(data);
  const raw = Array.isArray(payload) ? payload[0] : payload;
  const created = getCreatedRowResponse(raw);
  if (!created || isDraftRowId(created.id)) {
    return null;
  }
  created.rowNumber = created.rowNumber || rowCount + 1;
  return created;
}

/** Row data from a PATCH/POST reply, with server-computed formula values. */
export function extractRowData(data: unknown): CustomTableRowPatch {
  const payload = extractPayload(data);
  const raw = (Array.isArray(payload) ? payload[0] : payload) as { data?: unknown } | null;
  return raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
    ? (raw.data as CustomTableRowPatch)
    : {};
}

export async function createRowRequest(
  tableId: string,
  rowCount: number,
  data: CustomTableRowPatch,
): Promise<CustomTableGridRow> {
  const response = await apiClient.post(`/custom-tables/${tableId}/rows`, { data });
  const created = parseCreateRowResponse(response.data, rowCount);
  if (!created) {
    throw new Error('Invalid create row response');
  }
  return created;
}

export async function updateRowPatchRequest(
  tableId: string,
  rowId: string,
  patchData: CustomTableRowPatch,
  styles?: Record<string, Record<string, unknown>>,
): Promise<CustomTableRowPatch> {
  const response = await apiClient.patch(`/custom-tables/${tableId}/rows/${rowId}`, {
    data: patchData,
    ...(styles ? { styles } : {}),
  });
  return extractRowData(response.data);
}
