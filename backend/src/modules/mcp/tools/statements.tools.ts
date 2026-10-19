import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { writeBase64Upload } from '../../../common/utils/disk-upload.util';
import {
  assertReceiptFileSupported,
  removeUploadedFile,
  validateFile,
  validateFiles,
} from '../../../common/utils/file-validator.util';
import { redactPrivateRows } from '../../../common/utils/transaction-privacy.util';
import { StatementDetail, StatementListPage, type StatementsQuery } from '../../../contracts';
import type { ReceiptStatementService } from '../../statements/services/receipt-statement.service';
import type { StatementsService } from '../../statements/statements.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described, Limit, Page, Uuid } from './inputs';

/** The JSON body limit (1 MB) leaves room for about 700 KB of file once base64-encoded. */
const MAX_UPLOAD_BYTES = 700 * 1024;

const FileArgs = {
  fileName: described(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
    'File name with its extension, which decides the type (e.g. statement.pdf)',
  ),
  fileBase64: described(Schema.String, 'File content, base64-encoded; at most about 700 KB'),
};

/** Runs `create` on the written file and removes the file if the upload is refused. */
async function withUpload<T>(
  file: Express.Multer.File,
  create: (file: Express.Multer.File) => Promise<T>,
): Promise<T> {
  try {
    return await create(file);
  } catch (error) {
    await removeUploadedFile(file);
    throw error;
  }
}

export function statementTools(
  statements: StatementsService,
  receiptStatements: ReceiptStatementService,
): McpTool[] {
  return [
    defineTool({
      name: 'list_statements',
      description:
        'Uploaded documents (bank statements, receipt scans, manual expenses), newest first, with their processing status. Paginated.',
      input: Schema.Struct({
        search: Schema.optionalKey(described(Schema.String, 'Matches the file or bank name')),
        statuses: Schema.optionalKey(
          described(Schema.Array(Schema.String), 'e.g. uploaded, processing, parsed, error'),
        ),
        page: Schema.optionalKey(Page),
        limit: Schema.optionalKey(described(Limit(100), 'Documents per page, 1–100 (default 20)')),
      }),
      permissions: [Permission.STATEMENT_VIEW],
      output: StatementListPage,
      readOnly: true,
      run: (ctx, args) =>
        statements.findAll(ctx.workspaceId, {
          search: args.search,
          statuses: args.statuses ? [...args.statuses] : undefined,
          page: args.page ?? 1,
          limit: args.limit ?? 20,
        } satisfies StatementsQuery),
    }),
    defineTool({
      name: 'get_statement',
      description: 'One document with its processing status, totals and transactions.',
      input: Schema.Struct({ id: Uuid }),
      permissions: [Permission.STATEMENT_VIEW],
      output: StatementDetail,
      readOnly: true,
      run: async (ctx, args) => {
        const statement = await statements.findOne(args.id, ctx.workspaceId);
        redactPrivateRows(statement.transactions ?? [], ctx.memberId);
        return statement;
      },
    }),
    defineTool({
      name: 'upload_statement',
      description:
        'Upload a bank statement (PDF, CSV, XLSX, OFX/QFX, QIF, camt.053 or MT940). It is parsed in the background; check it with get_statement. Refused when the same file was uploaded before.',
      input: Schema.Struct({
        ...FileArgs,
        walletId: Schema.optionalKey(described(Uuid, 'Account the statement belongs to')),
        branchId: Schema.optionalKey(Uuid),
      }),
      permissions: [Permission.STATEMENT_UPLOAD],
      readOnly: false,
      run: async (ctx, args) => {
        const file = await writeBase64Upload(args.fileBase64, args.fileName, MAX_UPLOAD_BYTES);
        await validateFiles([file]);
        const statement = await withUpload(file, written =>
          statements.create(ctx.user, ctx.workspaceId, written, args.walletId, args.branchId),
        );
        return { id: statement.id, status: statement.status, fileName: statement.fileName };
      },
    }),
    defineTool({
      name: 'upload_receipt',
      description:
        'Upload a receipt (photo, PDF or e-invoice XML). It is read right away and lands in Review for approval.',
      input: Schema.Struct({
        ...FileArgs,
        language: Schema.optionalKey(
          described(Schema.String, 'Language of the receipt text, e.g. de or en (default: detect)'),
        ),
      }),
      permissions: [Permission.STATEMENT_UPLOAD],
      readOnly: false,
      run: async (ctx, args) => {
        const file = await writeBase64Upload(args.fileBase64, args.fileName, MAX_UPLOAD_BYTES);
        try {
          validateFile(file, { allowEInvoiceXml: true });
          assertReceiptFileSupported(file);
        } catch (error) {
          await removeUploadedFile(file);
          throw error;
        }
        const created = await withUpload(file, written =>
          receiptStatements.createFromReceiptScan({
            user: ctx.user,
            workspaceId: ctx.workspaceId,
            files: [written],
            language: args.language,
          }),
        );
        return created.map(statement => ({
          statementId: statement.id,
          status: statement.status,
          fileName: statement.fileName,
        }));
      },
    }),
  ];
}
