import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const ApproveTransactionsBody = Schema.Struct({
  ids: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(500),
  ),
  /** Omitted: keep whatever category the row has and only mark it reviewed. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type ApproveTransactionsBody = Wire<typeof ApproveTransactionsBody>;

export const ResolveDuplicateBody = Schema.Struct({
  decision: Schema.Literals(['confirm', 'keep']),
});
export type ResolveDuplicateBody = Wire<typeof ResolveDuplicateBody>;

/** `POST /review-inbox/duplicates/:id/resolve`: the duplicate transaction. */
export const ReviewDuplicateParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type ReviewDuplicateParams = Wire<typeof ReviewDuplicateParams>;

/** `GET /review-inbox/counts`: `me` as in the list; `anyone` or absent is the whole workspace. */
export const ReviewInboxCountsQuery = Schema.Struct({
  reviewer: Schema.optional(Schema.Literals(['me', 'anyone'])),
});
export type ReviewInboxCountsQuery = Wire<typeof ReviewInboxCountsQuery>;
