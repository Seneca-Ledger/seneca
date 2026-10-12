import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdatePayeeBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  mode: optionalNullable(Schema.Literals(['auto', 'always', 'never'])),
  /** The pinned category; required with `mode: always`, null clears it. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
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
  payeeId: optionalNullable(Schema.String.check(Schema.isUUID())),
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
}).check(
  Schema.makeFilter(body =>
    body.payeeId !== undefined || body.name !== undefined
      ? undefined
      : 'payeeId or name is required',
  ),
);
export type SetTransactionPayeeBody = Wire<typeof SetTransactionPayeeBody>;
