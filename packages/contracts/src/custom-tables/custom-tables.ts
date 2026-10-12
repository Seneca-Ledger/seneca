import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { Timestamp, type Wire } from '../common/wire';

export const CustomTableColumnType = Schema.Literals([
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multi_select',
  'currency',
  'formula',
  'relation',
  'ai',
]);
export type CustomTableColumnType = Wire<typeof CustomTableColumnType>;

/** A column; `config` is per type (options, currency, expression, target table, prompt). */
export const CustomTableColumnItem = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  title: Schema.String,
  type: CustomTableColumnType,
  position: Schema.Number,
  isRequired: Schema.Boolean,
  isUnique: Schema.Boolean,
  config: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
});
export type CustomTableColumnItem = Wire<typeof CustomTableColumnItem>;

const TableCategory = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
});

/** A table without its columns, as the list shows it. */
export const CustomTableItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  source: Schema.Literal('manual'),
  categoryId: Schema.NullOr(Schema.String),
  category: Schema.NullOr(TableCategory),
  /** The page's own layout state (widths, aggregates, saved views). */
  viewSettings: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  /** Set when the table was filled from app data and can be refreshed. */
  sourceBinding: Schema.NullOr(
    Schema.Struct({
      kind: Schema.String,
      filters: Schema.Record(Schema.String, Schema.Unknown),
      syncedAt: Schema.NullOr(Schema.String),
    }),
  ),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type CustomTableItem = Wire<typeof CustomTableItem>;

/** `POST /custom-tables`: the new table, its category not loaded. */
export const CreatedCustomTable = CustomTableItem.mapFields(Struct.omit(['category']));
export type CreatedCustomTable = Wire<typeof CreatedCustomTable>;

/** `GET /custom-tables`. */
export const CustomTableList = Schema.Struct({ items: Schema.Array(CustomTableItem) });
export type CustomTableList = Wire<typeof CustomTableList>;

/** `GET /custom-tables/:id`: the table with its columns, in position order. */
export const CustomTableDetail = Schema.Struct({
  ...CustomTableItem.fields,
  columns: Schema.Array(CustomTableColumnItem),
});
export type CustomTableDetail = Wire<typeof CustomTableDetail>;

/** A row; cell values are keyed by column key and typed by the column. */
export const CustomTableRowItem = Schema.Struct({
  id: Schema.String,
  rowNumber: Schema.Number,
  data: Schema.Record(Schema.String, Schema.Unknown),
  styles: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
  /** Labels of linked rows, resolved by the server for relation columns. */
  relationLabels: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  sourceKey: Schema.NullOr(Schema.String),
});
export type CustomTableRowItem = Wire<typeof CustomTableRowItem>;

/** `GET /custom-tables/:id/rows`. */
export const CustomTableRowPage = Schema.Struct({
  items: Schema.Array(CustomTableRowItem),
  meta: Schema.Struct({ total: Schema.Number }),
});
export type CustomTableRowPage = Wire<typeof CustomTableRowPage>;

export const CustomTableAggregate = Schema.Struct({
  col: Schema.String,
  fn: Schema.Literals(['sum', 'avg', 'min', 'max', 'count']),
  /** Sums of decimal cells come back as strings, counts as numbers. */
  value: Schema.NullOr(Schema.Union([Schema.String, Schema.Number])),
});
export type CustomTableAggregate = Wire<typeof CustomTableAggregate>;

/** `GET /custom-tables/:id/aggregates`. */
export const CustomTableAggregates = Schema.Struct({
  items: Schema.Array(CustomTableAggregate),
  meta: Schema.Struct({ total: Schema.Number }),
});
export type CustomTableAggregates = Wire<typeof CustomTableAggregates>;

/** `GET /custom-tables/:id/groups`. */
export const CustomTableGroups = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      key: Schema.NullOr(Schema.String),
      count: Schema.Number,
      aggregates: Schema.Array(CustomTableAggregate),
    }),
  ),
  meta: Schema.Struct({ groupCount: Schema.Number }),
});
export type CustomTableGroups = Wire<typeof CustomTableGroups>;

/** `GET /custom-tables/:id/summaries`: the table's formula cards, evaluated. */
export const CustomTableSummaries = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      expression: Schema.String,
      resultType: Schema.Literals(['number', 'boolean', 'text', 'date']),
      value: Schema.NullOr(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
      error: Schema.NullOr(Schema.String),
    }),
  ),
});
export type CustomTableSummaries = Wire<typeof CustomTableSummaries>;

/** `GET /public/custom-tables/:token`: public, so only names and columns. */
export const SharedTableView = Schema.Struct({
  table: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    description: Schema.NullOr(Schema.String),
  }),
  columns: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      title: Schema.String,
      type: Schema.String,
      position: Schema.Number,
    }),
  ),
});
export type SharedTableView = Wire<typeof SharedTableView>;

/** `GET /public/custom-tables/:token/rows`. */
export const SharedTableRows = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      rowNumber: Schema.Number,
      data: Schema.Record(Schema.String, Schema.Unknown),
    }),
  ),
  meta: Schema.Struct({ total: Schema.Number }),
});
export type SharedTableRows = Wire<typeof SharedTableRows>;

/** `GET /reports/custom-tables/available`: tables a report can be built from. */
export const AvailableCustomTables = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    source: Schema.Literal('manual'),
    rowCount: Schema.Number,
  }),
);
export type AvailableCustomTables = Wire<typeof AvailableCustomTables>;

const CellValue = Schema.NullOr(Schema.Union([Schema.String, Schema.Number, Schema.Boolean]));

/** `POST /custom-tables/source-preview`: how many rows a source gives, and a sample. */
export const SourcePreview = Schema.Struct({
  count: Schema.Number,
  columns: Schema.Array(
    Schema.Struct({ field: Schema.String, title: Schema.String, type: CustomTableColumnType }),
  ),
  rows: Schema.Array(Schema.Record(Schema.String, CellValue)),
});
export type SourcePreview = Wire<typeof SourcePreview>;

/** `POST /custom-tables/:id/formula-preview`: whether a formula parses, and its value on a row. */
export const FormulaPreview = Schema.Struct({
  valid: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
  expression: Schema.String,
  resultType: Schema.NullOr(Schema.Literals(['number', 'boolean', 'text', 'date'])),
  sample: CellValue,
});
export type FormulaPreview = Wire<typeof FormulaPreview>;

/** `POST /custom-tables/from-source`. */
export const CreatedFromSource = Schema.Struct({
  tableId: Schema.String,
  columnsCreated: Schema.Number,
  rowsCreated: Schema.Number,
});
export type CreatedFromSource = Wire<typeof CreatedFromSource>;

/** `POST /custom-tables/:id/refresh-from-source`. */
export const RefreshedFromSource = Schema.Struct({
  tableId: Schema.String,
  inserted: Schema.Number,
  updated: Schema.Number,
  unchanged: Schema.Number,
  total: Schema.Number,
  syncedAt: Schema.String,
});
export type RefreshedFromSource = Wire<typeof RefreshedFromSource>;

/** `POST /custom-tables/:id/convert-to-statement`. */
export const ConvertedToStatement = Schema.Struct({
  statementId: Schema.String,
  importedRows: Schema.Number,
  skippedRows: Schema.Number,
  warnings: Schema.Array(Schema.String),
});
export type ConvertedToStatement = Wire<typeof ConvertedToStatement>;

/** `POST /custom-tables/:id/rows/batch`: the rows as created. */
export const CustomTableRowBatch = Schema.Struct({
  ok: Schema.Boolean,
  created: Schema.Number,
  rows: Schema.Array(CustomTableRowItem),
});
export type CustomTableRowBatch = Wire<typeof CustomTableRowBatch>;
