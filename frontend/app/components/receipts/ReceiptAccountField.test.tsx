// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionRecord } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { transactionItem, walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { ReceiptAccountField } from './ReceiptAccountField';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet, put: apiPut } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const SCAN_STATEMENT = 'statement-scan';
const cash = walletItem({ id: 'wallet-cash', name: 'Cash' });

function record(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    ...transactionItem({ id: 'tx-1', statementId: SCAN_STATEMENT }),
    payeeId: null,
    payee: null,
    categorySource: null,
    splitGroupId: null,
    splitIndex: null,
    isDuplicate: false,
    ...overrides,
  };
}

function answer(row: TransactionRecord) {
  apiGet.mockImplementation(async (url: string) =>
    apiResponse(url === '/wallets' ? [cash] : row),
  );
}

describe('ReceiptAccountField', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
  });

  it("books the scan's own transaction to the picked account", async () => {
    answer(record());
    apiPut.mockResolvedValueOnce(apiResponse(record({ walletId: cash.id })));
    renderWithQuery(
      <ReceiptAccountField transactionId="tx-1" receiptStatementId={SCAN_STATEMENT} />,
    );

    selectOption(await screen.findByRole('combobox', { name: 'Account' }), 'Cash');

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/transactions/tx-1', { walletId: cash.id }),
    );
  });

  it('leaves a bank row alone: its statement already says which account', async () => {
    answer(record({ statementId: 'statement-bank' }));
    renderWithQuery(
      <ReceiptAccountField transactionId="tx-1" receiptStatementId={SCAN_STATEMENT} />,
    );

    // Long enough for both answers to land; the scan case above shows it within it.
    await expect(
      screen.findByRole('combobox', { name: 'Account' }, { timeout: 500 }),
    ).rejects.toThrow();
  });
});
