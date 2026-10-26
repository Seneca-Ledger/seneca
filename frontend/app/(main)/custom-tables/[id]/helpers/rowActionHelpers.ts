import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { toGridRow, toRowPatch } from '../utils/tableHelpers';
import type { CustomTableGridRow, CustomTableRowPatch } from '../utils/types';

export function applyRowDataPatch(
  rows: CustomTableGridRow[],
  rowId: string,
  patch: CustomTableRowPatch,
): CustomTableGridRow[] {
  return rows.map(r => (r.id === rowId ? { ...r, data: { ...(r.data || {}), ...patch } } : r));
}

export async function createRowRequest(
  tableId: string,
  rowCount: number,
  data: CustomTableRowPatch,
): Promise<CustomTableGridRow> {
  const response = await apiClient.post(`/custom-tables/${tableId}/rows`, {
    data,
  } satisfies ContractInput<'CreateCustomTableRowBody'>);
  const row = await checkContract('CustomTableRowItem', response.data, '/custom-tables/:id/rows');
  const created = toGridRow(row);
  return { ...created, rowNumber: created.rowNumber || rowCount + 1 };
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
  } satisfies ContractInput<'UpdateCustomTableRowBody'>);
  const row = await checkContract(
    'CustomTableRowItem',
    response.data,
    '/custom-tables/:id/rows/:rowId',
  );
  return toRowPatch(row.data);
}
