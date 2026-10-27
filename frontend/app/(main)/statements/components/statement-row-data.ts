import { resolveReceiptMerchantLabel } from '@/app/lib/receipt-merchant';
import {
  getStatementDisplayMerchant,
  getStatementMerchantLabel,
  isManualExpenseStatement,
} from '@/app/lib/statement-status';
import type { StatementAmountView } from './filters/amount-view';
import type { StatementForTable } from './StatementsListTable';
import {
  formatStatementAmount,
  formatStatementDate,
  getBankDisplayName,
  isReceiptProcessing,
  isStatementParsingInProgress,
} from './StatementsListView.utils';

interface StatementRowData {
  isReceipt: boolean;
  merchantLabel: string;
  isManualExpense: boolean;
  allowAttachFallback: boolean;
  isProcessingReceipt: boolean;
  isProcessingStatement: boolean;
  amountLabel: string;
  dateLabel: string;
}

/** What one row of the documents table prints, worked out from its statement. */
export function resolveStatementRowData(
  statement: StatementForTable,
  scanningLabel: string,
  amountView: StatementAmountView | null = null,
): StatementRowData {
  const isReceipt = statement.source === 'scan';
  const resolvedName = isReceipt
    ? resolveReceiptMerchantLabel({
        vendor: statement.parsedData?.vendor,
        subject: statement.subject,
        fallback: statement.fileName,
      })
    : getStatementDisplayMerchant(statement, getBankDisplayName(statement.bankName));
  const merchantLabel = isReceipt
    ? resolvedName
    : getStatementMerchantLabel(statement.status, resolvedName, scanningLabel);
  const isManualExpense = !isReceipt && isManualExpenseStatement(statement);
  const manualAttachmentCount = Number(statement.parsingDetails?.importPreview?.attachments ?? 0);
  const allowAttachFallback =
    isManualExpense &&
    !isReceipt &&
    (manualAttachmentCount === 0 || statement.fileName.toLowerCase().startsWith('manual-expense-'));
  return {
    isReceipt,
    merchantLabel,
    isManualExpense,
    allowAttachFallback,
    isProcessingReceipt: isReceiptProcessing(statement),
    isProcessingStatement: isStatementParsingInProgress(statement),
    amountLabel: formatStatementAmount(statement, amountView),
    dateLabel: formatStatementDate(statement),
  };
}
