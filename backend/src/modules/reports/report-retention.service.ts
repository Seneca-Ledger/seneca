import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, type Repository } from 'typeorm';
import { resolveInUploadsDir, resolveUploadsDir } from '../../common/utils/uploads.util';
import { ReportHistory } from '../../entities/report-history.entity';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_REPORT_HISTORY_TTL_DAYS = 90;

/** How long a generated file is kept; 0 keeps every file. */
export function reportHistoryTtlDays(raw = process.env.REPORT_HISTORY_TTL_DAYS): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_REPORT_HISTORY_TTL_DAYS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_REPORT_HISTORY_TTL_DAYS;
}

/**
 * Removes generated report files, and their history rows, once they are older
 * than REPORT_HISTORY_TTL_DAYS.
 *
 * A daily schedule writes a file every day and nothing else ever removes one, so
 * on a self-hosted box the disk only grows. The row goes with the file instead
 * of staying behind as a dead download: history lists what can still be
 * downloaded, and an older report is one generation away.
 */
@Injectable()
export class ReportRetentionService {
  constructor(
    @InjectRepository(ReportHistory)
    private readonly reportHistoryRepo: Repository<ReportHistory>,
  ) {}

  async purgeExpired(now = new Date()): Promise<{ removed: number }> {
    const ttlDays = reportHistoryTtlDays();
    if (ttlDays <= 0) {
      return { removed: 0 };
    }

    const cutoff = new Date(now.getTime() - ttlDays * MS_PER_DAY);
    const expired = await this.reportHistoryRepo.find({
      where: { generatedAt: LessThan(cutoff) },
      select: { id: true, filePath: true },
    });
    // Only a file inside the generated-reports folder is ours to delete.
    const reportsDir = path.resolve(resolveUploadsDir(), 'reports');
    for (const report of expired) {
      const file = report.filePath ? resolveInUploadsDir(report.filePath, reportsDir) : null;
      if (file) {
        await fs.promises.rm(file, { force: true });
      }
    }
    if (expired.length) {
      await this.reportHistoryRepo.delete(expired.map(report => report.id));
    }
    return { removed: expired.length };
  }
}
