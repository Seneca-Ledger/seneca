import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const ViewPreferenceBody = Schema.Struct({
  /** Opaque to the server: the page owns its own shape. */
  state: Schema.Record(Schema.String, Schema.Unknown),
});
export type ViewPreferenceBody = Wire<typeof ViewPreferenceBody>;
