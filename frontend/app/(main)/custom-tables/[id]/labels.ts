import type { useIntlayer } from '@/app/i18n';
import type { ColumnDialogLabels } from './components/ColumnDialog';
import type { CellLabels } from './components/cells/EditableCell';
import type { FilterBarLabels } from './components/FilterBar';
import type { ImportPreviewLabels } from './components/ImportPreviewDialog';
import type { SendToStatementsLabels } from './components/SendToStatementsDialog';
import type { SummariesLabels } from './components/SummariesBar';
import type { TableGridLabels } from './components/TableGrid';
import type { TablePageHeaderLabels } from './components/TablePageHeader';
import type { TableToolbarLabels } from './components/TableToolbar';
import type { AggregateFn, ColumnType, RowFilterOp } from './utils/types';

type Dictionary = ReturnType<typeof useIntlayer<'customTableDetailPage'>>;

const record = <K extends string>(node: Record<K, { value: string }>, keys: readonly K[]) =>
  Object.fromEntries(keys.map(key => [key, node[key].value])) as Record<K, string>;

const OPERATORS: RowFilterOp[] = [
  'eq',
  'neq',
  'contains',
  'startsWith',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
  'isEmpty',
  'isNotEmpty',
  'search',
];
const AGGREGATES: AggregateFn[] = ['sum', 'avg', 'min', 'max', 'count'];
const COLUMN_TYPES: ColumnType[] = [
  'text',
  'number',
  'currency',
  'date',
  'boolean',
  'select',
  'multi_select',
  'formula',
  'relation',
  'ai',
];

export interface DetailLabels {
  header: TablePageHeaderLabels;
  toolbar: TableToolbarLabels;
  filters: FilterBarLabels;
  grid: TableGridLabels;
  cells: CellLabels;
  groups: { title: string; empty: string; rows: string; loading: string };
  columnDialog: ColumnDialogLabels;
  deleteColumn: { title: string; message: string; confirm: string; cancel: string };
  deleteRows: { title: string; message: string; confirm: string; cancel: string };
  import: ImportPreviewLabels & {
    noRows: string;
    missingColumnTitle: string;
    insertFailed: string;
    undoFailed: string;
    fileReadFailed: string;
    fileUnsupported: string;
    fileTooLarge: string;
    fileEmpty: string;
    inserted: string;
    insertedWithIssues: string;
    undo: string;
    defaults: Record<
      'date' | 'type' | 'amount' | 'currency' | 'comment' | 'paid' | 'columnPrefix',
      string
    >;
  };
  convert: SendToStatementsLabels & { failed: string };
  summaries: SummariesLabels;
  toasts: Record<
    | 'loadTableFailed'
    | 'loadRowsFailed'
    | 'addRowLoading'
    | 'addRowSuccess'
    | 'addRowFailed'
    | 'columnSaved'
    | 'columnSaveFailed'
    | 'columnDeleted'
    | 'columnDeleteFailed'
    | 'rowsDeleted'
    | 'rowsDeleteFailed'
    | 'renamed'
    | 'renameFailed'
    | 'exportFailed'
    | 'refreshed'
    | 'refreshFailed',
    string
  >;
  notFound: { title: string; back: string };
}

/** Plain strings for the components: they never see intlayer nodes. */
export function buildDetailLabels(t: Dictionary): DetailLabels {
  const cells = {
    yes: t.grid.yes.value,
    no: t.grid.no.value,
    clear: t.grid.clear.value,
    edit: t.grid.edit.value,
  };
  return {
    header: {
      back: t.header.back.value,
      rename: t.header.rename.value,
      rows: t.header.rows.value,
      untitled: t.header.untitled.value,
      sources: record(t.header.sources, ['manual']),
      sourceKinds: record(t.header.sourceKinds, [
        'transactions',
        'subscriptions',
        'payables',
        'invoices',
        'budgets',
      ]),
      syncedAt: t.header.syncedAt.value,
    },
    toolbar: record(t.toolbar, [
      'search',
      'addRow',
      'addColumn',
      'columns',
      'showAllColumns',
      'groupBy',
      'groupNone',
      'importFile',
      'export',
      'exportXlsx',
      'exportCsv',
      'sendToStatements',
      'refreshSource',
      'deleteSelected',
    ]),
    filters: {
      ...record(t.filters, [
        'filter',
        'column',
        'operator',
        'value',
        'from',
        'to',
        'apply',
        'clearAll',
        'removeFilter',
      ]),
      yes: cells.yes,
      no: cells.no,
      operators: record(t.filters.operators, OPERATORS),
    },
    grid: {
      ...cells,
      ...record(t.grid, [
        'caption',
        'selectAll',
        'selectRow',
        'rowNumber',
        'addRow',
        'emptyTitle',
        'emptySubtitle',
        'noTotal',
        'columnMenu',
        'editColumn',
        'deleteColumn',
      ]),
      aggregates: record(t.grid.aggregates, AGGREGATES),
    },
    cells,
    groups: record(t.groups, ['title', 'empty', 'rows', 'loading']),
    columnDialog: {
      ...record(t.columnDialog, [
        'addTitle',
        'editTitle',
        'name',
        'namePlaceholder',
        'type',
        'currency',
        'precision',
        'format',
        'formatPlain',
        'formatPercent',
        'expression',
        'expressionHint',
        'formulaPreview',
        'formulaNoRows',
        'formulaChecking',
        'options',
        'optionPlaceholder',
        'addOption',
        'removeOption',
        'relationTarget',
        'prompt',
        'required',
        'unique',
        'save',
        'cancel',
      ]),
      types: record(t.columnDialog.types, COLUMN_TYPES),
    },
    deleteColumn: record(t.deleteColumn, ['title', 'message', 'confirm', 'cancel']),
    deleteRows: record(t.deleteRows, ['title', 'message', 'confirm', 'cancel']),
    import: {
      ...record(t.import, [
        'title',
        'useHeaders',
        'ignore',
        'newColumn',
        'newColumnTitle',
        'newColumnType',
        'sheet',
        'rowsSummary',
        'extraRows',
        'errors',
        'issuesKept',
        'requiredUnmapped',
        'requiredBlank',
        'totalsExcluded',
        'applyTotals',
        'optionsCount',
        'formulasSummary',
        'formulaCarried',
        'formulaSkipped',
        'progress',
        'add',
        'cancel',
        'source',
        'target',
        'noRows',
        'missingColumnTitle',
        'insertFailed',
        'undoFailed',
        'fileReadFailed',
        'fileUnsupported',
        'fileTooLarge',
        'fileEmpty',
        'inserted',
        'insertedWithIssues',
        'undo',
      ]),
      defaults: record(t.import.defaults, [
        'date',
        'type',
        'amount',
        'currency',
        'comment',
        'paid',
        'columnPrefix',
      ]),
    },
    summaries: {
      ...record(t.summaries, [
        'title',
        'add',
        'edit',
        'remove',
        'empty',
        'name',
        'namePlaceholder',
        'save',
        'cancel',
        'loadFailed',
        'saveFailed',
      ]),
      expression: t.columnDialog.expression.value,
      expressionHint: t.summaries.expressionHint.value,
      formulaPreview: t.summaries.formulaPreview.value,
      formulaNoRows: t.columnDialog.formulaNoRows.value,
      formulaChecking: t.columnDialog.formulaChecking.value,
    },
    convert: record(t.convert, [
      'title',
      'message',
      'requirements',
      'confirm',
      'cancel',
      'successTitle',
      'imported',
      'skipped',
      'openStatement',
      'openDashboard',
      'close',
      'failed',
    ]),
    toasts: record(t.toasts, [
      'loadTableFailed',
      'loadRowsFailed',
      'addRowLoading',
      'addRowSuccess',
      'addRowFailed',
      'columnSaved',
      'columnSaveFailed',
      'columnDeleted',
      'columnDeleteFailed',
      'rowsDeleted',
      'rowsDeleteFailed',
      'renamed',
      'renameFailed',
      'exportFailed',
      'refreshed',
      'refreshFailed',
    ]),
    notFound: record(t.notFound, ['title', 'back']),
  };
}
