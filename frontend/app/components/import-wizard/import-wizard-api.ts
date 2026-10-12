import { api } from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type ImportTarget =
  | 'transactions'
  | 'payables'
  | 'subscriptions'
  | 'invoices'
  | 'budgets'
  | 'metals';

export const IMPORT_TARGETS: ImportTarget[] = [
  'transactions',
  'payables',
  'subscriptions',
  'invoices',
  'budgets',
  'metals',
];

/** Mirror of the backend target fields: which roles a column can play and which are required. */
export const TARGET_FIELDS: Record<ImportTarget, Array<{ key: string; required: boolean }>> = {
  transactions: [
    { key: 'date', required: true },
    { key: 'amount', required: true },
    { key: 'merchant', required: true },
    { key: 'purpose', required: false },
    { key: 'currency', required: false },
    { key: 'category', required: false },
    { key: 'type', required: false },
  ],
  payables: [
    { key: 'vendor', required: true },
    { key: 'amount', required: true },
    { key: 'currency', required: false },
    { key: 'dueDate', required: false },
    { key: 'status', required: false },
    { key: 'direction', required: false },
    { key: 'comment', required: false },
    { key: 'isRecurring', required: false },
  ],
  subscriptions: [
    { key: 'vendorName', required: true },
    { key: 'amount', required: true },
    { key: 'frequency', required: false },
    { key: 'currency', required: false },
    { key: 'nextChargeDate', required: false },
    { key: 'category', required: false },
  ],
  invoices: [
    { key: 'client', required: true },
    { key: 'invoiceNumber', required: false },
    { key: 'issueDate', required: true },
    { key: 'dueDate', required: false },
    { key: 'amount', required: true },
    { key: 'currency', required: false },
    { key: 'notes', required: false },
  ],
  budgets: [
    { key: 'category', required: true },
    { key: 'limit', required: true },
    { key: 'periodType', required: false },
    { key: 'name', required: false },
    { key: 'currency', required: false },
  ],
  metals: [
    { key: 'metal', required: true },
    { key: 'unitWeight', required: true },
    { key: 'quantity', required: false },
    { key: 'weightUnit', required: false },
    { key: 'purity', required: false },
    { key: 'cost', required: false },
    { key: 'currency', required: false },
    { key: 'acquiredOn', required: false },
    { key: 'counterparty', required: false },
    { key: 'name', required: false },
  ],
};

export interface ImportSuggestion {
  target: ImportTarget | 'table';
  confidence: number;
  columns: Array<{ index: number; role: string | null }>;
  alternatives: Array<{ target: ImportTarget; confidence: number }>;
  source: 'heuristic' | 'ai';
}

export type ImportRowStatus = 'created' | 'updated' | 'skipped' | 'error';

export interface ImportRowResult {
  index: number;
  status: ImportRowStatus;
  reason?: string;
  id?: string;
}

export interface ImportCounts {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface ImportRunResult {
  batchId: string | null;
  target: ImportTarget;
  dryRun: boolean;
  counts: ImportCounts;
  rows: ImportRowResult[];
  createdIds: string[];
}

export interface ImportRunPayload {
  target: ImportTarget;
  mapping: Record<string, number>;
  rows: string[][];
  fileName?: string;
  dryRun?: boolean;
  options?: { currency?: string; categorize?: boolean };
}

export const suggestImport = async (
  headers: string[],
  samples: string[][],
): Promise<ImportSuggestion> => {
  const response = await api.post('/entity-imports/suggest', {
    headers,
    samples,
  } satisfies ContractInput<'SuggestImportBody'>);
  return checkContract('ImportSuggestion', response.data, '/entity-imports/suggest');
};

export const runEntityImport = async (payload: ImportRunPayload): Promise<ImportRunResult> => {
  const response = await api.post(
    '/entity-imports',
    payload satisfies ContractInput<'RunEntityImportBody'>,
  );
  return checkContract('EntityImportResult', response.data, '/entity-imports');
};

export const undoEntityImport = async (batchId: string): Promise<void> => {
  await api.delete(`/entity-imports/${batchId}`);
};

/** Import targets a custom table can be built from; metals have no table source. */
export type TableSourceTarget = ContractInput<'CreateCustomTableFromSourceBody'>['kind'];

const TABLE_SOURCE_TARGETS: readonly TableSourceTarget[] = [
  'transactions',
  'payables',
  'subscriptions',
  'invoices',
  'budgets',
];

export const isTableSourceTarget = (target: ImportTarget): target is TableSourceTarget =>
  TABLE_SOURCE_TARGETS.some(source => source === target);

export const createTableFromImport = async (payload: {
  kind: TableSourceTarget;
  filters: Record<string, unknown>;
  name: string;
  currency: string;
  columnTitles: Record<string, string>;
}): Promise<string | null> => {
  const response = await api.post(
    '/custom-tables/from-source',
    payload satisfies ContractInput<'CreateCustomTableFromSourceBody'>,
  );
  return (await checkContract('CreatedFromSource', response.data, '/custom-tables/from-source'))
    .tableId;
};
