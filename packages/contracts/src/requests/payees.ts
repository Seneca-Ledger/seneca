import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const UpdatePayeeBody = Schema.Struct({
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  mode: Schema.optional(Schema.Literals(['auto', 'always', 'never'])),
  /** The pinned category; required with `mode: always`, null clears it. */
  categoryId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
});
export type UpdatePayeeBody = Wire<typeof UpdatePayeeBody>;

export const MergePayeesBody = Schema.Struct({
  sourceIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(100),
  ),
});
export type MergePayeesBody = Wire<typeof MergePayeesBody>;

/** Either an existing payee, or a name to find or create one by. */
export const SetTransactionPayeeBody = Schema.Struct({
  payeeId: Schema.optional(Schema.String.check(Schema.isUUID())),
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
}).check(
  Schema.makeFilter(body =>
    body.payeeId !== undefined || body.name !== undefined
      ? undefined
      : 'payeeId or name is required',
  ),
);
export type SetTransactionPayeeBody = Wire<typeof SetTransactionPayeeBody>;
