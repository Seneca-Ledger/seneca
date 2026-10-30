'use client';

import type React from 'react';
import { GoalLinkField } from '@/app/components/goals/GoalLinkField';
import { RuleFromRowAction } from '@/app/components/rules/RuleFromRowAction';
import { ReceiptTagsField } from '@/app/components/tags/RecordTagsField';
import type { ReceiptRecord } from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { ReceiptAccountField } from './ReceiptAccountField';
import { ReceiptBillAction } from './ReceiptBillAction';
import { ReceiptBudgetLine } from './ReceiptBudgetLine';
import { ReceiptReimbursementAction } from './ReceiptReimbursementAction';

/**
 * What the receipt is tied to beyond its own fields: its category's budget,
 * tags, the account that paid it, the goal its transaction counts toward, the
 * bill it pays or the person who owes it back, and a rule for receipts like it.
 * Everything that moves money waits for approval, which may swap the scan's own
 * transaction for a bank row. The goal reads the saved figures rather than the
 * form, so it is recomputed only once an edit reached the transaction.
 */
export function ReceiptLinks({ receipt }: { receipt: ReceiptRecord }): React.JSX.Element {
  const saved = receipt.parsedData;
  const transactionId = receipt.status === 'approved' ? receipt.transactionId : null;
  const date = saved?.date?.split('T')[0] ?? null;
  return (
    <>
      {saved?.categoryId && date && saved.transactionType !== 'income' ? (
        <ReceiptBudgetLine categoryId={saved.categoryId} date={date} />
      ) : null}
      <ReceiptTagsField receiptId={receipt.id} />
      {transactionId && (
        <ReceiptAccountField
          transactionId={transactionId}
          receiptStatementId={receipt.statementId}
        />
      )}
      <GoalLinkField
        transactionId={transactionId}
        syncKey={`${saved?.amount}|${saved?.transactionType}|${saved?.currency}`}
      />
      {transactionId && saved?.transactionType !== 'income' && (
        <ReceiptBillAction transactionId={transactionId} paidOn={date} />
      )}
      {transactionId && saved?.amount ? (
        <ReceiptReimbursementAction
          vendor={saved.vendor ?? ''}
          amount={saved.amount}
          currency={saved.currency ?? FALLBACK_CURRENCY}
          statementId={receipt.statementId}
        />
      ) : null}
      {/* Rules match the payee as written; the vendor is the receipt's. */}
      <RuleFromRowAction
        transaction={{ counterpartyName: saved?.vendor ?? '' }}
        categoryId={saved?.categoryId ?? ''}
      />
    </>
  );
}
