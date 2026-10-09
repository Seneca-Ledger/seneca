import { IsNull } from 'typeorm';
import { createRepoMock } from '../../../helpers/create-repo-mock';
import { TaxThresholdPeriod } from '@/entities/tax-jurisdiction.entity';
import { TransactionType } from '@/entities/transaction.entity';
import { TaxThresholdService } from '@/modules/tax/tax-threshold.service';

describe('TaxThresholdService', () => {
  let service: TaxThresholdService;
  let workspaceRepo: ReturnType<typeof createRepoMock>;
  let transactionRepo: ReturnType<typeof createRepoMock>;
  let adoption: { getCurrentJurisdiction: jest.Mock };
  let exchangeRates: { getRate: jest.Mock };
  let events: { emit: jest.Mock };
  let workspace: Record<string, unknown>;

  const GB = {
    id: 'j-gb',
    code: 'GB',
    currency: 'GBP',
    registrationThreshold: '90000.00',
    thresholdPeriod: TaxThresholdPeriod.ROLLING_12M,
  };

  const DE = {
    id: 'j-de',
    code: 'DE',
    currency: 'EUR',
    registrationThreshold: '25000.00',
    thresholdPeriod: TaxThresholdPeriod.CALENDAR_YEAR,
  };

  const sale = (net: string, over: Record<string, unknown> = {}) => ({
    id: 'tx-1',
    transactionDate: new Date('2026-05-01'),
    currency: 'GBP',
    transactionType: TransactionType.INCOME,
    taxNetAmount: net,
    ...over,
  });

  const NOW = new Date('2026-06-15T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    workspace = { id: 'ws-1', taxThresholdAlertLevel: 0, taxThresholdAlertWindow: null };
    workspaceRepo = createRepoMock();
    workspaceRepo.findOne.mockImplementation(async () => workspace);
    workspaceRepo.save.mockImplementation(async (row: unknown) => row);
    transactionRepo = createRepoMock();
    transactionRepo.find.mockResolvedValue([]);
    adoption = { getCurrentJurisdiction: jest.fn().mockResolvedValue(GB) };
    exchangeRates = { getRate: jest.fn().mockResolvedValue(1) };
    events = { emit: jest.fn() };

    service = new TaxThresholdService(
      workspaceRepo,
      transactionRepo,
      adoption as never,
      exchangeRates as never,
      events as never,
    );
  });

  describe('getStatus', () => {
    it('is absent when the workspace has no jurisdiction', async () => {
      adoption.getCurrentJurisdiction.mockResolvedValue(null);
      expect(await service.getStatus('ws-1', NOW)).toBeNull();
    });

    it('measures turnover over counted (confirmed, not duplicate, not transfer, not trashed) sales only', async () => {
      await service.getStatus('ws-1', NOW);

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

    it('sums the net of sales, not the tax on them', async () => {
      transactionRepo.find.mockResolvedValue([sale('10000.00'), sale('5000.00')]);

      const status = await service.getStatus('ws-1', NOW);

      expect(status?.turnover).toBe(15000);
      expect(status?.percentUsed).toBeCloseTo(16.67, 1);
    });

    it('converts foreign sales at the rate for their own date', async () => {
      transactionRepo.find.mockResolvedValue([sale('1000.00', { currency: 'USD' })]);
      exchangeRates.getRate.mockResolvedValue(0.8);

      const status = await service.getStatus('ws-1', NOW);

      expect(exchangeRates.getRate).toHaveBeenCalledWith(
        'USD',
        'GBP',
        new Date('2026-05-01'),
        'ws-1',
      );
      expect(status?.turnover).toBe(800);
    });

    it('reports no percentage when the jurisdiction publishes no threshold', async () => {
      adoption.getCurrentJurisdiction.mockResolvedValue({
        ...GB,
        registrationThreshold: null,
        thresholdPeriod: null,
      });
      transactionRepo.find.mockResolvedValue([sale('10000.00')]);

      const status = await service.getStatus('ws-1', NOW);

      expect(status?.threshold).toBeNull();
      expect(status?.percentUsed).toBe(0);
    });

    it('measures a calendar-year threshold over that year', async () => {
      adoption.getCurrentJurisdiction.mockResolvedValue(DE);

      const status = await service.getStatus('ws-1', NOW);

      expect(status?.periodStart).toBe('2026-01-01');
      expect(status?.periodEnd).toBe('2026-12-31');
      expect(status?.window).toBe('2026');
    });

    it('measures a rolling threshold over the twelve months ending today', async () => {
      const status = await service.getStatus('ws-1', NOW);

      expect(status?.periodStart).toBe('2025-06-16');
      expect(status?.periodEnd).toBe('2026-06-15');
    });
  });

  describe('checkWorkspace', () => {
    const turnoverOf = (net: string) => transactionRepo.find.mockResolvedValue([sale(net)]);

    it('says nothing below 80%', async () => {
      turnoverOf('50000.00');
      await service.checkWorkspace('ws-1', NOW);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('warns once at 80%', async () => {
      turnoverOf('72000.00');

      await service.checkWorkspace('ws-1', NOW);

      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit.mock.calls[0][0]).toBe('tax.threshold.reached');
      expect(events.emit.mock.calls[0][1]).toMatchObject({ level: 80 });
    });

    it('does not warn again on the next run', async () => {
      turnoverOf('72000.00');

      await service.checkWorkspace('ws-1', NOW);
      await service.checkWorkspace('ws-1', NOW);

      // The alert level and its window are stored, so a daily sweep is quiet
      // after the first crossing.
      expect(events.emit).toHaveBeenCalledTimes(1);
    });

    it('escalates from a warning to a breach', async () => {
      turnoverOf('72000.00');
      await service.checkWorkspace('ws-1', NOW);

      turnoverOf('95000.00');
      await service.checkWorkspace('ws-1', NOW);

      expect(events.emit).toHaveBeenCalledTimes(2);
      expect(events.emit.mock.calls[1][1]).toMatchObject({ level: 100 });
    });

    it('does not fall back to a warning once the breach was sent', async () => {
      turnoverOf('95000.00');
      await service.checkWorkspace('ws-1', NOW);

      turnoverOf('85000.00');
      await service.checkWorkspace('ws-1', NOW);

      expect(events.emit).toHaveBeenCalledTimes(1);
    });

    it('re-arms in a new measuring window', async () => {
      adoption.getCurrentJurisdiction.mockResolvedValue(DE);
      transactionRepo.find.mockResolvedValue([sale('24000.00', { currency: 'EUR' })]);

      await service.checkWorkspace('ws-1', new Date('2026-06-15T00:00:00.000Z'));
      await service.checkWorkspace('ws-1', new Date('2027-06-15T00:00:00.000Z'));

      // A new year is a new threshold, so the alerts start again with no job
      // to clear the flags.
      expect(events.emit).toHaveBeenCalledTimes(2);
    });

    it('stays quiet when the jurisdiction publishes no threshold', async () => {
      adoption.getCurrentJurisdiction.mockResolvedValue({
        ...GB,
        registrationThreshold: null,
      });
      turnoverOf('999999.00');

      await service.checkWorkspace('ws-1', NOW);

      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('checkAll', () => {
    it('keeps sweeping after one workspace fails', async () => {
      workspaceRepo.find.mockResolvedValue([{ id: 'ws-1' }, { id: 'ws-2' }]);
      const failing = jest
        .spyOn(service, 'checkWorkspace')
        .mockRejectedValueOnce(new Error('rate lookup down'))
        .mockResolvedValueOnce(null);

      await service.checkAll();

      // One broken workspace must not deny every other workspace its alert.
      expect(failing).toHaveBeenCalledTimes(2);
    });
  });
});
