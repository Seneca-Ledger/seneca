import { TransactionType } from '@/entities/transaction.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { ReportsService } from '@/modules/reports/reports.service';

const createQueryBuilderMock = (transactions: any[]) => {
  const queryBuilder = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(transactions),
  };

  return queryBuilder;
};

describe('ReportsService top categories report', () => {
  it('aggregates categories, banks, and counterparties', async () => {
    const transactions = [
      {
        id: 'tx-1',
        amount: '1200',
        transactionType: TransactionType.EXPENSE,
        counterpartyName: 'Anthropic',
        transactionDate: new Date('2026-02-01T00:00:00Z'),
        category: { id: 'cat-1', name: 'Software' },
        statement: { bankName: 'Kaspi' },
      },
      {
        id: 'tx-2',
        amount: '800',
        transactionType: TransactionType.EXPENSE,
        counterpartyName: 'GitHub',
        transactionDate: new Date('2026-02-02T00:00:00Z'),
        category: { id: 'cat-1', name: 'Software' },
        statement: { bankName: 'Kaspi' },
      },
      {
        id: 'tx-3',
        amount: '500',
        transactionType: TransactionType.INCOME,
        counterpartyName: 'Client A',
        transactionDate: new Date('2026-02-03T00:00:00Z'),
        category: { id: 'cat-2', name: 'Sales' },
        statement: { bankName: 'Bereke' },
      },
    ];

    const queryBuilder = createQueryBuilderMock(transactions);
    const transactionRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    const service = new ReportsService(
      transactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: vi.fn(), set: vi.fn() } as any,
      { createEvent: vi.fn() } as AuditService,
      { findOne: vi.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: vi.fn(async () => 1) } as any,
      { exportBalanceSheet: vi.fn() } as any,
    );

    const result = await service.getTopCategoriesReport('ws-1', {
      limit: 10,
      type: 'all',
    } as any);

    expect(result.categories[0]).toMatchObject({
      name: 'Software',
      amount: 2000,
      transactions: 2,
    });
    expect(result.banks[0]).toMatchObject({
      bankName: 'Kaspi',
      amount: 2000,
      statements: 2,
    });
    expect(result.counterparties[0]).toMatchObject({
      name: 'Anthropic',
      amount: 1200,
    });
    expect(result.totals).toMatchObject({
      income: 500,
      expense: 2000,
      transactions: 3,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });
  });
});
