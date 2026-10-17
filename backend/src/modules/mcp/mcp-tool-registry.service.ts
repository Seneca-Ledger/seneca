import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { TransactionsService } from '../transactions/transactions.service';
import type { McpTool } from './mcp-tool';
import { categoryTools } from './tools/categories.tools';
import { dashboardTools } from './tools/dashboard.tools';
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
  ) {
    this.tools = [
      ...transactionTools(transactions),
      ...categoryTools(categories),
      ...dashboardTools(dashboard),
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
