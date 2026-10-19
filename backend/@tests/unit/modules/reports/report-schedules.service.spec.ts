import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ReportScheduleCadence } from '@/entities/report-schedule.entity';
import { ReportSchedulesService } from '@/modules/reports/report-schedules.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Сервис прикладывает сгенерированный отчёт к письму, поэтому путь из мока
// должен указывать на реально существующий файл.
const REPORT_FIXTURE = path.join(os.tmpdir(), `seneca-report-fixture-${process.pid}.csv`);

beforeAll(() => {
  fs.writeFileSync(REPORT_FIXTURE, 'date,amount\n');
});

afterAll(() => {
  fs.rmSync(REPORT_FIXTURE, { force: true });
});

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  const scheduleRepository = {
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    save: jest.fn(async (row: unknown) => row),
    create: jest.fn((row: unknown) => row),
    delete: jest.fn(async () => ({ affected: 1 })),
    ...(overrides.scheduleRepository as object),
  };
  const userRepository = { findOne: jest.fn(async () => ({ id: 'u1' })) };
  const reportsService = {
    generateFromTemplate: jest.fn(async () => ({
      filePath: REPORT_FIXTURE,
      fileName: 'report.csv',
      contentType: 'text/csv',
    })),
    ...(overrides.reportsService as object),
  };
  const applicationSettings = {
    getSmtpSettings: jest.fn(async () => ({ source: 'disabled', host: null, from: null })),
    ...(overrides.applicationSettings as object),
  };

  const service = new ReportSchedulesService(
    scheduleRepository as never,
    userRepository as never,
    reportsService as never,
    applicationSettings as never,
  );

  return { service, scheduleRepository, reportsService, applicationSettings };
}

describe('ReportSchedulesService.resolvePeriod', () => {
  const { service } = createService();

  it('covers yesterday for a daily schedule', () => {
    // Runs early on the 5th → reports the 4th, never a partial 5th.
    expect(
      service.resolvePeriod(ReportScheduleCadence.DAILY, new Date('2026-03-05T06:00:00.000Z')),
    ).toEqual({ dateFrom: '2026-03-04', dateTo: '2026-03-04' });
  });

  it('covers the previous Monday-to-Sunday week', () => {
    // 2026-03-09 is a Monday.
    expect(
      service.resolvePeriod(ReportScheduleCadence.WEEKLY, new Date('2026-03-09T06:00:00.000Z')),
    ).toEqual({ dateFrom: '2026-03-02', dateTo: '2026-03-08' });
  });

  it('covers the previous calendar month, including its real last day', () => {
    // February 2026 has 28 days.
    expect(
      service.resolvePeriod(ReportScheduleCadence.MONTHLY, new Date('2026-03-01T06:00:00.000Z')),
    ).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' });
  });

  it('handles a leap February', () => {
    expect(
      service.resolvePeriod(ReportScheduleCadence.MONTHLY, new Date('2024-03-10T06:00:00.000Z')),
    ).toEqual({ dateFrom: '2024-02-01', dateTo: '2024-02-29' });
  });
});

describe('ReportSchedulesService.computeNextRunAt', () => {
  const { service } = createService();

  it('moves a daily schedule to tomorrow once today 06:00 has passed', () => {
    expect(
      service.computeNextRunAt(ReportScheduleCadence.DAILY, new Date('2026-03-05T07:00:00.000Z')),
    ).toEqual(new Date('2026-03-06T06:00:00.000Z'));
  });

  it('keeps a daily schedule today when 06:00 is still ahead', () => {
    expect(
      service.computeNextRunAt(ReportScheduleCadence.DAILY, new Date('2026-03-05T05:00:00.000Z')),
    ).toEqual(new Date('2026-03-05T06:00:00.000Z'));
  });

  it('lands a weekly schedule on the next Monday', () => {
    // 2026-03-05 is a Thursday.
    expect(
      service.computeNextRunAt(ReportScheduleCadence.WEEKLY, new Date('2026-03-05T07:00:00.000Z')),
    ).toEqual(new Date('2026-03-09T06:00:00.000Z'));
  });

  it('skips a full week when run on Monday after 06:00', () => {
    expect(
      service.computeNextRunAt(ReportScheduleCadence.WEEKLY, new Date('2026-03-09T07:00:00.000Z')),
    ).toEqual(new Date('2026-03-16T06:00:00.000Z'));
  });

  it('lands a monthly schedule on the first of next month', () => {
    expect(
      service.computeNextRunAt(ReportScheduleCadence.MONTHLY, new Date('2026-12-20T07:00:00.000Z')),
    ).toEqual(new Date('2027-01-01T06:00:00.000Z'));
  });
});

describe('ReportSchedulesService.runDue', () => {
  const now = new Date('2026-03-05T07:00:00.000Z');

  function dueSchedule(id: string) {
    return {
      id,
      workspaceId: 'ws1',
      userId: 'u1',
      templateId: 'pnl',
      format: 'csv',
      cadence: ReportScheduleCadence.DAILY,
      recipients: ['finance@example.com'],
      walletIds: [],
      categoryIds: [],
      groupBy: null,
      locale: null,
      isActive: true,
      nextRunAt: new Date('2026-03-05T06:00:00.000Z'),
      lastRunAt: null,
      lastError: 'previous failure',
    };
  }

  it('records the failure but still advances the schedule', async () => {
    const schedule = dueSchedule('s1');
    const { service, scheduleRepository } = createService({
      scheduleRepository: { find: jest.fn(async () => [schedule]) },
    });

    // SMTP is disabled in the default mock, so delivery throws.
    const result = await service.runDue(now);

    expect(result).toEqual({ ran: 1, failed: 1 });
    const saved = scheduleRepository.save.mock.calls[0][0];
    expect(saved.lastError).toContain('SMTP is not configured');
    // Advanced anyway, otherwise the sweep would retry it every hour forever.
    expect(saved.nextRunAt).toEqual(new Date('2026-03-06T06:00:00.000Z'));
    expect(saved.lastRunAt).toEqual(now);
  });

  it('does not let one broken schedule stop the others', async () => {
    const { service, scheduleRepository, reportsService } = createService({
      scheduleRepository: { find: jest.fn(async () => [dueSchedule('s1'), dueSchedule('s2')]) },
      reportsService: {
        generateFromTemplate: jest
          .fn()
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValue({ filePath: '/tmp/r.csv', fileName: 'r.csv', contentType: 'text/csv' }),
      },
    });

    const result = await service.runDue(now);

    expect(reportsService.generateFromTemplate).toHaveBeenCalledTimes(2);
    expect(result.ran).toBe(2);
    expect(scheduleRepository.save).toHaveBeenCalledTimes(2);
  });

  it('clears a stale error after a successful run', async () => {
    const { service, scheduleRepository } = createService({
      scheduleRepository: { find: jest.fn(async () => [dueSchedule('s1')]) },
      applicationSettings: {
        getSmtpSettings: jest.fn(async () => ({
          source: 'env',
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          user: null,
          pass: null,
          from: 'noreply@example.com',
          replyTo: null,
          timeoutMs: 1000,
        })),
      },
    });

    // Stub the transport so no real connection is attempted.
    const nodemailer = require('nodemailer');
    const sendMail = jest.fn(async () => undefined);
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);

    const result = await service.runDue(now);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe('finance@example.com');
    // Named in the reader's language, not by its id.
    expect(sendMail.mock.calls[0][0].subject).toMatch(/^Profit & Loss \(P&L\): /);
    expect(result).toEqual({ ran: 1, failed: 0 });
    expect(scheduleRepository.save.mock.calls[0][0].lastError).toBeNull();
  });
});

describe('ReportSchedulesService CRUD', () => {
  it('rejects a schedule with no recipients', async () => {
    const { service } = createService();
    await expect(
      service.create('ws1', 'u1', {
        templateId: 'pnl',
        format: 'csv',
        cadence: ReportScheduleCadence.DAILY,
        recipients: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a template it does not know when the schedule is created', async () => {
    const { service, scheduleRepository } = createService();
    await expect(
      service.create('ws1', 'u1', {
        templateId: 'no-such-report',
        format: 'csv',
        cadence: ReportScheduleCadence.DAILY,
        recipients: ['a@example.com'],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(scheduleRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a format the template cannot be written in', async () => {
    const { service, scheduleRepository } = createService();
    // The Balance Sheet has no CSV renderer; without this check the schedule
    // would be saved and fail on every run.
    await expect(
      service.create('ws1', 'u1', {
        templateId: 'balance-sheet',
        format: 'csv',
        cadence: ReportScheduleCadence.DAILY,
        recipients: ['a@example.com'],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(scheduleRepository.save).not.toHaveBeenCalled();
  });

  it('reschedules from now when a paused schedule is resumed', async () => {
    const schedule = {
      id: 's1',
      workspaceId: 'ws1',
      cadence: ReportScheduleCadence.DAILY,
      isActive: false,
      nextRunAt: new Date('2020-01-01T06:00:00.000Z'),
    };
    const { service } = createService({
      scheduleRepository: { findOne: jest.fn(async () => schedule) },
    });

    const resumed = await service.setActive('ws1', 's1', true);

    // A years-old next_run_at must not cause a burst of catch-up runs.
    expect(resumed.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('404s when deleting a schedule from another workspace', async () => {
    const { service } = createService({
      scheduleRepository: { delete: jest.fn(async () => ({ affected: 0 })) },
    });
    await expect(service.remove('ws1', 's1')).rejects.toThrow(NotFoundException);
  });
});

describe("ReportSchedulesService on the owner's clock", () => {
  const { service } = createService();

  it('sends at 06:00 local, not at 06:00 UTC', () => {
    // Almaty is UTC+5, so breakfast there is 01:00 UTC.
    expect(
      service
        .computeNextRunAt(
          ReportScheduleCadence.DAILY,
          new Date('2026-03-05T02:00:00.000Z'),
          'Asia/Almaty',
        )
        .toISOString(),
    ).toBe('2026-03-06T01:00:00.000Z');
  });

  it('keeps 06:00 local across a daylight-saving change', () => {
    // Berlin moves to UTC+2 on 29 March 2026: 06:00 local goes from 05:00 to 04:00 UTC.
    expect(
      service
        .computeNextRunAt(
          ReportScheduleCadence.DAILY,
          new Date('2026-03-28T06:00:00.000Z'),
          'Europe/Berlin',
        )
        .toISOString(),
    ).toBe('2026-03-29T04:00:00.000Z');
  });

  it("counts yesterday by the owner's calendar", () => {
    // 00:30 UTC on the 6th is already 05:30 on the 6th in Almaty, so the last
    // whole day there is the 5th — in UTC it would still look like the 4th.
    expect(
      service.resolvePeriod(
        ReportScheduleCadence.DAILY,
        new Date('2026-03-06T00:30:00.000Z'),
        'Asia/Almaty',
      ),
    ).toEqual({ dateFrom: '2026-03-05', dateTo: '2026-03-05' });
  });

  it('falls back to UTC for a zone it does not recognise', () => {
    expect(
      service
        .computeNextRunAt(
          ReportScheduleCadence.DAILY,
          new Date('2026-03-05T07:00:00.000Z'),
          'Mars/Olympus',
        )
        .toISOString(),
    ).toBe('2026-03-06T06:00:00.000Z');
  });
});
