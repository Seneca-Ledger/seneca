import { BalanceAccountSubType, BalanceAccountType, type BalanceSnapshot } from '@/entities';
import { DEFAULT_BALANCE_ACCOUNTS } from '@/modules/balance/balance-default-accounts';
import { BalanceService } from '@/modules/balance/balance.service';
import { BadRequestException } from '@nestjs/common';

/** A chainable query builder that answers `getRawMany` with `rows`. */
function queryBuilderReturning(rows: unknown[]) {
  const builder: any = {};
  for (const method of [
    'leftJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.getRawMany = jest.fn(async () => rows);
  return builder;
}

function createRepoMock() {
  // seedDefaultAccounts() сидит в транзакции; менеджер прокидывает вызовы
  // в тот же мок-репозиторий, чтобы ассерты не менялись.
  const repo: any = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((input: unknown) => input),
    save: jest.fn(async (input: unknown) => input),
    createQueryBuilder: jest.fn(),
  };
  const manager = {
    query: jest.fn(),
    getRepository: jest.fn(() => repo),
    transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };
  repo.manager = manager;
  return repo;
}

describe('BalanceService', () => {
  let service: BalanceService;
  const balanceAccountRepository = createRepoMock();
  const balanceSnapshotRepository = createRepoMock();
  const walletRepository = createRepoMock();
  const transactionRepository = createRepoMock();
  const statementRepository = createRepoMock();
  const workspaceMemberRepository = createRepoMock();
  const workspaceRepository = createRepoMock();
  const auditService = { createEvent: jest.fn() } as any;
  const exchangeRatesService = { getRateOrNull: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // getWorkspaceCurrency() reads the workspace on every balance sheet build.
    workspaceRepository.findOne.mockResolvedValue({ currency: 'KZT' });

    service = new BalanceService(
      balanceAccountRepository,
      balanceSnapshotRepository,
      walletRepository,
      transactionRepository,
      statementRepository,
      workspaceMemberRepository,
      workspaceRepository,
      auditService,
      exchangeRatesService,
    );
  });

  it('seeds default accounts when workspace has none', async () => {
    balanceAccountRepository.count.mockResolvedValue(0);
    balanceAccountRepository.save.mockImplementation(async (input: any) => ({
      ...input,
      id: `acc-${input.code}`,
    }));

    await service.seedDefaultAccounts('ws-1');

    expect(balanceAccountRepository.save).toHaveBeenCalledTimes(DEFAULT_BALANCE_ACCOUNTS.length);
    const savedCodes = balanceAccountRepository.save.mock.calls.map((call: any[]) => call[0].code);
    expect(savedCodes).toEqual(DEFAULT_BALANCE_ACCOUNTS.map(account => account.code));
  });

  it('treats a concurrent-seed unique violation as success, not an error', async () => {
    balanceAccountRepository.count.mockResolvedValue(0);
    balanceAccountRepository.save.mockRejectedValue({ driverError: { code: '23505' } });

    await expect(service.seedDefaultAccounts('ws-1')).resolves.toBeUndefined();
  });

  it('calculates totals from manual and auto-computed lines', async () => {
    balanceAccountRepository.count.mockResolvedValue(3);
    balanceAccountRepository.find.mockResolvedValue([
      {
        id: 'asset-root',
        code: 'ASSET_NON_CURRENT',
        name: 'Assets section',
        accountType: BalanceAccountType.ASSET,
        subType: BalanceAccountSubType.NON_CURRENT_ASSET,
        isEditable: false,
        isAutoComputed: false,
        isExpandable: false,
        position: 0,
        parentId: null,
        createdAt: new Date(),
      },
      {
        id: 'asset-fixed',
        code: 'ASSET_FIXED',
        name: 'Fixed',
        accountType: BalanceAccountType.ASSET,
        subType: BalanceAccountSubType.NON_CURRENT_ASSET,
        isEditable: true,
        isAutoComputed: false,
        isExpandable: false,
        position: 0,
        parentId: 'asset-root',
        createdAt: new Date(),
      },
      {
        id: 'asset-cash',
        code: 'ASSET_CASH',
        name: 'Cash',
        accountType: BalanceAccountType.ASSET,
        subType: BalanceAccountSubType.CASH,
        isEditable: false,
        isAutoComputed: true,
        isExpandable: false,
        position: 1,
        parentId: null,
        createdAt: new Date(),
      },
      {
        id: 'equity-root',
        code: 'EQUITY_SECTION',
        name: 'Equity',
        accountType: BalanceAccountType.EQUITY,
        subType: BalanceAccountSubType.EQUITY,
        isEditable: false,
        isAutoComputed: false,
        isExpandable: false,
        position: 0,
        parentId: null,
        createdAt: new Date(),
      },
      {
        id: 'equity-retained',
        code: 'EQUITY_RETAINED_EARNINGS',
        name: 'Retained earnings',
        accountType: BalanceAccountType.EQUITY,
        subType: BalanceAccountSubType.EQUITY,
        isEditable: false,
        isAutoComputed: true,
        isExpandable: false,
        position: 0,
        parentId: 'equity-root',
        createdAt: new Date(),
      },
    ]);

    jest
      .spyOn(service as any, 'getLatestSnapshotMap')
      .mockResolvedValue(new Map([['asset-fixed', { amount: 100 } as BalanceSnapshot]]));
    jest
      .spyOn(service as any, 'getAutoComputedCashBalance')
      .mockResolvedValue(new Map([['KZT', 300]]));
    jest.spyOn(service as any, 'getRetainedEarnings').mockResolvedValue(new Map([['KZT', 400]]));

    const result = await service.getBalanceSheet('ws-1', '2026-02-15');

    expect(result.assets.total).toBe(400);
    expect(result.liabilities.total).toBe(400);
    expect(result.isBalanced).toBe(true);
    expect(result.difference).toBe(0);
  });

  it('returns localized account names for requested locale', async () => {
    balanceAccountRepository.count.mockResolvedValue(1);
    balanceAccountRepository.find.mockResolvedValue([
      {
        id: 'asset-cash',
        code: 'ASSET_CASH',
        name: 'III. Деньги',
        nameEn: 'III. Cash',
        nameKk: 'III. Ақша',
        accountType: BalanceAccountType.ASSET,
        subType: BalanceAccountSubType.CASH,
        isEditable: false,
        isAutoComputed: true,
        isExpandable: false,
        position: 0,
        parentId: null,
        createdAt: new Date(),
      },
    ]);

    jest.spyOn(service as any, 'getLatestSnapshotMap').mockResolvedValue(new Map());
    jest
      .spyOn(service as any, 'getAutoComputedCashBalance')
      .mockResolvedValue(new Map([['KZT', 1000]]));
    jest.spyOn(service as any, 'getRetainedEarnings').mockResolvedValue(new Map());

    const resultEn = await service.getBalanceSheet('ws-1', '2026-04-02', 'en');
    expect(resultEn.assets.sections[0].name).toBe('III. Cash');

    const resultKk = await service.getBalanceSheet('ws-1', '2026-04-02', 'kk');
    expect(resultKk.assets.sections[0].name).toBe('III. Ақша');

    const resultRu = await service.getBalanceSheet('ws-1', '2026-04-02', 'ru');
    expect(resultRu.assets.sections[0].name).toBe('III. Деньги');
  });

  it('uses localized labels in excel export', async () => {
    balanceAccountRepository.count.mockResolvedValue(1);
    balanceAccountRepository.find.mockResolvedValue([
      {
        id: 'asset-cash',
        code: 'ASSET_CASH',
        name: 'III. Деньги',
        nameEn: 'III. Cash',
        nameKk: 'III. Ақша',
        accountType: BalanceAccountType.ASSET,
        subType: BalanceAccountSubType.CASH,
        isEditable: false,
        isAutoComputed: true,
        isExpandable: false,
        position: 0,
        parentId: null,
        createdAt: new Date(),
      },
    ]);

    jest.spyOn(service as any, 'getLatestSnapshotMap').mockResolvedValue(new Map());
    jest
      .spyOn(service as any, 'getAutoComputedCashBalance')
      .mockResolvedValue(new Map([['KZT', 1000]]));
    jest.spyOn(service as any, 'getRetainedEarnings').mockResolvedValue(new Map());

    const payload = await service.exportBalanceSheet(
      'ws-1',
      { format: 'excel', date: '2026-04-02', locale: 'en' } as any,
      'en',
    );

    const workbook = require('xlsx').read(payload.buffer, { type: 'buffer' });
    const rows = require('xlsx').utils.sheet_to_json(workbook.Sheets.Balance, { header: 1 });

    expect(rows[0][0]).toBe('Balance sheet as of 2026-04-02');
    expect(rows[2][0]).toContain('Assets');
    expect(rows[2][2]).toContain('Liabilities');
    expect(rows[rows.length - 2][0]).toBe('Total');
    expect(rows[rows.length - 1][0]).toBe('Difference');
  });

  describe('currencies', () => {
    const cashLeaf = {
      id: 'asset-cash',
      code: 'ASSET_CASH',
      name: 'Cash',
      accountType: BalanceAccountType.ASSET,
      subType: BalanceAccountSubType.CASH,
      isEditable: false,
      isAutoComputed: true,
      isExpandable: false,
      position: 0,
      parentId: null,
      createdAt: new Date(),
    };
    const fixedLeaf = {
      ...cashLeaf,
      id: 'asset-fixed',
      code: 'ASSET_FIXED',
      name: 'Fixed',
      subType: BalanceAccountSubType.NON_CURRENT_ASSET,
      isEditable: true,
      isAutoComputed: false,
      position: 1,
    };

    beforeEach(() => {
      balanceAccountRepository.count.mockResolvedValue(2);
      balanceAccountRepository.find.mockResolvedValue([cashLeaf, fixedLeaf]);
      jest.spyOn(service as any, 'getRetainedEarnings').mockResolvedValue(new Map());
    });

    it('converts cash and snapshots into the workspace currency at the report date', async () => {
      jest
        .spyOn(service as any, 'getAutoComputedCashBalance')
        .mockResolvedValue(new Map([['KZT', 1000], ['USD', 10]]));
      jest
        .spyOn(service as any, 'getLatestSnapshotMap')
        .mockResolvedValue(new Map([['asset-fixed', { amount: '20', currency: 'EUR' }]]));
      exchangeRatesService.getRateOrNull.mockImplementation(async (from: string) =>
        from === 'USD' ? 450 : 500,
      );

      const result = await service.getBalanceSheet('ws-1', '2026-02-15');

      expect(result.assets.total).toBe(1000 + 10 * 450 + 20 * 500);
      expect(result.missingRates).toEqual([]);
      expect(exchangeRatesService.getRateOrNull).toHaveBeenCalledWith('USD', 'KZT', '2026-02-15', 'ws-1');
      expect(exchangeRatesService.getRateOrNull).toHaveBeenCalledWith('EUR', 'KZT', '2026-02-15', 'ws-1');
    });

    it('leaves out an amount without a rate instead of counting it 1:1', async () => {
      jest
        .spyOn(service as any, 'getAutoComputedCashBalance')
        .mockResolvedValue(new Map([['KZT', 1000], ['CHF', 10]]));
      jest.spyOn(service as any, 'getLatestSnapshotMap').mockResolvedValue(new Map());
      exchangeRatesService.getRateOrNull.mockResolvedValue(null);

      const result = await service.getBalanceSheet('ws-1', '2026-02-15');

      expect(result.assets.total).toBe(1000);
      expect(result.missingRates).toEqual(['CHF']);
    });
  });

  it('counts only confirmed transactions in retained earnings', async () => {
    const builder = queryBuilderReturning([{ currency: 'KZT', totalCredit: '500', totalDebit: '100' }]);
    transactionRepository.createQueryBuilder.mockReturnValue(builder);

    const earnings = await (service as any).getRetainedEarnings('ws-1', '2026-02-28');

    expect(earnings).toEqual(new Map([['KZT', 400]]));
    expect(builder.andWhere).toHaveBeenCalledWith('transaction.isVerified = true');
  });

  describe('getCashSeries', () => {
    beforeEach(() => {
      workspaceMemberRepository.find.mockResolvedValue([{ userId: 'user-1' }]);
    });

    it('keeps wallet balances per currency and skips rows of trashed statements', async () => {
      walletRepository.find.mockResolvedValue([
        { id: 'w-kzt', initialBalance: '100', currency: 'KZT' },
        { id: 'w-usd', initialBalance: '5', currency: 'usd' },
      ]);
      const builder = queryBuilderReturning([
        { date: '2026-01-10', currency: 'KZT', credit: '50', debit: '20' },
        { date: '2026-02-10', currency: 'USD', credit: '0', debit: '2' },
      ]);
      transactionRepository.createQueryBuilder.mockReturnValue(builder);

      const series = await service.getCashSeries('ws-1', ['2026-01-31', '2026-02-28']);

      expect(series.get('2026-01-31')).toEqual(new Map([['KZT', 130], ['USD', 5]]));
      expect(series.get('2026-02-28')).toEqual(new Map([['KZT', 130], ['USD', 3]]));
      expect(builder.andWhere).toHaveBeenCalledWith(
        '(transaction.statementId IS NULL OR statement.deletedAt IS NULL)',
      );
      // Unconfirmed rows wait in Review and move no balance.
      expect(builder.andWhere).toHaveBeenCalledWith('transaction.isVerified = true');
    });

    it('sums the latest live statement of each bank account', async () => {
      walletRepository.find.mockResolvedValue([]);
      const builder = queryBuilderReturning([
        { bankName: 'bank', accountNumber: 'A', currency: 'EUR', balanceEnd: '100', date: '2026-01-31' },
        { bankName: 'bank', accountNumber: 'B', currency: 'KZT', balanceEnd: '7000', date: '2026-01-31' },
        { bankName: 'bank', accountNumber: 'A', currency: 'EUR', balanceEnd: '150', date: '2026-02-28' },
      ]);
      statementRepository.createQueryBuilder.mockReturnValue(builder);

      const series = await service.getCashSeries('ws-1', ['2026-02-01', '2026-03-01']);

      expect(series.get('2026-02-01')).toEqual(new Map([['EUR', 100], ['KZT', 7000]]));
      expect(series.get('2026-03-01')).toEqual(new Map([['EUR', 150], ['KZT', 7000]]));
      expect(builder.andWhere).toHaveBeenCalledWith('statement.deletedAt IS NULL');
    });
  });

  it('rejects updates for non-editable accounts', async () => {
    balanceAccountRepository.findOne.mockResolvedValue({
      id: 'account-id',
      workspaceId: 'ws-1',
      isEditable: false,
      code: 'ASSET_CASH',
    });

    await expect(
      service.updateSnapshot('user-1', 'ws-1', {
        accountId: 'account-id',
        amount: 123.45,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('upserts editable snapshot and writes audit event', async () => {
    balanceAccountRepository.findOne.mockResolvedValue({
      id: 'asset-fixed',
      workspaceId: 'ws-1',
      isEditable: true,
      code: 'ASSET_FIXED',
    });
    balanceSnapshotRepository.findOne.mockResolvedValue(null);

    await service.updateSnapshot('user-1', 'ws-1', {
      accountId: 'asset-fixed',
      amount: 500,
      date: '2026-02-15',
      currency: 'KZT',
    });

    expect(balanceSnapshotRepository.save).toHaveBeenCalled();
    expect(auditService.createEvent).toHaveBeenCalled();
  });
});
