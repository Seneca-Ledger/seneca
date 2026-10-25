import { PERMISSIONS_KEY } from '@/common/decorators/require-permission.decorator';
import { Permission } from '@/common/enums/permissions.enum';
import { BudgetsController } from '@/modules/budgets/budgets.controller';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { ForecastController } from '@/modules/forecast/forecast.controller';
import { GoalsController } from '@/modules/goals/goals.controller';
import { InvoicesController } from '@/modules/invoices/invoices.controller';
import { toToolInputSchema } from '@/modules/mcp/mcp-json-schema';
import { McpToolRegistry } from '@/modules/mcp/mcp-tool-registry.service';
import { NetWorthController } from '@/modules/net-worth/net-worth.controller';
import { PayablesController } from '@/modules/payables/payables.controller';
import { PayeesController } from '@/modules/payees/payees.controller';
import { ReceiptApprovalsController } from '@/modules/receipts/receipt-approvals.controller';
import { ReceiptsController } from '@/modules/receipts/receipts.controller';
import { ReviewInboxController } from '@/modules/review-inbox/review-inbox.controller';
import { StatementUploadsController } from '@/modules/statements/statement-uploads.controller';
import { StatementsController } from '@/modules/statements/statements.controller';
import { SubscriptionsController } from '@/modules/subscriptions/subscriptions.controller';
import { TaxPackController } from '@/modules/tax-pack/tax-pack.controller';
import { TaxDeadlinesController } from '@/modules/tax-reminders/tax-deadlines.controller';
import { TransactionsController } from '@/modules/transactions/transactions.controller';
import { WalletsController } from '@/modules/wallets/wallets.controller';

// The tools only keep references to the services; building them calls nothing.
const registry = new (McpToolRegistry as unknown as new (...services: unknown[]) => McpToolRegistry)(
  ...Array.from({ length: McpToolRegistry.length }, () => ({})),
);

/** The REST route each tool stands in for: the tool must ask for what the route asks for. */
const ROUTES: Record<string, [{ prototype: object }, string]> = {
  list_transactions: [TransactionsController, 'findAll'],
  get_transaction: [TransactionsController, 'findOne'],
  update_transaction: [TransactionsController, 'update'],
  set_transactions_category: [TransactionsController, 'bulkUpdate'],
  list_categories: [CategoriesController, 'findAll'],
  create_category: [CategoriesController, 'create'],
  update_category: [CategoriesController, 'update'],
  list_statements: [StatementsController, 'findAll'],
  get_statement: [StatementsController, 'findOne'],
  upload_statement: [StatementUploadsController, 'upload'],
  upload_receipt: [StatementUploadsController, 'uploadReceipt'],
  get_review_counts: [ReviewInboxController, 'counts'],
  list_review_inbox: [ReviewInboxController, 'list'],
  approve_transactions: [ReviewInboxController, 'approveTransactions'],
  list_receipts: [ReceiptsController, 'findAll'],
  get_receipt: [ReceiptsController, 'findOne'],
  approve_receipt: [ReceiptApprovalsController, 'approve'],
  list_budgets: [BudgetsController, 'findAll'],
  get_stoic_balance: [BudgetsController, 'stoicBalance'],
  create_budget: [BudgetsController, 'create'],
  list_goals: [GoalsController, 'findAll'],
  get_forecast: [ForecastController, 'getForecast'],
  get_net_worth: [NetWorthController, 'getNetWorth'],
  list_wallets: [WalletsController, 'findAll'],
  list_invoices: [InvoicesController, 'findAll'],
  get_invoice_ageing: [InvoicesController, 'ageing'],
  list_payables: [PayablesController, 'findAll'],
  get_payables_summary: [PayablesController, 'getSummary'],
  list_subscriptions: [SubscriptionsController, 'findAll'],
  get_subscriptions_summary: [SubscriptionsController, 'getSummary'],
  get_upcoming_charges: [SubscriptionsController, 'getUpcoming'],
  list_payees: [PayeesController, 'list'],
  get_tax_deadlines: [TaxDeadlinesController, 'upcoming'],
  get_tax_year_report: [TaxPackController, 'yearReport'],
};

/** Routes with no permission of their own (membership only): the tool picks the nearest one. */
const UNGUARDED_ROUTES: Record<string, Permission[]> = {
  get_dashboard: [Permission.REPORT_VIEW],
  get_trends: [Permission.REPORT_VIEW],
  list_insights: [Permission.REPORT_VIEW],
  search: [Permission.TRANSACTION_VIEW],
};

describe('McpToolRegistry', () => {
  it('maps every tool to a REST route, or names the permission it stands in with', () => {
    expect(registry.tools.map(tool => tool.name).sort()).toEqual(
      [...Object.keys(ROUTES), ...Object.keys(UNGUARDED_ROUTES)].sort(),
    );
  });

  it.each(Object.entries(ROUTES))('%s asks for what its REST route asks for', (name, route) => {
    const [controller, method] = route;
    const handler = (controller.prototype as Record<string, unknown>)[method] as object;
    const routePermissions =
      Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? Reflect.getMetadata(PERMISSIONS_KEY, controller);

    expect(routePermissions?.length).toBeGreaterThan(0);
    expect([...(registry.find(name)?.permissions ?? [])].sort()).toEqual(
      [...routePermissions].sort(),
    );
  });

  it.each(Object.entries(UNGUARDED_ROUTES))('%s asks for %j', (name, permissions) => {
    expect(registry.find(name)?.permissions).toEqual(permissions);
  });

  it.each(registry.tools.map(tool => [tool.name, tool] as const))(
    '%s describes its arguments as a closed object with no dangling references',
    (_name, tool) => {
      const schema = toToolInputSchema(tool.input);
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);
      const refs = JSON.stringify(schema).match(/"\$ref":"[^"]+"/g) ?? [];
      const defs = Object.keys((schema.$defs as Record<string, unknown>) ?? {});
      for (const ref of refs) {
        expect(defs.some(def => ref.endsWith(`/${def}"`))).toBe(true);
      }
    },
  );

  it('marks only the writing tools as writing', () => {
    const writing = registry.tools.filter(tool => !tool.readOnly).map(tool => tool.name);

    expect(writing.sort()).toEqual(
      [
        'approve_receipt',
        'approve_transactions',
        'create_budget',
        'create_category',
        'set_transactions_category',
        'update_category',
        'update_transaction',
        'upload_receipt',
        'upload_statement',
      ].sort(),
    );
  });

  it('has a description on every tool', () => {
    for (const tool of registry.tools) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });
});
