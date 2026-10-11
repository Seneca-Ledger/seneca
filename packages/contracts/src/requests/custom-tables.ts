import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { IsoDateString, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

// #rrggbb или #rrggbbaa: заливка колонки хранится с прозрачностью, чтобы
// ложиться на обе темы.
const HexColor = Schema.String.check(Schema.isPattern(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i));

export const CreateRowCommentBody = Schema.Struct({
  body: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4000)),
});
export type CreateRowCommentBody = Wire<typeof CreateRowCommentBody>;

export const SetCommentResolvedBody = Schema.Struct({
  resolved: Schema.Boolean,
});
export type SetCommentResolvedBody = Wire<typeof SetCommentResolvedBody>;

export const CreateCustomTableShareBody = Schema.Struct({
  /** Срок жизни ссылки в днях; по умолчанию 30, максимум год. */
  expiresInDays: optionalNullable(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(365)),
  ),
});
export type CreateCustomTableShareBody = Wire<typeof CreateCustomTableShareBody>;

export const CreateExportScheduleBody = Schema.Struct({
  format: optionalNullable(Schema.Literals(['csv', 'xlsx'])),
  /** От часа до месяца: чаще смысла нет, реже — уже не расписание. */
  intervalHours: optionalNullable(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(744)),
  ),
  /** { filters, sort, columnKeys } — тот же «текущий вид», что у ручного экспорта. */
  viewConfig: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type CreateExportScheduleBody = Wire<typeof CreateExportScheduleBody>;

export const CreateCustomTableBody = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  description: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type CreateCustomTableBody = Wire<typeof CreateCustomTableBody>;

export const CreateCustomTableFromDataEntryBody = Schema.Struct({
  scope: Schema.Literals(['type', 'all']),
  type: optionalNullable(Schema.Literals(['cash', 'raw', 'debit', 'credit'])),
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120))),
  description: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
}).check(
  Schema.makeFilter(body =>
    body.scope !== 'type' || body.type !== undefined
      ? undefined
      : 'type is required when scope is type',
  ),
);
export type CreateCustomTableFromDataEntryBody = Wire<typeof CreateCustomTableFromDataEntryBody>;

export const CreateCustomTableFromDataEntryCustomTabBody = Schema.Struct({
  customTabId: Schema.String.check(Schema.isUUID()),
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120))),
  description: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
});
export type CreateCustomTableFromDataEntryCustomTabBody = Wire<
  typeof CreateCustomTableFromDataEntryCustomTabBody
>;

/** Union of every source's filters; each adapter reads only its own. */
export const SourceFiltersInput = Schema.Struct({
  dateFrom: optionalNullable(IsoDateString),
  dateTo: optionalNullable(IsoDateString),
  categoryIds: optionalNullable(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(100)),
  ),
  type: optionalNullable(Schema.String.check(Schema.isMaxLength(32))),
  currency: optionalNullable(Schema.String.check(Schema.isBetweenLength(3, 3))),
  statementIds: optionalNullable(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(10)),
  ),
  status: optionalNullable(Schema.String.check(Schema.isMaxLength(32))),
  direction: optionalNullable(Schema.String.check(Schema.isMaxLength(32))),
  dueDateFrom: optionalNullable(IsoDateString),
  dueDateTo: optionalNullable(IsoDateString),
  ids: optionalNullable(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(5000)),
  ),
});
export type SourceFiltersInput = Wire<typeof SourceFiltersInput>;

export const PreviewCustomTableSourceBody = Schema.Struct({
  kind: Schema.Literals(['transactions', 'subscriptions', 'payables', 'invoices', 'budgets']),
  filters: optionalNullable(SourceFiltersInput),
  /** Translated column titles per source field; English fallback otherwise. */
  columnTitles: optionalNullable(Schema.Record(Schema.String, Schema.String)),
});
export type PreviewCustomTableSourceBody = Wire<typeof PreviewCustomTableSourceBody>;

export const CreateCustomTableFromSourceBody = PreviewCustomTableSourceBody.mapFields(
  Struct.assign({
    name: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
    description: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
    categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
    /** Workspace currency for money columns, same as the templates flow. */
    currency: optionalNullable(Schema.String.check(Schema.isPattern(/^[A-Za-z]{3}$/))),
  }),
);
export type CreateCustomTableFromSourceBody = Wire<typeof CreateCustomTableFromSourceBody>;

export const PreviewFormulaBody = Schema.Struct({
  expression: Schema.String.check(Schema.isMaxLength(500)),
  /** Key of the column being edited, so its own old formula is not treated as a dependency. */
  columnKey: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  /** `table` previews a summary (no current row, only column totals). */
  scope: optionalNullable(Schema.Literals(['row', 'table'])),
});
export type PreviewFormulaBody = Wire<typeof PreviewFormulaBody>;

export const CustomTableSummaryInput = Schema.Struct({
  id: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  /** Formula over column totals, e.g. `SUM([income]) - SUM([expense])`. */
  expression: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
});
export type CustomTableSummaryInput = Wire<typeof CustomTableSummaryInput>;

export const UpdateCustomTableSummariesBody = Schema.Struct({
  summaries: Schema.Array(CustomTableSummaryInput).check(Schema.isMaxLength(20)),
});
export type UpdateCustomTableSummariesBody = Wire<typeof UpdateCustomTableSummariesBody>;

export const UpdateCustomTableBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120))),
  description: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type UpdateCustomTableBody = Wire<typeof UpdateCustomTableBody>;

export const CreateCustomTableColumnBody = Schema.Struct({
  title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  type: optionalNullable(
    Schema.Literals([
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
    ]),
  ),
  isRequired: optionalNullable(Schema.Boolean),
  isUnique: optionalNullable(Schema.Boolean),
  position: optionalNullable(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  config: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type CreateCustomTableColumnBody = Wire<typeof CreateCustomTableColumnBody>;

export const UpdateCustomTableColumnBody = CreateCustomTableColumnBody.mapFields(
  Struct.map(optionalNullable),
);
export type UpdateCustomTableColumnBody = Wire<typeof UpdateCustomTableColumnBody>;

export const ColumnStyleTextFormatInput = Schema.Struct({
  foregroundColor: optionalNullable(HexColor),
  bold: optionalNullable(Schema.Boolean),
});
export type ColumnStyleTextFormatInput = Wire<typeof ColumnStyleTextFormatInput>;

export const ColumnStylePartInput = Schema.Struct({
  backgroundColor: optionalNullable(HexColor),
  textFormat: optionalNullable(ColumnStyleTextFormatInput),
});
export type ColumnStylePartInput = Wire<typeof ColumnStylePartInput>;

/** Части, которых нет в теле, не меняются; null сбрасывает часть. */
export const UpdateCustomTableColumnStyleBody = Schema.Struct({
  header: optionalNullable(ColumnStylePartInput),
  cell: optionalNullable(ColumnStylePartInput),
});
export type UpdateCustomTableColumnStyleBody = Wire<typeof UpdateCustomTableColumnStyleBody>;

export const ReorderCustomTableColumnsBody = Schema.Struct({
  columnIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type ReorderCustomTableColumnsBody = Wire<typeof ReorderCustomTableColumnsBody>;

export const FillAiColumnBody = Schema.Struct({
  columnKey: Schema.String.check(Schema.isMinLength(1)),
  /** Заполняем только выбранные строки: запрос к модели стоит денег. */
  rowIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(200)),
});
export type FillAiColumnBody = Wire<typeof FillAiColumnBody>;

export const ClassifyPaidStatusBody = Schema.Struct({
  rowIds: Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});
export type ClassifyPaidStatusBody = Wire<typeof ClassifyPaidStatusBody>;

export const CreateCustomTableRowBody = Schema.Struct({
  data: Schema.Record(Schema.String, Schema.Unknown),
  styles: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
  rowNumber: optionalNullable(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
});
export type CreateCustomTableRowBody = Wire<typeof CreateCustomTableRowBody>;

export const UpdateCustomTableRowBody = Schema.Struct({
  data: Schema.Record(Schema.String, Schema.Unknown),
  styles: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type UpdateCustomTableRowBody = Wire<typeof UpdateCustomTableRowBody>;

export const BatchRowItemInput = Schema.Struct({
  data: Schema.Record(Schema.String, Schema.Unknown),
  rowNumber: optionalNullable(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  /** Cell styles by column key, e.g. an import marking cells it kept as text. */
  styles: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type BatchRowItemInput = Wire<typeof BatchRowItemInput>;

export const BatchCreateCustomTableRowsBody = Schema.Struct({
  /** One request per chunk: the client splits bigger imports and shows progress. */
  rows: Schema.Array(BatchRowItemInput).check(Schema.isMinLength(1), Schema.isMaxLength(1000)),
});
export type BatchCreateCustomTableRowsBody = Wire<typeof BatchCreateCustomTableRowsBody>;

export const UpdateCustomTableRulesBody = Schema.Struct({
  rules: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).check(Schema.isMaxLength(100)),
});
export type UpdateCustomTableRulesBody = Wire<typeof UpdateCustomTableRulesBody>;

export const CustomTableSavedViewSortInput = Schema.Struct({
  col: Schema.String.check(Schema.isMinLength(1)),
  dir: Schema.Literals(['asc', 'desc']),
});
export type CustomTableSavedViewSortInput = Wire<typeof CustomTableSavedViewSortInput>;

export const CustomTableSavedViewInput = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  /** Состояние панели фильтров: ключ колонки -> условие. */
  columnFilters: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
  sort: optionalNullable(CustomTableSavedViewSortInput),
  columnOrder: optionalNullable(Schema.Array(Schema.String).check(Schema.isMaxLength(500))),
  hiddenColumnKeys: optionalNullable(Schema.Array(Schema.String).check(Schema.isMaxLength(500))),
  /** Ключ колонки -> функция итога. */
  aggregates: optionalNullable(Schema.Record(Schema.String, Schema.String)),
});
export type CustomTableSavedViewInput = Wire<typeof CustomTableSavedViewInput>;

export const UpdateCustomTableViewsBody = Schema.Struct({
  views: Schema.Array(CustomTableSavedViewInput).check(Schema.isMaxLength(50)),
  activeViewId: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
});
export type UpdateCustomTableViewsBody = Wire<typeof UpdateCustomTableViewsBody>;

export const UpdateCustomTableViewSettingsColumnBody = Schema.Struct({
  columnKey: Schema.String,
  width: optionalNullable(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(60), Schema.isLessThanOrEqualTo(1200)),
  ),
  /** Функция итога для колонки; null снимает итог. */
  aggregate: optionalNullable(Schema.Literals(['sum', 'avg', 'min', 'max', 'count'])),
});
export type UpdateCustomTableViewSettingsColumnBody = Wire<
  typeof UpdateCustomTableViewSettingsColumnBody
>;
