import {
  DEFAULT_STATEMENT_FILTERS,
  resetSingleStatementFilter,
  type StatementFilters,
} from '../filters/statement-filters';

export type StatementColumnId =
  | 'receipt'
  | 'merchant'
  | 'from'
  | 'to'
  | 'category'
  | 'tag'
  | 'amount'
  | 'action'
  | 'approved'
  | 'billable'
  | 'card'
  | 'description'
  | 'exchangeRate'
  | 'exported';

export type StatementColumn = {
  id: StatementColumnId;
  label: string;
  visible: boolean;
  order: number;
};

export const STATEMENT_COLUMNS_STORAGE_KEY = 'seneca-statement-columns-v2';
// Saved before Tag was shown by default: every save holds the whole set, so a
// hidden Tag there is the old default, not a choice. Read once, Tag turned on.
const LEGACY_STATEMENT_COLUMNS_STORAGE_KEY = 'seneca-statement-columns';

export const DEFAULT_STATEMENT_COLUMNS: StatementColumn[] = [
  { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
  // No separate date column: the merchant cell already prints the date under
  // the name, and the merchant header carries the date sort.
  { id: 'merchant', label: 'Merchant', visible: true, order: 1 },
  { id: 'from', label: 'From', visible: true, order: 2 },
  { id: 'to', label: 'To', visible: false, order: 3 },
  { id: 'category', label: 'Category', visible: true, order: 4 },
  { id: 'tag', label: 'Tag', visible: true, order: 5 },
  { id: 'amount', label: 'Amount', visible: true, order: 6 },
  { id: 'action', label: 'Action', visible: true, order: 7 },
  { id: 'approved', label: 'Approved', visible: false, order: 8 },
  { id: 'billable', label: 'Billable', visible: false, order: 9 },
  { id: 'card', label: 'Card', visible: false, order: 10 },
  { id: 'description', label: 'Description', visible: false, order: 11 },
  { id: 'exchangeRate', label: 'Exchange rate', visible: false, order: 12 },
  { id: 'exported', label: 'Exported', visible: false, order: 13 },
];

export const COLUMN_FILTER_MAP: Partial<Record<StatementColumnId, Array<keyof StatementFilters>>> =
  {
    receipt: ['type', 'statuses'],
    merchant: ['keywords'],
    from: [],
    to: [],
    category: [],
    tag: [],
    amount: ['amountMin', 'amountMax'],
    action: [],
    approved: ['approved'],
    billable: ['billable'],
    card: [],
    description: ['keywords'],
    exchangeRate: [],
    exported: ['exported'],
  };

const ALWAYS_AVAILABLE_FILTER_KEYS: Array<keyof StatementFilters> = [
  'type',
  'date',
  'statuses',
  'groupBy',
  'has',
  'keywords',
  'limit',
  'paid',
  'exported',
];

const sortColumns = (columns: StatementColumn[]) => [...columns].sort((a, b) => a.order - b.order);

export const loadStatementColumns = (): StatementColumn[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATEMENT_COLUMNS;
  }
  const current = localStorage.getItem(STATEMENT_COLUMNS_STORAGE_KEY);
  const raw = current ?? localStorage.getItem(LEGACY_STATEMENT_COLUMNS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STATEMENT_COLUMNS;
  }
  try {
    const parsed = JSON.parse(raw) as Array<Partial<StatementColumn>>;
    const merged = DEFAULT_STATEMENT_COLUMNS.map(column => {
      const override = parsed.find(item => item.id === column.id);
      const legacyTag = current === null && column.id === 'tag';
      return {
        ...column,
        visible: legacyTag ? true : (override?.visible ?? column.visible),
        order: typeof override?.order === 'number' ? override.order : column.order,
      };
    });
    return sortColumns(merged);
  } catch {
    return DEFAULT_STATEMENT_COLUMNS;
  }
};

export const saveStatementColumns = (columns: StatementColumn[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(STATEMENT_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
};

export const reorderStatementColumns = (
  columns: StatementColumn[],
  activeId: StatementColumnId,
  overId: StatementColumnId,
) => {
  if (activeId === overId) {
    return columns;
  }
  const activeIndex = columns.findIndex(column => column.id === activeId);
  const overIndex = columns.findIndex(column => column.id === overId);
  if (activeIndex === -1 || overIndex === -1) {
    return columns;
  }

  const next = [...columns];
  const [moved] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, moved);
  return next.map((column, index) => ({ ...column, order: index }));
};

export const getAllowedStatementFilterKeys = (visibleColumnIds: StatementColumnId[]) => {
  const allowed = new Set<keyof StatementFilters>(ALWAYS_AVAILABLE_FILTER_KEYS);

  visibleColumnIds.forEach(columnId => {
    COLUMN_FILTER_MAP[columnId]?.forEach(filterKey => {
      allowed.add(filterKey);
    });
  });

  return Array.from(allowed).sort();
};

export const resetDisallowedStatementFilters = (
  filters: StatementFilters,
  allowedKeys: Array<keyof StatementFilters>,
) => {
  const allowed = new Set<keyof StatementFilters>(allowedKeys);
  let next = { ...filters };

  (Object.keys(DEFAULT_STATEMENT_FILTERS) as Array<keyof StatementFilters>).forEach(key => {
    if (!allowed.has(key)) {
      next = resetSingleStatementFilter(next, key);
    }
  });

  return next;
};

// Widths shared by the list header and its rows. Only the receipt icon and the
// amount keep a fixed width; the action is as wide as its Review label in the
// current language (every action cell carries an invisible copy of it, so the
// header and the rows agree); the rest split what is left by weight and
// truncate, so any set of columns fits the screen without a sideways scroll.
const FIXED_COLUMN_WIDTHS: Partial<Record<StatementColumnId, number>> = {
  receipt: 40,
  amount: 140,
};

const ACTION_COLUMN_MIN_WIDTH = 80;

const FLEX_COLUMN_WEIGHTS: Partial<Record<StatementColumnId, number>> = {
  merchant: 3,
  description: 2,
  approved: 0.6,
  billable: 0.6,
  exported: 0.6,
};

export const statementColumnWidthStyle = (
  columnId: StatementColumnId,
): { flex: string; width?: number; minWidth: number } => {
  const fixed = FIXED_COLUMN_WIDTHS[columnId];
  if (fixed) {
    return { flex: `0 0 ${fixed}px`, width: fixed, minWidth: fixed };
  }
  if (columnId === 'action') {
    return { flex: '0 0 auto', minWidth: ACTION_COLUMN_MIN_WIDTH };
  }
  return {
    flex: `${FLEX_COLUMN_WEIGHTS[columnId] ?? 1} 1 0`,
    minWidth: columnId === 'merchant' ? 120 : 0,
  };
};
