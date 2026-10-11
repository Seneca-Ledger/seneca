import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const ParseDocumentBody = Schema.Struct({
  sender: optionalNullable(Schema.String),
  subject: optionalNullable(Schema.String),
  emailBody: optionalNullable(Schema.String),
  source: optionalNullable(Schema.String),
});
export type ParseDocumentBody = Wire<typeof ParseDocumentBody>;
