/**
 * App data a table can be filled from. Column fields and filters mirror the
 * backend adapters (`custom-tables/sources/*.source.ts`); titles are looked up
 * in the dictionary by field name, with these English strings as fallback.
 */
export type SourceKind = 'transactions' | 'subscriptions' | 'payables' | 'invoices' | 'budgets';

export type SourceFilterField =
  | 'dateRange'
  | 'categories'
  | 'type'
  | 'currency'
  | 'statements'
  | 'status'
  | 'direction'
  | 'dueRange';

export interface SourceDef {
  id: SourceKind;
  name: string;
  description: string;
  filterFields: SourceFilterField[];
  columnFields: string[];
  /** Option values of the status filter, when the source has one. */
  statusOptions?: string[];
}

export interface SourceFilters {
  dateFrom: string;
  dateTo: string;
  categoryIds: string[];
  type: string;
  currency: string;
  statementIds: string[];
  status: string;
  direction: string;
  dueDateFrom: string;
  dueDateTo: string;
  /** Exact records to fill from; set when a fresh import is opened as a table. */
  ids: string[];
}

export const EMPTY_SOURCE_FILTERS: SourceFilters = {
  dateFrom: '',
  dateTo: '',
  categoryIds: [],
  type: '',
  currency: '',
  statementIds: [],
  status: '',
  direction: '',
  dueDateFrom: '',
  dueDateTo: '',
  ids: [],
};

export const TYPE_OPTIONS = ['income', 'expense'] as const;
export const DIRECTION_OPTIONS = ['payable', 'receivable'] as const;

export const SOURCE_KINDS: SourceDef[] = [
  {
    id: 'transactions',
    name: 'Transactions',
    description: 'Bank transactions filtered by period, category, type or statement.',
    filterFields: ['dateRange', 'categories', 'type', 'currency', 'statements'],
    columnFields: [
      'date',
      'counterparty',
      'purpose',
      'amount',
      'type',
      'category',
      'currency',
      'statement',
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Recurring charges with frequency, status and next charge date.',
    filterFields: ['status'],
    columnFields: [
      'vendor',
      'amount',
      'currency',
      'frequency',
      'status',
      'nextChargeDate',
      'lastChargeDate',
      'category',
    ],
    statusOptions: ['detected', 'active', 'paused', 'cancelled'],
  },
  {
    id: 'payables',
    name: 'Payables',
    description: 'Bills to pay and receive, with due dates and payment status.',
    filterFields: ['direction', 'status', 'dueRange'],
    columnFields: [
      'direction',
      'vendor',
      'amount',
      'currency',
      'dueDate',
      'status',
      'source',
      'isRecurring',
      'paidAt',
      'comment',
    ],
    statusOptions: ['to_pay', 'scheduled', 'paid', 'overdue', 'archived'],
  },
  {
    id: 'invoices',
    name: 'Invoices',
    description: 'Issued invoices with client, dates, totals and status.',
    filterFields: ['status'],
    columnFields: [
      'invoiceNumber',
      'client',
      'status',
      'issueDate',
      'dueDate',
      'subtotal',
      'taxTotal',
      'total',
      'currency',
      'notes',
    ],
    statusOptions: ['draft', 'sent', 'paid', 'overdue', 'void'],
  },
  {
    id: 'budgets',
    name: 'Budgets',
    description: 'Every budget with its limit, spent amount and remaining balance.',
    filterFields: [],
    columnFields: [
      'name',
      'category',
      'limit',
      'spent',
      'remaining',
      'percentUsed',
      'periodType',
      'periodStart',
      'currency',
    ],
  },
];

export const findSource = (id: SourceKind | null): SourceDef | null =>
  SOURCE_KINDS.find(source => source.id === id) ?? null;

/**
 * Empty strings and empty arrays are dropped, so the preview request and the
 * stored binding describe the same query.
 */
export function normalizeSourceFilters(filters: SourceFilters): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    normalized[key] = key === 'currency' ? String(value).toUpperCase() : value;
  }
  return normalized;
}

export interface SourceCreatePayload {
  kind: SourceKind;
  filters: Record<string, unknown>;
  name: string;
  description?: string;
  categoryId?: string;
  currency?: string;
  columnTitles: Record<string, string>;
}

/**
 * Body of `POST /custom-tables/from-source`: only titles of this source's
 * fields go along. Sources that carry their own currency column get the money
 * columns priced in the records' currency (the server takes the first row's),
 * not the workspace's — a KZT statement must not show up in dollars.
 */
export function buildSourcePayload(params: {
  source: SourceDef;
  filters: SourceFilters;
  name: string;
  description: string;
  categoryId: string;
  currency: string;
  titles: Record<string, string>;
}): SourceCreatePayload {
  const columnTitles: Record<string, string> = {};
  for (const field of params.source.columnFields) {
    const title = params.titles[field];
    if (title) {
      columnTitles[field] = title;
    }
  }
  return {
    kind: params.source.id,
    filters: normalizeSourceFilters(params.filters),
    name: params.name.trim(),
    description: params.description.trim() || undefined,
    categoryId: params.categoryId || undefined,
    currency: params.source.columnFields.includes('currency') ? undefined : params.currency,
    columnTitles,
  };
}
