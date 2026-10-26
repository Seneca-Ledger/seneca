import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** `POST /custom-tables/:id/sync-from-data-entry`: the rows rebuilt from the entries. */
export const SyncedFromDataEntry = Schema.Struct({
  tableId: Schema.String,
  rowsCreated: Schema.Number,
  syncedAt: Timestamp,
});
export type SyncedFromDataEntry = Wire<typeof SyncedFromDataEntry>;

/** `PATCH /custom-tables/:id/columns/:columnId/style`: the column's style after the change. */
export const CustomTableColumnStyle = Schema.Struct({
  columnKey: Schema.String,
  style: Schema.Record(Schema.String, Schema.Unknown),
});
export type CustomTableColumnStyle = Wire<typeof CustomTableColumnStyle>;

/** `GET /custom-tables/:id/relation-options`: rows of the linked table a cell can point at. */
export const CustomTableRelationOptions = Schema.Struct({
  items: Schema.Array(Schema.Struct({ id: Schema.String, label: Schema.String })),
});
export type CustomTableRelationOptions = Wire<typeof CustomTableRelationOptions>;

/** `GET /custom-tables/:id/duplicates`: rows sharing the same values in the key columns. */
export const CustomTableDuplicates = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      count: Schema.Number,
      rowIds: Schema.Array(Schema.String),
      rowNumbers: Schema.Array(Schema.Number),
    }),
  ),
  meta: Schema.Struct({ groupCount: Schema.Number }),
});
export type CustomTableDuplicates = Wire<typeof CustomTableDuplicates>;

/** `POST /custom-tables/:id/rows/paid-classify`: null when the row says nothing either way. */
export const PaidClassification = Schema.Struct({
  items: Schema.Array(Schema.Struct({ rowId: Schema.String, paid: Schema.NullOr(Schema.Boolean) })),
});
export type PaidClassification = Wire<typeof PaidClassification>;
