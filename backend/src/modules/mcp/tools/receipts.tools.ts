import { BadRequestException } from '@nestjs/common';
import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { ReceiptListPage, ReceiptRecord, type ReceiptsQuery } from '../../../contracts';
import type { ReceiptsService } from '../../receipts/receipts.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described, Limit, Page, Uuid } from './inputs';

export function receiptTools(receipts: ReceiptsService): McpTool[] {
  return [
    defineTool({
      name: 'list_receipts',
      description:
        'Receipts (scans, uploads, email) with what was read from them and their status. Paginated.',
      input: Schema.Struct({
        status: Schema.optionalKey(
          described(
            Schema.Literals([
              'new',
              'parsed',
              'needs_review',
              'draft',
              'reviewed',
              'approved',
              'rejected',
              'failed',
            ]),
            'needs_review: something to check; approved: booked',
          ),
        ),
        source: Schema.optionalKey(Schema.Literals(['upload', 'telegram', 'scan', 'imap'])),
        categoryId: Schema.optionalKey(Uuid),
        statementId: Schema.optionalKey(described(Uuid, 'The receipt behind a scan’s statement')),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(Limit(100)),
      }),
      permissions: [Permission.STATEMENT_VIEW],
      output: ReceiptListPage,
      readOnly: true,
      run: (ctx, args) => receipts.findAll(ctx.workspaceId, args satisfies ReceiptsQuery),
    }),
    defineTool({
      name: 'get_receipt',
      description: 'One receipt: merchant, date, total, line items and the bank rows it may match.',
      input: Schema.Struct({ id: Uuid }),
      permissions: [Permission.STATEMENT_VIEW],
      output: ReceiptRecord,
      readOnly: true,
      run: async (ctx, args) => {
        const receipt = await receipts.findOne(args.id, ctx.workspaceId);
        if (!receipt) {
          throw new BadRequestException('Receipt not found');
        }
        return receipt;
      },
    }),
    defineTool({
      name: 'approve_receipt',
      description:
        'Book a receipt: attach it to the bank row it documents (`transactionId`), or omit it to use the suggested match, or pass null to book it as a new expense. The transaction this creates or confirms can be undone from the activity log; the receipt keeps its approved status.',
      input: Schema.Struct({
        id: Uuid,
        transactionId: Schema.optionalKey(
          described(Schema.NullOr(Uuid), 'Bank row to attach to; null books a new transaction'),
        ),
      }),
      permissions: [Permission.STATEMENT_EDIT],
      readOnly: false,
      run: async (ctx, args) => {
        const result = await receipts.approve(args.id, ctx.workspaceId, ctx.user.id, {
          attachTo: args.transactionId,
        });
        if (!result) {
          throw new BadRequestException('Receipt not found');
        }
        return {
          receiptId: result.receipt.id,
          status: result.receipt.status,
          transactionId: result.transaction.id,
          attached: result.attached,
        };
      },
    }),
  ];
}
