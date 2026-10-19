import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { parseReviewerFilter } from '../../../common/utils/transaction-owner.util';
import {
  ReviewApproved,
  ReviewInboxCounts,
  ReviewInboxKind,
  ReviewInboxPage,
  type ReviewInboxQuery,
} from '../../../contracts';
import type { ReviewInboxService } from '../../review-inbox/review-inbox.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { Day, described, Limit, Page, Uuid } from './inputs';

const Reviewer = described(
  Schema.Literals(['me', 'anyone']),
  'me: my rows plus the shared ones; anyone: the whole workspace (default)',
);

export function reviewTools(review: ReviewInboxService): McpTool[] {
  return [
    defineTool({
      name: 'get_review_counts',
      description:
        'How many items wait in Review, per tab: unconfirmed transactions, receipts, possible duplicates, detected subscriptions.',
      input: Schema.Struct({ reviewer: Schema.optionalKey(Reviewer) }),
      permissions: [Permission.TRANSACTION_VIEW],
      output: ReviewInboxCounts,
      readOnly: true,
      run: (ctx, args) =>
        review.counts(ctx.workspaceId, parseReviewerFilter(args.reviewer, ctx.memberId)),
    }),
    defineTool({
      name: 'list_review_inbox',
      description:
        'Items waiting in Review for one tab (`kind`), oldest first. Paginated. Confirm transactions with approve_transactions, receipts with approve_receipt.',
      input: Schema.Struct({
        kind: Schema.optionalKey(
          described(ReviewInboxKind, 'transaction (default), receipt, duplicate or subscription'),
        ),
        reviewer: Schema.optionalKey(Reviewer),
        uncategorized: Schema.optionalKey(
          described(Schema.Boolean, 'kind=transaction: rows without a category, confirmed or not'),
        ),
        from: Schema.optionalKey(described(Day, 'First day, inclusive (YYYY-MM-DD)')),
        to: Schema.optionalKey(described(Day, 'Last day, inclusive (YYYY-MM-DD)')),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(Limit(200)),
      }),
      permissions: [Permission.TRANSACTION_VIEW],
      output: ReviewInboxPage,
      readOnly: true,
      run: (ctx, args) =>
        review.list(ctx.workspaceId, args satisfies ReviewInboxQuery, ctx.memberId),
    }),
    defineTool({
      name: 'approve_transactions',
      description:
        'Confirm up to 500 transactions in Review, optionally putting them all into one category. Logged as this API key and undoable from the activity log.',
      input: Schema.Struct({
        ids: Schema.Array(Uuid).check(Schema.isMinLength(1), Schema.isMaxLength(500)),
        categoryId: Schema.optionalKey(
          described(Uuid, 'Category for all of them; omitted keeps each row’s category'),
        ),
      }),
      permissions: [Permission.TRANSACTION_EDIT],
      output: ReviewApproved,
      readOnly: false,
      run: (ctx, args) =>
        review.approveTransactions(ctx.workspaceId, ctx.user.id, [...args.ids], args.categoryId),
    }),
  ];
}
