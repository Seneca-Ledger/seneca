import { createRepoMock } from '../../../helpers/create-repo-mock';
import { TaxRateKind } from '@/entities/tax-jurisdiction-rate.entity';
import { VatStatus } from '@/entities/workspace.entity';
import type { TedbVersion } from '@/modules/reference-data/tedb-vat-rates.service';
import { OfficialVatRatesService } from '@/modules/tax/official-vat-rates.service';

const rate = (id: string, kind: TaxRateKind, value: number, extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  rate: value.toFixed(2),
  validFrom: '1900-01-01',
  validTo: null,
  isReverseCharge: false,
  ...extra,
});

describe('OfficialVatRatesService', () => {
  let workspace: Record<string, unknown>;
  let rates: Array<Record<string, unknown>>;
  let versions: TedbVersion[];
  let settings: Record<string, unknown> | null;
  let taxRates: { startNewVersion: jest.Mock; addStatutoryRate: jest.Mock };
  let assignment: { reassess: jest.Mock };
  let events: { emit: jest.Mock };
  let service: OfficialVatRatesService;

  beforeEach(() => {
    workspace = {
      id: 'ws-1',
      vatStatus: VatStatus.REGISTERED,
      taxJurisdictionId: 'at',
      taxJurisdiction: { id: 'at', code: 'AT', isEu: true, taxName: 'USt' },
    };
    rates = [
      rate('std', TaxRateKind.STANDARD, 20),
      rate('std-rc', TaxRateKind.STANDARD, 20, { isReverseCharge: true }),
      rate('r10', TaxRateKind.REDUCED, 10),
      rate('r13', TaxRateKind.REDUCED, 13),
      rate('zero', TaxRateKind.ZERO, 0),
    ];
    versions = [
      { from: '2025-01-01', standard: 20, reduced: [{ rate: 10, kind: 'reduced', categories: [] }, { rate: 13, kind: 'reduced', categories: [] }] },
      {
        from: '2026-07-01',
        standard: 20,
        reduced: [
          { rate: 4.9, kind: 'super_reduced', categories: ['FOODSTUFFS'] },
          { rate: 10, kind: 'reduced', categories: [] },
          { rate: 13, kind: 'reduced', categories: [] },
        ],
      },
    ];
    settings = null;

    const workspaceRepo = createRepoMock();
    workspaceRepo.findOne.mockImplementation(async () => workspace);
    (workspaceRepo as unknown as { findOneOrFail: jest.Mock }).findOneOrFail = jest.fn(
      async () => workspace,
    );
    const rateRepo = createRepoMock();
    rateRepo.find.mockImplementation(async () => rates);
    const settingsRepo = createRepoMock();
    settingsRepo.findOne.mockImplementation(async () => settings);
    settingsRepo.save.mockImplementation(async (row: Record<string, unknown>) => {
      settings = row;
      return row;
    });
    const tedb = {
      stored: jest.fn(async () => ({
        snapshot: { country: 'AT', rangeFrom: '2024-10-11', rangeTo: '2027-10-11', versions },
        fetchedAt: new Date('2026-10-11T05:00:00Z'),
      })),
      snapshot: jest.fn(),
    };
    taxRates = { startNewVersion: jest.fn(), addStatutoryRate: jest.fn() };
    assignment = { reassess: jest.fn() };
    events = { emit: jest.fn() };
    service = new OfficialVatRatesService(
      workspaceRepo as never,
      rateRepo as never,
      settingsRepo as never,
      tedb as never,
      taxRates as never,
      assignment as never,
      events as never,
    );
  });

  it("finds Austria's 4.9% food rate missing since 1 July 2026", async () => {
    const check = await service.check('ws-1', { today: '2026-10-11' });
    expect(check).toMatchObject({ supported: true, country: 'AT', dismissed: [] });
    expect(check.differences).toEqual([
      {
        key: 'reduced_missing:4.9:2026-07-01',
        kind: 'reduced_missing',
        official: 4.9,
        ours: null,
        from: '2026-07-01',
        categories: ['FOODSTUFFS'],
        canApply: true,
      },
    ]);
  });

  it('finds an announced standard rate change, and nothing once the rates match', async () => {
    versions.push({ ...versions[1], from: '2027-01-01', standard: 22 });
    const check = await service.check('ws-1', { today: '2026-10-11' });
    expect(check.differences.find(item => item.kind === 'standard_changed')).toMatchObject({
      key: 'standard_changed:22:2027-01-01',
      official: 22,
      ours: 20,
      from: '2027-01-01',
      canApply: true,
    });

    rates.push(rate('r49', TaxRateKind.REDUCED, 4.9));
    versions.pop();
    expect((await service.check('ws-1', { today: '2026-10-11' })).differences).toEqual([]);
  });

  it('cannot apply a standard rate that differed before TEDB’s range begins', async () => {
    versions = versions.map(version => ({ ...version, standard: 21 }));
    const [difference] = (await service.check('ws-1', { today: '2026-10-11' })).differences.filter(
      item => item.kind === 'standard_changed',
    );
    expect(difference).toMatchObject({ from: null, canApply: false });
  });

  it('points out a reduced rate of ours the member state does not report', async () => {
    rates.push(rate('r48', TaxRateKind.REDUCED, 4.8));
    const check = await service.check('ws-1', { today: '2026-10-11' });
    expect(check.differences.find(item => item.kind === 'reduced_unlisted')).toMatchObject({
      key: 'reduced_unlisted:4.8',
      ours: 4.8,
      canApply: false,
    });
  });

  it('says nothing for a workspace that does not charge VAT, or outside the EU', async () => {
    workspace.vatStatus = VatStatus.SMALL_BUSINESS;
    expect((await service.check('ws-1')).supported).toBe(false);
    workspace.vatStatus = VatStatus.REGISTERED;
    workspace.taxJurisdiction = { code: 'GB', isEu: false };
    expect((await service.check('ws-1')).supported).toBe(false);
  });

  it('hides a dismissed difference and counts it', async () => {
    await service.dismiss('ws-1', 'reduced_missing:4.9:2026-07-01', true);
    const check = await service.check('ws-1', { today: '2026-10-11' });
    expect(check.differences).toEqual([]);
    expect(check.dismissed.map(item => item.key)).toEqual(['reduced_missing:4.9:2026-07-01']);
  });

  it('applies a standard change to the rate and its twin, then reassesses from that date', async () => {
    versions.push({ ...versions[1], from: '2027-01-01', standard: 22 });
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T12:00:00Z'));
    try {
      await service.apply('ws-1', 'standard_changed:22:2027-01-01', 'user-1');
    } finally {
      jest.useRealTimers();
    }
    expect(taxRates.startNewVersion.mock.calls.map(call => call[1]).sort()).toEqual([
      'std',
      'std-rc',
    ]);
    expect(taxRates.startNewVersion).toHaveBeenCalledWith('ws-1', 'std', 22, '2027-01-01', 'user-1');
    expect(assignment.reassess).toHaveBeenCalledWith('ws-1', { from: '2027-01-01' });
  });

  it('adds a missing reduced rate from the day it applies', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T12:00:00Z'));
    try {
      await service.apply('ws-1', 'reduced_missing:4.9:2026-07-01', 'user-1');
    } finally {
      jest.useRealTimers();
    }
    expect(taxRates.addStatutoryRate).toHaveBeenCalledWith(
      'ws-1',
      {
        jurisdictionId: 'at',
        code: 'AT_REDUCED_4_9',
        name: 'USt 4.9%',
        kind: TaxRateKind.REDUCED,
        rate: 4.9,
        validFrom: '2026-07-01',
      },
      'user-1',
    );
    expect(assignment.reassess).not.toHaveBeenCalled();
  });

  it('announces a difference once', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T12:00:00Z'));
    try {
      const check = await service.check('ws-1');
      await (service as unknown as { announce: (id: string, c: unknown) => Promise<void> }).announce(
        'ws-1',
        check,
      );
      await (service as unknown as { announce: (id: string, c: unknown) => Promise<void> }).announce(
        'ws-1',
        check,
      );
    } finally {
      jest.useRealTimers();
    }
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('tax.rates.official_changed', {
      workspaceId: 'ws-1',
      country: 'AT',
      count: 1,
    });
  });
});
