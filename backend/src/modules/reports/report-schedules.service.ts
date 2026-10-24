import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import nodemailer from 'nodemailer';
import { LessThanOrEqual, type Repository } from 'typeorm';
import { workspaceRoleAllows } from '../../common/authz/workspace-permissions';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type { CreateReportScheduleBody, GenerateReportBody } from '../../contracts';
import { ReportSchedule, ReportScheduleCadence } from '../../entities/report-schedule.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import {
  ApplicationSettingsService,
  smtpConnectTarget,
} from '../application-settings/application-settings.service';
import { renderTemplateLabels, templateTitle } from './report-template.translations';
import { ReportsService } from './reports.service';

/** Inclusive [from, to] ISO dates for the last completed period. */
export interface SchedulePeriod {
  dateFrom: string;
  dateTo: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** How far ahead of UTC `timeZone` is at that instant, in milliseconds. */
function zoneOffset(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find(part => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - at.getTime();
}

/**
 * The instant at which a wall clock in `timeZone` reads the given date and hour.
 *
 * The offset depends on the instant we are looking for, so the first guess is
 * corrected once and then checked again — enough to land on the right side of a
 * daylight-saving change.
 */
function zonedTime(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const wallClock = Date.UTC(year, month, day, hour);
  // Each pass measures the offset again at the instant found so far, but always
  // corrects the same wall-clock target — subtracting twice would walk away.
  let utc = wallClock - zoneOffset(new Date(wallClock), timeZone);
  utc = wallClock - zoneOffset(new Date(utc), timeZone);
  return new Date(utc);
}

/** The calendar parts a wall clock in `timeZone` shows at that instant. */
function zonedParts(at: Date, timeZone: string): { year: number; month: number; day: number } {
  const iso = new Date(at.getTime() + zoneOffset(at, timeZone));
  return { year: iso.getUTCFullYear(), month: iso.getUTCMonth(), day: iso.getUTCDate() };
}

/** A schedule falls back to UTC only when its owner never set a time zone. */
function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return 'UTC';
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** Reports go out at 06:00 on the owner's clock, not on the server's. */
const SEND_HOUR = 6;

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
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
  ) {}

  /**
   * The period a run should cover: the last *completed* day, week or month.
   * Running on the 1st therefore reports the whole previous month, never a
   * partial current one.
   */
  resolvePeriod(cadence: ReportScheduleCadence, now: Date, timeZone = 'UTC'): SchedulePeriod {
    const local = zonedParts(now, resolveTimeZone(timeZone));
    const today = new Date(Date.UTC(local.year, local.month, local.day));

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

  /**
   * The next 06:00 on the owner's clock for the given cadence.
   *
   * Stored as an instant, so a report lands at breakfast wherever the reader
   * is rather than at whatever hour 06:00 UTC happens to be there — and keeps
   * landing at breakfast across a daylight-saving change.
   */
  computeNextRunAt(cadence: ReportScheduleCadence, from: Date, timeZone = 'UTC'): Date {
    const zone = resolveTimeZone(timeZone);
    const local = zonedParts(from, zone);
    const at = (dayOffset: number): Date =>
      zonedTime(local.year, local.month, local.day + dayOffset, SEND_HOUR, zone);

    if (cadence === ReportScheduleCadence.DAILY) {
      const today = at(0);
      return today > from ? today : at(1);
    }

    if (cadence === ReportScheduleCadence.WEEKLY) {
      // Monday on the owner's calendar, not on the server's.
      const weekday = new Date(Date.UTC(local.year, local.month, local.day)).getUTCDay();
      const daysUntilMonday = (8 - weekday) % 7;
      const monday = at(daysUntilMonday);
      return monday > from ? monday : at(daysUntilMonday + 7);
    }

    return zonedTime(local.year, local.month + 1, 1, SEND_HOUR, zone);
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
    ReportsService.assertTemplateFormat(dto.templateId, dto.format);

    const now = new Date();
    const timeZone = await this.timeZoneOf(userId);
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
        nextRunAt: this.computeNextRunAt(toEnum(ReportScheduleCadence, dto.cadence), now, timeZone),
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
      schedule.nextRunAt = this.computeNextRunAt(
        schedule.cadence,
        new Date(),
        await this.timeZoneOf(schedule.userId),
      );
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
    // A past version keeps its copied schedules but never mails them.
    const due = await this.scheduleRepository.find({
      where: { isActive: true, nextRunAt: LessThanOrEqual(now), workspace: STANDARD_WORKSPACE },
    });

    let failed = 0;
    let ran = 0;
    for (const schedule of due) {
      if (!(await this.creatorMayStillExport(schedule))) {
        // Mailing on would hand the workspace's figures to someone it no longer trusts with them.
        schedule.isActive = false;
        schedule.lastError = 'Paused: whoever set this up can no longer export reports here';
        await this.scheduleRepository.save(schedule);
        continue;
      }
      ran += 1;
      const timeZone = await this.timeZoneOf(schedule.userId);
      try {
        await this.runSchedule(schedule, now, timeZone);
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
      schedule.nextRunAt = this.computeNextRunAt(schedule.cadence, now, timeZone);
      await this.scheduleRepository.save(schedule);
    }

    return { ran, failed };
  }

  /** The schedule's creator is still a member allowed to take the reports away. */
  private async creatorMayStillExport(schedule: ReportSchedule): Promise<boolean> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId: schedule.workspaceId, userId: schedule.userId },
      select: {
        role: true,
        permissions: true,
      },
    });
    return workspaceRoleAllows(Permission.REPORT_EXPORT, membership?.role, membership?.permissions);
  }

  private async runSchedule(schedule: ReportSchedule, now: Date, timeZone: string): Promise<void> {
    const period = this.resolvePeriod(schedule.cadence, now, timeZone);

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

  /** The owner's time zone, or UTC when they never picked one. */
  private async timeZoneOf(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        timeZone: true,
      },
    });
    return resolveTimeZone(user?.timeZone);
  }

  private async sendReportEmail(
    schedule: ReportSchedule,
    filePath: string,
    fileName: string,
    period: SchedulePeriod,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: schedule.userId } });
    // The schedule's workspace sends its report, whatever the owner's home workspace is.
    const smtp = await this.applicationSettings.getSmtpSettings(schedule.workspaceId);

    if (smtp.source === 'disabled' || !(smtp.host && smtp.from)) {
      throw new Error('SMTP is not configured for this workspace');
    }

    const transporter = nodemailer.createTransport({
      ...(await smtpConnectTarget(smtp, smtp.host)),
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
      connectionTimeout: smtp.timeoutMs,
      greetingTimeout: smtp.timeoutMs,
      socketTimeout: smtp.timeoutMs,
    });

    const locale = schedule.locale ?? user?.locale ?? undefined;
    const name = templateTitle(schedule.templateId, locale) ?? schedule.templateId;
    const subject = `${name}: ${period.dateFrom} — ${period.dateTo}`;

    await transporter.sendMail({
      from: smtp.from,
      to: schedule.recipients.join(', '),
      replyTo: smtp.replyTo || undefined,
      subject,
      text: `${name}\n${period.dateFrom} — ${period.dateTo}\n\n${
        renderTemplateLabels(locale).scheduledMailBody
      }`,
      // Читаем файл, а не отдаём поток: у потока ошибка чтения приходит
      // событием 'error', и без слушателя она роняет процесс целиком вместо
      // того, чтобы пометить расписание упавшим. Отчёты небольшие, чтения в
      // память достаточно.
      attachments: [{ filename: fileName, content: await fs.promises.readFile(filePath) }],
    });
  }
}
