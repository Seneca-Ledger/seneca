import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateBranchBody = Schema.Struct({
  name: Schema.String,
  code: optionalNullable(Schema.String),
  address: optionalNullable(Schema.String),
});
export type CreateBranchBody = Wire<typeof CreateBranchBody>;

export const UpdateBranchBody = Schema.Struct({
  name: optionalNullable(Schema.String),
  code: optionalNullable(Schema.String),
  address: optionalNullable(Schema.String),
  isActive: optionalNullable(Schema.Boolean),
});
export type UpdateBranchBody = Wire<typeof UpdateBranchBody>;
