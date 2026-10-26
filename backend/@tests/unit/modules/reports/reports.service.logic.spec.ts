import { AuditService } from '@/modules/audit/audit.service';
import { ReportsService } from '@/modules/reports/reports.service';
import { ReportGroupBy } from '@/modules/reports/dto/custom-report.dto';
import { TransactionType } from '@/entities/transaction.entity';

function createRepoMock() {
  return {} as any;
}

/** Builds a minimal ReportsService with the given transaction repo mock. */
function makeService(
  transactionRepo: any = createRepoMock(),
  cacheManager: any = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
) {
  return new ReportsService(
    transactionRepo,
    createRepoMock(), // category
    createRepoMock(), // branch
    createRepoMock(), // wallet
    createRepoMock(), // customTable
    createRepoMock(), // customTableColumn
    createRepoMock(), // customTableRow
    createRepoMock(), // user
    cacheManager,
    { createEvent: vi.fn() } as unknown as AuditService,
    createRepoMock(), // reportHistory
      { findOne: vi.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: vi.fn(async () => 1) } as any,
      { exportBalanceSheet: vi.fn() } as any,
  );
}

/** Creates a fluent QueryBuilder mock. */
function createQbMock(getMany: () => Promise<any[]> = async () => [], extra: Record<string, any> = {}) {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockImplementation(getMany),
    getRawMany: vi.fn().mockResolvedValue([]),
    getRawOne: vi.fn().mockResolvedValue(null),
    ...extra,
  };
  return qb;
}

const WS_ID = 'ws-abc';

// ---------------------------------------------------------------------------
// getLatestTransactionDate
// ---------------------------------------------------------------------------
describe('ReportsService — getLatestTransactionDate', () => {
  it('returns null when no transactions exist', async () => {
    const qb = createQbMock(async () => [], { getRawOne: vi.fn().mockResolvedValue(null) });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = makeService(transactionRepo);

    const result = await service.getLatestTransactionDate(WS_ID);

    expect(result).toBeNull();
  });

  it('returns YYYY-MM-DD string when a transaction exists', async () => {
    const transactionDate = new Date('2025-06-15T12:30:00.000Z');
    const qb = createQbMock(async () => [], {
      getRawOne: vi.fn().mockResolvedValue({ transactionDate }),
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = makeService(transactionRepo);

    const result = await service.getLatestTransactionDate(WS_ID);

    expect(result).toBe('2025-06-15');
  });

  it('returns null when getRawOne resolves with transactionDate undefined', async () => {
    const qb = createQbMock(async () => [], {
      getRawOne: vi.fn().mockResolvedValue({ transactionDate: undefined }),
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = makeService(transactionRepo);

    const result = await service.getLatestTransactionDate(WS_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLatestTransactionPeriod
// ---------------------------------------------------------------------------
describe('ReportsService — getLatestTransactionPeriod', () => {
  it('returns nulls when no transactions exist', async () => {
    const qb = createQbMock(async () => [], { getRawOne: vi.fn().mockResolvedValue(null) });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = makeService(transactionRepo);

    const result = await service.getLatestTransactionPeriod(WS_ID);

    expect(result).toEqual({ date: null, year: null, month: null });
  });

  it('returns date, year and 1-based month for a known date', async () => {
    const qb = createQbMock(async () => [], {
      getRawOne: vi.fn().mockResolvedValue({ transactionDate: new Date('2025-03-20') }),
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = makeService(transactionRepo);

    const result = await service.getLatestTransactionPeriod(WS_ID);

    expect(result.date).toBe('2025-03-20');
    expect(result.year).toBe(2025);
    expect(result.month).toBe(3); // March is month 3 (1-based)
  });
});

// ---------------------------------------------------------------------------
// generateDailyReport
// ---------------------------------------------------------------------------
describe('ReportsService — generateDailyReport', () => {
  it('returns cached value immediately without querying DB', async () => {
    const cached = { date: '2025-01-10', income: {}, expense: {}, summary: {} };
    const cacheManager = {
      get: vi.fn().mockResolvedValue(cached),
      set: vi.fn(),
    };
    const transactionRepo = { createQueryBuilder: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateDailyReport(WS_ID, '2025-01-10');

    expect(result).toBe(cached);
    expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns correct income/expense totals for a given day', async () => {
    const income1 = {
      id: '1',
      amount: 5000,
      transactionType: TransactionType.INCOME,
      transactionDate: new Date('2025-01-10'),
      counterpartyName: 'Halyk',
      category: null,
      categoryId: null,
    };
    const expense1 = {
      id: '2',
      amount: 2000,
      transactionType: TransactionType.EXPENSE,
      transactionDate: new Date('2025-01-10'),
      counterpartyName: 'Vendor A',
      category: { name: 'Food' },
      categoryId: 'cat-food',
    };

    let callCount = 0;
    const qb = createQbMock(async () => {
      callCount++;
      // First call = income query, second = expense query
      return callCount === 1 ? [income1] : [expense1];
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateDailyReport(WS_ID, '2025-01-10');

    expect(result.income.totalAmount).toBe(5000);
    expect(result.income.transactionCount).toBe(1);
    expect(result.expense.totalAmount).toBe(2000);
    expect(result.expense.transactionCount).toBe(1);
    expect(result.summary.incomeTotal).toBe(5000);
    expect(result.summary.expenseTotal).toBe(2000);
    expect(result.summary.difference).toBe(3000);
  });

  it('returns zero totals when no transactions for the day', async () => {
    const qb = createQbMock(async () => []);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateDailyReport(WS_ID, '2025-01-10');

    expect(result.income.totalAmount).toBe(0);
    expect(result.expense.totalAmount).toBe(0);
    expect(result.summary.difference).toBe(0);
  });

  it('aggregates multiple income transactions into topCounterparties', async () => {
    const tx = (cp: string, amount: number) => ({
      id: cp,
      amount,
      transactionType: TransactionType.INCOME,
      transactionDate: new Date('2025-01-10'),
      counterpartyName: cp,
      category: null,
      categoryId: null,
    });

    let callCount = 0;
    const qb = createQbMock(async () => {
      callCount++;
      return callCount === 1
        ? [tx('Alpha', 3000), tx('Beta', 1000), tx('Alpha', 2000)] // income
        : []; // expense
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateDailyReport(WS_ID, '2025-01-10');

    expect(result.income.topCounterparties[0].name).toBe('Alpha');
    expect(result.income.topCounterparties[0].amount).toBe(5000);
    expect(result.income.topCounterparties[0].count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// generateMonthlyReport
// ---------------------------------------------------------------------------
describe('ReportsService — generateMonthlyReport', () => {
  it('returns cached value without querying DB', async () => {
    const cached = { month: '3', year: 2025, dailyTrends: [], categoryDistribution: [], counterpartyDistribution: [], comparison: {}, summary: {} };
    const cacheManager = {
      get: vi.fn().mockResolvedValue(cached),
      set: vi.fn(),
    };
    const transactionRepo = { createQueryBuilder: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateMonthlyReport(WS_ID, 2025, 3);

    expect(result).toBe(cached);
    expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('computes summary totals for the current and previous month', async () => {
    const makeTx = (type: TransactionType, amount: number, dateStr: string) => ({
      id: `${type}-${amount}`,
      amount,
      transactionType: type,
      transactionDate: new Date(dateStr),
      counterpartyName: 'CP',
      category: null,
      categoryId: null,
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    });

    let callCount = 0;
    const qb = createQbMock(async () => {
      callCount++;
      if (callCount === 1) {
        // Current month: 8000 income, 3000 expense
        return [
          makeTx(TransactionType.INCOME, 8000, '2025-03-10'),
          makeTx(TransactionType.EXPENSE, 3000, '2025-03-12'),
        ];
      }
      // Previous month: 5000 income, 2000 expense
      return [
        makeTx(TransactionType.INCOME, 5000, '2025-02-10'),
        makeTx(TransactionType.EXPENSE, 2000, '2025-02-15'),
      ];
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateMonthlyReport(WS_ID, 2025, 3);

    expect(result.summary.totalIncome).toBe(8000);
    expect(result.summary.totalExpense).toBe(3000);
    expect(result.summary.difference).toBe(5000);
    expect(result.comparison.currentPeriod.income).toBe(8000);
    expect(result.comparison.previousPeriod.income).toBe(5000);
    expect(result.comparison.change.incomeChange).toBe(3000);
  });

  it('builds dailyTrends with one entry per transaction date', async () => {
    const tx = (type: TransactionType, amount: number, dateStr: string) => ({
      id: dateStr + type,
      amount,
      transactionType: type,
      transactionDate: new Date(dateStr),
      counterpartyName: 'X',
      category: null,
      categoryId: null,
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    });

    let callCount = 0;
    const qb = createQbMock(async () => {
      callCount++;
      return callCount === 1
        ? [
            tx(TransactionType.INCOME, 1000, '2025-03-05'),
            tx(TransactionType.EXPENSE, 500, '2025-03-05'),
            tx(TransactionType.INCOME, 300, '2025-03-07'),
          ]
        : [];
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateMonthlyReport(WS_ID, 2025, 3);

    expect(result.dailyTrends).toHaveLength(2);
    const march5 = result.dailyTrends.find((d: any) => d.date === '2025-03-05');
    expect(march5?.income).toBe(1000);
    expect(march5?.expense).toBe(500);
  });

  it('computes category distribution percentages', async () => {
    const tx = (catId: string, catName: string, amount: number) => ({
      id: catId,
      amount,
      transactionType: TransactionType.EXPENSE,
      transactionDate: new Date('2025-03-10'),
      counterpartyName: 'V',
      category: { name: catName },
      categoryId: catId,
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    });

    let callCount = 0;
    const qb = createQbMock(async () => {
      callCount++;
      return callCount === 1
        ? [tx('cat-a', 'Food', 750), tx('cat-b', 'Transport', 250)]
        : [];
    });
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateMonthlyReport(WS_ID, 2025, 3);

    const food = result.categoryDistribution.find((c: any) => c.categoryId === 'cat-a');
    const transport = result.categoryDistribution.find((c: any) => c.categoryId === 'cat-b');
    expect(food?.percentage).toBeCloseTo(75);
    expect(transport?.percentage).toBeCloseTo(25);
  });
});

// ---------------------------------------------------------------------------
// generateCustomReport
// ---------------------------------------------------------------------------
describe('ReportsService — generateCustomReport', () => {
  const baseDto = {
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
    groupBy: ReportGroupBy.DAY,
  };

  it('returns empty groups and zero summary when no transactions', async () => {
    const qb = createQbMock(async () => []);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateCustomReport(WS_ID, baseDto as any);

    expect(result.groups).toHaveLength(0);
    expect(result.summary.totalIncome).toBe(0);
    expect(result.summary.totalExpense).toBe(0);
    expect(result.summary.difference).toBe(0);
    expect(result.summary.transactionCount).toBe(0);
  });

  it('groups transactions by day and aggregates amounts', async () => {
    const makeTx = (dateStr: string, amount: number, type: TransactionType) => ({
      id: `${dateStr}-${amount}`,
      amount,
      transactionType: type,
      transactionDate: new Date(dateStr),
      counterpartyName: 'CP',
      category: null,
      categoryId: null,
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    });

    const qb = createQbMock(async () => [
      makeTx('2025-01-10', 1000, TransactionType.INCOME),
      makeTx('2025-01-10', 2000, TransactionType.INCOME),
      makeTx('2025-01-11', 500, TransactionType.EXPENSE),
    ]);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateCustomReport(WS_ID, baseDto as any);

    expect(result.groups).toHaveLength(2);
    const jan10 = result.groups.find((g: any) => g.key === '2025-01-10');
    expect(jan10?.totalAmount).toBe(3000);
    expect(jan10?.transactionCount).toBe(2);
    expect(result.summary.totalIncome).toBe(3000);
    expect(result.summary.totalExpense).toBe(500);
    expect(result.summary.difference).toBe(2500);
    expect(result.summary.transactionCount).toBe(3);
  });

  it('groups by CATEGORY when groupBy is CATEGORY', async () => {
    const tx = {
      id: 'tx-1',
      amount: 1500,
      transactionType: TransactionType.EXPENSE,
      transactionDate: new Date('2025-01-05'),
      counterpartyName: 'Shop',
      category: { name: 'Food' },
      categoryId: 'cat-food',
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    };

    const qb = createQbMock(async () => [tx]);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateCustomReport(WS_ID, {
      ...baseDto,
      groupBy: ReportGroupBy.CATEGORY,
    } as any);

    expect(result.groups[0].key).toBe('cat-food');
    expect(result.groups[0].label).toBe('Food');
  });

  it('groups by COUNTERPARTY when groupBy is COUNTERPARTY', async () => {
    const tx = {
      id: 'tx-1',
      amount: 2000,
      transactionType: TransactionType.INCOME,
      transactionDate: new Date('2025-01-15'),
      counterpartyName: 'Acme Corp',
      category: null,
      categoryId: null,
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    };

    const qb = createQbMock(async () => [tx]);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateCustomReport(WS_ID, {
      ...baseDto,
      groupBy: ReportGroupBy.COUNTERPARTY,
    } as any);

    expect(result.groups[0].key).toBe('Acme Corp');
    expect(result.groups[0].label).toBe('Acme Corp');
  });

  it('applies optional categoryId filter to the query', async () => {
    const qb = createQbMock(async () => []);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    await service.generateCustomReport(WS_ID, {
      ...baseDto,
      categoryId: 'cat-123',
    } as any);

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('categoryId'),
      expect.objectContaining({ categoryId: 'cat-123' }),
    );
  });

  it('sorts groups by totalAmount descending', async () => {
    const makeTx = (dateStr: string, amount: number) => ({
      id: dateStr,
      amount,
      transactionType: TransactionType.INCOME,
      transactionDate: new Date(dateStr),
      counterpartyName: 'X',
      category: null,
      categoryId: null,
      branch: null,
      branchId: null,
      wallet: null,
      walletId: null,
    });

    const qb = createQbMock(async () => [
      makeTx('2025-01-03', 100),
      makeTx('2025-01-01', 9000),
      makeTx('2025-01-02', 500),
    ]);
    const transactionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const service = makeService(transactionRepo, cacheManager);

    const result = await service.generateCustomReport(WS_ID, baseDto as any);

    expect(result.groups[0].totalAmount).toBe(9000);
    expect(result.groups[1].totalAmount).toBe(500);
    expect(result.groups[2].totalAmount).toBe(100);
  });
});
