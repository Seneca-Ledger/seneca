// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATEMENT_FILTERS } from '@/app/(main)/statements/components/filters/statement-filters';
import type { ReceiptDocument, Transaction } from '@/app/(main)/statements/types/statement-types';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ userFallback: { value: 'User' } }),
}));

import { useSpendOverTimeRecords } from './useSpendOverTimeRecords';

describe('useSpendOverTimeRecords links', () => {
  it('opens a scan’s transaction on its receipt, not on the scan’s statement', () => {
    const transaction = {
      id: 'tx-1',
      statementId: 'st-scan',
      debit: 3.73,
      credit: null,
      transactionType: 'expense',
      transactionDate: '2026-10-12',
      counterpartyName: 'grizzlysms.com',
    } as unknown as Transaction;
    const receipt = {
      id: 'rc-1',
      source: 'scan',
      transactionId: 'tx-1',
      status: 'approved',
      receivedAt: '2026-10-12T10:00:00.000Z',
      parsedData: { amount: 3.73, currency: 'USD', vendor: 'grizzlysms.com', date: '2026-10-12' },
    } as unknown as ReceiptDocument;

    const { result } = renderHook(() =>
      useSpendOverTimeRecords({
        statements: [{ id: 'st-scan', status: 'completed' }] as never,
        transactions: [transaction],
        receipts: [receipt],
        workspaceCurrency: 'USD',
        appliedFilters: DEFAULT_STATEMENT_FILTERS,
        searchInput: '',
        activeFlowType: 'expense',
      }),
    );

    // One spend, not two, and it links to the receipt page.
    expect(result.current.allRecords.map(record => [record.id, record.href])).toEqual([
      ['tx-1', '/storage/receipts/rc-1'],
    ]);
  });
});
