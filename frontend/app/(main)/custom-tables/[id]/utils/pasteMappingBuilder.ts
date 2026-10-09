import { matchFieldByName, normalizeToken } from './pasteParser';
import type {
  PasteColumn,
  PasteColumnMapping,
  PasteFieldKey,
  PasteMappingSelection,
} from './pasteTypes';
import { optionValues } from './selectOptions';
import type { ColumnType } from './types';

// ---------------------------------------------------------------------------
// Column inference helpers
// ---------------------------------------------------------------------------

const TYPE_TO_FIELD: Record<string, PasteFieldKey> = {
  date: 'date',
  number: 'amount',
  boolean: 'paid',
};

export const inferFieldFromColumn = (column: PasteColumn): PasteFieldKey | null => {
  const matched = matchFieldByName(`${column.title ?? ''} ${column.key ?? ''}`);
  if (matched) {
    return matched;
  }
  return column.type ? (TYPE_TO_FIELD[column.type] ?? null) : null;
};

const FIELD_TO_COL_TYPE: Record<string, ColumnType> = {
  date: 'date',
  amount: 'number',
  paid: 'boolean',
};

export const inferNewColumnType = (field: PasteFieldKey | null): ColumnType =>
  field ? (FIELD_TO_COL_TYPE[field] ?? 'text') : 'text';

// ---------------------------------------------------------------------------
// Column-name lookup maps builder
// ---------------------------------------------------------------------------

export type ColumnMaps = {
  columnByKey: Map<string, PasteColumn>;
  columnNameMap: Map<string, PasteColumn>;
  columnNameToField: Map<string, PasteFieldKey>;
  fieldToColumn: Map<PasteFieldKey, PasteColumn>;
};

type IndexArgs = {
  token: string;
  col: PasteColumn;
  field: PasteFieldKey | null;
  columnNameMap: Map<string, PasteColumn>;
  columnNameToField: Map<string, PasteFieldKey>;
};

const indexToken = ({ token, col, field, columnNameMap, columnNameToField }: IndexArgs): void => {
  columnNameMap.set(token, col);
  if (field) {
    columnNameToField.set(token, field);
  }
};

export const buildColumnMaps = (orderedColumns: PasteColumn[]): ColumnMaps => {
  const columnByKey = new Map(orderedColumns.map(col => [col.key, col]));
  const columnNameMap = new Map<string, PasteColumn>();
  const columnNameToField = new Map<string, PasteFieldKey>();
  const fieldToColumn = new Map<PasteFieldKey, PasteColumn>();
  for (const col of orderedColumns) {
    const field = inferFieldFromColumn(col);
    if (col.title) {
      indexToken({
        token: normalizeToken(col.title),
        col,
        field,
        columnNameMap,
        columnNameToField,
      });
    }
    if (col.key) {
      indexToken({ token: normalizeToken(col.key), col, field, columnNameMap, columnNameToField });
    }
    if (field && !fieldToColumn.has(field)) {
      fieldToColumn.set(field, col);
    }
  }
  return { columnByKey, columnNameMap, columnNameToField, fieldToColumn };
};

// ---------------------------------------------------------------------------
// Auto-mapping context type
// ---------------------------------------------------------------------------

export type AutoMapContext = {
  useHeaders: boolean;
  columnNameMap: Map<string, PasteColumn>;
  fieldToColumn: Map<PasteFieldKey, PasteColumn>;
  defaults: Record<PasteFieldKey | 'columnPrefix', string>;
  usedExisting: Set<string>;
};

type SourceColumn = { index: number; header: string; sampleValues: string[] };

// ---------------------------------------------------------------------------
// Header-based mapping helpers
// ---------------------------------------------------------------------------

const claimExistingColumn = (
  col: PasteColumn,
  usedExisting: Set<string>,
  field?: PasteFieldKey | null,
): PasteMappingSelection => {
  usedExisting.add(col.key);
  return { mode: 'existing', columnKey: col.key, field: field ?? inferFieldFromColumn(col) };
};

const mapByNameMatch = (
  column: SourceColumn,
  ctx: AutoMapContext,
): PasteMappingSelection | null => {
  const n = normalizeToken(column.header);
  const match = n ? ctx.columnNameMap.get(n) : null;
  if (!match || ctx.usedExisting.has(match.key)) {
    return null;
  }
  return claimExistingColumn(match, ctx.usedExisting);
};

const mapByFieldName = (
  column: SourceColumn,
  ctx: AutoMapContext,
): PasteMappingSelection | null => {
  const field = matchFieldByName(column.header);
  if (!field) {
    return null;
  }
  const col = ctx.fieldToColumn.get(field);
  if (col && !ctx.usedExisting.has(col.key)) {
    return claimExistingColumn(col, ctx.usedExisting, field);
  }
  return {
    mode: 'new',
    field,
    newTitle: column.header || ctx.defaults[field],
    newType: inferNewColumnType(field),
  };
};

export const tryMapByHeaderMatch = (
  column: SourceColumn,
  ctx: AutoMapContext,
): PasteMappingSelection | null => {
  if (!ctx.useHeaders) {
    return null;
  }
  return mapByNameMatch(column, ctx) ?? mapByFieldName(column, ctx);
};

export const tryMapByValueInference = (
  column: SourceColumn,
  inferredField: PasteFieldKey | null,
  ctx: AutoMapContext,
): PasteMappingSelection | null => {
  if (!inferredField) {
    return null;
  }
  const col = ctx.fieldToColumn.get(inferredField);
  if (col && !ctx.usedExisting.has(col.key)) {
    return claimExistingColumn(col, ctx.usedExisting, inferredField);
  }
  return {
    mode: 'new',
    field: inferredField,
    newTitle: column.header || ctx.defaults[inferredField],
    newType: inferNewColumnType(inferredField),
  };
};

// ---------------------------------------------------------------------------
// Mapped columns builder
// ---------------------------------------------------------------------------

const toExistingMapping = (
  sourceColumn: SourceColumn,
  column: PasteColumn,
  field: PasteFieldKey,
): PasteColumnMapping => ({
  sourceIndex: sourceColumn.index,
  field,
  columnKey: column.key,
  label: column.title || column.key,
  options: optionValues(column.config),
  mode: 'existing',
});

const buildExistingColumnMapping = (
  sourceColumn: SourceColumn,
  selection: PasteMappingSelection,
  columnByKey: Map<string, PasteColumn>,
): PasteColumnMapping | null => {
  if (!selection.columnKey) {
    return null;
  }
  const column = columnByKey.get(selection.columnKey);
  if (!column) {
    return null;
  }
  const field = (selection.field ?? inferFieldFromColumn(column) ?? 'comment') as PasteFieldKey;
  return toExistingMapping(sourceColumn, column, field);
};

const resolveNewField = (
  selection: PasteMappingSelection,
  resolvedTitle: string,
): PasteFieldKey => {
  if (selection.field === null) {
    return 'comment';
  }
  return selection.field ?? matchFieldByName(resolvedTitle) ?? 'comment';
};

type BuildNewArgs = {
  sourceColumn: SourceColumn;
  selection: PasteMappingSelection;
  defaults: Record<PasteFieldKey | 'columnPrefix', string>;
};

const buildNewColumnMapping = ({
  sourceColumn,
  selection,
  defaults,
}: BuildNewArgs): PasteColumnMapping => {
  const fallback = sourceColumn.header || `${defaults.columnPrefix} ${sourceColumn.index + 1}`;
  const resolvedTitle = selection.newTitle !== undefined ? selection.newTitle : fallback;
  const label = resolvedTitle?.trim() ? resolvedTitle : fallback;
  const field = resolveNewField(selection, resolvedTitle);
  return {
    sourceIndex: sourceColumn.index,
    field,
    columnKey: `__new__${sourceColumn.index}`,
    label,
    mode: 'new',
    newTitle: resolvedTitle,
    newType: selection.newType ?? inferNewColumnType(field),
    ...(selection.newConfig ? { newConfig: selection.newConfig } : {}),
    ...(selection.formula ? { formula: selection.formula } : {}),
  };
};

type BuildMappedArgs = {
  sourceColumns: SourceColumn[];
  mapping: Record<number, PasteMappingSelection>;
  columnByKey: Map<string, PasteColumn>;
  defaults: Record<PasteFieldKey | 'columnPrefix', string>;
};

export const buildMappedColumns = ({
  sourceColumns,
  mapping,
  columnByKey,
  defaults,
}: BuildMappedArgs): PasteColumnMapping[] => {
  const result: PasteColumnMapping[] = [];
  for (const sourceColumn of sourceColumns) {
    const selection = mapping[sourceColumn.index];
    if (!selection || selection.mode === 'ignore') {
      continue;
    }
    if (selection.mode === 'existing') {
      const mapped = buildExistingColumnMapping(sourceColumn, selection, columnByKey);
      if (mapped) {
        result.push(mapped);
      }
      continue;
    }
    result.push(buildNewColumnMapping({ sourceColumn, selection, defaults }));
  }
  return result;
};
