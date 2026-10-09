import { Between, In, IsNull } from 'typeorm';
import { PayableStatus } from '../../../../src/entities/payable.entity';
import { ReceiptStatus } from '../../../../src/entities/receipt.entity';
import { BankName, StatementStatus } from '../../../../src/entities/statement.entity';
import { TransactionType } from '../../../../src/entities/transaction.entity';
import { WorkspaceRole } from '../../../../src/entities/workspace-member.entity';
import { DashboardService } from '../../../../src/modules/dashboard/dashboard.service';

const createRepoMock = () =>
  ({
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  }) as any;

const createQueryBuilderMock = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue(result),
  getRawMany: jest.fn().mockResolvedValue(result),
  getCount: jest.fn().mockResolvedValue(result),
  getMany: jest.fn().mockResolvedValue(result),
});

const createExpectedWindow = (days: number, targetDate: string | Date) => {
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const since = new Date(endDate);
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  return { since, endDate };
};

const createExpectedMonthWindow = (targetDate: string | Date) => {
  const anchor = new Date(targetDate);
  const since = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { since, endDate };
};

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('DashboardService', () => {
  let service: DashboardService;
  const transactionRepo = createRepoMock();
  const statementRepo = createRepoMock();
  const payableRepo = createRepoMock();
  const walletRepo = createRepoMock();
  const receiptRepo = createRepoMock();
  const memberRepo = createRepoMock();
  const workspaceRepo = createRepoMock();
  const subscriptionRepo = createRepoMock();
  const exchangeRatesService = {
    getRate: jest.fn(),
    coverageForWorkspace: jest.fn(async () => []),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    workspaceRepo.findOne.mockResolvedValue({ currency: 'KZT' });
    exchangeRatesService.getRate.mockResolvedValue(1);
    service = new DashboardService(
      transactionRepo,
      statementRepo,
      payableRepo,
      receiptRepo,
      memberRepo,
      workspaceRepo,
      subscriptionRepo,
      exchangeRatesService as any,
    );
  });

  it('getDashboard returns correct shape with topMerchants and topCategories', async () => {
    const snapshot = {
      totalBalance: 1000,
      income30d: 200,
      expense30d: 50,
      netFlow30d: 150,
      totalPayable: 75,
      totalOverdue: 10,
      currency: 'USD',
    };
    const actions = [{ type: 'statements_pending_review', count: 2, label: '2', href: '/x' }];
    const cashFlow = [{ date: '2026-02-01', income: 100, expense: 40 }];
    const topMerchants = [{ name: 'Kaspi', amount: 50000, count: 10 }];
    const topCategories = [{ id: 'cat-1', name: 'Utilities', amount: 30000, count: 5 }];
    const recentTransactions = [
      {
        id: 'tx-1',
        description: 'Kaspi Zolotoy',
        amount: -5000,
        currency: 'USD',
        date: '2026-02-01',
        account: 'Kaspi •••• 4821',
        categoryId: 'cat-1',
        categoryName: 'Utilities',
        categoryColor: '#0584C7',
        categoryIcon: null,
      },
    ];
    const dataHealth = {
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 0,
      unapprovedCash: 0,
      lastUploadDate: null,
      parsingWarnings: 0,
    };

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue(snapshot);
    jest.spyOn(service as any, 'getActions').mockResolvedValue(actions);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue(cashFlow);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue(topMerchants);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue(topCategories);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue(recentTransactions);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('admin');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue(dataHealth);

    const result = await service.getDashboard('user-1', 'ws-1', '30d');

    expect(result).toEqual({
      snapshot,
      actions,
      cashFlow,
      topMerchants,
      topCategories,
      recentTransactions,
      role: 'admin',
      range: '30d',
      dataHealth,
    });
    expect((service as any).getSnapshot).toHaveBeenCalledWith(
      'ws-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect((service as any).getTopMerchants).toHaveBeenCalledWith(
      'ws-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect((service as any).getTopCategories).toHaveBeenCalledWith(
      'ws-1',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('getDashboard uses 7-day window for range=7d', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T12:00:00Z'));

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({} as any);
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    await service.getDashboard('user-1', 'ws-1', '7d');

    const snapshotCall = (service as any).getSnapshot.mock.calls[0];
    const expectedWindow = createExpectedWindow(7, '2026-03-19T12:00:00Z');
    expect(snapshotCall[1]).toEqual(expectedWindow.since);
    expect(snapshotCall[2]).toEqual(expectedWindow.endDate);

    jest.useRealTimers();
  });

  it('getDashboard uses 90-day window for range=90d', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T12:00:00Z'));

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({} as any);
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    await service.getDashboard('user-1', 'ws-1', '90d');

    const snapshotCall = (service as any).getSnapshot.mock.calls[0];
    const expectedWindow = createExpectedWindow(90, '2026-03-19T12:00:00Z');
    expect(snapshotCall[1]).toEqual(expectedWindow.since);
    expect(snapshotCall[2]).toEqual(expectedWindow.endDate);

    jest.useRealTimers();
  });

  it('getDashboard uses the calendar month window for range=month', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T12:00:00Z'));

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({} as any);
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    await service.getDashboard('user-1', 'ws-1', 'month');

    const snapshotCall = (service as any).getSnapshot.mock.calls[0];
    const expectedWindow = createExpectedMonthWindow('2026-03-19T12:00:00Z');
    expect(snapshotCall[1]).toEqual(expectedWindow.since);
    expect(snapshotCall[2]).toEqual(expectedWindow.endDate);

    // A calendar month is always under 90 days, so cash flow buckets stay daily.
    expect((service as any).getCashFlow).toHaveBeenCalledWith(
      'ws-1',
      expectedWindow.since,
      expectedWindow.endDate,
      31,
    );

    jest.useRealTimers();
  });

  it('getDashboard resolves an explicit date=YYYY-MM-DD to that date’s calendar month', async () => {
    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({} as any);
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    await service.getDashboard('user-1', 'ws-1', 'month', '2026-02-15');

    const snapshotCall = (service as any).getSnapshot.mock.calls[0];
    const expectedWindow = createExpectedMonthWindow('2026-02-15');
    expect(snapshotCall[1]).toEqual(expectedWindow.since);
    expect(snapshotCall[2]).toEqual(expectedWindow.endDate);
    expect((service as any).getCashFlow).toHaveBeenCalledWith(
      'ws-1',
      expectedWindow.since,
      expectedWindow.endDate,
      28,
    );
  });

  it('getDashboard auto-shifts to the latest transaction’s month when the current month is empty and no date is given', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T12:00:00Z'));

    const emptySnapshot = {
      totalBalance: 0,
      income30d: 0,
      expense30d: 0,
      netFlow30d: 0,
      totalPayable: 0,
      totalOverdue: 0,
      unapprovedCash: 0,
      currency: 'USD',
    };
    const shiftedSnapshot = { ...emptySnapshot, income30d: 200, expense30d: 50, netFlow30d: 150 };
    const latestTransactionDate = new Date('2026-01-10T08:30:00Z');

    jest
      .spyOn(service as any, 'getSnapshot')
      .mockResolvedValueOnce(emptySnapshot)
      .mockResolvedValueOnce(shiftedSnapshot);
    jest.spyOn(service as any, 'getLatestTransactionDate').mockResolvedValue(latestTransactionDate);
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    const result = await service.getDashboard('user-1', 'ws-1', 'month');

    const adjustedWindow = createExpectedMonthWindow(latestTransactionDate);
    expect((service as any).getSnapshot).toHaveBeenNthCalledWith(
      2,
      'ws-1',
      adjustedWindow.since,
      adjustedWindow.endDate,
    );
    expect(result).toMatchObject({
      snapshot: shiftedSnapshot,
      effectiveEndDate: formatDateOnly(adjustedWindow.endDate),
      effectiveSince: formatDateOnly(adjustedWindow.since),
    });

    jest.useRealTimers();
  });

  it('getDashboard does not auto-shift for range=month when an explicit date is provided', async () => {
    const emptySnapshot = {
      totalBalance: 0,
      income30d: 0,
      expense30d: 0,
      netFlow30d: 0,
      totalPayable: 0,
      totalOverdue: 0,
      unapprovedCash: 0,
      currency: 'USD',
    };

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue(emptySnapshot);
    jest
      .spyOn(service as any, 'getLatestTransactionDate')
      .mockResolvedValue(new Date('2026-01-10T08:30:00Z'));
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    const result = await service.getDashboard('user-1', 'ws-1', 'month', '2026-03-01');

    expect((service as any).getSnapshot).toHaveBeenCalledTimes(1);
    expect((service as any).getLatestTransactionDate).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('effectiveEndDate');
    expect(result).not.toHaveProperty('effectiveSince');
  });

  it('getDashboard auto-shifts to the latest transaction window when current window is empty', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T12:00:00Z'));

    const emptySnapshot = {
      totalBalance: 1000,
      income30d: 0,
      expense30d: 0,
      netFlow30d: 0,
      totalPayable: 75,
      totalOverdue: 10,
      unapprovedCash: 0,
      currency: 'USD',
    };
    const shiftedSnapshot = {
      ...emptySnapshot,
      income30d: 200,
      expense30d: 50,
      netFlow30d: 150,
    };
    const latestTransactionDate = new Date('2026-02-10T08:30:00Z');
    const cashFlow = [{ date: '2026-02-10', income: 200, expense: 50 }];
    const topMerchants = [{ name: 'Kaspi', amount: 50000, count: 10 }];
    const topCategories = [{ id: 'cat-1', name: 'Utilities', amount: 30000, count: 5 }];
    const recentTransactions: any[] = [];
    const dataHealth = {
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      unapprovedCash: 0,
      lastUploadDate: null,
      parsingWarnings: 0,
    };

    jest
      .spyOn(service as any, 'getSnapshot')
      .mockResolvedValueOnce(emptySnapshot)
      .mockResolvedValueOnce(shiftedSnapshot);
    jest.spyOn(service as any, 'getLatestTransactionDate').mockResolvedValue(latestTransactionDate);
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue(cashFlow);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue(topMerchants);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue(topCategories);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue(recentTransactions);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('admin');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue(dataHealth);

    const result = await service.getDashboard('user-1', 'ws-1', '30d');

    const requestedWindow = createExpectedWindow(30, '2026-03-19T12:00:00Z');
    const adjustedWindow = createExpectedWindow(30, latestTransactionDate);

    expect((service as any).getSnapshot).toHaveBeenNthCalledWith(
      1,
      'ws-1',
      requestedWindow.since,
      requestedWindow.endDate,
    );
    expect((service as any).getLatestTransactionDate).toHaveBeenCalledWith('ws-1');
    expect((service as any).getSnapshot).toHaveBeenNthCalledWith(
      2,
      'ws-1',
      adjustedWindow.since,
      adjustedWindow.endDate,
    );
    expect((service as any).getCashFlow).toHaveBeenCalledWith(
      'ws-1',
      adjustedWindow.since,
      adjustedWindow.endDate,
      30,
    );
    expect((service as any).getTopMerchants).toHaveBeenCalledWith(
      'ws-1',
      adjustedWindow.since,
      adjustedWindow.endDate,
    );
    expect((service as any).getTopCategories).toHaveBeenCalledWith(
      'ws-1',
      adjustedWindow.since,
      adjustedWindow.endDate,
    );
    expect(result).toMatchObject({
      snapshot: shiftedSnapshot,
      cashFlow,
      topMerchants,
      topCategories,
      effectiveEndDate: formatDateOnly(adjustedWindow.endDate),
      effectiveSince: formatDateOnly(adjustedWindow.since),
    });

    jest.useRealTimers();
  });

  it('getDashboard does not auto-shift when explicit end date is provided', async () => {
    const emptySnapshot = {
      totalBalance: 1000,
      income30d: 0,
      expense30d: 0,
      netFlow30d: 0,
      totalPayable: 75,
      totalOverdue: 10,
      unapprovedCash: 0,
      currency: 'USD',
    };

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue(emptySnapshot);
    jest
      .spyOn(service as any, 'getLatestTransactionDate')
      .mockResolvedValue(new Date('2026-02-10T08:30:00Z'));
    jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
    jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('admin');
    jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({} as any);

    const result = await service.getDashboard('user-1', 'ws-1', '30d', '2026-03-01');

    expect((service as any).getSnapshot).toHaveBeenCalledTimes(1);
    expect((service as any).getLatestTransactionDate).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('effectiveEndDate');
    expect(result).not.toHaveProperty('effectiveSince');
  });

  it('getSnapshot calculates totals correctly from transactions, not wallets', async () => {
    // txResult (period income/expense) then balanceResult (all-time balance)
    const txQb = createQueryBuilderMock([
      { currency: 'USD', income: '1200', expense: '200', unapprovedCash: '0' },
    ]);
    const balanceQb = createQueryBuilderMock([{ currency: 'USD', balance: '1500.5' }]);
    const payableQb = createQueryBuilderMock([
      { currency: 'USD', totalPayable: '300', totalOverdue: '50' },
    ]);

    transactionRepo.createQueryBuilder.mockReturnValueOnce(txQb).mockReturnValueOnce(balanceQb);
    payableRepo.createQueryBuilder.mockReturnValue(payableQb);
    workspaceRepo.findOne.mockResolvedValue({ currency: 'USD' });

    const result = await (service as any).getSnapshot(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    );

    expect(result).toEqual({
      totalBalance: 1500.5,
      income30d: 1200,
      expense30d: 200,
      netFlow30d: 1000,
      totalPayable: 300,
      totalOverdue: 50,
      unapprovedCash: 0,
      currency: 'USD',
      missingRates: [],
    });
    // walletRepo should NOT be used for balance computation
    expect(walletRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('getSnapshot counts only confirmed rows in income, expense and balance', async () => {
    const txQb = createQueryBuilderMock([
      { currency: 'USD', income: '0', expense: '0', unapprovedCash: '0' },
    ]);
    const balanceQb = createQueryBuilderMock([{ currency: 'USD', balance: '0' }]);
    transactionRepo.createQueryBuilder.mockReturnValueOnce(txQb).mockReturnValueOnce(balanceQb);
    payableRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));
    workspaceRepo.findOne.mockResolvedValue({ currency: 'USD' });

    await (service as any).getSnapshot('ws-1', new Date('2026-02-01'), new Date('2026-03-01'));

    const [columns] = txQb.select.mock.calls[0] as [string[]];
    const column = (alias: string) => columns.find(sql => sql.endsWith(alias)) ?? '';
    expect(column('AS income')).toContain('t.is_verified = true');
    expect(column('AS expense')).toContain('t.is_verified = true');
    // Unapproved cash measures what still waits, so it keeps the unconfirmed rows.
    expect(column('AS "unapprovedCash"')).not.toContain('is_verified');
    expect(balanceQb.andWhere).toHaveBeenCalledWith('t.isVerified = true');
  });

  it('counts uncategorised rows for data health whether or not they are confirmed', async () => {
    const query = createQueryBuilderMock(0);
    transactionRepo.createQueryBuilder.mockReturnValueOnce(query);

    await (service as any).getUncategorizedTransactionCount('ws-1', null);

    expect(query.andWhere).not.toHaveBeenCalledWith('t.isVerified = true');
    expect(query.andWhere).toHaveBeenCalledWith('t.categoryId IS NULL');
  });

  it('builds every trend and top list from confirmed rows only', () => {
    const query = createQueryBuilderMock([]);
    transactionRepo.createQueryBuilder.mockReturnValueOnce(query);

    (service as any).createTrendBaseQuery('ws-1', new Date('2026-02-01'), new Date('2026-03-01'));

    expect(query.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
    expect(query.andWhere).toHaveBeenCalledWith('t.isVerified = true');
  });

  it('getSnapshot converts grouped source currencies into the workspace currency', async () => {
    const txQb = createQueryBuilderMock([
      { currency: 'USD', income: '10', expense: '2', unapprovedCash: '1' },
      { currency: 'KZT', income: '1000', expense: '500', unapprovedCash: '0' },
    ]);
    const balanceQb = createQueryBuilderMock([
      { currency: 'USD', balance: '3' },
      { currency: 'KZT', balance: '700' },
    ]);
    const payableQb = createQueryBuilderMock([
      { currency: 'USD', totalPayable: '4', totalOverdue: '1' },
      { currency: 'KZT', totalPayable: '200', totalOverdue: '50' },
    ]);

    transactionRepo.createQueryBuilder.mockReturnValueOnce(txQb).mockReturnValueOnce(balanceQb);
    payableRepo.createQueryBuilder.mockReturnValue(payableQb);
    workspaceRepo.findOne.mockResolvedValue({ currency: 'KZT' });
    exchangeRatesService.getRate.mockResolvedValue(500);

    const result = await (service as any).getSnapshot(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    );

    expect(result).toMatchObject({
      totalBalance: 2200,
      income30d: 6000,
      expense30d: 1500,
      netFlow30d: 4500,
      totalPayable: 2200,
      totalOverdue: 550,
      unapprovedCash: 500,
      currency: 'KZT',
    });
    expect(exchangeRatesService.getRate).toHaveBeenCalledWith('USD', 'KZT', undefined, 'ws-1');
  });

  it('getSnapshot excludes error and processing statements from period totals', async () => {
    const txQb = createQueryBuilderMock([
      { currency: 'USD', income: '1200', expense: '200', unapprovedCash: '0' },
    ]);
    const balanceQb = createQueryBuilderMock([{ currency: 'USD', balance: '1500.5' }]);
    const payableQb = createQueryBuilderMock([
      { currency: 'USD', totalPayable: '300', totalOverdue: '50' },
    ]);

    transactionRepo.createQueryBuilder.mockReturnValueOnce(txQb).mockReturnValueOnce(balanceQb);
    payableRepo.createQueryBuilder.mockReturnValue(payableQb);
    workspaceRepo.findOne.mockResolvedValue({ currency: 'USD' });

    await (service as any).getSnapshot('ws-1', new Date('2026-02-01'), new Date('2026-03-01'));

    expect(txQb.andWhere).toHaveBeenCalledWith('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
  });

  it('getSnapshot excludes duplicate transactions from period totals and total balance', async () => {
    const txQb = createQueryBuilderMock([
      { currency: 'USD', income: '1200', expense: '200', unapprovedCash: '0' },
    ]);
    const balanceQb = createQueryBuilderMock([{ currency: 'USD', balance: '1500.5' }]);
    const payableQb = createQueryBuilderMock([
      { currency: 'USD', totalPayable: '300', totalOverdue: '50' },
    ]);

    transactionRepo.createQueryBuilder.mockReturnValueOnce(txQb).mockReturnValueOnce(balanceQb);
    payableRepo.createQueryBuilder.mockReturnValue(payableQb);
    workspaceRepo.findOne.mockResolvedValue({ currency: 'USD' });

    await (service as any).getSnapshot('ws-1', new Date('2026-02-01'), new Date('2026-03-01'));

    expect(txQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
    expect(balanceQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
  });

  it('applyActiveStatementTransactionFilters applies the shared workspace and date filters', () => {
    const qb = createQueryBuilderMock([]);
    const since = new Date('2026-02-01T00:00:00Z');
    const endDate = new Date('2026-03-01T23:59:59Z');

    (service as any).applyActiveStatementTransactionFilters(qb, 'ws-1', since, endDate);

    expect(qb.where).toHaveBeenCalledWith('s.workspaceId = :workspaceId', { workspaceId: 'ws-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('t.transactionDate BETWEEN :since AND :endDate', {
      since,
      endDate,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('s.deletedAt IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
    expect(qb.andWhere).toHaveBeenCalledWith('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
  });

  it('getActions returns only non-zero action items', async () => {
    statementRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    payableRepo.count.mockResolvedValueOnce(0);
    const uncategorizedQb = createQueryBuilderMock(2);
    const uncategorizedReceiptQb = createQueryBuilderMock(1);
    transactionRepo.createQueryBuilder.mockReturnValue(uncategorizedQb);
    receiptRepo.createQueryBuilder.mockReturnValue(uncategorizedReceiptQb);
    receiptRepo.count.mockResolvedValueOnce(1);

    const result = await (service as any).getActions('user-1', 'ws-1');

    const types = result.map((item: any) => item.type);
    expect(types).toEqual([
      'statements_pending_review',
      'transactions_uncategorized',
      'receipts_pending_review',
    ]);
    expect(result).toHaveLength(3);
    expect(result.find((item: any) => item.type === 'transactions_uncategorized')).toMatchObject({
      href: '/statements/submit?categoryId=uncategorized',
    });
    expect(result.find((item: any) => item.type === 'receipts_pending_review')).toMatchObject({
      href: '/statements/submit?status=needs_review',
    });
  });

  it('getActions links overdue payments to the overdue payables filter', async () => {
    statementRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    payableRepo.count.mockResolvedValueOnce(2);
    const uncategorizedQb = createQueryBuilderMock(0);
    const uncategorizedReceiptQb = createQueryBuilderMock(0);
    transactionRepo.createQueryBuilder.mockReturnValue(uncategorizedQb);
    receiptRepo.createQueryBuilder.mockReturnValue(uncategorizedReceiptQb);
    receiptRepo.count.mockResolvedValueOnce(0);

    const result = await (service as any).getActions('user-1', 'ws-1');

    expect(result).toEqual([
      expect.objectContaining({
        type: 'payments_overdue',
        href: '/statements/pay?status=overdue',
      }),
    ]);
  });

  it('getCashFlow groups by date for 30d range', async () => {
    const rows = [
      { date: '2026-02-01', currency: 'KZT', income: '100', expense: '50' },
      { date: '2026-02-02', currency: 'KZT', income: '0', expense: '25' },
    ];
    const cashFlowQb = createQueryBuilderMock(rows);
    transactionRepo.createQueryBuilder.mockReturnValue(cashFlowQb);

    const result = await (service as any).getCashFlow(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-02-03'),
      30,
    );

    expect(result).toEqual([
      { date: '2026-02-01', income: 100, expense: 50 },
      { date: '2026-02-02', income: 0, expense: 25 },
      { date: '2026-02-03', income: 0, expense: 0 },
    ]);
    expect(cashFlowQb.andWhere).toHaveBeenCalledWith('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
    expect(cashFlowQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
  });

  it('getCashFlow groups by week for 90d range', async () => {
    const rows = [
      { date: '2026-05', currency: 'KZT', income: '500', expense: '200' },
      { date: '2026-06', currency: 'KZT', income: '300', expense: '100' },
    ];
    const cashFlowQb = createQueryBuilderMock(rows);
    transactionRepo.createQueryBuilder.mockReturnValue(cashFlowQb);

    const result = await (service as any).getCashFlow(
      'ws-1',
      new Date('2026-01-27'),
      new Date('2026-02-09'),
      90,
    );

    // Verify the query builder was called (weekly grouping used IYYY-IW format)
    expect(cashFlowQb.select).toHaveBeenCalledWith("TO_CHAR(t.transactionDate, 'IYYY-IW')", 'date');
    expect(result).toEqual([
      { date: '2026-05', income: 500, expense: 200 },
      { date: '2026-06', income: 300, expense: 100 },
      { date: '2026-07', income: 0, expense: 0 },
    ]);
  });

  it('getTransactionGroupFormat switches to weekly buckets for 90-day ranges', () => {
    expect((service as any).getTransactionGroupFormat(30)).toBe("'YYYY-MM-DD'");
    expect((service as any).getTransactionGroupFormat(90)).toBe("'IYYY-IW'");
  });

  it('getTopMerchants returns top 5 expense merchants sorted by amount', async () => {
    const rows = [
      { name: 'Kaspi', currency: 'KZT', amount: '50000', count: '10' },
      { name: 'Halyk', currency: 'KZT', amount: '30000', count: '5' },
    ];
    const qb = createQueryBuilderMock(rows);
    transactionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await (service as any).getTopMerchants(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    );

    expect(result).toEqual([
      { name: 'Kaspi', amount: 50000, count: 10 },
      { name: 'Halyk', amount: 30000, count: 5 },
    ]);
    expect(qb.limit).not.toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
  });

  it('getTopCategories returns categories sorted by amount, with color, icon and percent', async () => {
    const rows = [
      {
        id: 'cat-1',
        name: 'Utilities',
        color: '#0584C7',
        icon: '/uploads/utilities.png',
        currency: 'KZT',
        amount: '40000',
        count: '8',
      },
      { id: null, name: null, color: null, icon: null, currency: 'KZT', amount: '15000', count: '3' },
    ];
    const qb = createQueryBuilderMock(rows);
    transactionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await (service as any).getTopCategories(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    );

    expect(result).toEqual([
      {
        id: 'cat-1',
        name: 'Utilities',
        color: '#0584C7',
        icon: '/uploads/utilities.png',
        amount: 40000,
        count: 8,
        percent: 72.73,
      },
      {
        id: null,
        name: null,
        color: '#898781',
        icon: null,
        amount: 15000,
        count: 3,
        percent: 27.27,
      },
    ]);
    expect(qb.limit).not.toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
  });

  it('getTopCategories folds a category with no spend out of the results entirely', async () => {
    const qb = createQueryBuilderMock([]);
    transactionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await (service as any).getTopCategories(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    );

    expect(result).toEqual([]);
  });

  it('getTopCategories collapses categories past the top 8 into a single Other bucket, with percentages summing to exactly 100', async () => {
    // 9 categories, amounts 900..100 (descending), each on its own currency row
    // to also exercise the per-currency aggregation path.
    const rows = Array.from({ length: 9 }, (_, i) => ({
      id: `cat-${i + 1}`,
      name: `Category ${i + 1}`,
      color: `#00000${i}`,
      icon: null,
      currency: 'KZT',
      amount: String(900 - i * 100),
      count: '1',
    }));
    const qb = createQueryBuilderMock(rows);
    transactionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await (service as any).getTopCategories(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    );

    expect(result).toHaveLength(9);
    const other = result[8];
    expect(other).toMatchObject({
      id: null,
      name: null,
      isOther: true,
      color: '#898781',
      icon: null,
      amount: 100,
      count: 1,
    });
    // The 9th category (amount 100) is the only one folded in.
    const totalPercent = result.reduce((sum: number, row: any) => sum + row.percent, 0);
    expect(totalPercent).toBeCloseTo(100, 2);
    expect(result.slice(0, 8).every((row: any) => row.isOther === undefined)).toBe(true);
  });

  it('getLatestTransactionDate returns the latest valid transaction date', async () => {
    const latestTransactionDate = new Date('2026-02-10T08:30:00Z');
    const qb = createQueryBuilderMock({ latestTransactionDate });
    transactionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await (service as any).getLatestTransactionDate('ws-1');

    expect(result).toEqual(latestTransactionDate);
    expect(qb.andWhere).toHaveBeenCalledWith('s.deletedAt IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
  });

  it('getRecentTransactions returns signed amounts and a masked bank/account label', async () => {
    const rows = [
      {
        id: 'tx-income',
        description: 'Salary',
        debit: null,
        credit: '150000',
        transactionType: TransactionType.INCOME,
        currency: 'KZT',
        date: '2026-02-10',
        categoryId: 'cat-1',
        categoryName: 'Salary',
        categoryColor: '#10b981',
        categoryIcon: null,
        bankName: BankName.KASPI,
        accountNumber: 'KZ1234567890124821',
      },
      {
        id: 'tx-expense',
        description: 'Grocery Store',
        debit: '5000',
        credit: null,
        transactionType: TransactionType.EXPENSE,
        currency: 'KZT',
        date: '2026-02-09',
        categoryId: null,
        categoryName: null,
        categoryColor: null,
        categoryIcon: null,
        bankName: BankName.OTHER,
        accountNumber: null,
      },
    ];
    const qb = createQueryBuilderMock(rows);
    transactionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await (service as any).getRecentTransactions(
      'ws-1',
      new Date('2026-02-01'),
      new Date('2026-02-28'),
    );

    expect(qb.limit).toHaveBeenCalledWith(6);
    expect(result).toEqual([
      {
        id: 'tx-income',
        description: 'Salary',
        amount: 150000,
        currency: 'KZT',
        date: '2026-02-10',
        account: 'Kaspi •••• 4821',
        categoryId: 'cat-1',
        categoryName: 'Salary',
        categoryColor: '#10b981',
        categoryIcon: null,
      },
      {
        id: 'tx-expense',
        description: 'Grocery Store',
        amount: -5000,
        currency: 'KZT',
        date: '2026-02-09',
        account: 'Bank',
        categoryId: null,
        categoryName: null,
        categoryColor: '#898781',
        categoryIcon: null,
      },
    ]);
  });

  it('getMemberRole returns correct role', async () => {
    memberRepo.findOne.mockResolvedValue({ role: WorkspaceRole.ADMIN });
    const adminRole = await (service as any).getMemberRole('user-1', 'ws-1');
    expect(adminRole).toBe('admin');

    memberRepo.findOne.mockResolvedValue(null);
    const defaultRole = await (service as any).getMemberRole('user-1', 'ws-1');
    expect(defaultRole).toBe('member');
  });

  it('getTrends auto-shifts to the latest transaction window when current window has no rows', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T12:00:00Z'));

    jest
      .spyOn(service as any, 'getLatestTransactionDate')
      .mockResolvedValue(new Date('2026-02-10T08:30:00Z'));

    transactionRepo.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilderMock([]))
      .mockReturnValueOnce(createQueryBuilderMock([]))
      .mockReturnValueOnce(createQueryBuilderMock([]))
      .mockReturnValueOnce(createQueryBuilderMock({ income: '0', expense: '0', rows: '0' }))
      .mockReturnValueOnce(
        createQueryBuilderMock([{ date: '2026-02-10', income: '100', expense: '40' }]),
      )
      .mockReturnValueOnce(
        createQueryBuilderMock([{ name: 'Utilities', amount: '40', count: '1' }]),
      )
      .mockReturnValueOnce(
        createQueryBuilderMock([{ name: 'Client A', amount: '100', count: '1' }]),
      )
      .mockReturnValueOnce(createQueryBuilderMock({ income: '100', expense: '40', rows: '2' }))
      .mockReturnValueOnce(createQueryBuilderMock([]));

    const result = await service.getTrends('ws-1', 30);
    const adjustedWindow = createExpectedWindow(30, '2026-02-10T08:30:00Z');

    expect((service as any).getLatestTransactionDate).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({
      dailyTrend: expect.arrayContaining([{ date: '2026-02-10', income: 100, expense: 40 }]),
      forecast: [],
      categories: [{ name: 'Utilities', amount: 40, count: 1 }],
      counterparties: [{ name: 'Client A', amount: 100, count: 1 }],
      sources: {
        statements: {
          income: 100,
          expense: 40,
          rows: 2,
        },
      },
      effectiveEndDate: formatDateOnly(adjustedWindow.endDate),
      effectiveSince: formatDateOnly(adjustedWindow.since),
    });
    expect(result.dailyTrend).toHaveLength(31);
    expect(result.dailyTrend[0]).toEqual({ date: '2026-01-11', income: 0, expense: 0 });

    jest.useRealTimers();
  });

  it('getTrendData excludes duplicate transactions from all aggregate queries', async () => {
    const dailyQb = createQueryBuilderMock([]);
    const categoryQb = createQueryBuilderMock([]);
    const counterpartyQb = createQueryBuilderMock([]);
    const sourceQb = createQueryBuilderMock({ income: '0', expense: '0', rows: '0' });

    transactionRepo.createQueryBuilder
      .mockReturnValueOnce(dailyQb)
      .mockReturnValueOnce(categoryQb)
      .mockReturnValueOnce(counterpartyQb)
      .mockReturnValueOnce(sourceQb);

    await (service as any).getTrendData('ws-1', new Date('2026-02-01'), new Date('2026-03-01'), 30);

    expect(dailyQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
    expect(categoryQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
    expect(counterpartyQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
    expect(sourceQb.andWhere).toHaveBeenCalledWith('t.isDuplicate = false');
  });

  it('getDataHealth counts pending review and parsing warnings from actual statement conditions', async () => {
    const warningsQb = createQueryBuilderMock(4);
    const uncategorizedReceiptQb = createQueryBuilderMock(4);

    transactionRepo.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilderMock(2))
      .mockReturnValueOnce(createQueryBuilderMock({ unapprovedCash: '0' }));
    receiptRepo.createQueryBuilder.mockReturnValue(uncategorizedReceiptQb);
    statementRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    receiptRepo.count.mockResolvedValueOnce(5);
    statementRepo.findOne.mockResolvedValue({ createdAt: new Date('2026-03-17T00:00:00Z') });
    statementRepo.createQueryBuilder.mockReturnValue(warningsQb);

    const result = await (service as any).getDataHealth('ws-1');

    expect(result).toMatchObject({
      uncategorizedTransactions: 6,
      statementsWithErrors: 1,
      statementsPendingReview: 3,
      statementsPendingSubmit: 2,
      receiptsPendingReview: 5,
      parsingWarnings: 4,
    });
    expect(statementRepo.count).toHaveBeenNthCalledWith(2, {
      where: {
        workspaceId: 'ws-1',
        status: In([StatementStatus.PARSED, StatementStatus.VALIDATED]),
        deletedAt: IsNull(),
      },
    });
    expect(statementRepo.count).toHaveBeenNthCalledWith(3, {
      where: {
        workspaceId: 'ws-1',
        status: StatementStatus.UPLOADED,
        deletedAt: IsNull(),
      },
    });
    expect(receiptRepo.count).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws-1',
        status: In([ReceiptStatus.NEW, ReceiptStatus.NEEDS_REVIEW]),
      },
    });
    expect(uncategorizedReceiptQb.andWhere).toHaveBeenCalledWith(
      "NULLIF(TRIM(r.parsed_data->>'amount'), '') IS NOT NULL",
    );
    expect(uncategorizedReceiptQb.andWhere).toHaveBeenCalledWith(
      "NULLIF(r.parsed_data ->> 'categoryId', '') IS NULL",
    );
    expect(uncategorizedReceiptQb.andWhere).toHaveBeenCalledWith('rt.category_id IS NULL');
    expect(warningsQb.andWhere).toHaveBeenCalledWith(
      "jsonb_array_length(COALESCE(s.parsing_details->'warnings', '[]'::jsonb)) > 0",
    );
  });
  describe('getCommitments', () => {
    const commitmentDay = (offset: number) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      return date;
    };

    const primeBalance = (balance: string) => {
      transactionRepo.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock([{ currency: 'KZT', balance }]),
      );
    };

    it('pulls overdue payables to today and keeps undated ones off the curve', async () => {
      primeBalance('1000');
      payableRepo.find.mockResolvedValue([
        { id: 'p-overdue', vendor: 'Late Co', amount: '300', currency: 'KZT', dueDate: formatDateOnly(commitmentDay(-5)) },
        { id: 'p-soon', vendor: 'Soon Co', amount: '500', currency: 'KZT', dueDate: formatDateOnly(commitmentDay(3)) },
        { id: 'p-undated', vendor: 'No Date Co', amount: '700', currency: 'KZT', dueDate: null },
      ]);
      subscriptionRepo.find.mockResolvedValue([]);

      const result = await service.getCommitments('ws-1', 10);

      expect(result.openingBalance).toBe(1000);
      expect(result.horizonDays).toBe(10);
      expect(result.days).toHaveLength(10);
      // The overdue payable is still owed, so it lands on day zero rather than in the past.
      expect(result.items[0]).toMatchObject({
        sourceId: 'p-overdue',
        date: formatDateOnly(commitmentDay(0)),
        isOverdue: true,
      });
      expect(result.unscheduledCommitted).toBe(700);
      expect(result.totalCommitted).toBe(800);
      expect(result.days[0].balance).toBe(700);
      expect(result.days[3].balance).toBe(200);
      expect(result.lowestBalance).toBe(200);
      expect(result.shortfallDate).toBeNull();
    });

    it('counts what is left of a partly paid bill', async () => {
      primeBalance('1000');
      payableRepo.find.mockResolvedValue([
        { id: 'p-part', vendor: 'Part Co', amount: '500', paidAmount: '200', currency: 'KZT', dueDate: formatDateOnly(commitmentDay(2)) },
        { id: 'p-settled', vendor: 'Settled Co', amount: '100', paidAmount: '100', currency: 'KZT', dueDate: formatDateOnly(commitmentDay(2)) },
      ]);
      subscriptionRepo.find.mockResolvedValue([]);

      const result = await service.getCommitments('ws-1', 10);

      expect(payableRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({
              _value: expect.arrayContaining([PayableStatus.PARTIALLY_PAID]),
            }),
          }),
        }),
      );
      expect(result.items).toEqual([expect.objectContaining({ sourceId: 'p-part', amount: 300 })]);
    });

    it('projects monthly subscriptions with month-end clamping and flags the shortfall', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15));
      try {
        primeBalance('250');
        payableRepo.find.mockResolvedValue([]);
        subscriptionRepo.find.mockResolvedValue([
          {
            id: 'sub-1',
            vendorName: 'Hosting',
            amount: '100',
            currency: 'KZT',
            frequency: 'monthly',
            nextChargeDate: '2025-12-31',
          },
        ]);

        const result = await service.getCommitments('ws-1', 90);

        // A stale next-charge date rolls forward; Jan 31 + 1 month clamps to Feb 28.
        expect(result.items.map(item => item.date)).toEqual([
          '2026-01-31',
          '2026-02-28',
          '2026-03-28',
        ]);
        expect(result.totalCommitted).toBe(300);
        expect(result.shortfallDate).toBe('2026-03-28');
        expect(result.lowestBalance).toBe(-50);
      } finally {
        jest.useRealTimers();
      }
    });

    it('clamps an absurd horizon instead of projecting a decade of days', async () => {
      primeBalance('0');
      payableRepo.find.mockResolvedValue([]);
      subscriptionRepo.find.mockResolvedValue([]);

      const result = await service.getCommitments('ws-1', 10_000);

      expect(result.horizonDays).toBe(365);
      expect(result.days).toHaveLength(365);
    });
  });

  describe('getMonthlyCashFlow', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-03-15T12:00:00'), doNotFake: ['nextTick'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('zero-fills every month of the 12m window and converts currencies', async () => {
      const qb = createQueryBuilderMock([
        { date: '2026-01', currency: 'KZT', income: '1000', expense: '400' },
        { date: '2026-01', currency: 'USD', income: '10', expense: '0' },
        { date: '2025-06', currency: 'KZT', income: '0', expense: '250.5' },
      ]);
      transactionRepo.createQueryBuilder.mockReturnValue(qb);
      exchangeRatesService.getRate.mockResolvedValue(500);

      const result = await service.getMonthlyCashFlow('ws-1', '12m');

      expect(qb.where).toHaveBeenCalledWith('s.workspaceId = :workspaceId', {
        workspaceId: 'ws-1',
      });
      expect(result.currency).toBe('KZT');
      expect(result.since).toBe('2025-04-01');
      expect(result.endDate).toBe('2026-03-31');
      expect(result.points).toHaveLength(12);
      expect(result.points[0]).toEqual({ month: '2025-04', income: 0, expense: 0, net: 0 });
      expect(result.points.find(point => point.month === '2026-01')).toEqual({
        month: '2026-01',
        income: 6000,
        expense: 400,
        net: 5600,
      });
      expect(result.totals).toEqual({ income: 6000, expense: 650.5, net: 5349.5 });
    });

    it('ends the window at a picked month instead of the current one', async () => {
      const qb = createQueryBuilderMock([
        { date: '2025-06', currency: 'KZT', income: '300', expense: '100' },
      ]);
      transactionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMonthlyCashFlow('ws-1', '12m', '2025-06');

      expect(result.since).toBe('2024-07-01');
      expect(result.endDate).toBe('2025-06-30');
      expect(result.points).toHaveLength(12);
      expect(result.points.at(-1)).toEqual({
        month: '2025-06',
        income: 300,
        expense: 100,
        net: 200,
      });
    });

    it('returns no points when the window has no transactions', async () => {
      transactionRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      const result = await service.getMonthlyCashFlow('ws-1', 'this_year');

      expect(result.points).toEqual([]);
      expect(result.totals).toEqual({ income: 0, expense: 0, net: 0 });
    });

    it('starts all-time at the earliest transaction month', async () => {
      const earliestQb = createQueryBuilderMock({ earliestTransactionDate: '2025-11-20' });
      const sumsQb = createQueryBuilderMock([
        { date: '2025-12', currency: 'KZT', income: '100', expense: '0' },
      ]);
      transactionRepo.createQueryBuilder.mockReturnValueOnce(earliestQb).mockReturnValue(sumsQb);

      const result = await service.getMonthlyCashFlow('ws-1', 'all');

      expect(result.points.map(point => point.month)).toEqual([
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
        '2026-03',
      ]);
    });

    it('returns an empty response for all-time when the workspace has no transactions (no sums query)', async () => {
      const earliestQb = createQueryBuilderMock({ earliestTransactionDate: null });
      transactionRepo.createQueryBuilder.mockReturnValue(earliestQb);

      const result = await service.getMonthlyCashFlow('ws-1', 'all');

      expect(result).toEqual({
        range: 'all',
        currency: 'KZT',
        since: null,
        endDate: null,
        totals: { income: 0, expense: 0, net: 0 },
        points: [],
      });
      expect(earliestQb.getRawMany).not.toHaveBeenCalled();
    });
  });

  describe('month-scoped queues', () => {
    const july = {
      since: new Date(2026, 6, 1),
      endDate: new Date(2026, 6, 31, 23, 59, 59, 999),
    };

    const primeDataHealth = () => {
      const uncategorizedTxQb = createQueryBuilderMock(3);
      const unapprovedQb = createQueryBuilderMock({ unapprovedCash: '10' });
      const receiptQb = createQueryBuilderMock(1);
      const warningsQb = createQueryBuilderMock(2);
      transactionRepo.createQueryBuilder
        .mockReturnValueOnce(uncategorizedTxQb)
        .mockReturnValueOnce(unapprovedQb);
      receiptRepo.createQueryBuilder.mockReturnValue(receiptQb);
      statementRepo.createQueryBuilder.mockReturnValue(warningsQb);
      statementRepo.count.mockResolvedValue(0);
      receiptRepo.count.mockResolvedValue(0);
      statementRepo.findOne.mockResolvedValue({ createdAt: new Date('2026-08-02T10:00:00Z') });
      return { uncategorizedTxQb, unapprovedQb, receiptQb, warningsQb };
    };

    it('getDataHealth counts only items dated inside the picked month', async () => {
      const { uncategorizedTxQb, unapprovedQb, receiptQb, warningsQb } = primeDataHealth();
      const inJuly = [
        'BETWEEN :windowSince AND :windowEnd',
        { windowSince: july.since, windowEnd: july.endDate },
      ];

      const result = await (service as any).getDataHealth('ws-1', july);

      expect(statementRepo.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ createdAt: Between(july.since, july.endDate) }),
      });
      expect(receiptRepo.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ receivedAt: Between(july.since, july.endDate) }),
      });
      expect(uncategorizedTxQb.andWhere).toHaveBeenCalledWith(`t.transactionDate ${inJuly[0]}`, inJuly[1]);
      expect(unapprovedQb.andWhere).toHaveBeenCalledWith(`t.transactionDate ${inJuly[0]}`, inJuly[1]);
      expect(receiptQb.andWhere).toHaveBeenCalledWith(`r.receivedAt ${inJuly[0]}`, inJuly[1]);
      expect(warningsQb.andWhere).toHaveBeenCalledWith(`s.createdAt ${inJuly[0]}`, inJuly[1]);
      // The "never uploaded" empty state must not depend on the picked month.
      expect(statementRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: 'ws-1', deletedAt: IsNull() } }),
      );
      expect(result).toMatchObject({ uncategorizedTransactions: 4, parsingWarnings: 2 });
    });

    it('getDataHealth without a window keeps live all-time totals', async () => {
      const { uncategorizedTxQb } = primeDataHealth();

      await (service as any).getDataHealth('ws-1', null);

      expect(statementRepo.count).not.toHaveBeenCalledWith({
        where: expect.objectContaining({ createdAt: expect.anything() }),
      });
      expect(uncategorizedTxQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('BETWEEN :windowSince'),
        expect.anything(),
      );
    });

    it('getDashboard scopes queues to the month only in month mode', async () => {
      jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({ income30d: 1, expense30d: 0 });
      jest.spyOn(service as any, 'getMemberRole').mockResolvedValue('member');
      jest.spyOn(service as any, 'getCashFlow').mockResolvedValue([]);
      jest.spyOn(service as any, 'getTopMerchants').mockResolvedValue([]);
      jest.spyOn(service as any, 'getTopCategories').mockResolvedValue([]);
      jest.spyOn(service as any, 'getRecentTransactions').mockResolvedValue([]);
      const actions = jest.spyOn(service as any, 'getActions').mockResolvedValue([]);
      const health = jest.spyOn(service as any, 'getDataHealth').mockResolvedValue({});

      await service.getDashboard('user-1', 'ws-1', 'month', '2026-07-01');
      const expected = createExpectedMonthWindow('2026-07-01T00:00:00');
      expect(actions).toHaveBeenLastCalledWith('user-1', 'ws-1', expected);
      expect(health).toHaveBeenLastCalledWith('ws-1', expected);

      await service.getDashboard('user-1', 'ws-1', '30d', '2026-07-15');
      expect(actions).toHaveBeenLastCalledWith('user-1', 'ws-1', null);
      expect(health).toHaveBeenLastCalledWith('ws-1', null);
    });
  });

  describe('getTrends for a picked month', () => {
    const trendRows = {
      dailyRows: [{ date: '2026-02-10', income: '100', expense: '40' }],
      categoryRows: [{ name: 'Utilities', amount: '40', count: '1' }],
      counterpartyRows: [],
      sourceRows: { income: '100', expense: '40', rows: '2' },
    };

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-03-19T12:00:00'), doNotFake: ['nextTick'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('uses the whole past month, never auto-shifts and has no forecast', async () => {
      const trendData = jest.spyOn(service as any, 'getTrendData').mockResolvedValue(trendRows);
      const forecast = jest.spyOn(service as any, 'computeForecast');
      const latest = jest.spyOn(service as any, 'getLatestTransactionDate');

      const result = await service.getTrends('ws-1', 30, '2026-02');

      expect(trendData).toHaveBeenCalledWith(
        'ws-1',
        new Date(2026, 1, 1),
        new Date(2026, 1, 28, 23, 59, 59, 999),
        28,
      );
      expect(result.dailyTrend).toHaveLength(28);
      expect(result.dailyTrend[9]).toEqual({ date: '2026-02-10', income: 100, expense: 40 });
      expect(result.forecast).toEqual([]);
      expect(result.effectiveSince).toBeUndefined();
      expect(forecast).not.toHaveBeenCalled();
      expect(latest).not.toHaveBeenCalled();
    });

    it('stops the current month at today and forecasts ahead', async () => {
      const trendData = jest.spyOn(service as any, 'getTrendData').mockResolvedValue({
        ...trendRows,
        dailyRows: [{ date: '2026-03-02', income: '100', expense: '40' }],
      });
      jest
        .spyOn(service as any, 'computeForecast')
        .mockResolvedValue([{ date: '2026-03-20', income: 1, expense: 1 }]);

      const result = await service.getTrends('ws-1', 30, '2026-03');

      expect(trendData).toHaveBeenCalledWith(
        'ws-1',
        new Date(2026, 2, 1),
        new Date(2026, 2, 19, 23, 59, 59, 999),
        31,
      );
      expect(result.dailyTrend).toHaveLength(19);
      expect(result.forecast).toEqual([{ date: '2026-03-20', income: 1, expense: 1 }]);
    });
  });

  describe('getHealthHistory', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-03-15T12:00:00'), doNotFake: ['nextTick'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('zero-fills January to the current month and folds every queue into its month', async () => {
      transactionRepo.createQueryBuilder.mockReturnValueOnce(
        createQueryBuilderMock([{ month: '2026-02', total: '10', uncategorized: '3' }]),
      );
      receiptRepo.createQueryBuilder
        .mockReturnValueOnce(createQueryBuilderMock([{ month: '2026-02', count: '1' }]))
        .mockReturnValueOnce(createQueryBuilderMock([{ month: '2026-03', count: '2' }]));
      statementRepo.createQueryBuilder
        .mockReturnValueOnce(
          createQueryBuilderMock([
            { month: '2026-01', status: StatementStatus.ERROR, count: '1' },
            { month: '2026-01', status: StatementStatus.PARSED, count: '2' },
            { month: '2026-02', status: StatementStatus.UPLOADED, count: '1' },
            { month: '2026-02', status: StatementStatus.COMPLETED, count: '5' },
          ]),
        )
        .mockReturnValueOnce(createQueryBuilderMock([{ month: '2026-01', count: '1' }]));
      payableRepo.createQueryBuilder.mockReturnValueOnce(
        createQueryBuilderMock([
          { month: '2026-03', count: '4' },
          { month: '2026-04', count: '9' },
        ]),
      );

      const result = await service.getHealthHistory('ws-1', 2026);

      const zero = {
        transactions: 0,
        uncategorized: 0,
        statementsUploaded: 0,
        statementErrors: 0,
        statementsPendingReview: 0,
        statementsPendingSubmit: 0,
        parsingWarnings: 0,
        receiptsPendingReview: 0,
        overduePayments: 0,
      };
      expect(result).toEqual({
        year: 2026,
        months: [
          {
            ...zero,
            month: '2026-01',
            statementsUploaded: 3,
            statementErrors: 1,
            statementsPendingReview: 2,
            parsingWarnings: 1,
          },
          {
            ...zero,
            month: '2026-02',
            transactions: 10,
            uncategorized: 4,
            statementsUploaded: 6,
            statementsPendingSubmit: 1,
          },
          { ...zero, month: '2026-03', receiptsPendingReview: 2, overduePayments: 4 },
        ],
      });
    });

    it('returns no months for a future year without querying', async () => {
      const result = await service.getHealthHistory('ws-1', 2027);

      expect(result).toEqual({ year: 2027, months: [] });
      expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
