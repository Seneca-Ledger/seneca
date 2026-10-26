import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { countedWhere } from '../../common/utils/counted-transactions.util';
import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../common/utils/money.util';
import { readWorkspaceProfile } from '../../common/utils/workspace-profile.util';
import { TaxThresholdPeriod } from '../../entities/tax-jurisdiction.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { VatStatus, Workspace, WorkspaceKind } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { TaxThresholdReachedEvent } from '../notifications/events/notification-events';
import { JurisdictionAdoptionService } from './jurisdiction-adoption.service';
import { toDateOnly } from './jurisdictions.service';

export interface ThresholdStatus {
  /** Null when the jurisdiction publishes no threshold we track. */
  threshold: number | null;
  turnover: number;
  currency: string;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
  /** Identifies the measuring window, so an alert can be tied to it. */
  window: string;
  /** Currencies of sales left out for want of an exchange rate on their day. */
  missingRateCurrencies: string[];
}

/** Income that is not a sale: moving money, borrowing, wages, tax refunds. */
const NOT_TURNOVER: ReadonlySet<string> = new Set(['transfer', 'loan', 'salary', 'tax']);

/**
 * Watches taxable turnover against the registration threshold.
 *
 * Crossing it is what obliges a business to register for VAT, and missing that
 * moment is expensive, so the point of this is to say something before it
 * happens rather than after.
 */
@Injectable()
export class TaxThresholdService {
  private readonly logger = new Logger(TaxThresholdService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly adoptionService: JurisdictionAdoptionService,
    private readonly exchangeRatesService: ExchangeRatesService,
    // Emitted, not injected: importing NotificationsModule here closes a module
    // cycle through telegram -> reports -> transactions -> tax.
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * The window the threshold is measured over.
   *
   * A calendar year resets on 1 January; a rolling window always ends today
   * and is therefore keyed by that date, so it is re-evaluated daily.
   */
  private resolveWindow(
    period: TaxThresholdPeriod,
    now: Date,
  ): { periodStart: string; periodEnd: string; window: string } {
    if (period === TaxThresholdPeriod.CALENDAR_YEAR) {
      const year = now.getUTCFullYear();
      return {
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        window: String(year),
      };
    }

    const start = new Date(now);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    start.setUTCDate(start.getUTCDate() + 1);

    return {
      periodStart: toDateOnly(start),
      periodEnd: toDateOnly(now),
      window: `r${toDateOnly(now)}`,
    };
  }

  /**
   * Taxable turnover in the window, in the jurisdiction's currency.
   *
   * Turnover is the net of what was sold, not the tax on it, and only income
   * counts — purchases do not make you liable to register.
   */
  async getStatus(workspaceId: string, now: Date = new Date()): Promise<ThresholdStatus | null> {
    // The threshold is what obliges a business to register for VAT. One that
    // is registered is past it, and a household never has to register.
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, vatStatus: true, settings: true },
    });
    if (
      !workspace ||
      workspace.vatStatus === VatStatus.REGISTERED ||
      readWorkspaceProfile(workspace) === 'home'
    ) {
      return null;
    }

    const jurisdiction = await this.adoptionService.getCurrentJurisdiction(workspaceId);
    if (!jurisdiction) {
      return null;
    }

    const period = jurisdiction.thresholdPeriod ?? TaxThresholdPeriod.CALENDAR_YEAR;
    const { periodStart, periodEnd, window } = this.resolveWindow(period, now);
    const threshold =
      jurisdiction.registrationThreshold === null
        ? null
        : Number(jurisdiction.registrationThreshold);

    // Every categorised sale, not only the ones VAT was worked out on: a
    // business below the threshold has no VAT assessed at all, and it is the
    // one this exists for.
    const sales = await this.transactionRepository.find({
      // Money moved in from the user's own account is not turnover.
      where: countedWhere({
        workspaceId,
        transferPairId: IsNull(),
        transactionType: TransactionType.INCOME,
        transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
        categoryId: Not(IsNull()),
      }),
    });

    let turnoverMinor = 0;
    const missing = new Set<string>();
    for (const sale of sales) {
      if (sale.transactionNature && NOT_TURNOVER.has(sale.transactionNature)) {
        continue;
      }
      // Turnover is the net of what was sold, not the VAT on it.
      const net = Number(
        sale.taxNetAmount !== null && !sale.taxReverseCharge
          ? sale.taxNetAmount
          : (sale.amount ?? sale.credit ?? 0),
      );
      if (!Number.isFinite(net) || net === 0) {
        continue;
      }

      const from = (sale.currency || jurisdiction.currency).toUpperCase();
      // Never `getRate`: it answers 1 without a rate, and a dollar sale
      // would count as one tenge towards the threshold.
      const rate =
        from === jurisdiction.currency
          ? 1
          : await this.exchangeRatesService.getRateOrNull(
              from,
              jurisdiction.currency,
              new Date(sale.transactionDate),
              workspaceId,
            );
      if (rate === null) {
        missing.add(from);
        continue;
      }

      turnoverMinor += roundHalfAwayFromZero(toMinor(net) * rate);
    }

    const turnover = fromMinor(turnoverMinor);

    return {
      threshold,
      turnover,
      currency: jurisdiction.currency,
      percentUsed: threshold && threshold > 0 ? (turnover / threshold) * 100 : 0,
      periodStart,
      periodEnd,
      window,
      missingRateCurrencies: [...missing],
    };
  }

  /**
   * Sends at most one alert per escalation point per window.
   *
   * The level and the window are stored together, so entering a new year
   * re-arms both alerts without a job to reset them, and re-running this on
   * the same day sends nothing the second time.
   */
  async checkWorkspace(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<ThresholdStatus | null> {
    const status = await this.getStatus(workspaceId, now);
    if (!(status?.threshold && status.threshold > 0)) {
      return status;
    }

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      return status;
    }

    // A different window means the previous alerts belong to a period that has
    // closed, so escalation starts again from nothing.
    const sentLevel =
      workspace.taxThresholdAlertWindow === status.window ? workspace.taxThresholdAlertLevel : 0;

    const reachedLevel = status.percentUsed >= 100 ? 100 : status.percentUsed >= 80 ? 80 : 0;
    if (reachedLevel === 0 || reachedLevel <= sentLevel) {
      return status;
    }

    workspace.taxThresholdAlertLevel = reachedLevel;
    workspace.taxThresholdAlertWindow = status.window;
    await this.workspaceRepository.save(workspace);

    this.eventEmitter.emit('tax.threshold.reached', {
      workspaceId,
      level: reachedLevel,
      turnover: status.turnover,
      threshold: status.threshold,
      currency: status.currency,
      percentUsed: Math.round(status.percentUsed),
      periodStart: status.periodStart,
      periodEnd: status.periodEnd,
    } satisfies TaxThresholdReachedEvent);

    this.logger.log(
      `Workspace ${workspaceId} reached ${Math.round(status.percentUsed)}% of its ` +
        `${status.currency} ${status.threshold} registration threshold`,
    );

    return status;
  }

  /** Only workspaces that have chosen a jurisdiction are worth examining. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkAll(): Promise<void> {
    // Registered workspaces are past the threshold; getStatus skips them and
    // households too, but there is no point loading them.
    const workspaces = await this.workspaceRepository.find({
      where: {
        taxJurisdictionId: Not(IsNull()),
        vatStatus: In([VatStatus.NOT_REGISTERED, VatStatus.SMALL_BUSINESS]),
        // A past version is a copy of books already checked; it raises no alerts.
        kind: WorkspaceKind.STANDARD,
      },
      select: {
        id: true,
      },
    });

    for (const workspace of workspaces) {
      try {
        await this.checkWorkspace(workspace.id);
      } catch (error) {
        // One workspace with a broken rate lookup must not stop the sweep.
        this.logger.error(
          `Threshold check failed for workspace ${workspace.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
