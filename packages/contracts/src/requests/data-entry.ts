import * as Schema from 'effect/Schema';
import { DateOnlyInput, IsoDateString, NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

const DataEntryKind = Schema.Literals(['cash', 'raw', 'debit', 'credit']);
const Uuid = Schema.String.check(Schema.isUUID());

export const CreateDataEntryBody = Schema.Struct({
  type: DataEntryKind,
  date: IsoDateString,
  amount: Schema.Finite,
  note: optionalNullable(Schema.String),
  currency: optionalNullable(Schema.String),
  customFieldName: optionalNullable(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  ),
  customFieldIcon: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
  customFieldValue: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
  customTabId: optionalNullable(Schema.String.check(Schema.isUUID())),
}).check(
  // A custom value needs the field it belongs to.
  Schema.makeFilter(body =>
    (body.customFieldValue ?? '').trim().length === 0 || body.customFieldName !== undefined
      ? undefined
      : 'customFieldName is required with customFieldValue',
  ),
);
export type CreateDataEntryBody = Wire<typeof CreateDataEntryBody>;

export const CreateDataEntryCustomFieldBody = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(120)),
  icon: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
});
export type CreateDataEntryCustomFieldBody = Wire<typeof CreateDataEntryCustomFieldBody>;

export const UpdateDataEntryCustomFieldBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
  icon: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
});
export type UpdateDataEntryCustomFieldBody = Wire<typeof UpdateDataEntryCustomFieldBody>;

/** `/data-entry/:id` and `/data-entry/custom-fields/:id`: both uuids. */
export const DataEntryParams = Schema.Struct({ id: Uuid });
export type DataEntryParams = Wire<typeof DataEntryParams>;

export const DataEntryBaseTabParams = Schema.Struct({ type: DataEntryKind });
export type DataEntryBaseTabParams = Wire<typeof DataEntryBaseTabParams>;

/** `GET /data-entry`; limit and page are clamped by the controller. */
export const DataEntryListQuery = Schema.Struct({
  type: Schema.optional(DataEntryKind),
  customTabId: Schema.optional(Uuid),
  limit: Schema.optional(NumericInput.check(Schema.isInt())),
  page: Schema.optional(NumericInput.check(Schema.isInt())),
  q: Schema.optional(Schema.String),
  date: Schema.optional(DateOnlyInput),
});
export type DataEntryListQuery = Wire<typeof DataEntryListQuery>;
