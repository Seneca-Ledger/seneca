import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import nodemailer from 'nodemailer';
import { LessThanOrEqual, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import type { CreateReportScheduleBody, GenerateReportBody } from '../../contracts';
import { ReportSchedule, ReportScheduleCadence } from '../../entities/report-schedule.entity';
import { User } from '../../entities/user.entity';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';
import { ReportsService } from './reports.service';

/** Inclusive [from, to] ISO dates for the last completed period. */
export interface SchedulePeriod {
  dateFrom: string;
  dateTo: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ReportSchedulesService {
  private readonly logger = new Logger(ReportSchedulesService.name);

  constructor(
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepository: Repository<ReportSchedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly reportsService: ReportsService,
    private readonly applicationSettings: ApplicationSettingsService,
  ) {}

  /**
   * The period a run should cover: the last *completed* day, week or month.
   * Running on the 1st therefore reports the whole previous month, never a
   * partial current one.
   */
  resolvePeriod(cadence: ReportScheduleCadence, now: Date): SchedulePeriod {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (cadence === ReportScheduleCadence.DAILY) {
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return { dateFrom: toIsoDate(yesterday), dateTo: toIsoDate(yesterday) };
    }

    if (cadence === ReportScheduleCadence.WEEKLY) {
      const mondayThisWeek = new Date(today);
      mondayThisWeek.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
      const start = new Date(mondayThisWeek);
      start.setUTCDate(start.getUTCDate() - 7);
      const end = new Date(mondayThisWeek);
      end.setUTCDate(end.getUTCDate() - 1);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }

    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    // Day 0 of the current month is the last day of the previous one.
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
  }

  /** Next 06:00 UTC boundary after `from` for the given cadence. */
  computeNextRunAt(cadence: ReportScheduleCadence, from: Date): Date {
    const next = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 6, 0, 0, 0),
    );

    if (cadence === ReportScheduleCadence.DAILY) {
      if (next <= from) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return next;
    }

    if (cadence === ReportScheduleCadence.WEEKLY) {
      // Next Monday; if today is Monday but 06:00 has passed, jump a full week.
      const daysUntilMonday = (8 - next.getUTCDay()) % 7;
      next.setUTCDate(next.getUTCDate() + daysUntilMonday);
      if (next <= from) {
        next.setUTCDate(next.getUTCDate() + 7);
      }
      return next;
    }

    const firstOfNextMonth = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 6, 0, 0, 0),
    );
    return firstOfNextMonth;
  }

  async list(workspaceId: string): Promise<ReportSchedule[]> {
    return this.scheduleRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateReportScheduleBody,
  ): Promise<ReportSchedule> {
    if (dto.recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    const now = new Date();
    return this.scheduleRepository.save(
      this.scheduleRepository.create({
        workspaceId,
        userId,
        templateId: dto.templateId,
        format: dto.format,
        cadence: toEnum(ReportScheduleCadence, dto.cadence),
        recipients: dto.recipients,
        walletIds: dto.walletIds ?? [],
        categoryIds: dto.categoryIds ?? [],
        groupBy: dto.groupBy ?? null,
        locale: dto.locale ?? null,
        isActive: true,
        nextRunAt: this.computeNextRunAt(toEnum(ReportScheduleCadence, dto.cadence), now),
      }),
    );
  }

  async setActive(
    workspaceId: string,
    scheduleId: string,
    isActive: boolean,
  ): Promise<ReportSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, workspaceId },
    });
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    schedule.isActive = isActive;
    if (isActive) {
      // Resuming a long-paused schedule must not fire for every missed period.
      schedule.nextRunAt = this.computeNextRunAt(schedule.cadence, new Date());
    }
    return this.scheduleRepository.save(schedule);
  }

  async remove(workspaceId: string, scheduleId: string): Promise<void> {
    const result = await this.scheduleRepository.delete({ id: scheduleId, workspaceId });
    if (!result.affected) {
      throw new NotFoundException('Schedule not found');
    }
  }

  /**
   * Runs every schedule whose next_run_at has passed. Each one is isolated:
   * a failing schedule records its error and still advances, so one broken
   * recipient list cannot block the rest or spin forever.
   */
  async runDue(now = new Date()): Promise<{ ran: number; failed: number }> {
    const due = await this.scheduleRepository.find({
      where: { isActive: true, nextRunAt: LessThanOrEqual(now) },
    });

    let failed = 0;
    for (const schedule of due) {
      try {
        await this.runSchedule(schedule, now);
        schedule.lastError = null;
      } catch (error) {
        failed += 1;
        schedule.lastError = (error as Error).message.slice(0, 500);
        this.logger.error(
          `Scheduled report ${schedule.id} (${schedule.templateId}) failed`,
          error as Error,
        );
      }

      schedule.lastRunAt = now;
      schedule.nextRunAt = this.computeNextRunAt(schedule.cadence, now);
      await this.scheduleRepository.save(schedule);
    }

    return { ran: due.length, failed };
  }

  private async runSchedule(schedule: ReportSchedule, now: Date): Promise<void> {
    const period = this.resolvePeriod(schedule.cadence, now);

    const file = await this.reportsService.generateFromTemplate(
      schedule.workspaceId,
      schedule.userId,
      {
        templateId: schedule.templateId,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        // Stored from a CreateReportScheduleBody, checked against the same literals.
        format: schedule.format as GenerateReportBody['format'],
        walletIds: schedule.walletIds,
        categoryIds: schedule.categoryIds,
        groupBy: schedule.groupBy as 'day' | 'week' | 'month' | undefined,
        locale: (schedule.locale ?? undefined) as GenerateReportBody['locale'],
      },
    );

    await this.sendReportEmail(schedule, file.filePath, file.fileName, period);
  }

  private async sendReportEmail(
    schedule: ReportSchedule,
    filePath: string,
    fileName: string,
    period: SchedulePeriod,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: schedule.userId } });
    const smtp = await this.applicationSettings.getSmtpSettings(user);

    if (smtp.source === 'disabled' || !(smtp.host && smtp.from)) {
      throw new Error('SMTP is not configured for this workspace');
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
      connectionTimeout: smtp.timeoutMs,
      greetingTimeout: smtp.timeoutMs,
      socketTimeout: smtp.timeoutMs,
    });

    const subject = `${schedule.templateId}: ${period.dateFrom} — ${period.dateTo}`;

    await transporter.sendMail({
      from: smtp.from,
      to: schedule.recipients.join(', '),
      replyTo: smtp.replyTo || undefined,
      subject,
      text: `Scheduled report for ${period.dateFrom} — ${period.dateTo} is attached.`,
      // Читаем файл, а не отдаём поток: у потока ошибка чтения приходит
      // событием 'error', и без слушателя она роняет процесс целиком вместо
      // того, чтобы пометить расписание упавшим. Отчёты небольшие, чтения в
      // память достаточно.
      attachments: [{ filename: fileName, content: await fs.promises.readFile(filePath) }],
    });
  }
}
