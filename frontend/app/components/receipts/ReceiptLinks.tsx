'use client';

import type React from 'react';
import { GoalLinkField } from '@/app/components/goals/GoalLinkField';
import { ReceiptTagsField } from '@/app/components/tags/RecordTagsField';
import type { ReceiptRecord } from '@/app/lib/api';
import { ReceiptAccountField } from './ReceiptAccountField';

/**
 * What the receipt is tied to beyond its own fields: tags, the account that
 * paid it, and the goal its transaction counts toward. Both links wait for
 * approval, which may swap the scan's own transaction for a bank row. The goal
 * reads the saved figures rather than the form, so it is recomputed only once
 * an edit reached the transaction.
 */
export function ReceiptLinks({ receipt }: { receipt: ReceiptRecord }): React.JSX.Element {
  const saved = receipt.parsedData;
  const transactionId = receipt.status === 'approved' ? receipt.transactionId : null;
  return (
    <>
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
    </>
  );
}
