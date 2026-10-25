import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import toast from 'react-hot-toast';
import type { EditableReceiptParsedData } from '@/app/components/receipts/receipt-types';
import type { ReceiptRecord } from '@/app/lib/api';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { buildParsedDataPayload } from '../hooks/useReceiptData';

type ExportColumn = { title: string; type: 'text' | 'number' | 'date' };
type ExportRow = Record<string, string | number | undefined>;
export type ExportData = { columns: ExportColumn[]; rows: ExportRow[] };
export type ExportLabels = Record<
  'item' | 'vendor' | 'date' | 'amount' | 'currency' | 'source' | 'status',
  string
>;
/** Translated texts of the created table and its toasts, from the calling hook. */
export type ExportMessages = Record<'name' | 'description' | 'failed' | 'success', string>;

interface ColumnBuildState {
  columns: ExportColumn[];
  baseRow: ExportRow;
}
interface FieldSpec {
  title: string;
  type: ExportColumn['type'];
  value: string | number | undefined;
}

function addFieldToExport(state: ColumnBuildState, spec: FieldSpec): void {
  const { value } = spec;
  if (value === undefined || value === null || value === '') {
    return;
  }
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (trimmed === '') {
    return;
  }
  state.columns.push({ title: spec.title, type: spec.type });
  state.baseRow[spec.title] = trimmed;
}

interface BaseColumnsArgs {
  parsedData: ReturnType<typeof buildParsedDataPayload>;
  receipt: ReceiptRecord;
  hasLineItems: boolean;
  labels: ExportLabels;
}

function buildBaseColumns({
  parsedData,
  receipt,
  hasLineItems,
  labels,
}: BaseColumnsArgs): ColumnBuildState {
  const state: ColumnBuildState = { columns: [], baseRow: {} };
  const vendor = parsedData.vendor as string | undefined;
  const date = parsedData.date as string | undefined;
  const amount = parsedData.amount as number | undefined;
  const currency = parsedData.currency as string | undefined;

  if (hasLineItems) {
    state.columns.push({ title: labels.item, type: 'text' });
  } else {
    addFieldToExport(state, { title: labels.vendor, type: 'text', value: vendor });
  }
  addFieldToExport(state, { title: labels.date, type: 'date', value: date });
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    addFieldToExport(state, { title: labels.amount, type: 'number', value: amount });
  }
  addFieldToExport(state, { title: labels.currency, type: 'text', value: currency });
  addFieldToExport(state, { title: labels.source, type: 'text', value: receipt.source });
  addFieldToExport(state, { title: labels.status, type: 'text', value: receipt.status });
  return state;
}

export function buildExportData({
  receipt,
  formValue,
  labels,
}: {
  receipt: ReceiptRecord;
  formValue: EditableReceiptParsedData;
  labels: ExportLabels;
}): ExportData {
  const parsedData = buildParsedDataPayload(formValue);
  const lineItems = parsedData.lineItems as Array<{ description: string; amount: number }>;
  const hasLineItems = lineItems.length > 0;
  const { columns, baseRow } = buildBaseColumns({ parsedData, receipt, hasLineItems, labels });
  if (!hasLineItems) {
    return { columns, rows: [baseRow] };
  }
  return {
    columns,
    rows: lineItems.map(item => ({
      [labels.item]: item.description,
      [labels.date]: baseRow[labels.date],
      [labels.amount]: item.amount,
      [labels.currency]: baseRow[labels.currency],
      [labels.source]: baseRow[labels.source],
      [labels.status]: baseRow[labels.status],
    })),
  };
}

function buildColumnKeyMap(
  columns: ExportColumn[],
  createdColumns: Array<{ data?: unknown }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < columns.length; i++) {
    const payload = (createdColumns[i] as Record<string, unknown>)?.data;
    const dataPayload = (payload as Record<string, unknown>)?.data || payload;
    const key = (dataPayload as Record<string, unknown>)?.key as string | undefined;
    if (key) {
      result[columns[i].title] = key;
    }
  }
  return result;
}

function buildRowData(
  row: ExportRow,
  columnKeyByTitle: Record<string, string>,
): Record<string, string | number> {
  const data: Record<string, string | number> = {};
  for (const [title, value] of Object.entries(row)) {
    const key = columnKeyByTitle[title];
    if (key && value !== undefined && value !== '') {
      data[key] = value as string | number;
    }
  }
  return data;
}

export async function createExportTable({
  receipt,
  exportData,
  router,
  messages,
}: {
  receipt: ReceiptRecord;
  exportData: ExportData;
  router: AppRouterInstance;
  messages: ExportMessages;
}): Promise<void> {
  const createRes = await apiClient.post('/custom-tables', {
    name: messages.name.slice(0, 120),
    description: messages.description,
  } satisfies ContractInput<'CreateCustomTableBody'>);
  const createdTable = await checkContract('CreatedCustomTable', createRes.data, '/custom-tables');
  const tableId = createdTable.id;
  if (!tableId) {
    toast.error(messages.failed);
    router.push('/custom-tables');
    return;
  }
  const createdColumns = await Promise.all(
    exportData.columns.map(col =>
      apiClient.post(`/custom-tables/${tableId}/columns`, {
        title: col.title,
        type: col.type,
      } satisfies ContractInput<'CreateCustomTableColumnBody'>),
    ),
  );
  await Promise.all(
    createdColumns.map(response =>
      checkContract('CustomTableColumnItem', response.data, '/custom-tables/:id/columns'),
    ),
  );
  const columnKeyByTitle = buildColumnKeyMap(exportData.columns, createdColumns);
  const rows = exportData.rows.map(row => ({ data: buildRowData(row, columnKeyByTitle) }));
  await apiClient.post(`/custom-tables/${tableId}/rows/batch`, {
    rows,
  } satisfies ContractInput<'BatchCreateCustomTableRowsBody'>);
  toast.success(messages.success);
  router.push(`/custom-tables/${tableId}`);
}
