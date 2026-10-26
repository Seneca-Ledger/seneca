import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ReportRetentionService, reportHistoryTtlDays } from '@/modules/reports/report-retention.service';

/**
 * Generated files were never removed: a daily schedule writes one a day and a
 * self-hosted box fills up quietly.
 */

function buildService(rows: Array<{ id: string; filePath: string | null }>) {
  const historyRepo = {
    find: vi.fn(async (_options: any) => rows),
    delete: vi.fn(async () => ({ affected: rows.length })),
  };
  return { service: new ReportRetentionService(historyRepo as any), historyRepo };
}

describe('report retention', () => {
  const saved = {
    ttl: process.env.REPORT_HISTORY_TTL_DAYS,
    uploads: process.env.UPLOADS_DIR,
  };
  let uploads: string;
  let reports: string;

  beforeEach(() => {
    uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'seneca-retention-'));
    reports = path.join(uploads, 'reports', 'ws-1');
    fs.mkdirSync(reports, { recursive: true });
    process.env.UPLOADS_DIR = uploads;
    delete process.env.REPORT_HISTORY_TTL_DAYS;
  });

  afterEach(() => {
    fs.rmSync(uploads, { recursive: true, force: true });
    for (const [key, value] of [
      ['REPORT_HISTORY_TTL_DAYS', saved.ttl],
      ['UPLOADS_DIR', saved.uploads],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('removes the file and its row together', async () => {
    const filePath = path.join(reports, 'pnl.csv');
    fs.writeFileSync(filePath, 'old');
    const { service, historyRepo } = buildService([{ id: 'r1', filePath }]);

    await expect(service.purgeExpired()).resolves.toEqual({ removed: 1 });

    expect(fs.existsSync(filePath)).toBe(false);
    expect(historyRepo.delete).toHaveBeenCalledWith(['r1']);
  });

  it('survives a row whose file is already gone', async () => {
    const { service } = buildService([{ id: 'r1', filePath: path.join(reports, 'gone.csv') }]);

    await expect(service.purgeExpired()).resolves.toEqual({ removed: 1 });
  });

  it('never deletes a file outside the reports folder, whatever the row says', async () => {
    const outside = path.join(uploads, 'statement.pdf');
    fs.writeFileSync(outside, 'keep');
    const { service } = buildService([{ id: 'r1', filePath: outside }]);

    await service.purgeExpired();

    expect(fs.existsSync(outside)).toBe(true);
  });

  it('keeps everything when the retention is turned off', async () => {
    process.env.REPORT_HISTORY_TTL_DAYS = '0';
    const filePath = path.join(reports, 'pnl.csv');
    fs.writeFileSync(filePath, 'old');
    const { service, historyRepo } = buildService([{ id: 'r1', filePath }]);

    await expect(service.purgeExpired()).resolves.toEqual({ removed: 0 });

    expect(fs.existsSync(filePath)).toBe(true);
    expect(historyRepo.find).not.toHaveBeenCalled();
  });

  it('asks for rows older than the retention window', async () => {
    process.env.REPORT_HISTORY_TTL_DAYS = '30';
    const { service, historyRepo } = buildService([]);

    await service.purgeExpired(new Date('2026-03-31T00:00:00.000Z'));

    const where = historyRepo.find.mock.calls[0][0].where.generatedAt;
    expect(where.type).toBe('lessThan');
    expect(where.value).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('falls back to 90 days for an unset or unreadable setting', () => {
    expect(reportHistoryTtlDays(undefined)).toBe(90);
    expect(reportHistoryTtlDays('')).toBe(90);
    expect(reportHistoryTtlDays('soon')).toBe(90);
    expect(reportHistoryTtlDays('7')).toBe(7);
  });
});
