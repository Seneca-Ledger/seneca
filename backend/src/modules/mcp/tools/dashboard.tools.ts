import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { DashboardResponse } from '../../../contracts';
import type { DashboardService } from '../../dashboard/dashboard.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { Day, described } from './inputs';

export function dashboardTools(dashboard: DashboardService): McpTool[] {
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
  ];
}
