import { Schema } from 'effect';
import { toEnum } from '../../../common/effect/to-enum';
import { Permission } from '../../../common/enums/permissions.enum';
import {
  AgeingReport,
  InvoiceListPage,
  InvoiceStatus,
  type InvoicesQuery,
  NetWorthResponse,
  PayableDirection,
  PayableListPage,
  PayableStatus,
  type PayablesQuery,
  PayablesSummary,
  WalletList,
} from '../../../contracts';
import { PayableDirection as PayableDirectionEnum } from '../../../entities/payable.entity';
import type { InvoiceAgeingService } from '../../invoices/invoice-ageing.service';
import type { InvoicesService } from '../../invoices/invoices.service';
import type { NetWorthService } from '../../net-worth/net-worth.service';
import type { PayablesService } from '../../payables/payables.service';
import type { WalletsService } from '../../wallets/wallets.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { Day, described, Limit, Page, Uuid } from './inputs';

const Direction = described(
  PayableDirection,
  'payable: bills you pay; receivable: money owed to you (invoices)',
);

export function moneyTools(deps: {
  netWorth: NetWorthService;
  wallets: WalletsService;
  invoices: InvoicesService;
  invoiceAgeing: InvoiceAgeingService;
  payables: PayablesService;
}): McpTool[] {
  return [
    defineTool({
      name: 'get_net_worth',
      description:
        'Net worth now and over a period: assets, liabilities, the breakdown per account and asset class, change against the start. `missingRates` lists currencies left out for lack of a rate.',
      input: Schema.Struct({
        range: Schema.optionalKey(
          described(
            Schema.Literals(['30d', '90d', '180d', 'ytd', '1y', '3y', '5y', 'all']),
            'History length (default 90d)',
          ),
        ),
        to: Schema.optionalKey(described(Day, 'Value as of this day (default today)')),
      }),
      permissions: [Permission.REPORT_VIEW],
      output: NetWorthResponse,
      readOnly: true,
      run: (ctx, args) =>
        deps.netWorth.getNetWorth(
          ctx.workspaceId,
          { range: args.range ?? '90d', to: args.to },
          ctx.user.locale,
        ),
    }),
    defineTool({
      name: 'list_wallets',
      description: 'Accounts (bank, cash, card, savings) with their currency and balance.',
      input: Schema.Struct({}),
      permissions: [Permission.WALLET_VIEW],
      output: WalletList,
      readOnly: true,
      run: ctx => deps.wallets.list(ctx.workspaceId),
    }),
    defineTool({
      name: 'list_invoices',
      description: 'Invoices you issued, with client, amounts, due date and status. Paginated.',
      input: Schema.Struct({
        status: Schema.optionalKey(InvoiceStatus),
        clientId: Schema.optionalKey(Uuid),
        search: Schema.optionalKey(described(Schema.String, 'Matches number or client')),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(Limit(100)),
      }),
      permissions: [Permission.INVOICE_VIEW],
      output: InvoiceListPage,
      readOnly: true,
      run: (ctx, args) => deps.invoices.findAll(ctx.workspaceId, args satisfies InvoicesQuery),
    }),
    defineTool({
      name: 'get_invoice_ageing',
      description:
        'What clients owe, by how overdue it is (current, 1–30, 31–60, 61–90, over 90 days), per client and currency.',
      input: Schema.Struct({}),
      permissions: [Permission.INVOICE_VIEW],
      output: AgeingReport,
      readOnly: true,
      run: ctx => deps.invoiceAgeing.report(ctx.workspaceId),
    }),
    defineTool({
      name: 'list_payables',
      description:
        'Bills to pay and amounts to receive (Pay/Receive), with due dates and status. Paginated.',
      input: Schema.Struct({
        direction: Schema.optionalKey(Direction),
        status: Schema.optionalKey(PayableStatus),
        search: Schema.optionalKey(described(Schema.String, 'Matches vendor or reference')),
        dueDateFrom: Schema.optionalKey(Day),
        dueDateTo: Schema.optionalKey(Day),
        sort: Schema.optionalKey(
          Schema.Literals(['dueDateAsc', 'dueDateDesc', 'amountDesc', 'vendorAsc']),
        ),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(Limit(100)),
      }),
      permissions: [Permission.PAYABLE_VIEW],
      output: PayableListPage,
      readOnly: true,
      run: (ctx, args) => deps.payables.findAll(ctx.workspaceId, args satisfies PayablesQuery),
    }),
    defineTool({
      name: 'get_payables_summary',
      description: 'Totals to pay or to receive: outstanding, overdue and due this week.',
      input: Schema.Struct({ direction: Schema.optionalKey(Direction) }),
      permissions: [Permission.PAYABLE_VIEW],
      output: PayablesSummary,
      readOnly: true,
      run: (ctx, args) =>
        deps.payables.getSummary(ctx.workspaceId, toEnum(PayableDirectionEnum, args.direction)),
    }),
  ];
}
