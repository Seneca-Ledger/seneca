import { Schema } from 'effect';
import { toEnum } from '../../../common/effect/to-enum';
import { Permission } from '../../../common/enums/permissions.enum';
import {
  PayeesPage,
  type PayeesQuery,
  SubscriptionList,
  SubscriptionSummary,
} from '../../../contracts';
import { SubscriptionStatus } from '../../../entities/subscription.entity';
import type { PayeesService } from '../../payees/payees.service';
import type { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described, Limit, Page } from './inputs';

export function recurringTools(deps: {
  subscriptions: SubscriptionsService;
  payees: PayeesService;
}): McpTool[] {
  return [
    defineTool({
      name: 'list_subscriptions',
      description:
        'Recurring charges: vendor, amount, how often, next charge and cost per use. `detected` ones were found in transactions and wait for confirmation in Review.',
      input: Schema.Struct({
        status: Schema.optionalKey(
          described(
            Schema.Literals(['detected', 'active', 'paused', 'cancelled']),
            'Only this status (default: all)',
          ),
        ),
      }),
      permissions: [Permission.SUBSCRIPTION_VIEW],
      output: SubscriptionList,
      readOnly: true,
      run: (ctx, args) =>
        deps.subscriptions.findAll(ctx.workspaceId, toEnum(SubscriptionStatus, args.status)),
    }),
    defineTool({
      name: 'get_subscriptions_summary',
      description:
        'Monthly cost of active subscriptions, how many there are, price changes and likely duplicates.',
      input: Schema.Struct({}),
      permissions: [Permission.SUBSCRIPTION_VIEW],
      output: SubscriptionSummary,
      readOnly: true,
      run: ctx => deps.subscriptions.getSummary(ctx.workspaceId),
    }),
    defineTool({
      name: 'get_upcoming_charges',
      description: 'Subscription charges due in the next days.',
      input: Schema.Struct({
        days: Schema.optionalKey(
          described(
            Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 90 })),
            'How far ahead, 1–90 days (default 7)',
          ),
        ),
      }),
      permissions: [Permission.SUBSCRIPTION_VIEW],
      readOnly: true,
      run: (ctx, args) => deps.subscriptions.getUpcoming(ctx.workspaceId, args.days ?? 7),
    }),
    defineTool({
      name: 'list_payees',
      description:
        'Payees (who you pay or who pays you) with their default category and how many transactions they have. Paginated.',
      input: Schema.Struct({
        search: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(200))),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(Limit(200)),
      }),
      permissions: [Permission.TRANSACTION_VIEW],
      output: PayeesPage,
      readOnly: true,
      run: (ctx, args) => deps.payees.list(ctx.workspaceId, args satisfies PayeesQuery),
    }),
  ];
}
