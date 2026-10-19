import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Category, CategoryType } from '@/entities/category.entity';
import { LedgerAccount, LedgerAccountType, NormalBalance } from '@/entities/ledger-account.entity';
import { LedgerAccountsService, statementCashKey } from '@/modules/ledger/ledger-accounts.service';
import {
  categoryAccountCode,
  DEFAULT_LEDGER_ACCOUNTS,
  LEDGER_ACCOUNT_CODES,
} from '@/modules/ledger/ledger-default-accounts';

const WS = 'workspace-1';

const createRepoMock = () => ({
  create: jest.fn((data: unknown) => ({ ...(data as object) })),
  save: jest.fn(async (data: { code?: string; id?: string }) => ({
    ...data,
    id: data.id ?? `id-${data.code}`,
  })),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
});

/** The seeded chart as it would come back from the database. */
const seededDefaults = (): Partial<LedgerAccount>[] =>
  DEFAULT_LEDGER_ACCOUNTS.map(definition => ({
    id: `id-${definition.code}`,
    code: definition.code,
    parentId: definition.parentCode ? `id-${definition.parentCode}` : null,
    accountType: definition.accountType,
    isPostable: definition.isPostable,
    isSystem: true,
  }));

describe('LedgerAccountsService', () => {
  const accountRepository = createRepoMock();
  const categoryRepository = createRepoMock();
  const lineRepository = createRepoMock();
  const txAccountRepository = createRepoMock();
  const txCategoryRepository = createRepoMock();
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Category ? txCategoryRepository : txAccountRepository,
    ),
  };
  const transaction = jest.fn(async (work: (m: typeof manager) => Promise<void>) => work(manager));

  let service: LedgerAccountsService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(accountRepository, { manager: { transaction } });
    service = new LedgerAccountsService(
      accountRepository as any,
      categoryRepository as any,
      lineRepository as any,
    );
  });

  describe('ensureChart', () => {
    it('seeds every default account under its parent', async () => {
      accountRepository.find.mockResolvedValue([]);
      categoryRepository.find.mockResolvedValue([]);

      await service.ensureChart(WS);

      const saved = txAccountRepository.save.mock.calls.map(([account]) => account);
      expect(saved.map(account => account.code)).toEqual(
        DEFAULT_LEDGER_ACCOUNTS.map(definition => definition.code),
      );
      const unallocated = saved.find(a => a.code === LEDGER_ACCOUNT_CODES.CASH_UNALLOCATED);
      expect(unallocated).toEqual(
        expect.objectContaining({
          workspaceId: WS,
          parentId: `id-${LEDGER_ACCOUNT_CODES.CASH}`,
          normalBalance: NormalBalance.DEBIT,
          isPostable: true,
          isSystem: true,
        }),
      );
      const vatPayable = saved.find(a => a.code === LEDGER_ACCOUNT_CODES.VAT_PAYABLE);
      expect(vatPayable.normalBalance).toBe(NormalBalance.CREDIT);
    });

    it('opens an income or expense account for each unlinked root category', async () => {
      accountRepository.find.mockResolvedValue(seededDefaults());
      const food = { id: 'aaaaaaaa-1111-4111-8111-111111111111', name: 'Food', type: CategoryType.EXPENSE };
      const salary = { id: 'bbbbbbbb-2222-4222-8222-222222222222', name: 'Salary', type: CategoryType.INCOME };
      categoryRepository.find.mockResolvedValue([food, salary]);

      await service.ensureChart(WS);

      expect(categoryRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: WS }),
        }),
      );
      expect(txAccountRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'EXPENSE_AAAAAAAA',
          name: 'Food',
          accountType: LedgerAccountType.EXPENSE,
          normalBalance: NormalBalance.DEBIT,
          parentId: `id-${LEDGER_ACCOUNT_CODES.EXPENSES}`,
          isSystem: false,
        }),
      );
      expect(txAccountRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INCOME_BBBBBBBB',
          accountType: LedgerAccountType.INCOME,
          normalBalance: NormalBalance.CREDIT,
          parentId: `id-${LEDGER_ACCOUNT_CODES.INCOME}`,
        }),
      );
      expect(txCategoryRepository.update).toHaveBeenCalledWith(
        { id: food.id, workspaceId: WS },
        { ledgerAccountId: 'id-EXPENSE_AAAAAAAA' },
      );
      expect(txCategoryRepository.update).toHaveBeenCalledWith(
        { id: salary.id, workspaceId: WS },
        { ledgerAccountId: 'id-INCOME_BBBBBBBB' },
      );
    });

    it('relinks a category to the account that already carries its code', async () => {
      const food = { id: 'aaaaaaaa-1111-4111-8111-111111111111', name: 'Food', type: CategoryType.EXPENSE };
      const existing = { id: 'existing', code: categoryAccountCode('expense', food.id) };
      accountRepository.find.mockResolvedValue([...seededDefaults(), existing]);
      categoryRepository.find.mockResolvedValue([food]);

      await service.ensureChart(WS);

      expect(txAccountRepository.save).not.toHaveBeenCalled();
      expect(txCategoryRepository.update).toHaveBeenCalledWith(
        { id: food.id, workspaceId: WS },
        { ledgerAccountId: 'existing' },
      );
    });

    it('does nothing when the chart is complete', async () => {
      accountRepository.find.mockResolvedValue(seededDefaults());
      categoryRepository.find.mockResolvedValue([]);

      await service.ensureChart(WS);

      expect(transaction).not.toHaveBeenCalled();
    });

    it('treats a concurrent seed that won the race as success', async () => {
      accountRepository.find.mockResolvedValue([]);
      categoryRepository.find.mockResolvedValue([]);
      txAccountRepository.save.mockRejectedValueOnce({ driverError: { code: '23505' } });

      await expect(service.ensureChart(WS)).resolves.toBeUndefined();
    });

    it('rethrows any other failure', async () => {
      accountRepository.find.mockResolvedValue([]);
      categoryRepository.find.mockResolvedValue([]);
      txAccountRepository.save.mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.ensureChart(WS)).rejects.toThrow('connection lost');
    });
  });

  describe('create', () => {
    beforeEach(() => {
      jest.spyOn(service, 'ensureChart').mockResolvedValue();
    });

    it('derives the normal balance from the type and normalises code and currency', async () => {
      accountRepository.findOne.mockResolvedValue({
        id: 'header',
        workspaceId: WS,
        accountType: LedgerAccountType.ASSET,
        isPostable: false,
      });

      const result = await service.create(WS, {
        code: 'bank-eur',
        name: '  Main account ',
        accountType: LedgerAccountType.ASSET,
        parentId: 'header',
        currency: 'eur',
      });

      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'header', workspaceId: WS },
      });
      expect(result).toEqual(
        expect.objectContaining({
          code: 'BANK-EUR',
          name: 'Main account',
          currency: 'EUR',
          normalBalance: NormalBalance.DEBIT,
          isPostable: true,
          isSystem: false,
          parentId: 'header',
        }),
      );
    });

    it.each([
      ['a parent of another type', { accountType: LedgerAccountType.EXPENSE, isPostable: false }, /same type/],
      ['a postable parent', { accountType: LedgerAccountType.INCOME, isPostable: true }, /section header/],
    ])('refuses %s', async (_label, parent, message) => {
      accountRepository.findOne.mockResolvedValue({ id: 'parent', ...parent });

      await expect(
        service.create(WS, {
          code: 'X',
          name: 'X',
          accountType: LedgerAccountType.INCOME,
          parentId: 'parent',
        }),
      ).rejects.toThrow(message);
    });

    it('refuses a parent from outside the workspace', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(WS, {
          code: 'X',
          name: 'X',
          accountType: LedgerAccountType.INCOME,
          parentId: 'foreign',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reports a taken code as a conflict', async () => {
      accountRepository.save.mockRejectedValueOnce({ code: '23505' });

      await expect(
        service.create(WS, { code: 'ASSETS', name: 'Dup', accountType: LedgerAccountType.ASSET }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('lets a system account be renamed but not re-coded or moved', async () => {
      accountRepository.findOne.mockResolvedValue({ id: 'sys', isSystem: true, name: 'Old' });

      await expect(service.update(WS, 'sys', { code: 'NEW' })).rejects.toThrow(/System accounts/);
      await expect(service.update(WS, 'sys', { parentId: null })).rejects.toThrow(/System accounts/);
      await expect(service.update(WS, 'sys', { name: 'Renamed' })).resolves.toEqual(
        expect.objectContaining({ name: 'Renamed' }),
      );
    });

    it('refuses to move an account under its own sub-account', async () => {
      accountRepository.findOne
        .mockResolvedValueOnce({ id: 'top', isSystem: false, parentId: null, accountType: LedgerAccountType.EXPENSE })
        .mockResolvedValueOnce({ id: 'grandchild', accountType: LedgerAccountType.EXPENSE, isPostable: false });
      accountRepository.find.mockResolvedValue([
        { id: 'top', parentId: null },
        { id: 'child', parentId: 'top' },
        { id: 'grandchild', parentId: 'child' },
      ]);

      await expect(service.update(WS, 'top', { parentId: 'grandchild' })).rejects.toThrow(
        /own sub-account/,
      );
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('returns 404 for an account of another workspace', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.update(WS, 'foreign', { name: 'x' })).rejects.toThrow(NotFoundException);
      expect(accountRepository.findOne).toHaveBeenCalledWith({ where: { id: 'foreign', workspaceId: WS } });
    });
  });

  describe('remove', () => {
    const custom = { id: 'acc', workspaceId: WS, isSystem: false };

    it('soft-deletes an account nothing depends on', async () => {
      accountRepository.findOne.mockResolvedValue(custom);
      accountRepository.count.mockResolvedValue(0);
      lineRepository.count.mockResolvedValue(0);
      categoryRepository.count.mockResolvedValue(0);

      await service.remove(WS, 'acc');

      expect(accountRepository.softDelete).toHaveBeenCalledWith({ id: 'acc', workspaceId: WS });
    });

    it('refuses a system account', async () => {
      accountRepository.findOne.mockResolvedValue({ ...custom, isSystem: true });

      await expect(service.remove(WS, 'acc')).rejects.toThrow(BadRequestException);
      expect(accountRepository.softDelete).not.toHaveBeenCalled();
    });

    it.each([
      ['sub-accounts', [1, 0, 0], /sub-accounts/],
      ['journal lines', [0, 3, 0], /journal lines/],
      ['linked categories', [0, 0, 2], /Categories book/],
    ])('refuses an account with %s', async (_label, [children, lines, categories], message) => {
      accountRepository.findOne.mockResolvedValue(custom);
      accountRepository.count.mockResolvedValue(children);
      lineRepository.count.mockResolvedValue(lines);
      categoryRepository.count.mockResolvedValue(categories);

      await expect(service.remove(WS, 'acc')).rejects.toThrow(message);
      expect(accountRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('categoryAccountId', () => {
    beforeEach(() => {
      jest.spyOn(service, 'ensureChart').mockResolvedValue();
    });

    it('walks up to the nearest ancestor with an account', async () => {
      categoryRepository.findOne
        .mockResolvedValueOnce({ id: 'child', parentId: 'root', ledgerAccountId: null })
        .mockResolvedValueOnce({ id: 'root', parentId: null, ledgerAccountId: 'acc-root' });
      accountRepository.findOne.mockResolvedValue({ id: 'acc-root' });

      await expect(service.categoryAccountId(WS, 'child')).resolves.toBe('acc-root');
      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'acc-root', workspaceId: WS, isPostable: true },
        select: ['id'],
      });
      expect(service.ensureChart).not.toHaveBeenCalled();
    });

    it('seeds the chart once for a root created since the last seed', async () => {
      categoryRepository.findOne
        .mockResolvedValueOnce({ id: 'root', parentId: null, ledgerAccountId: null })
        .mockResolvedValueOnce({ id: 'root', parentId: null, ledgerAccountId: 'acc-new' });
      accountRepository.findOne.mockResolvedValue({ id: 'acc-new' });

      await expect(service.categoryAccountId(WS, 'root')).resolves.toBe('acc-new');
      expect(service.ensureChart).toHaveBeenCalledTimes(1);
    });

    it('gives up after one seed, and on a foreign or non-postable link', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'root', parentId: null, ledgerAccountId: null });
      await expect(service.categoryAccountId(WS, 'root')).resolves.toBeNull();
      expect(service.ensureChart).toHaveBeenCalledTimes(1);

      categoryRepository.findOne.mockResolvedValue({ id: 'root', parentId: null, ledgerAccountId: 'header' });
      accountRepository.findOne.mockResolvedValue(null);
      await expect(service.categoryAccountId(WS, 'root')).resolves.toBeNull();

      categoryRepository.findOne.mockResolvedValue(null);
      await expect(service.categoryAccountId(WS, 'foreign')).resolves.toBeNull();
    });

    it('stops on a parent cycle instead of spinning', async () => {
      categoryRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        parentId: where.id === 'a' ? 'b' : 'a',
        ledgerAccountId: null,
      }));
      await expect(service.categoryAccountId(WS, 'a')).resolves.toBeNull();
      expect(categoryRepository.findOne.mock.calls.length).toBeLessThanOrEqual(10);
    });
  });

  describe('statementCashKey', () => {
    it('is stable, ignores spacing and case of the currency, and hides the number', () => {
      const key = statementCashKey('kaspi', 'KZ12 3456 7890', 'kzt');
      expect(key).toBe(statementCashKey('kaspi', 'KZ1234567890', 'KZT'));
      expect(key).toMatch(/^statement:[0-9a-f]{64}$/);
      expect(key).not.toContain('7890');
      expect(statementCashKey('kaspi', null, 'KZT')).not.toBe(key);
      expect(statementCashKey('kaspi', 'KZ1234567890', 'USD')).not.toBe(key);
    });
  });
});
