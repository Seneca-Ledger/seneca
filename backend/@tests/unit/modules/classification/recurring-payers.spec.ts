import type { Transaction } from '@/entities/transaction.entity';
import { recurringBusinessPayers } from '@/modules/classification/suggestions/recurring-payers';

const monthly = (name: string, amount: number) =>
  ['2026-01-25', '2026-02-25', '2026-03-25', '2026-04-24'].map(date => ({
    counterpartyName: name,
    amount,
    credit: amount,
    transactionDate: date,
  }));

const repo = (history: unknown[]) => {
  const query = {
    select: () => query,
    where: () => query,
    andWhere: () => query,
    getMany: async () => history,
  };
  return { createQueryBuilder: () => query } as never;
};

const statementRow = {
  transactionType: 'income',
  transactionDate: '2026-04-24',
} as unknown as Transaction;

describe('recurringBusinessPayers', () => {
  it('finds a business that pays much the same every month, and no person', async () => {
    const payers = await recurringBusinessPayers(
      repo([...monthly('EXAMPLE LOGISTICS LIMITED', 1200), ...monthly('Member One', 300)]),
      'ws-1',
      [statementRow],
    );

    expect([...payers]).toEqual(['example logistics limited']);
  });

  it('reads an old statement as of its own last day', async () => {
    const payers = await recurringBusinessPayers(
      repo(monthly('EXAMPLE LOGISTICS LIMITED', 1200)),
      'ws-1',
      [statementRow],
    );

    expect(payers.has('example logistics limited')).toBe(true);
  });

  it('looks for nothing when the statement has no income', async () => {
    const payers = await recurringBusinessPayers(repo([]), 'ws-1', [
      { ...statementRow, transactionType: 'expense' } as Transaction,
    ]);

    expect(payers.size).toBe(0);
  });
});
