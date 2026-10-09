import * as fs from 'fs';
import * as path from 'path';
import type { CustomTableColumn } from '@/entities';
import { CustomTableColumnType } from '@/entities/custom-table-column.entity';
import { WorkspaceExportFormat } from '@/modules/reports/dto/workspace-export.dto';
import { AuditService } from '@/modules/audit/audit.service';
import { ReportsService } from '@/modules/reports/reports.service';
import { BadRequestException } from '@nestjs/common';

function createRepoMock() {
  return {} as any;
}

describe('ReportsService (helpers)', () => {
  let service: ReportsService;

  beforeEach(() => {
    service = new ReportsService(
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      createRepoMock() as any,
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );
  });

  it('parseNumber handles spaces and comma decimals', () => {
    const parseNumber = (service as any).parseNumber.bind(service) as (v: unknown) => number | null;
    expect(parseNumber(' 1 234,50 ')).toBe(1234.5);
    expect(parseNumber('not-a-number')).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });

  it('parseDate supports YYYY-MM-DD and DD.MM.YYYY', () => {
    const parseDate = (service as any).parseDate.bind(service) as (v: unknown) => Date | null;
    expect(parseDate('2025-01-02')?.toISOString()).toContain('2025-01-02');
    expect(parseDate('2.1.2025')?.toISOString()).toContain('2025-01-02');
    expect(parseDate('bad')).toBeNull();
  });

  it('toDateKey normalizes date-ish inputs', () => {
    const toDateKey = (service as any).toDateKey.bind(service) as (v: unknown) => string;
    expect(toDateKey('2025-01-02T10:00:00.000Z')).toBe('2025-01-02');
    expect(toDateKey(new Date('2025-01-02T00:00:00.000Z'))).toBe('2025-01-02');
  });

  it('pickBestColumnKey chooses best match based on scorer', () => {
    const pickBestColumnKey = (service as any).pickBestColumnKey.bind(service) as (
      cols: CustomTableColumn[],
      scorer: (c: CustomTableColumn) => number,
    ) => string | null;
    const scoreAmount = (service as any).scoreAmountColumn.bind(service) as (
      c: CustomTableColumn,
    ) => number;

    const columns = [
      { key: 'a', title: 'Дата', type: CustomTableColumnType.DATE } as any,
      { key: 'b', title: 'Сумма', type: CustomTableColumnType.NUMBER } as any,
      { key: 'c', title: 'Год', type: CustomTableColumnType.NUMBER } as any,
    ] as CustomTableColumn[];

    expect(pickBestColumnKey(columns, scoreAmount)).toBe('b');
  });

  it('getSpendOverTimeReport fills empty periods', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => [
        { period: '2025-01-01', income: '100', expense: '0', count: '1' },
        { period: '2025-01-03', income: '0', expense: '20', count: '1' },
      ]),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const localService = new ReportsService(
      transactionRepository as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      createRepoMock() as any,
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    const result = await (localService as any).getSpendOverTimeReport('ws-1', {
      groupBy: 'day',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-03',
    });

    expect(qb.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });

    expect(result.points).toHaveLength(3);
    expect(result.points[1]).toEqual({
      period: '2025-01-02',
      label: '2025-01-02',
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
    });
    expect(result.totals.income).toBe(100);
    expect(result.totals.expense).toBe(20);
    expect(result.totals.net).toBe(80);
    expect(result.totals.count).toBe(2);
    expect(result.totals.avgPerPeriod).toBeCloseTo(80 / 3, 5);
  });

  it('getSpendOverTimeReport supports quarterly grouping', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => [
        { period: '2025-Q1', income: '100', expense: '40', count: '2' },
      ]),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const localService = new ReportsService(
      transactionRepository as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      createRepoMock() as any,
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    const result = await (localService as any).getSpendOverTimeReport('ws-1', {
      groupBy: 'quarter',
      dateFrom: '2025-01-01',
      dateTo: '2025-06-30',
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual({
      period: '2025-Q1',
      label: 'Q1 2025',
      income: 100,
      expense: 40,
      net: 60,
      count: 2,
    });
    expect(result.points[1]).toEqual({
      period: '2025-Q2',
      label: 'Q2 2025',
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
    });
  });

  it('getSpendOverTimeReport supports yearly grouping', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => [
        { period: '2025', income: '250', expense: '150', count: '3' },
      ]),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const localService = new ReportsService(
      transactionRepository as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      createRepoMock() as any,
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    const result = await (localService as any).getSpendOverTimeReport('ws-1', {
      groupBy: 'year',
      dateFrom: '2025-01-01',
      dateTo: '2026-12-31',
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual({
      period: '2025',
      label: '2025',
      income: 250,
      expense: 150,
      net: 100,
      count: 3,
    });
    expect(result.points[1]).toEqual({
      period: '2026',
      label: '2026',
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
    });
  });
});

describe('generateFromTemplate', () => {
  let mockTransactionRepository: any;
  let mockReportHistoryRepo: any;
  let mockWorkspaceRepository: any;
  let mockExchangeRates: any;
  let mockBalanceService: any;
  let service: ReportsService;
  const written: string[] = [];

  function generate(dto: any) {
    return service.generateFromTemplate('ws1', 'user1', dto);
  }

  beforeEach(() => {
    mockTransactionRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockReportHistoryRepo = {
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };
    mockWorkspaceRepository = {
      findOne: jest.fn(async () => ({ currency: 'EUR' })),
    };
    mockExchangeRates = { getRate: jest.fn(async () => 2) };
    mockBalanceService = {
      exportBalanceSheet: jest.fn(async () => ({
        fileName: 'balance-sheet-2024-01-31.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('balance'),
      })),
    };

    service = new ReportsService(
      mockTransactionRepository as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      mockReportHistoryRepo as any,
      mockWorkspaceRepository as any,
      mockExchangeRates as any,
      mockBalanceService as any,
    );
  });

  afterEach(() => {
    for (const filePath of written.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  function track(filePath: string): string {
    written.push(filePath);
    return filePath;
  }

  it('should throw for unknown template', async () => {
    await expect(
      generate({
        templateId: 'unknown',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        format: 'excel',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('getCustomTablesSummary scopes tables by workspaceId', async () => {
    const customTableRepository = {
      find: jest.fn(async () => []),
    };

    const localService = new ReportsService(
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      customTableRepository as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      createRepoMock() as any,
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    await localService.getCustomTablesSummary('ws-1', { days: 30, tableIds: [] } as any);

    expect(customTableRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws-1' }),
      }),
    );
  });

  it('should generate P&L as excel', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      { amount: 5000, transactionType: 'income', currency: 'EUR', category: { name: 'Sales' } },
      { amount: 2000, transactionType: 'expense', currency: 'EUR', category: { name: 'Rent' } },
    ]);

    const result = await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'excel',
    });

    expect(result.contentType).toContain('spreadsheet');
    expect(fs.existsSync(track(result.filePath))).toBe(true);
  });

  it('should generate P&L as csv', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      { amount: 3000, transactionType: 'income', currency: 'EUR', category: { name: 'Services' } },
    ]);

    const result = await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'csv',
    });

    expect(result.contentType).toBe('text/csv');
    expect(result.fileName).toMatch(/\.csv$/);
    expect(fs.readFileSync(track(result.filePath), 'utf-8')).toContain('NET INCOME');
  });

  it('quotes category names containing a comma in csv', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      {
        amount: 100,
        transactionType: 'expense',
        currency: 'EUR',
        category: { name: 'Food, drinks' },
      },
    ]);

    const result = await generate({
      templateId: 'expense-by-category',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'csv',
    });

    expect(fs.readFileSync(track(result.filePath), 'utf-8')).toContain('"Food, drinks"');
  });

  it('converts foreign-currency amounts into the workspace currency', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      { amount: 100, transactionType: 'income', currency: 'EUR', category: { name: 'Sales' } },
      { amount: 100, transactionType: 'income', currency: 'USD', category: { name: 'Sales' } },
    ]);

    const result = await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'csv',
    });

    // EUR is the workspace currency (rate 1), USD is converted at the mocked rate of 2.
    expect(mockExchangeRates.getRate).toHaveBeenCalledWith('USD', 'EUR', undefined, 'ws1');
    expect(mockExchangeRates.getRate).not.toHaveBeenCalledWith('EUR', 'EUR');
    expect(fs.readFileSync(track(result.filePath), 'utf-8')).toContain('NET INCOME,300');
  });

  it('scopes the query when wallet and category filters are set', async () => {
    mockTransactionRepository.find.mockResolvedValue([]);

    await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'csv',
      walletIds: ['11111111-1111-4111-8111-111111111111'],
      categoryIds: ['22222222-2222-4222-8222-222222222222'],
    });

    // Both alternatives (no statement / statement not trashed) carry the filters.
    for (const where of mockTransactionRepository.find.mock.calls[0][0].where) {
      expect(where.walletId).toBeDefined();
      expect(where.categoryId).toBeDefined();
    }
  });

  it('omits the filter keys entirely when the arrays are empty', async () => {
    mockTransactionRepository.find.mockResolvedValue([]);

    await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'csv',
      walletIds: [],
      categoryIds: [],
    });

    // `In([])` would render as `IN ()` and silently match nothing.
    const where = mockTransactionRepository.find.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('walletId');
    expect(where).not.toHaveProperty('categoryId');
  });

  it('should generate P&L as pdf', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      { amount: 5000, transactionType: 'income', currency: 'EUR', category: { name: 'Sales' } },
    ]);

    const result = await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'pdf',
    });

    expect(result.contentType).toBe('application/pdf');
    expect(fs.readFileSync(track(result.filePath)).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('keeps the generated file so History can download it later', async () => {
    mockTransactionRepository.find.mockResolvedValue([]);

    const result = await generate({
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'csv',
    });

    // The regression this guards: the file used to be written to the OS temp dir
    // and unlinked as soon as the response stream ended, so History always 404'd.
    expect(result.filePath).toContain(`${path.sep}reports${path.sep}`);
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(mockReportHistoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        userId: 'user1',
        templateId: 'pnl',
        filePath: result.filePath,
      }),
    );
    track(result.filePath);
  });

  it('should generate Cash Flow as excel', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      {
        amount: 5000,
        transactionType: 'income',
        currency: 'EUR',
        transactionDate: new Date('2024-01-15'),
        category: null,
      },
      {
        amount: 2000,
        transactionType: 'expense',
        currency: 'EUR',
        transactionDate: new Date('2024-01-15'),
        category: null,
      },
    ]);

    const result = await generate({
      templateId: 'cash-flow',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'excel',
    });

    expect(result.contentType).toContain('spreadsheet');
    expect(fs.existsSync(track(result.filePath))).toBe(true);
  });

  it('buckets Cash Flow by the requested period', async () => {
    // Two days in the same ISO week (Mon 2024-01-15, Wed 2024-01-17) plus one the week after.
    mockTransactionRepository.find.mockResolvedValue([
      {
        amount: 10,
        transactionType: 'income',
        currency: 'EUR',
        transactionDate: new Date('2024-01-15T00:00:00.000Z'),
        category: null,
      },
      {
        amount: 5,
        transactionType: 'income',
        currency: 'EUR',
        transactionDate: new Date('2024-01-17T00:00:00.000Z'),
        category: null,
      },
      {
        amount: 7,
        transactionType: 'income',
        currency: 'EUR',
        transactionDate: new Date('2024-01-23T00:00:00.000Z'),
        category: null,
      },
    ]);

    const result = await generate({
      templateId: 'cash-flow',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'csv',
      groupBy: 'week',
    });

    const csv = fs.readFileSync(track(result.filePath), 'utf-8');
    expect(csv).toContain('Week of,Income,Expense,Net');
    expect(csv).toContain('2024-01-15,15,0,15');
    expect(csv).toContain('2024-01-22,7,0,7');
  });

  it('should generate Expense by Category as excel', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      {
        amount: 3000,
        transactionType: 'expense',
        currency: 'EUR',
        transactionDate: new Date('2024-01-15'),
        category: { name: 'Marketing' },
      },
      {
        amount: 1500,
        transactionType: 'expense',
        currency: 'EUR',
        transactionDate: new Date('2024-01-20'),
        category: { name: 'Rent' },
      },
    ]);

    const result = await generate({
      templateId: 'expense-by-category',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'excel',
    });

    expect(result.contentType).toContain('spreadsheet');
    expect(fs.existsSync(track(result.filePath))).toBe(true);
  });

  it('lists every transaction with both amounts in the register', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      {
        amount: 100,
        transactionType: 'expense',
        currency: 'USD',
        counterpartyName: 'Acme',
        transactionDate: new Date('2024-01-20T00:00:00.000Z'),
        category: { name: 'Software' },
      },
      {
        amount: 40,
        transactionType: 'income',
        currency: 'EUR',
        counterpartyName: 'Client',
        transactionDate: new Date('2024-01-10T00:00:00.000Z'),
        category: { name: 'Sales' },
      },
    ]);

    const result = await generate({
      templateId: 'transaction-register',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'csv',
    });

    const lines = fs.readFileSync(track(result.filePath), 'utf-8').split('\n');
    // The subtitle also starts with a date, so match the leading date cell instead.
    const dataLines = lines.filter(line => /^\d{4}-\d{2}-\d{2},/.test(line));

    // Sorted by date, expenses signed negative, USD converted at the mocked rate of 2.
    expect(dataLines[0]).toBe('2024-01-10,Client,Sales,Income,40,40 EUR');
    expect(dataLines[1]).toBe('2024-01-20,Acme,Software,Expense,-200,100 USD');
    expect(lines.some(line => line.startsWith('TOTAL,,,2 rows,-160,'))).toBe(true);
  });

  it('summarises totals and top categories in the monthly summary', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      { amount: 1000, transactionType: 'income', currency: 'EUR', category: { name: 'Sales' } },
      { amount: 300, transactionType: 'expense', currency: 'EUR', category: { name: 'Rent' } },
      { amount: 100, transactionType: 'expense', currency: 'EUR', category: { name: 'Food' } },
    ]);

    const result = await generate({
      templateId: 'monthly-summary',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'csv',
    });

    const csv = fs.readFileSync(track(result.filePath), 'utf-8');
    expect(csv).toContain('Income,1000');
    expect(csv).toContain('Expenses,400');
    // (1000 - 400) / 1000
    expect(csv).toContain('"Savings rate, %",60');
    // Top categories are ordered by size, largest first.
    expect(csv.indexOf('Rent,300')).toBeLessThan(csv.indexOf('Food,100'));
    expect(csv).toContain('NET,600');
  });

  it('delegates Balance Sheet to BalanceService and stores the buffer', async () => {
    const result = await generate({
      templateId: 'balance-sheet',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      format: 'excel',
      locale: 'kk',
    });

    expect(mockBalanceService.exportBalanceSheet).toHaveBeenCalledWith(
      'ws1',
      { date: '2024-01-31', format: 'excel' },
      'kk',
    );
    expect(fs.readFileSync(track(result.filePath), 'utf-8')).toBe('balance');
  });

  it('rejects csv for Balance Sheet', async () => {
    await expect(
      generate({
        templateId: 'balance-sheet',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        format: 'csv',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('previews the document without writing a file', async () => {
    mockTransactionRepository.find.mockResolvedValue([
      { amount: 10, transactionType: 'income', currency: 'EUR', category: { name: 'Sales' } },
      { amount: 4, transactionType: 'expense', currency: 'EUR', category: { name: 'Rent' } },
    ]);

    const preview = await service.previewTemplate('ws1', {
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'excel',
    } as any);

    expect(preview.title).toBe('Profit & Loss (P&L)');
    expect(preview.footer).toEqual([['NET INCOME', 6]]);
    expect(preview.truncated).toBe(false);
    expect(mockReportHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('caps preview rows per section and flags the truncation', async () => {
    mockTransactionRepository.find.mockResolvedValue(
      Array.from({ length: 25 }, (_unused, index) => ({
        amount: index + 1,
        transactionType: 'expense',
        currency: 'EUR',
        category: { name: `Category ${index}` },
      })),
    );

    const preview = await service.previewTemplate(
      'ws1',
      {
        templateId: 'expense-by-category',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        format: 'csv',
      } as any,
      5,
    );

    expect(preview.sections[0].rows).toHaveLength(5);
    expect(preview.truncated).toBe(true);
    // Totals stay computed over the full set, not the visible slice.
    expect(preview.sections[0].total?.[1]).toBe(325);
  });

  it('refuses to preview the balance sheet', async () => {
    await expect(
      service.previewTemplate('ws1', {
        templateId: 'balance-sheet',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        format: 'excel',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return stored history report download metadata', async () => {
    mockReportHistoryRepo.findOne = jest.fn().mockResolvedValue({
      id: 'report-1',
      workspaceId: 'ws1',
      filePath: __filename,
      fileName: 'history-report.xlsx',
      format: 'excel',
    });

    const result = await service.downloadHistoryReport('ws1', 'report-1');

    expect(mockReportHistoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'report-1', workspaceId: 'ws1' },
    });
    expect(result).toEqual({
      filePath: __filename,
      fileName: 'history-report.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  });
});

describe('exportWorkspaceTransactions', () => {
  it('queries all workspace transactions and delegates excel export', async () => {
    const getMany = jest.fn(async () => [{ id: 'tx-1' }]);
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany,
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const service = new ReportsService(
      transactionRepository as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      createRepoMock() as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as AuditService,
      createRepoMock() as any,
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );
    const excelSpy = jest
      .spyOn(service as any, 'generateWorkspaceExcel')
      .mockResolvedValue(undefined);

    const result = await (service as any).exportWorkspaceTransactions(
      'ws-42',
      WorkspaceExportFormat.EXCEL,
    );

    expect(transactionRepository.createQueryBuilder).toHaveBeenCalledWith('transaction');
    expect(qb.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
      workspaceId: 'ws-42',
    });
    // Only confirmed rows are exported; a row waiting in Review is not.
    expect(qb.andWhere).toHaveBeenNthCalledWith(1, 'transaction.isVerified = true');
    expect(qb.andWhere).toHaveBeenNthCalledWith(2, 'transaction.isDuplicate = false');
    // Trashed statements are left out through a subquery, not a join.
    expect(qb.andWhere).toHaveBeenNthCalledWith(3, expect.stringContaining('deleted_at IS NOT NULL'));
    expect(qb.andWhere).toHaveBeenNthCalledWith(4, 'transaction.transferPairId IS NULL');
    expect(excelSpy).toHaveBeenCalledWith([{ id: 'tx-1' }], expect.stringContaining('workspace-transactions-'));
    expect(result.fileName).toMatch(/^workspace-transactions-.*\.xlsx$/);
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});
