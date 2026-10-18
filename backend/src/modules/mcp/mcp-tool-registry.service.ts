import { Injectable } from '@nestjs/common';
import { BudgetsService } from '../budgets/budgets.service';
import { StoicLedgerService } from '../budgets/stoic/stoic-ledger.service';
import { CategoriesService } from '../categories/categories.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ForecastService } from '../forecast/forecast.service';
import { GoalsService } from '../goals/goals.service';
import { InsightsService } from '../insights/insights.service';
import { InvoiceAgeingService } from '../invoices/invoice-ageing.service';
import { InvoicesService } from '../invoices/invoices.service';
import { NetWorthService } from '../net-worth/net-worth.service';
import { PayablesService } from '../payables/payables.service';
import { PayeesService } from '../payees/payees.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { ReviewInboxService } from '../review-inbox/review-inbox.service';
import { SearchService } from '../search/search.service';
import { ReceiptStatementService } from '../statements/services/receipt-statement.service';
import { StatementsService } from '../statements/statements.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TaxPackService } from '../tax-pack/tax-pack.service';
import { TaxDeadlinesService } from '../tax-reminders/tax-deadlines.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import type { McpTool } from './mcp-tool';
import { categoryTools } from './tools/categories.tools';
import { dashboardTools } from './tools/dashboard.tools';
import { moneyTools } from './tools/money.tools';
import { planningTools } from './tools/planning.tools';
import { receiptTools } from './tools/receipts.tools';
import { recurringTools } from './tools/recurring.tools';
import { reviewTools } from './tools/review.tools';
import { searchTools } from './tools/search.tools';
import { statementTools } from './tools/statements.tools';
import { taxTools } from './tools/tax.tools';
import { transactionTools } from './tools/transactions.tools';

/** Every tool the MCP endpoint offers, built once from the services they call. */
@Injectable()
export class McpToolRegistry {
  readonly tools: readonly McpTool[];
  private readonly byName: ReadonlyMap<string, McpTool>;

  constructor(
    transactions: TransactionsService,
    categories: CategoriesService,
    dashboard: DashboardService,
    insights: InsightsService,
    statements: StatementsService,
    receiptStatements: ReceiptStatementService,
    search: SearchService,
    review: ReviewInboxService,
    receipts: ReceiptsService,
    budgets: BudgetsService,
    stoicLedger: StoicLedgerService,
    goals: GoalsService,
    forecast: ForecastService,
    netWorth: NetWorthService,
    wallets: WalletsService,
    invoices: InvoicesService,
    invoiceAgeing: InvoiceAgeingService,
    payables: PayablesService,
    subscriptions: SubscriptionsService,
    payees: PayeesService,
    deadlines: TaxDeadlinesService,
    taxPack: TaxPackService,
  ) {
    this.tools = [
      ...transactionTools(transactions),
      ...categoryTools(categories),
      ...statementTools(statements, receiptStatements),
      ...searchTools(search),
      ...reviewTools(review),
      ...receiptTools(receipts),
      ...planningTools({ budgets, stoicLedger, goals, forecast }),
      ...moneyTools({ netWorth, wallets, invoices, invoiceAgeing, payables }),
      ...recurringTools({ subscriptions, payees }),
      ...taxTools({ deadlines, taxPack }),
      ...dashboardTools(dashboard, insights),
    ];
    this.byName = new Map(this.tools.map(tool => [tool.name, tool]));
    if (this.byName.size !== this.tools.length) {
      throw new Error('Two MCP tools share a name');
    }
  }

  find(name: string): McpTool | undefined {
    return this.byName.get(name);
  }
}
