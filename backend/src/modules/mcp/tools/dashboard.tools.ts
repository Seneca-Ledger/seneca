import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { DashboardResponse, DashboardTrendsResponse, InsightList } from '../../../contracts';
import type { DashboardService } from '../../dashboard/dashboard.service';
import type { InsightsService } from '../../insights/insights.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { Day, described, Limit } from './inputs';

const Month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Expected a month as YYYY-MM' }),
);

export function dashboardTools(dashboard: DashboardService, insights: InsightsService): McpTool[] {
  return [
    defineTool({
      name: 'get_dashboard',
      description:
        'The dashboard snapshot: income, spending and net flow for the period, balances, top categories and merchants, recent transactions. Amounts are in the workspace currency; `missingRates` lists currencies counted at face value for lack of a rate.',
      input: Schema.Struct({
        range: Schema.optionalKey(
          described(
            Schema.Literals(['7d', '30d', '90d', 'month']),
            'Period ending on `date`: 7, 30 or 90 days, or the calendar month (default 30d)',
          ),
        ),
        date: Schema.optionalKey(described(Day, 'Last day of the period (default today)')),
      }),
      // The REST route checks membership only; reading the dashboard is reading a report.
      permissions: [Permission.REPORT_VIEW],
      output: DashboardResponse,
      readOnly: true,
      run: (ctx, args) =>
        dashboard.getDashboard(ctx.user.id, ctx.workspaceId, args.range ?? '30d', args.date),
    }),
    defineTool({
      name: 'get_trends',
      description:
        'Daily income and spending, spending by category and the top income sources over the last days or one month. Amounts in the workspace currency.',
      input: Schema.Struct({
        days: Schema.optionalKey(
          described(
            Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 365 })),
            'Last N days, 1–365 (default 30); ignored with `month`',
          ),
        ),
        month: Schema.optionalKey(described(Month, 'One calendar month, YYYY-MM')),
      }),
      permissions: [Permission.REPORT_VIEW],
      output: DashboardTrendsResponse,
      readOnly: true,
      run: (ctx, args) => dashboard.getTrends(ctx.workspaceId, args.days ?? 30, args.month),
    }),
    defineTool({
      name: 'list_insights',
      description:
        'Findings the app made about the money: unusual spending, budget risks, subscriptions, advice. Newest first.',
      input: Schema.Struct({
        category: Schema.optionalKey(Schema.String),
        limit: Schema.optionalKey(Limit(50)),
        offset: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
      }),
      permissions: [Permission.REPORT_VIEW],
      output: InsightList,
      readOnly: true,
      run: (ctx, args) =>
        insights.list({
          userId: ctx.user.id,
          workspaceId: ctx.workspaceId,
          category: args.category,
          limit: args.limit ?? 20,
          offset: args.offset ?? 0,
          locale: ctx.user.locale ?? undefined,
        }),
    }),
  ];
}
