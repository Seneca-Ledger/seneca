import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { TaxDeadlineList, TaxYearReport } from '../../../contracts';
import type { TaxPackService } from '../../tax-pack/tax-pack.service';
import type { TaxDeadlinesService } from '../../tax-reminders/tax-deadlines.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described } from './inputs';

export function taxTools(deps: {
  deadlines: TaxDeadlinesService;
  taxPack: TaxPackService;
}): McpTool[] {
  return [
    defineTool({
      name: 'get_tax_deadlines',
      description:
        'VAT and income-tax returns around today: period, due date, days left and whether each is done.',
      input: Schema.Struct({}),
      permissions: [Permission.REPORT_VIEW],
      output: TaxDeadlineList,
      readOnly: true,
      run: ctx => deps.deadlines.getUpcoming(ctx.workspaceId),
    }),
    defineTool({
      name: 'get_tax_year_report',
      description:
        'The year’s tax-relevant income and spending by category, with totals and how many documents back them. Rows are left out unless asked for.',
      input: Schema.Struct({
        year: described(
          Schema.Int.check(Schema.isBetween({ minimum: 2000, maximum: 2100 })),
          'Tax year, e.g. 2025',
        ),
        includeRows: Schema.optionalKey(
          described(Schema.Boolean, 'Also return up to 200 individual rows (default false)'),
        ),
      }),
      permissions: [Permission.REPORT_VIEW, Permission.TRANSACTION_VIEW],
      output: TaxYearReport,
      readOnly: true,
      run: async (ctx, args) => {
        const report = await deps.taxPack.yearReport(ctx.workspaceId, args.year, ctx.memberId);
        return { ...report, rows: args.includeRows ? report.rows.slice(0, 200) : [] };
      },
    }),
  ];
}
