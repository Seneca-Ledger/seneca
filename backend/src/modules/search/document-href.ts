import { In, type Repository } from 'typeorm';
import { Receipt, ReceiptSource } from '../../entities/receipt.entity';
import { Statement, StatementStatus } from '../../entities/statement.entity';

/** What the rule reads off a statement. */
export type DocumentHrefStatement = Pick<Statement, 'id' | 'status' | 'parsingDetails'>;

/** Statuses whose transactions are ready to inspect in the statement editor. */
const OPENS_IN_EDITOR = new Set<string>([
  StatementStatus.COMPLETED,
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.NEEDS_REVIEW,
]);

/**
 * Where a document opens, by the same rule as a click in the Documents list:
 * a scan opens its receipt, a parsed statement its editor, anything else storage.
 * A transaction has no page of its own, so it opens its document too.
 */
export function documentHref(
  statement: DocumentHrefStatement,
  scanReceipts: Map<string, Pick<Receipt, 'id' | 'source'>>,
): string {
  const receipt = scanReceipts.get(statement.id);
  if (receipt) {
    const base =
      receipt.source === ReceiptSource.GMAIL ? '/storage/gmail-receipts' : '/storage/receipts';
    return `${base}/${receipt.id}`;
  }
  if (OPENS_IN_EDITOR.has(statement.status)) {
    return `/statements/${statement.id}/edit`;
  }
  return `/storage/${statement.id}`;
}

/** A scan uploads as a statement of its own, which the Documents list hides behind its receipt. */
function isReceiptScanStatement(statement: DocumentHrefStatement): boolean {
  const details = statement.parsingDetails;
  return (
    details?.detectedBy === 'receipt-scan' || details?.importPreview?.source === 'receipt-scan'
  );
}

/** The receipts behind the scans among these statements, keyed by statement id. */
export async function findScanReceipts(
  receiptRepo: Repository<Receipt>,
  workspaceId: string,
  statements: DocumentHrefStatement[],
): Promise<Map<string, Receipt>> {
  const scanIds = statements.filter(isReceiptScanStatement).map(statement => statement.id);
  if (scanIds.length === 0) {
    return new Map();
  }
  const receipts = await receiptRepo.find({
    where: { workspaceId, statementId: In(scanIds) },
    select: { id: true, statementId: true, source: true },
  });
  return new Map(receipts.map(receipt => [receipt.statementId as string, receipt]));
}
