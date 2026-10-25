import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { readWorkspaceProfile } from '../../common/utils/workspace-profile.util';
import { IncomeTaxProfile } from '../../entities/income-tax-profile.entity';
import { IncomeTaxReturn, IncomeTaxReturnStatus } from '../../entities/income-tax-return.entity';
import { TaxReturn, TaxReturnStatus } from '../../entities/tax-return.entity';
import { VatStatus, Workspace, WorkspaceKind } from '../../entities/workspace.entity';
import {
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities/workspace-service-settings.entity';
import { filingInfoFor } from '../income-tax/filing-info';
import type {
  TaxDeadlineResolvedEvent,
  TaxDeadlineUpcomingEvent,
} from '../notifications/events/notification-events';
import { PublicHolidaysService } from '../reference-data/public-holidays.service';
import { toDateOnly } from '../tax/jurisdictions.service';
import {
  type Period,
  periodContaining,
  previousPeriod,
  VAT_DEADLINE_RULES,
  VAT_DEADLINES_CHECKED_AT,
  vatReturnDueDate,
} from '../tax/vat-deadlines';
import { WorkspaceTaxSettingsService } from '../tax/workspace-tax-settings.service';

export interface TaxDeadline {
  kind: 'vat_return' | 'income_tax';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  daysLeft: number;
  /** Filed (VAT) or finalized (income tax) in the app, or marked as filed outside it. */
  done: boolean;
  /** The user said this return was filed outside Seneca. */
  filedElsewhere: boolean;
  returnName: string;
  /**
   * statute: worked out from the rule in the law; published: the date the
   * authority announced for this year. `checkedAt` is when that was read.
   */
  basis: 'statute' | 'published';
  checkedAt: string;
}

/** Previous VAT periods looked at: an overdue return stays visible for a while, then drops off. */
const VAT_LOOKBACK_PERIODS = 2;
/** Reminder points, in days before the due date; 0 = the day itself, -1 = overdue. */
const VAT_REMINDERS = [7, 1, -1];
const INCOME_TAX_REMINDERS = [30, 7, 1];
const SENT_KEYS_KEPT = 60;

interface ReminderState {
  sent: string[];
  filedElsewhere: string[];
}

function returnKey(item: { kind: string; periodEnd: string }): string {
  return `${item.kind}:${item.periodEnd}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * What tax returns are coming up for a workspace, and the daily sweep that
 * reminds its members.
 *
 * Only verified rules are used: a country whose VAT deadline was not checked
 * gets no VAT reminders, and income-tax dates come from the verified filing
 * calendar. "Done" means filed (VAT) or finalized (income tax) here; a return
 * filed elsewhere is unknown to the app, so the reminders stop once it is
 * filed in Seneca too, or once the return falls out of the look-back window.
 */
@Injectable()
export class TaxDeadlinesService {
  private readonly logger = new Logger(TaxDeadlinesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(TaxReturn)
    private readonly taxReturnRepository: Repository<TaxReturn>,
    @InjectRepository(IncomeTaxReturn)
    private readonly incomeTaxReturnRepository: Repository<IncomeTaxReturn>,
    @InjectRepository(IncomeTaxProfile)
    private readonly incomeTaxProfileRepository: Repository<IncomeTaxProfile>,
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
    private readonly taxSettingsService: WorkspaceTaxSettingsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly publicHolidaysService: PublicHolidaysService,
  ) {}

  async getUpcoming(
    workspaceId: string,
    today: string = toDateOnly(new Date()),
  ): Promise<TaxDeadline[]> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const country = workspace?.taxJurisdiction?.code;
    if (!(workspace && country)) {
      return [];
    }
    const elsewhere = new Set((await this.reminderState(workspaceId)).filedElsewhere);
    // Due dates around today fall in these years; a deadline on a holiday moves past it.
    const thisYear = Number(today.slice(0, 4));
    const holidays = await this.publicHolidaysService.holidaysFor(country, [
      thisYear - 1,
      thisYear,
      thisYear + 1,
    ]);
    return [
      ...(await this.vatDeadlines(workspace, country, today, holidays)),
      ...(await this.incomeTaxDeadlines(workspace, country, today, holidays)),
    ]
      .map(item => {
        const filedElsewhere = elsewhere.has(returnKey(item));
        return { ...item, filedElsewhere, done: item.done || filedElsewhere };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  /**
   * Marks a return as filed outside Seneca, or takes the mark back. It stops
   * the reminders and the banner without locking anything: the rows were not
   * filed from here, so nothing here is frozen.
   */
  async setFiledElsewhere(
    workspaceId: string,
    kind: TaxDeadline['kind'],
    periodEnd: string,
    filed: boolean,
  ): Promise<void> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.TAX_REMINDERS },
    });
    const state = {
      sent: [],
      filedElsewhere: [],
      ...((row?.config ?? {}) as Partial<ReminderState>),
    };
    const key = returnKey({ kind, periodEnd });
    const marked = new Set(state.filedElsewhere);
    if (filed) {
      marked.add(key);
    } else {
      marked.delete(key);
    }
    await this.settingsRepository.save({
      ...(row ?? {}),
      workspaceId,
      key: WorkspaceServiceSettingsKey.TAX_REMINDERS,
      config: { ...state, filedElsewhere: [...marked].slice(-SENT_KEYS_KEPT) },
    });
    if (filed) {
      this.eventEmitter.emit('tax.deadline.resolved', {
        workspaceId,
        kind,
        periodEnd,
      } satisfies TaxDeadlineResolvedEvent);
    }
  }

  private async reminderState(workspaceId: string): Promise<ReminderState> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.TAX_REMINDERS },
    });
    const config = (row?.config ?? {}) as Partial<ReminderState>;
    return { sent: config.sent ?? [], filedElsewhere: config.filedElsewhere ?? [] };
  }

  private async vatDeadlines(
    workspace: Workspace,
    country: string,
    today: string,
    holidays: ReadonlySet<string>,
  ): Promise<TaxDeadline[]> {
    const rule = VAT_DEADLINE_RULES[country];
    if (workspace.vatStatus !== VatStatus.REGISTERED || !rule) {
      return [];
    }
    const filing = await this.taxSettingsService.getVatFiling(workspace.id);
    if (!(filing.frequency && rule.frequencies[filing.frequency])) {
      return [];
    }

    // The current period and the ones before it; the current one is not due
    // until it ends, so it is listed only to show what comes next.
    const periods: Period[] = [periodContaining(today, filing.frequency)];
    for (let i = 0; i < VAT_LOOKBACK_PERIODS; i++) {
      periods.push(previousPeriod(periods[periods.length - 1], filing.frequency));
    }

    const deadlines: TaxDeadline[] = [];
    for (const period of periods) {
      const dueDate = vatReturnDueDate(
        country,
        filing.frequency,
        period.end,
        filing.extension,
        holidays,
      );
      if (!dueDate) {
        continue;
      }
      const filed = await this.taxReturnRepository.exists({
        where: {
          workspaceId: workspace.id,
          periodStart: period.start,
          periodEnd: period.end,
          status: TaxReturnStatus.FILED,
        },
      });
      deadlines.push({
        kind: 'vat_return',
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
        daysLeft: daysBetween(today, dueDate),
        done: filed,
        filedElsewhere: false,
        returnName: rule.returnName,
        basis: 'statute',
        checkedAt: VAT_DEADLINES_CHECKED_AT,
      });
    }
    return deadlines;
  }

  private async incomeTaxDeadlines(
    workspace: Workspace,
    country: string,
    today: string,
    holidays: ReadonlySet<string>,
  ): Promise<TaxDeadline[]> {
    // The declaration is a business feature; a household is not reminded.
    if (readWorkspaceProfile(workspace) === 'home') {
      return [];
    }
    const deadlines: TaxDeadline[] = [];
    const thisYear = Number(today.slice(0, 4));
    for (const taxYear of [thisYear - 1, thisYear]) {
      const profile = await this.incomeTaxProfileRepository.findOne({
        where: { workspaceId: workspace.id, taxYear },
      });
      const info = filingInfoFor(
        country,
        taxYear,
        profile?.taxpayerType ?? 'self_employed',
        profile?.details ?? {},
        holidays,
      );
      const standard =
        info?.deadlines.find(deadline => deadline.kind === 'standard') ?? info?.deadlines[0];
      if (!(info && standard) || standard.date < today) {
        continue;
      }
      const finalized = await this.incomeTaxReturnRepository.exists({
        where: { workspaceId: workspace.id, taxYear, status: IncomeTaxReturnStatus.FINALIZED },
      });
      deadlines.push({
        kind: 'income_tax',
        periodStart: `${taxYear}-01-01`,
        periodEnd: `${taxYear}-12-31`,
        dueDate: standard.date,
        daysLeft: daysBetween(today, standard.date),
        done: finalized,
        filedElsewhere: false,
        returnName: info.formName,
        basis: info.basis,
        checkedAt: info.checkedAt,
      });
    }
    return deadlines;
  }

  /**
   * Sends each reminder once: a week and a day before a VAT return is due and
   * the day after it was missed; a month, a week and a day before the income
   * tax return. The keys sent are kept per workspace, so re-running the sweep
   * the same day sends nothing new.
   */
  async remindWorkspace(
    workspaceId: string,
    today: string = toDateOnly(new Date()),
  ): Promise<number> {
    const deadlines = (await this.getUpcoming(workspaceId, today)).filter(item => !item.done);
    if (deadlines.length === 0) {
      return 0;
    }

    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.TAX_REMINDERS },
    });
    const config = (row?.config ?? {}) as Partial<ReminderState>;
    const sent = new Set<string>(config.sent ?? []);
    const newlySent: string[] = [];

    for (const deadline of deadlines) {
      const points = deadline.kind === 'vat_return' ? VAT_REMINDERS : INCOME_TAX_REMINDERS;
      // The nearest reminder point already reached; earlier ones are not sent
      // late on top of it.
      const point = points.filter(days => deadline.daysLeft <= days).sort((a, b) => a - b)[0];
      if (point === undefined || (point === -1 && deadline.daysLeft < -7)) {
        continue;
      }
      const key = `${deadline.kind}:${deadline.periodEnd}:${point}`;
      if (sent.has(key)) {
        continue;
      }
      this.eventEmitter.emit('tax.deadline.upcoming', {
        workspaceId,
        kind: deadline.kind,
        periodStart: deadline.periodStart,
        periodEnd: deadline.periodEnd,
        dueDate: deadline.dueDate,
        daysLeft: deadline.daysLeft,
        returnName: deadline.returnName,
      } satisfies TaxDeadlineUpcomingEvent);
      sent.add(key);
      newlySent.push(key);
    }

    if (newlySent.length > 0) {
      await this.settingsRepository.save({
        ...(row ?? {}),
        workspaceId,
        key: WorkspaceServiceSettingsKey.TAX_REMINDERS,
        config: { ...config, sent: [...sent].slice(-SENT_KEYS_KEPT) },
      });
    }
    return newlySent.length;
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async remindAll(): Promise<void> {
    // A past version is a copy, not a workspace anyone files from.
    const workspaces = await this.workspaceRepository.find({
      where: { taxJurisdictionId: Not(IsNull()), kind: WorkspaceKind.STANDARD },
      select: {
        id: true,
      },
    });
    for (const workspace of workspaces) {
      try {
        await this.remindWorkspace(workspace.id);
      } catch (error) {
        // One workspace failing must not cost every other one its reminder.
        this.logger.error(
          `Tax deadline reminder failed for workspace ${workspace.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
