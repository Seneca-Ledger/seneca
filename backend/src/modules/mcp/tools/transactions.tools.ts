import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { TransactionListPage } from '../../../contracts';
import type { TransactionsService } from '../../transactions/transactions.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { Day, described, Limit, Page, Uuid } from './inputs';

export function transactionTools(transactions: TransactionsService): McpTool[] {
  return [
    defineTool({
      name: 'list_transactions',
      description:
        'List transactions, newest first, filtered by statement, period, direction, category or currency. Amounts are in the transaction currency. Paginated: `total` is the number of matches.',
      input: Schema.Struct({
        statementId: Schema.optionalKey(described(Uuid, 'Only rows of this statement')),
        dateFrom: Schema.optionalKey(described(Day, 'First day, inclusive (YYYY-MM-DD)')),
        dateTo: Schema.optionalKey(described(Day, 'Last day, inclusive (YYYY-MM-DD)')),
        type: Schema.optionalKey(
          described(
            Schema.Literals(['income', 'expense', 'transfer']),
            'income, expense, or transfer (rows paired as a transfer)',
          ),
        ),
        categoryId: Schema.optionalKey(Uuid),
        currency: Schema.optionalKey(described(Schema.String, 'ISO 4217 code, e.g. EUR')),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(described(Limit(100), 'Rows per page, 1–100 (default 50)')),
      }),
      permissions: [Permission.TRANSACTION_VIEW],
      output: TransactionListPage,
      readOnly: true,
      run: (ctx, args) =>
        transactions.findAll(
          ctx.workspaceId,
          {
            statementId: args.statementId,
            dateFrom: args.dateFrom ? new Date(args.dateFrom) : undefined,
            dateTo: args.dateTo ? new Date(args.dateTo) : undefined,
            type: args.type,
            categoryId: args.categoryId,
            currency: args.currency,
            page: args.page ?? 1,
            limit: args.limit ?? 50,
          },
          ctx.memberId,
        ),
    }),
    defineTool({
      name: 'get_transaction',
      description: 'One transaction with its category, wallet and statement.',
      input: Schema.Struct({ id: Uuid }),
      permissions: [Permission.TRANSACTION_VIEW],
      readOnly: true,
      run: (ctx, args) => transactions.findOneFor(args.id, ctx.workspaceId, ctx.memberId),
    }),
  ];
}
