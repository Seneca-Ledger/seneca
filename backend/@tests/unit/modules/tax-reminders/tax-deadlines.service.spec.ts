import { createRepoMock } from '../../../helpers/create-repo-mock';
import { TaxFilingPeriod } from '@/entities/tax-jurisdiction.entity';
import { VatStatus } from '@/entities/workspace.entity';
import { TaxDeadlinesService } from '@/modules/tax-reminders/tax-deadlines.service';
import { APP_NAME } from '../../../../src/common/brand';

describe('TaxDeadlinesService', () => {
  let service: TaxDeadlinesService;
  let workspaceRepo: ReturnType<typeof createRepoMock>;
  let taxReturnRepo: ReturnType<typeof createRepoMock> & { exists: jest.Mock };
  let incomeTaxReturnRepo: ReturnType<typeof createRepoMock> & { exists: jest.Mock };
  let profileRepo: ReturnType<typeof createRepoMock>;
  let settingsRepo: ReturnType<typeof createRepoMock>;
  let filing: { frequency: TaxFilingPeriod | null; extension: boolean };
  let events: { emit: jest.Mock };
  let workspace: Record<string, unknown>;
  let holidays: string[];

  beforeEach(() => {
    workspace = {
      id: 'ws-1',
      vatStatus: VatStatus.REGISTERED,
      settings: null,
      taxJurisdiction: { code: 'DE' },
    };
    workspaceRepo = createRepoMock();
    workspaceRepo.findOne.mockImplementation(async () => workspace);
    taxReturnRepo = Object.assign(createRepoMock(), { exists: jest.fn().mockResolvedValue(false) });
    incomeTaxReturnRepo = Object.assign(createRepoMock(), {
      exists: jest.fn().mockResolvedValue(false),
    });
    profileRepo = createRepoMock();
    profileRepo.findOne.mockResolvedValue(null);
    settingsRepo = createRepoMock();
    settingsRepo.findOne.mockResolvedValue(null);
    settingsRepo.save.mockImplementation(async (row: unknown) => row);
    filing = { frequency: TaxFilingPeriod.QUARTERLY, extension: false };
    events = { emit: jest.fn() };
    holidays = [];
    service = new TaxDeadlinesService(
      workspaceRepo as never,
      taxReturnRepo as never,
      incomeTaxReturnRepo as never,
      profileRepo as never,
      settingsRepo as never,
      { getVatFiling: jest.fn(async () => filing) } as never,
      events as never,
      { holidaysFor: jest.fn(async () => new Set(holidays)) } as never,
    );
  });

  describe('public holidays', () => {
    it('moves a VAT deadline past a holiday as well as the weekend', async () => {
      // Q3 2027 is due Sunday 10 October; say Monday the 11th were a holiday.
      holidays = ['2027-10-11'];
      const deadlines = await service.getUpcoming('ws-1', '2027-10-05');
      expect(deadlines.find(item => item.periodEnd === '2027-09-30')?.dueDate).toBe('2027-10-12');
    });

    it('says what a date is based on and when that was checked', async () => {
      const deadlines = await service.getUpcoming('ws-1', '2027-07-10');
      expect(deadlines.find(item => item.kind === 'vat_return')).toMatchObject({
        basis: 'statute',
        checkedAt: '2026-10-10',
      });
      expect(deadlines.find(item => item.kind === 'income_tax')).toMatchObject({
        basis: 'statute',
      });
    });
  });

  describe('getUpcoming', () => {
    it("lists the quarter just closed with Germany's 10th-of-the-month deadline", async () => {
      const deadlines = await service.getUpcoming('ws-1', '2026-10-05');
      const q3 = deadlines.find(item => item.periodEnd === '2026-09-30');
      // 10 October 2026 is a Saturday, so § 108 Abs. 3 AO moves it to Monday.
      expect(q3).toMatchObject({ kind: 'vat_return', dueDate: '2026-10-12', daysLeft: 7, done: false });
    });

    it('adds the month of a standing extension', async () => {
      filing.extension = true;
      const deadlines = await service.getUpcoming('ws-1', '2026-10-05');
      expect(deadlines.find(item => item.periodEnd === '2026-09-30')?.dueDate).toBe('2026-11-10');
    });

    it('marks a period filed in the app as done', async () => {
      taxReturnRepo.exists.mockResolvedValue(true);
      const deadlines = await service.getUpcoming('ws-1', '2026-10-05');
      expect(deadlines.filter(item => item.kind === 'vat_return').every(item => item.done)).toBe(true);
    });

    it('lists no VAT returns for a workspace that does not charge VAT', async () => {
      workspace.vatStatus = VatStatus.SMALL_BUSINESS;
      const deadlines = await service.getUpcoming('ws-1', '2026-10-05');
      expect(deadlines.some(item => item.kind === 'vat_return')).toBe(false);
    });

    it('lists no VAT returns for a country whose deadline was not verified', async () => {
      workspace.taxJurisdiction = { code: 'FR' };
      expect((await service.getUpcoming('ws-1', '2026-10-05')).length).toBe(0);
    });

    it('adds the income tax return while its deadline is ahead', async () => {
      const deadlines = await service.getUpcoming('ws-1', '2027-07-10');
      expect(deadlines.find(item => item.kind === 'income_tax')).toMatchObject({
        periodStart: '2026-01-01',
        dueDate: '2027-08-02',
      });
    });

    it('does not remind a household about the income tax return', async () => {
      workspace.settings = { profile: 'home' };
      const deadlines = await service.getUpcoming('ws-1', '2027-07-10');
      expect(deadlines.some(item => item.kind === 'income_tax')).toBe(false);
    });
  });

  describe('remindWorkspace', () => {
    it('sends the week-before reminder once', async () => {
      const first = await service.remindWorkspace('ws-1', '2026-10-05');
      settingsRepo.findOne.mockResolvedValue(settingsRepo.save.mock.calls[0][0]);
      const second = await service.remindWorkspace('ws-1', '2026-10-05');

      expect(first).toBe(1);
      expect(second).toBe(0);
      expect(events.emit).toHaveBeenCalledWith(
        'tax.deadline.upcoming',
        expect.objectContaining({ kind: 'vat_return', dueDate: '2026-10-12', daysLeft: 7 }),
      );
    });

    it('sends the day-before reminder after the week-before one', async () => {
      settingsRepo.findOne.mockResolvedValue({ config: { sent: ['vat_return:2026-09-30:7'] } });
      await service.remindWorkspace('ws-1', '2026-10-11');
      expect(events.emit).toHaveBeenCalledWith(
        'tax.deadline.upcoming',
        expect.objectContaining({ daysLeft: 1 }),
      );
    });

    it('says once that a return was missed, and then stops', async () => {
      expect(await service.remindWorkspace('ws-1', '2026-10-13')).toBe(1);
      expect(events.emit.mock.calls[0][1]).toMatchObject({ daysLeft: -1 });

      events.emit.mockClear();
      settingsRepo.findOne.mockResolvedValue(null);
      // Long past the deadline nothing more is sent.
      expect(await service.remindWorkspace('ws-1', '2026-10-25')).toBe(0);
    });

    it('sends nothing for a filed return', async () => {
      taxReturnRepo.exists.mockResolvedValue(true);
      expect(await service.remindWorkspace('ws-1', '2026-10-05')).toBe(0);
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe(`filed outside ${APP_NAME}`, () => {
    it('counts a return marked as filed elsewhere as done, and sends no reminder for it', async () => {
      settingsRepo.findOne.mockResolvedValue({
        config: { sent: [], filedElsewhere: ['vat_return:2026-09-30'] },
      });

      const q3 = (await service.getUpcoming('ws-1', '2026-10-05')).find(
        item => item.periodEnd === '2026-09-30',
      );
      expect(q3).toMatchObject({ done: true, filedElsewhere: true });
      expect(await service.remindWorkspace('ws-1', '2026-10-05')).toBe(0);
    });

    it('stores the mark beside the sent reminders, and takes it back', async () => {
      settingsRepo.findOne.mockResolvedValue({ config: { sent: ['vat_return:2026-09-30:7'] } });

      await service.setFiledElsewhere('ws-1', 'vat_return', '2026-09-30', true);
      expect(settingsRepo.save.mock.calls[0][0].config).toEqual({
        sent: ['vat_return:2026-09-30:7'],
        filedElsewhere: ['vat_return:2026-09-30'],
      });

      settingsRepo.findOne.mockResolvedValue({ config: settingsRepo.save.mock.calls[0][0].config });
      await service.setFiledElsewhere('ws-1', 'vat_return', '2026-09-30', false);
      expect(settingsRepo.save.mock.calls[1][0].config.filedElsewhere).toEqual([]);
    });

    it('retires the reminders for the period once it is marked as filed', async () => {
      await service.setFiledElsewhere('ws-1', 'vat_return', '2026-09-30', true);
      await service.setFiledElsewhere('ws-1', 'vat_return', '2026-09-30', false);

      const resolved = events.emit.mock.calls.filter(([name]) => name === 'tax.deadline.resolved');
      expect(resolved).toEqual([
        [
          'tax.deadline.resolved',
          { workspaceId: 'ws-1', kind: 'vat_return', periodEnd: '2026-09-30' },
        ],
      ]);
    });
  });
});
