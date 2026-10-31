import type { Transaction } from '@/entities/transaction.entity';
import { cloneForSplit } from '@/modules/transactions/helpers/transaction-split-clone';

describe('cloneForSplit', () => {
  it('hands the payment type to every part', () => {
    const source = { workspaceId: 'ws-1', paymentType: 'card' } as Transaction;

    expect(cloneForSplit(source).paymentType).toBe('card');
  });

  it('keeps an empty payment type empty', () => {
    const source = { workspaceId: 'ws-1', paymentType: null } as Transaction;

    expect(cloneForSplit(source).paymentType).toBeNull();
  });
});
