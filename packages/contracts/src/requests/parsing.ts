import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const ParseDocumentBody = Schema.Struct({
  sender: Schema.optional(Schema.String),
  subject: Schema.optional(Schema.String),
  emailBody: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
});
export type ParseDocumentBody = Wire<typeof ParseDocumentBody>;
