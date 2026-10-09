import { IsNull } from 'typeorm';
import { createRepoMock } from '../../../helpers/create-repo-mock';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { TaxReturnStatus } from '@/entities/tax-return.entity';
import { TransactionType } from '@/entities/transaction.entity';
import { TaxReturnsService } from '@/modules/tax/tax-returns.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('TaxReturnsService', () => {
  let service: TaxReturnsService;
  let returnRepo: ReturnType<typeof createRepoMock>;
  let transactionRepo: ReturnType<typeof createRepoMock>;
  let adoption: { getCurrentJurisdiction: jest.Mock };
  let exchangeRates: { getRate: jest.Mock };
  let auditService: { createEvent: jest.Mock };

  const KZ = { id: 'j-kz', code: 'KZ', currency: 'KZT' };

  const tx = (over: Record<string, unknown> = {}) => ({
    id: 'tx-1',
    transactionDate: new Date('2026-02-10'),
    counterpartyName: 'Magnum',
    currency: 'KZT',
    transactionType: TransactionType.EXPENSE,
    taxAmount: '10.71',
    taxNetAmount: '89.29',
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    returnRepo = createRepoMock();
    transactionRepo = createRepoMock();
    transactionRepo.find.mockResolvedValue([]);
    returnRepo.findOne.mockResolvedValue(null);
    returnRepo.create.mockImplementation((input: unknown) => input);
    returnRepo.save.mockImplementation(async (input: unknown) => input);
    adoption = { getCurrentJurisdiction: jest.fn().mockResolvedValue(KZ) };
    exchangeRates = { getRate: jest.fn().mockResolvedValue(1) };
    auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };

    service = new TaxReturnsService(
      returnRepo,
      transactionRepo,
      adoption as never,
      exchangeRates as never,
      {} as never,
      auditService as never,
    );
  });

  describe('computeTotals', () => {
    it('refuses to build a return without a jurisdiction', async () => {
      adoption.getCurrentJurisdiction.mockResolvedValue(null);

      await expect(service.computeTotals('ws-1', '2026-01-01', '2026-03-31')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('counts only counted (confirmed, not duplicate, not transfer, not trashed) transactions', async () => {
      await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

      // Both alternatives (no statement / statement not trashed) count confirmed,
      // non-duplicate, non-transfer rows of this workspace only.
      const where = transactionRepo.find.mock.calls[0][0].where;
      expect(where).toHaveLength(2);
      for (const branch of where) {
        expect(branch).toMatchObject({ isVerified: true, isDuplicate: false, workspaceId: 'ws-1' });
        expect(branch.transferPairId).toEqual(IsNull());
      }
      expect(where[0].statementId).toEqual(IsNull());
      expect(where[1].statement).toEqual({ deletedAt: IsNull() });
    });

    it('splits income into output tax and expense into input tax', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ id: 'a', transactionType: TransactionType.INCOME, taxAmount: '120.00' }),
        tx({ id: 'b', transactionType: TransactionType.EXPENSE, taxAmount: '50.00' }),
      ]);

      const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

      expect(totals.outputTax).toBe(120);
      expect(totals.inputTax).toBe(50);
      expect(totals.netPayable).toBe(70);
      expect(totals.currency).toBe('KZT');
    });

    it('reports a refund as a negative net', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ transactionType: TransactionType.EXPENSE, taxAmount: '90.00' }),
      ]);

      const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');
      expect(totals.netPayable).toBe(-90);
    });

    it('skips rows carrying no tax', async () => {
      transactionRepo.find.mockResolvedValue([tx({ taxAmount: '0.00' }), tx({ taxAmount: null })]);

      const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

      expect(totals.lines).toHaveLength(0);
      expect(totals.netPayable).toBe(0);
    });

    describe('multi-currency', () => {
      it('converts at the rate for the transaction date, not today', async () => {
        transactionRepo.find.mockResolvedValue([
          tx({ currency: 'USD', taxAmount: '10.00', transactionDate: new Date('2026-02-10') }),
        ]);
        exchangeRates.getRate.mockResolvedValue(500);

        await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

        // Converting at today's rate would make a filed return drift with the
        // market and answer differently every time it was opened.
        const [from, to, date] = exchangeRates.getRate.mock.calls[0];
        expect(from).toBe('USD');
        expect(to).toBe('KZT');
        expect(date).toEqual(new Date('2026-02-10'));
      });

      it('totals the converted figures', async () => {
        transactionRepo.find.mockResolvedValue([
          tx({ id: 'a', currency: 'USD', taxAmount: '10.00' }),
          tx({ id: 'b', currency: 'KZT', taxAmount: '1000.00' }),
        ]);
        exchangeRates.getRate.mockResolvedValue(500);

        const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

        expect(totals.inputTax).toBe(6000);
      });

      it('does not call the rate service when the currency already matches', async () => {
        transactionRepo.find.mockResolvedValue([tx({ currency: 'KZT' })]);

        await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

        expect(exchangeRates.getRate).not.toHaveBeenCalled();
      });

      it('rounds each converted line once so lines and totals agree', async () => {
        transactionRepo.find.mockResolvedValue([
          tx({ id: 'a', currency: 'USD', taxAmount: '10.01' }),
          tx({ id: 'b', currency: 'USD', taxAmount: '10.01' }),
        ]);
        exchangeRates.getRate.mockResolvedValue(1.115);

        const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');
        const lineSum = totals.lines.reduce((sum, line) => sum + line.taxAmountConverted, 0);

        expect(Number(lineSum.toFixed(2))).toBe(totals.inputTax);
      });
    });

    it('records the rate used on every line', async () => {
      transactionRepo.find.mockResolvedValue([tx({ currency: 'USD', taxAmount: '10.00' })]);
      exchangeRates.getRate.mockResolvedValue(500);

      const [line] = (await service.computeTotals('ws-1', '2026-01-01', '2026-03-31')).lines;

      expect(line).toMatchObject({
        currency: 'USD',
        taxAmount: 10,
        exchangeRate: 500,
        taxAmountConverted: 5000,
        direction: 'input',
      });
    });
  });

  describe('getForPeriod', () => {
    it('rejects a period that ends before it starts', async () => {
      await expect(service.getForPeriod('ws-1', '2026-03-31', '2026-01-01')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns a filed period untouched instead of recomputing it', async () => {
      const filed = {
        id: 'ret-1',
        status: TaxReturnStatus.FILED,
        outputTax: 999,
        snapshot: [],
      };
      returnRepo.findOne.mockResolvedValue(filed);

      const result = await service.getForPeriod('ws-1', '2026-01-01', '2026-03-31');

      // Recomputing would show figures that differ from the ones submitted.
      expect(result).toBe(filed);
      expect(transactionRepo.find).not.toHaveBeenCalled();
    });

    it('recomputes a draft', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ transactionType: TransactionType.INCOME, taxAmount: '42.00' }),
      ]);

      const result = await service.getForPeriod('ws-1', '2026-01-01', '2026-03-31');

      expect(result).toMatchObject({ status: TaxReturnStatus.DRAFT, outputTax: 42 });
    });
  });

  describe('file', () => {
    const manager = {
      save: jest.fn(async (_entity: unknown, row: unknown) => row),
      createQueryBuilder: jest.fn(),
    };

    beforeEach(() => {
      const update = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      manager.save.mockClear();
      manager.createQueryBuilder.mockReturnValue(update);
      returnRepo.manager = {
        transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
      } as never;
    });

    it('refuses to file a period twice', async () => {
      returnRepo.findOne.mockResolvedValue({ status: TaxReturnStatus.FILED });

      await expect(service.file('ws-1', '2026-01-01', '2026-03-31')).rejects.toThrow(
        ConflictException,
      );
    });

    it('writes the snapshot and stamps the filing time', async () => {
      transactionRepo.find.mockResolvedValue([tx({ id: 'a', taxAmount: '10.00' })]);

      const filed = await service.file('ws-1', '2026-01-01', '2026-03-31');

      expect(filed.status).toBe(TaxReturnStatus.FILED);
      expect(filed.filedAt).toBeInstanceOf(Date);
      expect(filed.snapshot).toHaveLength(1);
      expect(filed.snapshot?.[0].transactionId).toBe('a');
    });

    it('locks exactly the transactions it reported', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ id: 'a', taxAmount: '10.00' }),
        tx({ id: 'b', taxAmount: '20.00' }),
        tx({ id: 'c', taxAmount: '0.00' }),
      ]);

      await service.file('ws-1', '2026-01-01', '2026-03-31');

      const builder = manager.createQueryBuilder.mock.results[0].value;
      expect(builder.set).toHaveBeenCalledWith({ taxLocked: true });
      // The zero-tax row contributed nothing, so locking it would freeze a row
      // the return never mentioned.
      expect(builder.whereInIds).toHaveBeenCalledWith(['a', 'b']);
    });

    it('locks nothing when the period is empty', async () => {
      transactionRepo.find.mockResolvedValue([]);

      await service.file('ws-1', '2026-01-01', '2026-03-31');

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('saves the return and locks inside one database transaction', async () => {
      transactionRepo.find.mockResolvedValue([tx({ id: 'a', taxAmount: '10.00' })]);

      await service.file('ws-1', '2026-01-01', '2026-03-31');

      // A crash between the two would leave a return claiming to be filed over
      // transactions that are still editable.
      expect(returnRepo.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it('audits the filing against the persisted return row', async () => {
      returnRepo.findOne.mockResolvedValue({ id: 'ret-1', status: TaxReturnStatus.DRAFT });

      await service.file('ws-1', '2026-01-01', '2026-03-31', 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.TAX_RETURN,
          entityId: 'ret-1',
          action: AuditAction.UPDATE,
          diff: {
            before: expect.objectContaining({ status: TaxReturnStatus.DRAFT }),
            after: expect.objectContaining({ status: TaxReturnStatus.FILED }),
          },
          meta: {
            periodStart: '2026-01-01',
            periodEnd: '2026-03-31',
            status: TaxReturnStatus.FILED,
          },
        }),
      );
      expect(auditService.createEvent.mock.calls[0][0].severity).toBeUndefined();
    });

    it('still files when the audit log fails', async () => {
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.file('ws-1', '2026-01-01', '2026-03-31', 'user-1')).resolves.toMatchObject(
        { status: TaxReturnStatus.FILED },
      );
    });
  });

  describe('reopen', () => {
    const manager = {
      save: jest.fn(async (_entity: unknown, row: unknown) => row),
      createQueryBuilder: jest.fn(),
    };

    beforeEach(() => {
      const update = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      manager.createQueryBuilder.mockReturnValue(update);
      returnRepo.manager = {
        transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
      } as never;
    });

    it('refuses when the period is not filed', async () => {
      returnRepo.findOne.mockResolvedValue({ status: TaxReturnStatus.DRAFT });

      await expect(service.reopen('ws-1', '2026-01-01', '2026-03-31')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unlocks the transactions and clears the submission record', async () => {
      returnRepo.findOne.mockResolvedValue({
        id: 'ret-1',
        status: TaxReturnStatus.FILED,
        snapshot: [{ transactionId: 'a' }, { transactionId: 'b' }],
      });

      const reopened = await service.reopen('ws-1', '2026-01-01', '2026-03-31');

      const builder = manager.createQueryBuilder.mock.results.at(-1)?.value;
      expect(builder.set).toHaveBeenCalledWith({ taxLocked: false });
      expect(builder.whereInIds).toHaveBeenCalledWith(['a', 'b']);
      expect(reopened).toMatchObject({
        status: TaxReturnStatus.DRAFT,
        filedAt: null,
        snapshot: null,
      });
    });

    it('audits the reopen as a warning', async () => {
      returnRepo.findOne.mockResolvedValue({
        id: 'ret-1',
        workspaceId: 'ws-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        status: TaxReturnStatus.FILED,
        snapshot: [],
      });

      await service.reopen('ws-1', '2026-01-01', '2026-03-31', 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          entityType: EntityType.TAX_RETURN,
          entityId: 'ret-1',
          action: AuditAction.UPDATE,
          severity: Severity.WARN,
          meta: {
            periodStart: '2026-01-01',
            periodEnd: '2026-03-31',
            status: TaxReturnStatus.DRAFT,
          },
        }),
      );
    });

    it('still reopens when the audit log fails', async () => {
      returnRepo.findOne.mockResolvedValue({
        id: 'ret-1',
        status: TaxReturnStatus.FILED,
        snapshot: [],
      });
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.reopen('ws-1', '2026-01-01', '2026-03-31', 'user-1')).resolves.toMatchObject(
        { status: TaxReturnStatus.DRAFT },
      );
    });
  });

  describe('reverse charge', () => {
    it('reports the notional figure on both sides so the entries cancel', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({
          id: 'rc',
          taxAmount: '0.00',
          taxReverseCharge: true,
          taxNotionalAmount: '190.00',
        }),
      ]);

      const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');

      expect(totals.outputTax).toBe(190);
      expect(totals.inputTax).toBe(190);
      // The whole point: it is declared, and it costs nothing.
      expect(totals.netPayable).toBe(0);
    });

    it('marks the line so the return shows why it appears twice', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ taxAmount: '0.00', taxReverseCharge: true, taxNotionalAmount: '190.00' }),
      ]);

      const [line] = (await service.computeTotals('ws-1', '2026-01-01', '2026-03-31')).lines;
      expect(line.direction).toBe('reverse_charge');
      expect(line.taxAmount).toBe(190);
    });

    it('does not drop a reverse-charge row for having zero tax charged', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ taxAmount: '0.00', taxReverseCharge: true, taxNotionalAmount: '190.00' }),
      ]);

      const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');
      expect(totals.lines).toHaveLength(1);
    });

    it('still skips a reverse-charge row that has no notional figure', async () => {
      transactionRepo.find.mockResolvedValue([
        tx({ taxAmount: '0.00', taxReverseCharge: true, taxNotionalAmount: null }),
      ]);

      const totals = await service.computeTotals('ws-1', '2026-01-01', '2026-03-31');
      expect(totals.lines).toHaveLength(0);
    });
  });
});
