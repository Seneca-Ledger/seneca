import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WorkspacePluginsModule } from '../workspaces/workspace-plugins.module';
import { McpController } from './mcp.controller';
import { McpAccessGuard } from './mcp-access.guard';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolRegistry } from './mcp-tool-registry.service';

/** The MCP endpoint. Nothing imports it, so the domain modules it pulls in cannot loop back. */
@Module({
  imports: [WorkspacePluginsModule, TransactionsModule, CategoriesModule, DashboardModule],
  controllers: [McpController],
  providers: [McpToolRegistry, McpServerFactory, McpAccessGuard],
})
export class McpModule {}
