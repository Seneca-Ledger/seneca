import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { CategoriesModule } from '../categories/categories.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ForecastModule } from '../forecast/forecast.module';
import { GoalsModule } from '../goals/goals.module';
import { InsightsModule } from '../insights/insights.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NetWorthModule } from '../net-worth/net-worth.module';
import { PayablesModule } from '../payables/payables.module';
import { PayeesModule } from '../payees/payees.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { ReviewInboxModule } from '../review-inbox/review-inbox.module';
import { SearchModule } from '../search/search.module';
import { StatementsModule } from '../statements/statements.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TaxPackModule } from '../tax-pack/tax-pack.module';
import { TaxRemindersModule } from '../tax-reminders/tax-reminders.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { WorkspacePluginsModule } from '../workspaces/workspace-plugins.module';
import { McpController } from './mcp.controller';
import { McpAccessGuard } from './mcp-access.guard';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolRegistry } from './mcp-tool-registry.service';

/** The MCP endpoint. Nothing imports it, so the domain modules it pulls in cannot loop back. */
@Module({
  imports: [
    WorkspacePluginsModule,
    TransactionsModule,
    CategoriesModule,
    DashboardModule,
    InsightsModule,
    StatementsModule,
    SearchModule,
    ReviewInboxModule,
    ReceiptsModule,
    BudgetsModule,
    GoalsModule,
    ForecastModule,
    NetWorthModule,
    WalletsModule,
    InvoicesModule,
    PayablesModule,
    SubscriptionsModule,
    PayeesModule,
    TaxRemindersModule,
    TaxPackModule,
  ],
  controllers: [McpController],
  providers: [McpToolRegistry, McpServerFactory, McpAccessGuard],
})
export class McpModule {}
