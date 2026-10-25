import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/** `GET /search`: the text typed so far (empty when absent). */
export const SearchQuery = Schema.Struct({ q: Schema.optional(Schema.String) });
export type SearchQuery = Wire<typeof SearchQuery>;
