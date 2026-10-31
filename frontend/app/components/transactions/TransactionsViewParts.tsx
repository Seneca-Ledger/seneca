import type { StatementTransaction } from '@/app/lib/contracts';
import { PaymentTypeLabel } from './PaymentTypeLabel';

export const getTransactionValue = (transaction: StatementTransaction, key: string): unknown => {
  const record = transaction as unknown as Record<string, unknown>;
  return record[key];
};

export const getNamedObjectLabel = (value: object): string | null => {
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' ? record.name : null;
};

/** The purpose of a row with its payment type beneath it. */
export function PaymentPurposeCell({
  tx,
  fallback,
}: {
  tx: Pick<StatementTransaction, 'paymentPurpose' | 'paymentType'>;
  fallback: string;
}) {
  return (
    <>
      {tx.paymentPurpose || fallback}
      <PaymentTypeLabel type={tx.paymentType} />
    </>
  );
}
