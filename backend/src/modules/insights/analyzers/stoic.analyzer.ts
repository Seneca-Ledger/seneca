import { Injectable, Logger } from '@nestjs/common';
import { InsightCategory, InsightSeverity } from '../../../entities/insight.entity';
import { StoicLedgerService } from '../../budgets/stoic/stoic-ledger.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { GoalPlanService } from '../../goals/goal-plan.service';
import { GoalsService } from '../../goals/goals.service';
import { collectExpertSignals } from '../stoic/expert-signals';
import { StoicBehaviorService } from '../stoic/stoic-behavior.service';
import {
  collectSignals,
  JUDGE_CURRENT_FROM_DAY,
  SERIOUS_PRIORITY,
  type StoicCommitments,
  type StoicGoalView,
  type StoicSignal,
} from '../stoic/stoic-signals';
import { STOIC_VARIANT_COUNT } from '../stoic-texts/types';
import type { AnalysisContext, InsightAnalyzer, InsightCandidate } from './analyzer.interface';

/** More than this and the page stops being advice and becomes a report. */
const MAX_STOIC_CARDS = 5;
/** Expert principles are a second voice, not a second report. */
const MAX_EXPERT_CARDS = 2;
/** Goals checked for pace; each one is a plan computation. */
const MAX_GOALS = 5;
/** How far ahead upcoming payments are weighed against the balance. */
const COMMITMENT_HORIZON_DAYS = 45;

/** A small stable hash, so each workspace gets its own rotation of wordings. */
function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

/**
 * Advice in the Stoic sense. Budgets say what the user meant to spend on
 * necessity, work, virtue and leisure; transactions, goals and upcoming
 * payments say what is actually happening. The signals (stoic-signals.ts)
 * name every gap, habit and good month the data supports; this class decides
 * which of them to say, and in which of five wordings.
 *
 * All candidates are INFO: this is reflection for the Advice page, not an
 * alarm for the banner.
 */
@Injectable()
export class StoicAnalyzer implements InsightAnalyzer {
  private readonly logger = new Logger(StoicAnalyzer.name);

  constructor(
    private readonly stoicLedgerService: StoicLedgerService,
    private readonly stoicBehaviorService: StoicBehaviorService,
    private readonly goalsService: GoalsService,
    private readonly goalPlanService: GoalPlanService,
    private readonly dashboardService: DashboardService,
  ) {}

  async analyze(context: AnalysisContext, now = new Date()): Promise<InsightCandidate[]> {
    const workspaceId = context.workspaceId;
    if (!workspaceId) {
      return [];
    }

    const balance = await this.stoicLedgerService.monthlyBalance(workspaceId, 6, now);
    const judgesPreviousMonth = now.getDate() < JUDGE_CURRENT_FROM_DAY;
    const referenceStart = new Date(
      now.getFullYear(),
      now.getMonth() - (judgesPreviousMonth ? 1 : 0),
      1,
    );

    // Each source is optional: a failing goal plan must not silence the budgets.
    const [behavior, goals, commitments] = await Promise.all([
      this.optional('behavior', () =>
        this.stoicBehaviorService.load(workspaceId, balance.currency, referenceStart),
      ),
      this.optional('goals', () => this.loadGoals(workspaceId, now)),
      this.optional('commitments', () => this.loadCommitments(workspaceId)),
    ]);

    const stoicContext = { now, balance, behavior, goals: goals ?? [], commitments };
    const signals = collectSignals(stoicContext);
    const experts = collectExpertSignals(stoicContext)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_EXPERT_CARDS);
    const referenceMonth = balance.months[judgesPreviousMonth ? 1 : 0]?.month ?? 'none';
    const expiresAt = judgesPreviousMonth
      ? new Date(now.getFullYear(), now.getMonth(), JUDGE_CURRENT_FROM_DAY)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const rotation =
      hash(workspaceId) + referenceStart.getFullYear() * 12 + referenceStart.getMonth();

    const toCandidate = (signal: StoicSignal, category: InsightCategory): InsightCandidate => ({
      type: signal.type,
      category,
      severity: InsightSeverity.INFO,
      messageKey: signal.key,
      messageParams: {
        ...signal.params,
        currency: balance.currency,
        // The same situation reads differently from one month to the next,
        // and differently in two workspaces in the same month.
        variant: (rotation + hash(signal.key)) % STOIC_VARIANT_COUNT,
      },
      deduplicationKey: [
        category,
        signal.praise ? 'praise' : signal.key.replace(/^(stoic|expert)\./, ''),
        workspaceId,
        signal.subject ?? '',
        referenceMonth,
      ].join(':'),
      // Priority travels with the row so the daily quote can pick the
      // situation that matters most without recomputing anything.
      data: { month: referenceMonth, priority: signal.priority, ...signal.params, ...signal.data },
      expiresAt,
    });

    return [
      ...this.select(signals, rotation).map(signal => toCandidate(signal, InsightCategory.STOIC)),
      ...experts.map(signal => toCandidate(signal, InsightCategory.EXPERT)),
    ];
  }

  /**
   * The most important corrections first, capped. One praise is added when
   * nothing serious needs correcting — which one rotates month by month among
   * those the data supports, so a good streak is not praised the same way twice.
   */
  private select(signals: StoicSignal[], rotation: number): StoicSignal[] {
    const corrections = signals
      .filter(signal => !signal.praise)
      .sort((a, b) => b.priority - a.priority);
    const praises = signals.filter(signal => signal.praise);
    const serious = corrections.some(signal => signal.priority >= SERIOUS_PRIORITY);

    const praise = !serious && praises.length > 0 ? [praises[rotation % praises.length]] : [];
    return [...praise, ...corrections].slice(0, MAX_STOIC_CARDS);
  }

  private async loadGoals(workspaceId: string, now: Date): Promise<StoicGoalView[]> {
    const goals = (await this.goalsService.findAll(workspaceId))
      .filter(goal => !goal.isReached && goal.targetDate)
      .slice(0, MAX_GOALS);
    return Promise.all(
      goals.map(async goal => {
        const plan = await this.goalPlanService.getPlan(goal.id, workspaceId, now);
        return {
          id: goal.id,
          name: goal.name,
          percent: goal.percent,
          status: plan.status,
          requiredPerMonth: plan.requiredPerMonth,
          pacePerMonth: plan.pace.perMonth,
          monthsLate: plan.forecast.monthsLate,
          freePerMonth: plan.capacity.free,
        };
      }),
    );
  }

  private async loadCommitments(workspaceId: string): Promise<StoicCommitments> {
    const commitments = await this.dashboardService.getCommitments(
      workspaceId,
      COMMITMENT_HORIZON_DAYS,
    );
    return {
      openingBalance: commitments.openingBalance,
      shortfallDate: commitments.shortfallDate,
      lowestBalance: commitments.lowestBalance,
      totalCommitted: commitments.totalCommitted,
    };
  }

  private async optional<T>(source: string, load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ type: 'stoic_source_failed', source, message });
      return null;
    }
  }
}
