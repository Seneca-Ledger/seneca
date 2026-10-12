import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateCategoryBody = Schema.Struct({
  name: Schema.String,
  type: Schema.Literals(['income', 'expense']),
  parentId: optionalNullable(Schema.String.check(Schema.isUUID())),
  color: optionalNullable(Schema.String),
  icon: optionalNullable(Schema.String),
  isEnabled: optionalNullable(Schema.Boolean),
  /** Null clears the user's choice and returns the category to the suggestion
   * (IsOptional lets null through). */
  stoicClass: optionalNullable(Schema.Literals(['necessity', 'work', 'virtue', 'leisure'])),
  /** Null returns the category to the name-based guess. */
  helpsOthers: optionalNullable(Schema.Boolean),
});
export type CreateCategoryBody = Wire<typeof CreateCategoryBody>;

export const UpdateCategoryBody = CreateCategoryBody.mapFields(Struct.map(optionalNullable));
export type UpdateCategoryBody = Wire<typeof UpdateCategoryBody>;
