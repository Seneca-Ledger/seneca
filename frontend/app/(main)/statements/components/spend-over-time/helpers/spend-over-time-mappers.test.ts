import { describe, expect, it } from 'vitest';
import type {
  ReceiptDocument,
  StatementMeta,
  Transaction,
} from '@/app/(main)/statements/types/statement-types';
import {
  mapReceiptToSpendRecord,
  mapTransactionToSpendRecord,
} from './spend-over-time-mappers';

const receipt = (source: string): ReceiptDocument =>
  ({
    id: 'rc-1',
    source,
    subject: 'grizzlysms.com',
    sender: 'scan',
    status: 'approved',
    receivedAt: '2026-10-12T10:00:00.000Z',
    parsedData: { amount: 3.73, currency: 'USD', vendor: 'grizzlysms.com', date: '2026-10-12' },
  }) as unknown as ReceiptDocument;

describe('spend record links', () => {
  it('opens a receipt of any source on its receipt page', () => {
    expect(mapReceiptToSpendRecord(receipt('scan'), 'USD')?.href).toBe(
      '/storage/receipts/rc-1',
    );
    expect(mapReceiptToSpendRecord(receipt('imap'), 'USD')?.href).toBe(
      '/storage/receipts/rc-1',
    );
  });

  it('opens a bank row in its statement, by the Documents list rule', () => {
    const tx = {
      id: 'tx-1',
      statementId: 'st-1',
      debit: 25,
      credit: null,
      transactionType: 'expense',
      transactionDate: '2026-10-04',
      counterpartyName: 'Hosting',
    } as unknown as Transaction;
    const parsed = { id: 'st-1', status: 'completed' } as unknown as StatementMeta;
    const uploaded = { id: 'st-1', status: 'uploaded' } as unknown as StatementMeta;

    expect(mapTransactionToSpendRecord(tx, parsed, 'USD')?.href).toBe('/statements/st-1/edit');
    expect(mapTransactionToSpendRecord(tx, uploaded, 'USD')?.href).toBe('/storage/st-1');
  });
});
