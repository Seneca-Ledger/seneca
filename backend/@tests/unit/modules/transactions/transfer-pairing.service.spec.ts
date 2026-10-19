import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull } from 'typeorm';
import {
  Transaction,
  TransactionType,
  TransferPairSource,
} from '../../../../src/entities/transaction.entity';
import { ExchangeRatesService } from '../../../../src/modules/exchange-rates/exchange-rates.service';
import { TransferPairingService } from '../../../../src/modules/transactions/services/transfer-pairing.service';

const WORKSPACE = 'ws-1';

function row(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    workspaceId: WORKSPACE,
    transactionDate: new Date('2026-03-10'),
    transactionType: TransactionType.EXPENSE,
    amount: 100,
    debit: 100,
    credit: null,
    currency: 'EUR',
    statementId: 'stmt-a',
    walletId: null,
    cryptoWalletId: null,
    statement: null,
    isDuplicate: false,
    splitGroupId: null,
    transferPairId: null,
    transferPairSource: null,
    ...overrides,
  } as Transaction;
}

describe('TransferPairingService', () => {
  let service: TransferPairingService;
  const repository = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const exchangeRates = { getRateOrNull: jest.fn(async () => null) };

  /** One query builder per call; each resolves `getMany` with the next batch. */
  function queueQueries(...batches: Transaction[][]) {
    for (const batch of batches) {
      const qb: Record<string, jest.Mock> = {};
      for (const method of ['leftJoin', 'addSelect', 'where', 'andWhere']) {
        qb[method] = jest.fn(() => qb);
      }
      qb.getMany = jest.fn(async () => batch);
      repository.createQueryBuilder.mockReturnValueOnce(qb);
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TransferPairingService,
        { provide: getRepositoryToken(Transaction), useValue: repository },
        { provide: ExchangeRatesService, useValue: exchangeRates },
      ],
    }).compile();
    service = module.get(TransferPairingService);
  });

  describe('detectAndApply', () => {
    it('writes each proposed pair only when both legs are still unpaired', async () => {
      const a = row({ id: 'a' });
      const b = row({
        id: 'b',
        transactionType: TransactionType.INCOME,
        debit: null,
        credit: 100,
        statementId: 'stmt-b',
      });
      queueQueries([a], [a, b]);
      repository.update.mockResolvedValueOnce({ affected: 2 });

      const result = await service.detectAndApply(WORKSPACE, 'stmt-a');

      expect(result).toEqual({ found: 1, paired: 1 });
      expect(repository.update).toHaveBeenCalledTimes(1);
      const [criteria, patch] = repository.update.mock.calls[0];
      expect(criteria).toEqual({ id: In(['a', 'b']), transferPairId: IsNull() });
      expect(patch.transferPairSource).toBe(TransferPairSource.AUTO);
      expect(patch.transferPairId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('undoes a half-written pair when one leg was taken meanwhile', async () => {
      const a = row({ id: 'a' });
      const b = row({
        id: 'b',
        transactionType: TransactionType.INCOME,
        debit: null,
        credit: 100,
        statementId: 'stmt-b',
      });
      queueQueries([a], [a, b]);
      repository.update.mockResolvedValueOnce({ affected: 1 });
      repository.update.mockResolvedValueOnce({ affected: 1 });

      const result = await service.detectAndApply(WORKSPACE);

      expect(result).toEqual({ found: 1, paired: 0 });
      const pairId = repository.update.mock.calls[0][1].transferPairId;
      expect(repository.update.mock.calls[1]).toEqual([
        { transferPairId: pairId },
        { transferPairId: null, transferPairSource: null },
      ]);
    });

    it('does nothing when the statement has no rows to check', async () => {
      queueQueries([]);
      expect(await service.detectAndApply(WORKSPACE, 'stmt-a')).toEqual({ found: 0, paired: 0 });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('link', () => {
    it('pairs two owned rows of opposite direction by hand', async () => {
      repository.findOne
        .mockResolvedValueOnce(row({ id: 'a' }))
        .mockResolvedValueOnce(row({ id: 'b', transactionType: TransactionType.INCOME }));
      repository.update.mockResolvedValueOnce({ affected: 2 });

      const pairId = await service.link(WORKSPACE, 'a', 'b');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'a', workspaceId: WORKSPACE },
        relations: ['statement'],
      });
      expect(repository.update).toHaveBeenCalledWith(
        { id: In(['a', 'b']), workspaceId: WORKSPACE, transferPairId: IsNull() },
        { transferPairId: pairId, transferPairSource: TransferPairSource.MANUAL },
      );
    });

    it('rejects the same row, same direction, duplicates, splits and paired rows', async () => {
      await expect(service.link(WORKSPACE, 'a', 'a')).rejects.toBeInstanceOf(BadRequestException);

      repository.findOne.mockResolvedValueOnce(row({ id: 'a' })).mockResolvedValueOnce(row({ id: 'b' }));
      await expect(service.link(WORKSPACE, 'a', 'b')).rejects.toBeInstanceOf(BadRequestException);

      repository.findOne
        .mockResolvedValueOnce(row({ id: 'a', isDuplicate: true }))
        .mockResolvedValueOnce(row({ id: 'b', transactionType: TransactionType.INCOME }));
      await expect(service.link(WORKSPACE, 'a', 'b')).rejects.toBeInstanceOf(BadRequestException);

      repository.findOne
        .mockResolvedValueOnce(row({ id: 'a', splitGroupId: 'g' }))
        .mockResolvedValueOnce(row({ id: 'b', transactionType: TransactionType.INCOME }));
      await expect(service.link(WORKSPACE, 'a', 'b')).rejects.toBeInstanceOf(BadRequestException);

      repository.findOne
        .mockResolvedValueOnce(row({ id: 'a', transferPairId: 'p' }))
        .mockResolvedValueOnce(row({ id: 'b', transactionType: TransactionType.INCOME }));
      await expect(service.link(WORKSPACE, 'a', 'b')).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('does not see rows of another workspace', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.link(WORKSPACE, 'a', 'b')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fails and cleans up when a leg was paired between the read and the write', async () => {
      repository.findOne
        .mockResolvedValueOnce(row({ id: 'a' }))
        .mockResolvedValueOnce(row({ id: 'b', transactionType: TransactionType.INCOME }));
      repository.update.mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 1 });

      await expect(service.link(WORKSPACE, 'a', 'b')).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('unlink', () => {
    it('separates both legs and marks them rejected', async () => {
      repository.findOne.mockResolvedValueOnce(row({ id: 'a', transferPairId: 'pair-1' }));
      repository.update.mockResolvedValueOnce({ affected: 2 });

      await service.unlink(WORKSPACE, 'a');

      expect(repository.update).toHaveBeenCalledWith(
        { workspaceId: WORKSPACE, transferPairId: 'pair-1' },
        {
          transferPairId: null,
          transferPairSource: TransferPairSource.REJECTED,
          transferPairKind: null,
          reimbursementOfId: null,
        },
      );
    });

    it('refuses a row that is not paired', async () => {
      repository.findOne.mockResolvedValueOnce(row({ id: 'a' }));
      await expect(service.unlink(WORKSPACE, 'a')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('candidates', () => {
    it('lists opposite-direction rows on other accounts, closest amount first', async () => {
      const own = row({ id: 'a', amount: 100, debit: 100 });
      repository.findOne.mockResolvedValueOnce(own);
      const far = row({ id: 'far', transactionType: TransactionType.INCOME, amount: 130, statementId: 's2' });
      const exact = row({ id: 'exact', transactionType: TransactionType.INCOME, amount: 100, statementId: 's3' });
      const sameAccount = row({ id: 'same', transactionType: TransactionType.INCOME, amount: 100, statementId: 'stmt-a' });
      queueQueries([far, exact, sameAccount]);

      const result = await service.candidates(WORKSPACE, 'a');

      expect(result.map(r => r.id)).toEqual(['exact', 'far']);
    });
  });
});

describe('TransferPairingService reimbursements', () => {
  let service: TransferPairingService;
  const repository = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TransferPairingService,
        { provide: getRepositoryToken(Transaction), useValue: repository },
        { provide: ExchangeRatesService, useValue: { getRateOrNull: jest.fn(async () => null) } },
      ],
    }).compile();
    service = module.get(TransferPairingService);
  });

  const income = (overrides: Partial<Transaction> = {}) =>
    row({
      id: 'inc',
      transactionType: TransactionType.INCOME,
      debit: null,
      credit: 120,
      amount: 120,
      ...overrides,
    });
  const expense = (overrides: Partial<Transaction> = {}) =>
    row({ id: 'exp', amount: 120, debit: 120, ...overrides });

  it('pairs a full repayment so both rows leave the aggregates', async () => {
    repository.findOne.mockResolvedValueOnce(income()).mockResolvedValueOnce(expense());
    repository.update.mockResolvedValue({ affected: 2 });

    const result = await service.linkReimbursement(WORKSPACE, 'inc', 'exp');

    expect(result.full).toBe(true);
    expect(repository.update).toHaveBeenNthCalledWith(
      1,
      { id: In(['inc', 'exp']), workspaceId: WORKSPACE, transferPairId: IsNull() },
      expect.objectContaining({
        transferPairId: result.transferPairId,
        transferPairSource: TransferPairSource.MANUAL,
        transferPairKind: 'reimbursement',
      }),
    );
    expect(repository.update).toHaveBeenNthCalledWith(
      2,
      { id: 'inc', workspaceId: WORKSPACE },
      { reimbursementOfId: 'exp' },
    );
  });

  it('only records the link for a partial repayment', async () => {
    repository.findOne
      .mockResolvedValueOnce(income({ credit: 80, amount: 80 }))
      .mockResolvedValueOnce(expense());
    repository.update.mockResolvedValue({ affected: 1 });

    const result = await service.linkReimbursement(WORKSPACE, 'inc', 'exp');

    expect(result).toEqual({ full: false, transferPairId: null });
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'inc', workspaceId: WORKSPACE },
      { reimbursementOfId: 'exp' },
    );
  });

  it('refuses the wrong directions and rows already linked', async () => {
    repository.findOne.mockResolvedValueOnce(expense()).mockResolvedValueOnce(income());
    await expect(service.linkReimbursement(WORKSPACE, 'exp', 'inc')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    repository.findOne
      .mockResolvedValueOnce(income({ reimbursementOfId: 'other' }))
      .mockResolvedValueOnce(expense());
    await expect(service.linkReimbursement(WORKSPACE, 'inc', 'exp')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('unlinks the pair together with the link', async () => {
    repository.findOne.mockResolvedValueOnce(
      income({
        reimbursementOfId: 'exp',
        transferPairId: 'pair-1',
        transferPairKind: 'reimbursement' as Transaction['transferPairKind'],
      }),
    );
    repository.update.mockResolvedValue({ affected: 2 });

    await service.unlinkReimbursement(WORKSPACE, 'inc');

    expect(repository.update).toHaveBeenNthCalledWith(
      1,
      { workspaceId: WORKSPACE, transferPairId: 'pair-1' },
      { transferPairId: null, transferPairSource: null, transferPairKind: null },
    );
    expect(repository.update).toHaveBeenNthCalledWith(
      2,
      { id: 'inc', workspaceId: WORKSPACE },
      { reimbursementOfId: null },
    );
  });
});
