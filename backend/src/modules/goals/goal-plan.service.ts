import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { Goal, GoalContribution } from '../../entities';
import { Budget } from '../../entities/budget.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import {
  computeMonthRange,
  normalizeLimitToMonth,
  overlapsWindow,
  toMonthKey,
} from '../budgets/budget-period.util';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { GoalItemsService } from './goal-items.service';
import {
  buildRateMap,
  convertWith,
  normalizeCurrency,
  round2,
  toDateOnly,
  toNumber,
} from './goal-money.util';

/**
 * How many complete months of history the pace and the income average read.
 * Three is short enough to react to a change in circumstances and long enough
 * that one large month does not become the forecast.
 */
const HISTORY_MONTHS = 3;

/** Below this share of free cash flow the plan is called tight rather than safe. */
const TIGHT_RATIO = 0.8;

export type GoalPlanStatus = 'reached' | 'no_deadline' | 'on_track' | 'tight' | 'not_feasible';

export interface GoalPlanResponse {
  goalId: string;
  /** Workspace currency. Every amount below is converted into it. */
  currency: string;
  target: {
    /** What the user declared the goal costs. */
    declared: number;
    /** What its cost lines add up to. Zero when nothing has been itemised. */
    estimated: number;
    /** Declared minus estimated: negative means the estimate has outgrown the goal. */
    unallocated: number;
  };
  saved: number;
  remaining: number;
  targetDate: string | null;
  /** Months left including the current one. Zero when the date has passed. */
  monthsLeft: number | null;
  /** What must be set aside each of those months. Null without a target date. */
  requiredPerMonth: number | null;
  /** What is actually being set aside, averaged over the observed history. */
  pace: { perMonth: number; monthsObserved: number };
  /**
   * When the goal arrives at the current pace. `month` is null when nothing is
   * being contributed — there is no date, and inventing a far one would be
   * worse than saying so.
   */
  forecast: { month: string | null; monthsLate: number | null };
  /** Room in the monthly budget: what comes in, what is already committed. */
  capacity: { income: number; committed: number; free: number };
  /** Required minus free. Positive is the shortfall to close. */
  gap: number | null;
  status: GoalPlanStatus;
}

/**
 * Whether a goal is reachable, and on what terms.
 *
 * The goals screen could already say how much was saved and how much was left,
 * which answers nothing about a multi-year plan. This answers the three
 * questions a long-horizon goal actually raises: how much per month the target
 * date demands, when the current pace really arrives, and whether the monthly
 * income left over after existing budgets can carry either number.
 *
 * Everything here is derived on read — nothing is stored — so the plan cannot
 * drift away from the contributions and budgets it summarises.
 */
@Injectable()
export class GoalPlanService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(GoalContribution)
    private readonly contributionRepository: Repository<GoalContribution>,
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly goalItemsService: GoalItemsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getPlan(goalId: string, workspaceId: string, now = new Date()): Promise<GoalPlanResponse> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');

    const currency = await this.getWorkspaceCurrency(workspaceId);
    const goalCurrency = normalizeCurrency(goal.currency);
    const history = historyWindow(now, HISTORY_MONTHS);

    const [saved, estimatedInGoalCurrency, contributedInHistory, budgets, incomeRows] =
      await Promise.all([
        this.sumContributions(workspaceId, goalId),
        this.goalItemsService.estimatedTotal(goalId, workspaceId, goalCurrency),
        this.sumContributions(workspaceId, goalId, history),
        this.budgetRepository.find({ where: { workspaceId } }),
        this.loadIncome(workspaceId, history),
      ]);

    const rates = await buildRateMap(
      this.exchangeRatesService,
      [goalCurrency, ...budgets.map(budget => budget.currency), ...incomeRows.map(r => r.currency)],
      currency,
      workspaceId,
    );
    const fromGoal = (amount: number): number => convertWith(rates, amount, goalCurrency);

    const declared = fromGoal(toNumber(goal.targetAmount));
    const estimated = fromGoal(estimatedInGoalCurrency);
    const savedTotal = fromGoal(saved);
    const remaining = Math.max(declared - savedTotal, 0);

    const monthsLeft = goal.targetDate ? monthsUntil(now, goal.targetDate) : null;
    const requiredPerMonth =
      monthsLeft === null ? null : monthsLeft > 0 ? remaining / monthsLeft : remaining;

    // The goal cannot have been contributed to before it existed, so a young
    // goal is averaged over the complete months it has actually been around.
    // Dividing a two-week-old goal by three would report a third of its real
    // pace; zero observed months reports no pace at all rather than a fake one.
    const monthsObserved = Math.min(HISTORY_MONTHS, monthsSinceStart(goal.createdAt, now));
    const perMonth =
      monthsObserved === 0 ? 0 : round2(fromGoal(contributedInHistory) / monthsObserved);

    const monthsNeeded =
      remaining === 0 ? 0 : perMonth > 0 ? Math.ceil(remaining / perMonth) : null;
    // The first of those months is this one, so N contributions land in month
    // N-1 from now — not N, which would push every forecast a month late.
    const forecastMonth =
      monthsNeeded === null
        ? null
        : toMonthKey(addMonths(startOfMonth(now), Math.max(monthsNeeded - 1, 0)));
    const monthsLate =
      monthsNeeded === null || monthsLeft === null ? null : Math.max(monthsNeeded - monthsLeft, 0);

    const monthWindow = computeMonthRange(now);
    const committed = budgets
      .filter(budget => overlapsWindow(monthWindow, budget))
      .reduce(
        (sum, budget) =>
          sum +
          normalizeLimitToMonth(
            convertWith(rates, budget.limitAmount, budget.currency),
            budget.periodType,
          ),
        0,
      );
    const income =
      incomeRows.reduce((sum, row) => sum + convertWith(rates, row.total, row.currency), 0) /
      HISTORY_MONTHS;
    const free = income - committed;

    return {
      goalId: goal.id,
      currency,
      target: {
        declared: round2(declared),
        estimated: round2(estimated),
        unallocated: round2(declared - estimated),
      },
      saved: round2(savedTotal),
      remaining: round2(remaining),
      targetDate: goal.targetDate,
      monthsLeft,
      requiredPerMonth: requiredPerMonth === null ? null : round2(requiredPerMonth),
      pace: { perMonth, monthsObserved },
      forecast: { month: forecastMonth, monthsLate },
      capacity: { income: round2(income), committed: round2(committed), free: round2(free) },
      gap: requiredPerMonth === null ? null : round2(requiredPerMonth - free),
      status: resolveStatus(remaining, requiredPerMonth, free),
    };
  }

  /** Contributions for the goal, optionally restricted to a date window. */
  private async sumContributions(
    workspaceId: string,
    goalId: string,
    window?: { start: Date; end: Date },
  ): Promise<number> {
    const query = this.contributionRepository
      .createQueryBuilder('contribution')
      .select('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.workspace_id = :workspaceId', { workspaceId })
      .andWhere('contribution.goal_id = :goalId', { goalId });

    if (window) {
      query
        .andWhere('contribution.contribution_date >= :start', { start: toDateOnly(window.start) })
        .andWhere('contribution.contribution_date <= :end', { end: toDateOnly(window.end) });
    }

    const row = await query.getRawOne<{ total: string }>();
    return toNumber(row?.total);
  }

  /**
   * Income over the history window, by currency. Same filters the budgets page
   * uses for spending — no statement join, no status gate — so the two sides of
   * the capacity figure are drawn from the same population of rows.
   */
  private async loadIncome(
    workspaceId: string,
    window: { start: Date; end: Date },
  ): Promise<Array<{ currency: string; total: string }>> {
    return this.transactionRepository
      .createQueryBuilder('t')
      .select('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transaction_type = :type', { type: TransactionType.INCOME })
      .andWhere('t.transaction_date >= :start', { start: window.start })
      .andWhere('t.transaction_date <= :end', { end: window.end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(countedSql('t'))
      .groupBy('t.currency')
      .getRawMany<{ currency: string; total: string }>();
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    return normalizeCurrency(workspace?.currency);
  }
}

/**
 * A plan is only as good as the room left for it, so free cash flow decides the
 * verdict rather than the required amount alone: setting aside 300k a month is
 * comfortable on one income and impossible on another.
 */
function resolveStatus(
  remaining: number,
  requiredPerMonth: number | null,
  free: number,
): GoalPlanStatus {
  if (remaining === 0) {
    return 'reached';
  }
  if (requiredPerMonth === null) {
    return 'no_deadline';
  }
  if (free <= 0 || requiredPerMonth > free) {
    return 'not_feasible';
  }
  return requiredPerMonth > free * TIGHT_RATIO ? 'tight' : 'on_track';
}

/** The last `months` complete calendar months, current month excluded. */
function historyWindow(now: Date, months: number): { start: Date; end: Date } {
  const firstOfThisMonth = startOfMonth(now);
  return {
    start: addMonths(firstOfThisMonth, -months),
    end: new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth(), 0),
  };
}

/**
 * Months from now to the target, counting the current one. A date inside this
 * month leaves one month, not zero; a date already past leaves none.
 */
function monthsUntil(now: Date, targetDate: string): number {
  const [year, month] = targetDate.split('-').map(Number);
  const diff = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth()) + 1;
  return Math.max(diff, 0);
}

/** Complete months of history the goal itself has, counting the current one. */
function monthsSinceStart(createdAt: Date, now: Date): number {
  const created = new Date(createdAt);
  return (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
