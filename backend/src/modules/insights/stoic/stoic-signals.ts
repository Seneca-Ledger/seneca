import { StoicClass } from '../../../entities/category.entity';
import { InsightType } from '../../../entities/insight.entity';
import type {
  StoicBalance,
  StoicMonth,
  StoicTotals,
} from '../../budgets/stoic/stoic-ledger.service';
import type { StoicMessageKey } from '../stoic-texts/types';
import type { StoicBehavior } from './stoic-behavior.service';

/** Points of spending share between what was planned for a class and what it got. */
const INTENT_GAP_POINTS = 10;
/** Months out of the window before a repeat is called a habit. */
const HABIT_MONTHS = 3;
/** Consecutive months before postponed virtue is called neglect. */
const NEGLECT_MONTHS = 2;
/** Spending above the whole plan by this share is worth a word. */
const TOTAL_OVER_PLAN_RATIO = 1.1;
/** A budget projected past its limit by this much, early enough to act. */
const PACE_OVERSHOOT_RATIO = 1.15;
const PACE_MIN_DAY = 7;
/** Share of spending outside every budget before the plan is called partial. */
const UNBUDGETED_SHARE = 0.35;
/** One leisure category holding this share of leisure. */
const LEISURE_CONCENTRATION_SHARE = 0.7;
/** Leisure must be at least this share of the month to judge how it is spent. */
const LEISURE_MIN_SHARE = 0.1;
/** Month-over-month growth that counts as necessities creeping. */
const CREEP_STEP = 1.05;
/** Purchases at one merchant before they are a habit, and how small "small" is. */
const SMALL_PURCHASE_COUNT = 8;
const SMALL_PURCHASE_MAX_SHARE = 0.03;
const FEWER_SMALL_RATIO = 0.6;
const WEEKEND_LEISURE_SHARE = 0.6;
const TOP_MERCHANT_SHARE = 0.2;
const INCOME_DROP = 0.2;
const SUBSCRIPTIONS_MIN_COUNT = 3;
const SUBSCRIPTIONS_SHARE = 0.1;
/** Saving this share of income over the window counts as earning well. */
const GENEROUS_SAVINGS_RATE = 0.2;
/** Below this share of income given to others, a gentle hint; at the other, praise. */
const GENEROSITY_HINT_SHARE = 0.01;
const GENEROSITY_PRAISE_SHARE = 0.02;
const GENEROSITY_MONTHS = 3;
/** Before this day the running month is too young to judge; the previous one is. */
export const JUDGE_CURRENT_FROM_DAY = 10;
/**
 * Corrections at or above this priority are serious enough that praising the
 * month next to them would ring false. Softer notes — a weekend pattern, an
 * unused budget — can sit beside praise.
 */
export const SERIOUS_PRIORITY = 40;

export interface StoicGoalView {
  id: string;
  name: string;
  percent: number;
  status: 'reached' | 'no_deadline' | 'on_track' | 'tight' | 'not_feasible';
  requiredPerMonth: number | null;
  pacePerMonth: number;
  monthsLate: number | null;
  freePerMonth: number;
}

export interface StoicCommitments {
  /** Balance today, the start of the projection. */
  openingBalance: number;
  shortfallDate: string | null;
  lowestBalance: number;
  totalCommitted: number;
}

export interface StoicContext {
  now: Date;
  balance: StoicBalance;
  behavior: StoicBehavior | null;
  goals: StoicGoalView[];
  commitments: StoicCommitments | null;
}

export interface StoicSignal {
  key: StoicMessageKey;
  type: InsightType;
  /** Higher is more important; decides what survives the cap. */
  priority: number;
  praise?: boolean;
  params: Record<string, string | number>;
  /** Routing handles for the client: stoicClass, categoryId, goalId, merchant. */
  data?: Record<string, unknown>;
  /** Distinguishes two signals of the same key, e.g. two categories. */
  subject?: string;
}

const sumTotals = (totals: StoicTotals) => Object.values(totals).reduce((sum, v) => sum + v, 0);

const share = (totals: StoicTotals, stoicClass: StoicClass) => {
  const total = sumTotals(totals);
  return total > 0 ? (totals[stoicClass] / total) * 100 : 0;
};

const pct = (value: number) => Math.round(value);
const money = (value: number) => Math.round(value);

const judgeable = (month: StoicMonth) =>
  sumTotals(month.intended) > 0 && sumTotals(month.actual) > 0;

const classGap = (month: StoicMonth, stoicClass: StoicClass) =>
  share(month.actual, stoicClass) - share(month.intended, stoicClass);

const leisureOverPlan = (month: StoicMonth) =>
  classGap(month, StoicClass.LEISURE) >= INTENT_GAP_POINTS;

const virtueUnderPlan = (month: StoicMonth) => {
  const planned = share(month.intended, StoicClass.VIRTUE);
  return planned > 0 && share(month.actual, StoicClass.VIRTUE) < planned / 2;
};

export const withinPlan = (month: StoicMonth) =>
  sumTotals(month.actual) <= sumTotals(month.intended) &&
  !leisureOverPlan(month) &&
  month.overBudgetCategoryIds.length === 0;

/** How many months, newest first, satisfy `test` without a break. */
const streak = (months: StoicMonth[], test: (month: StoicMonth) => boolean) => {
  let count = 0;
  for (const month of months) {
    if (!(judgeable(month) && test(month))) {
      break;
    }
    count += 1;
  }
  return count;
};

const daysIn = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

/**
 * Every Stoic observation the data supports this month, unranked. The analyzer
 * decides which of them the user actually sees.
 */
export function collectSignals(context: StoicContext): StoicSignal[] {
  const { now, balance } = context;
  const judgesPreviousMonth = now.getDate() < JUDGE_CURRENT_FROM_DAY;
  const history = balance.months.slice(judgesPreviousMonth ? 1 : 0);
  const reference = history[0];
  const classOf = new Map(balance.categories.map(category => [category.id, category.stoicClass]));
  const nameOf = new Map(balance.categories.map(category => [category.id, category.name]));

  return [
    ...unclassified(balance),
    ...(reference && judgeable(reference) ? planSignals(reference, history, nameOf) : []),
    ...(reference && judgeable(reference) ? planPraise(reference, history, now) : []),
    ...paceSignals(balance.months[0], now, nameOf),
    ...unusedBudgets(balance.months, nameOf),
    ...necessityTrend(balance.months),
    ...(context.behavior && reference
      ? behaviorSignals(context.behavior, reference, classOf, nameOf, now)
      : []),
    ...subscriptionSignals(context.behavior),
    ...(context.behavior && reference
      ? generositySignals(balance, context.behavior, reference)
      : []),
    ...goalSignals(context.goals),
    ...commitmentSignals(context.commitments),
  ];
}

function unclassified(balance: StoicBalance): StoicSignal[] {
  const unjudged = balance.categories.filter(category => category.active && !category.stoicClass);
  return unjudged.length === 0
    ? []
    : [
        {
          key: 'stoic.unclassified',
          type: InsightType.STOIC_UNCLASSIFIED,
          priority: 10,
          params: { count: unjudged.length },
          data: { categoryIds: unjudged.map(category => category.id) },
        },
      ];
}

function planSignals(
  reference: StoicMonth,
  history: StoicMonth[],
  nameOf: Map<string, string>,
): StoicSignal[] {
  const signals: StoicSignal[] = [];
  const judged = history.filter(judgeable);
  const planned = sumTotals(reference.intended);
  const spent = sumTotals(reference.actual);
  const shares = (stoicClass: StoicClass) => ({
    planned: pct(share(reference.intended, stoicClass)),
    actual: pct(share(reference.actual, stoicClass)),
  });

  if (spent > planned * TOTAL_OVER_PLAN_RATIO) {
    signals.push({
      key: 'stoic.total_over_plan',
      type: InsightType.STOIC_PLAN,
      priority: 90,
      params: {
        percent: pct((spent / planned - 1) * 100),
        spentAmount: money(spent),
        plannedAmount: money(planned),
      },
    });
  }

  if (leisureOverPlan(reference)) {
    const months = judged.filter(leisureOverPlan).length;
    signals.push(
      months >= HABIT_MONTHS
        ? {
            key: 'stoic.leisure_habit',
            type: InsightType.STOIC_REPEATED,
            priority: 75,
            params: { months, window: judged.length },
            data: { stoicClass: StoicClass.LEISURE },
          }
        : {
            key: 'stoic.leisure_over_plan',
            type: InsightType.STOIC_INTENT_GAP,
            priority: 55,
            params: shares(StoicClass.LEISURE),
            data: { stoicClass: StoicClass.LEISURE },
          },
    );
  }

  if (virtueUnderPlan(reference)) {
    const months = streak(history, virtueUnderPlan);
    signals.push(
      months >= NEGLECT_MONTHS
        ? {
            key: 'stoic.virtue_neglected',
            type: InsightType.STOIC_VIRTUE_NEGLECTED,
            priority: 60,
            params: { months },
            data: { stoicClass: StoicClass.VIRTUE },
          }
        : {
            key: 'stoic.virtue_under_plan',
            type: InsightType.STOIC_INTENT_GAP,
            priority: 50,
            params: shares(StoicClass.VIRTUE),
            data: { stoicClass: StoicClass.VIRTUE },
          },
    );
  }

  if (reference.intended[StoicClass.VIRTUE] === 0) {
    signals.push({
      key: 'stoic.virtue_absent_plan',
      type: InsightType.STOIC_PLAN,
      priority: 15,
      params: {},
      data: { stoicClass: StoicClass.VIRTUE },
    });
  }

  signals.push(...classGapSignals(reference, shares));

  // A category that broke its limit once is a bad month; one that breaks it
  // month after month is a desire the limit was never going to hold.
  const overruns = reference.overBudgetCategoryIds
    .map(categoryId => ({
      categoryId,
      months: judged.filter(month => month.overBudgetCategoryIds.includes(categoryId)).length,
    }))
    .filter(item => item.months >= HABIT_MONTHS)
    .sort((a, b) => b.months - a.months)
    .slice(0, 2);
  for (const overrun of overruns) {
    signals.push({
      key: 'stoic.repeated_overrun',
      type: InsightType.STOIC_REPEATED,
      priority: 80,
      params: {
        category: nameOf.get(overrun.categoryId) ?? '',
        months: overrun.months,
        window: judged.length,
      },
      data: { categoryId: overrun.categoryId },
      subject: overrun.categoryId,
    });
  }

  signals.push(...unbudgetedSignal(reference, spent));
  return signals;
}

/** Necessities or work taking a bigger share than the plan gave them. */
function classGapSignals(
  reference: StoicMonth,
  shares: (stoicClass: StoicClass) => { planned: number; actual: number },
): StoicSignal[] {
  const signals: StoicSignal[] = [];
  for (const [stoicClass, key, priority] of [
    [StoicClass.NECESSITY, 'stoic.necessity_over_plan', 40],
    [StoicClass.WORK, 'stoic.work_over_plan', 35],
  ] as const) {
    // With nothing planned for the class, the gap is just unbudgeted spending,
    // which unbudgeted_share already names.
    if (
      reference.intended[stoicClass] > 0 &&
      classGap(reference, stoicClass) >= INTENT_GAP_POINTS
    ) {
      signals.push({
        key,
        type: InsightType.STOIC_INTENT_GAP,
        priority,
        params: shares(stoicClass),
        data: { stoicClass },
      });
    }
  }

  return signals;
}

/** Spending no budget watches, once it is a large part of the month. */
function unbudgetedSignal(reference: StoicMonth, spent: number): StoicSignal[] {
  const unbudgeted = Object.entries(reference.spentByCategory)
    .filter(([categoryId]) => !(categoryId in reference.limitByCategory))
    .reduce((sum, [, amount]) => sum + amount, 0);
  if (spent > 0 && unbudgeted / spent >= UNBUDGETED_SHARE) {
    return [
      {
        key: 'stoic.unbudgeted_share',
        type: InsightType.STOIC_PLAN,
        priority: 25,
        params: { percent: pct((unbudgeted / spent) * 100), unbudgetedAmount: money(unbudgeted) },
      },
    ];
  }

  return [];
}

function leisureCategories(month: StoicMonth, classOf: Map<string, StoicClass | null>) {
  return Object.entries(month.spentByCategory)
    .filter(([categoryId, amount]) => amount > 0 && classOf.get(categoryId) === StoicClass.LEISURE)
    .sort((a, b) => b[1] - a[1]);
}

/** Praise that the plan can vouch for; the analyzer shows one at most. */
function planPraise(reference: StoicMonth, history: StoicMonth[], now: Date): StoicSignal[] {
  if (!withinPlan(reference)) {
    return [];
  }
  const praise: StoicSignal[] = [];
  const base = { type: InsightType.STOIC_PRAISE, priority: 0, praise: true } as const;

  const months = streak(history, withinPlan);
  if (months >= 2) {
    praise.push({ ...base, key: 'stoic.praise_within_plan', params: { months } });
  }

  const virtue = {
    planned: pct(share(reference.intended, StoicClass.VIRTUE)),
    actual: pct(share(reference.actual, StoicClass.VIRTUE)),
  };
  if (virtue.planned > 0 && virtue.actual >= virtue.planned) {
    praise.push({
      ...base,
      key: 'stoic.praise_virtue',
      params: virtue,
      data: { stoicClass: StoicClass.VIRTUE },
    });
  }

  const leisure = {
    planned: pct(share(reference.intended, StoicClass.LEISURE)),
    actual: pct(share(reference.actual, StoicClass.LEISURE)),
  };
  if (leisure.planned > 0 && leisure.actual < leisure.planned) {
    praise.push({
      ...base,
      key: 'stoic.praise_leisure_restrained',
      params: leisure,
      data: { stoicClass: StoicClass.LEISURE },
    });
  }

  // A running month is always "under plan" early on; only a finished (or
  // nearly finished) month has earned this one.
  const monthIsDone = reference.monthsAgo > 0 || now.getDate() > daysIn(now) - 3;
  const planned = sumTotals(reference.intended);
  const spent = sumTotals(reference.actual);
  if (monthIsDone && spent <= planned * 0.9) {
    praise.push({
      ...base,
      key: 'stoic.praise_under_plan',
      params: { percent: pct((1 - spent / planned) * 100), savedAmount: money(planned - spent) },
    });
  }

  if (praise.length === 0) {
    praise.push({ ...base, key: 'stoic.praise_steady', params: {} });
  }
  return praise;
}

/** The budget that, at this month's pace, runs out soonest. */
function paceSignals(
  current: StoicMonth | undefined,
  now: Date,
  nameOf: Map<string, string>,
): StoicSignal[] {
  const day = now.getDate();
  const days = daysIn(now);
  if (!current || day < PACE_MIN_DAY || day > days - 3) {
    return [];
  }
  const runningOut = Object.entries(current.limitByCategory)
    .map(([categoryId, limit]) => ({
      categoryId,
      limit,
      spent: current.spentByCategory[categoryId] ?? 0,
    }))
    .filter(
      item =>
        item.limit > 0 &&
        item.spent < item.limit &&
        item.spent >= item.limit * 0.4 &&
        (item.spent / day) * days > item.limit * PACE_OVERSHOOT_RATIO,
    )
    .map(item => ({ ...item, runOutDay: Math.ceil(item.limit / (item.spent / day)) }))
    .sort((a, b) => a.runOutDay - b.runOutDay)[0];

  return runningOut
    ? [
        {
          key: 'stoic.budget_pace',
          type: InsightType.STOIC_PLAN,
          priority: 70,
          params: {
            category: nameOf.get(runningOut.categoryId) ?? '',
            day: runningOut.runOutDay,
            limitAmount: money(runningOut.limit),
            spentAmount: money(runningOut.spent),
          },
          data: { categoryId: runningOut.categoryId },
          subject: runningOut.categoryId,
        },
      ]
    : [];
}

/** A budget that has had a limit and no spending for two finished months or more. */
function unusedBudgets(months: StoicMonth[], nameOf: Map<string, string>): StoicSignal[] {
  const closed = months.filter(month => month.monthsAgo > 0);
  const idle = Object.keys(closed[0]?.limitByCategory ?? {})
    .map(categoryId => ({
      categoryId,
      months: streakWhere(
        closed,
        month =>
          categoryId in month.limitByCategory && (month.spentByCategory[categoryId] ?? 0) === 0,
      ),
    }))
    .filter(item => item.months >= 2)
    .sort((a, b) => b.months - a.months)[0];

  return idle
    ? [
        {
          key: 'stoic.budget_unused',
          type: InsightType.STOIC_PLAN,
          priority: 20,
          params: { category: nameOf.get(idle.categoryId) ?? '', months: idle.months },
          data: { categoryId: idle.categoryId },
          subject: idle.categoryId,
        },
      ]
    : [];
}

function streakWhere(months: StoicMonth[], test: (month: StoicMonth) => boolean) {
  let count = 0;
  for (const month of months) {
    if (!test(month)) {
      break;
    }
    count += 1;
  }
  return count;
}

/** Necessities over the last three finished months: creeping up, or holding steady. */
function necessityTrend(months: StoicMonth[]): StoicSignal[] {
  const closed = months.filter(month => month.monthsAgo > 0).slice(0, 3);
  if (closed.length < 3) {
    return [];
  }
  const [n1, n2, n3] = closed.map(month => month.actual[StoicClass.NECESSITY]);
  if (n3 <= 0) {
    return [];
  }
  if (n1 > n2 * CREEP_STEP && n2 > n3 * CREEP_STEP) {
    return [
      {
        key: 'stoic.necessity_creep',
        type: InsightType.STOIC_INTENT_GAP,
        priority: 45,
        params: { months: 3, percent: pct((n1 / n3 - 1) * 100) },
        data: { stoicClass: StoicClass.NECESSITY },
      },
    ];
  }
  const values = [n1, n2, n3];
  if (Math.min(...values) > 0 && Math.max(...values) / Math.min(...values) <= CREEP_STEP) {
    return [
      {
        key: 'stoic.praise_necessity_stable',
        type: InsightType.STOIC_PRAISE,
        priority: 0,
        praise: true,
        params: { months: 3 },
        data: { stoicClass: StoicClass.NECESSITY },
      },
    ];
  }
  return [];
}

function behaviorSignals(
  behavior: StoicBehavior,
  reference: StoicMonth,
  classOf: Map<string, StoicClass | null>,
  nameOf: Map<string, string>,
  now: Date,
): StoicSignal[] {
  const signals: StoicSignal[] = [];
  const monthTotal = Object.values(behavior.totalByCategory).reduce((sum, v) => sum + v, 0);
  const isLeisureLike = (categoryId: string | null) => {
    const stoicClass = categoryId ? classOf.get(categoryId) : null;
    return stoicClass === StoicClass.LEISURE || stoicClass === null || stoicClass === undefined;
  };

  if (monthTotal > 0) {
    const small = behavior.merchants
      .filter(
        merchant =>
          merchant.count >= SMALL_PURCHASE_COUNT &&
          merchant.total / merchant.count <= monthTotal * SMALL_PURCHASE_MAX_SHARE &&
          isLeisureLike(merchant.categoryId),
      )
      .sort((a, b) => b.count - a.count)[0];
    if (small) {
      signals.push({
        key: 'stoic.small_purchases',
        type: InsightType.STOIC_HABIT,
        priority: 40,
        params: { merchant: small.name, count: small.count, totalAmount: money(small.total) },
        data: { merchant: small.name },
        subject: small.name,
      });
    }

    const top = behavior.merchants
      .filter(
        merchant =>
          merchant.categoryId !== null &&
          classOf.get(merchant.categoryId) === StoicClass.LEISURE &&
          merchant.total >= monthTotal * TOP_MERCHANT_SHARE,
      )
      .sort((a, b) => b.total - a.total)[0];
    if (top) {
      signals.push({
        key: 'stoic.top_merchant',
        type: InsightType.STOIC_HABIT,
        priority: 30,
        params: {
          merchant: top.name,
          percent: pct((top.total / monthTotal) * 100),
          totalAmount: money(top.total),
        },
        data: { merchant: top.name },
        subject: top.name,
      });
    }

    const leisureIds = Object.keys(behavior.totalByCategory).filter(
      id => classOf.get(id) === StoicClass.LEISURE,
    );
    const leisureTotal = leisureIds.reduce((sum, id) => sum + behavior.totalByCategory[id], 0);
    const leisureWeekend = leisureIds.reduce(
      (sum, id) => sum + (behavior.weekendByCategory[id] ?? 0),
      0,
    );
    if (
      leisureTotal >= monthTotal * LEISURE_MIN_SHARE &&
      leisureWeekend / leisureTotal >= WEEKEND_LEISURE_SHARE
    ) {
      signals.push({
        key: 'stoic.weekend_leisure',
        type: InsightType.STOIC_HABIT,
        priority: 35,
        params: { percent: pct((leisureWeekend / leisureTotal) * 100) },
        data: { stoicClass: StoicClass.LEISURE },
      });
    }

    const leisureSpend = leisureCategories(reference, classOf);
    const leisureSum = leisureSpend.reduce((sum, [, amount]) => sum + amount, 0);
    if (
      leisureSpend.length >= 2 &&
      leisureSum >= monthTotal * LEISURE_MIN_SHARE &&
      leisureSpend[0][1] / leisureSum >= LEISURE_CONCENTRATION_SHARE
    ) {
      const [categoryId, amount] = leisureSpend[0];
      signals.push({
        key: 'stoic.leisure_concentration',
        type: InsightType.STOIC_INTENT_GAP,
        priority: 30,
        params: {
          category: nameOf.get(categoryId) ?? '',
          percent: pct((amount / leisureSum) * 100),
        },
        data: { categoryId, stoicClass: StoicClass.LEISURE },
        subject: categoryId,
      });
    }
  }

  signals.push(...fewerSmallPurchases(behavior, reference, isLeisureLike, now));
  signals.push(...fortuneSignals(behavior, reference));
  return signals;
}

function fewerSmallPurchases(
  behavior: StoicBehavior,
  reference: StoicMonth,
  isLeisureLike: (categoryId: string | null) => boolean,
  now: Date,
): StoicSignal[] {
  // A running month has had fewer days to accumulate visits; scale it up.
  const scale = reference.monthsAgo === 0 ? daysIn(now) / Math.max(now.getDate(), 1) : 1;
  const improved = behavior.merchants
    .filter(merchant => isLeisureLike(merchant.categoryId))
    .map(merchant => ({
      name: merchant.name,
      before: behavior.previousCounts[merchant.name] ?? 0,
      after: Math.round(merchant.count * scale),
    }))
    .filter(
      item => item.before >= SMALL_PURCHASE_COUNT && item.after <= item.before * FEWER_SMALL_RATIO,
    )
    .sort((a, b) => b.before - b.after - (a.before - a.after))[0];

  return improved
    ? [
        {
          key: 'stoic.praise_fewer_small',
          type: InsightType.STOIC_PRAISE,
          priority: 0,
          praise: true,
          params: { merchant: improved.name, before: improved.before, after: improved.after },
          data: { merchant: improved.name },
        },
      ]
    : [];
}

/** Income against spending over finished months: a drop not followed, or met well. */
function fortuneSignals(behavior: StoicBehavior, reference: StoicMonth): StoicSignal[] {
  const closedIndex = reference.monthsAgo > 0 ? 0 : 1;
  const last = behavior.cashFlow[closedIndex];
  const before = behavior.cashFlow
    .slice(closedIndex + 1, closedIndex + 4)
    .filter(month => month.income > 0);
  if (!last || last.income <= 0 || before.length < 2) {
    return [];
  }
  const avgIncome = before.reduce((sum, month) => sum + month.income, 0) / before.length;
  const avgExpense = before.reduce((sum, month) => sum + month.expense, 0) / before.length;
  const drop = 1 - last.income / avgIncome;
  if (drop < INCOME_DROP || avgExpense <= 0) {
    return [];
  }

  if (last.expense >= avgExpense * 0.95) {
    return [
      {
        key: 'stoic.income_drop',
        type: InsightType.STOIC_FORTUNE,
        priority: 65,
        params: {
          percent: pct(drop * 100),
          incomeAmount: money(last.income),
          expenseAmount: money(last.expense),
        },
        data: { month: last.month },
      },
    ];
  }
  if (last.expense <= avgExpense * 0.9) {
    return [
      {
        key: 'stoic.praise_income_adapted',
        type: InsightType.STOIC_PRAISE,
        priority: 0,
        praise: true,
        params: {
          incomePercent: pct(drop * 100),
          expensePercent: pct((1 - last.expense / avgExpense) * 100),
        },
        data: { month: last.month },
      },
    ];
  }
  return [];
}

function subscriptionSignals(behavior: StoicBehavior | null): StoicSignal[] {
  if (!behavior || behavior.subscriptions.count < SUBSCRIPTIONS_MIN_COUNT) {
    return [];
  }
  const finished = behavior.cashFlow.slice(1).filter(month => month.expense > 0);
  const avgExpense =
    finished.reduce((sum, month) => sum + month.expense, 0) / Math.max(finished.length, 1);
  const monthly = behavior.subscriptions.monthlyTotal;
  if (avgExpense <= 0 || monthly / avgExpense < SUBSCRIPTIONS_SHARE) {
    return [];
  }
  return [
    {
      key: 'stoic.subscriptions_share',
      type: InsightType.STOIC_SUBSCRIPTIONS,
      priority: 30,
      params: {
        count: behavior.subscriptions.count,
        percent: pct((monthly / avgExpense) * 100),
        monthlyAmount: money(monthly),
      },
    },
  ];
}

/**
 * Earning comfortably while giving little to others. The hint is soft on
 * purpose — help given in cash or outside the app is invisible here — and
 * never below "serious", so it can sit next to praise for everything else.
 */
function generositySignals(
  balance: StoicBalance,
  behavior: StoicBehavior,
  reference: StoicMonth,
): StoicSignal[] {
  const firstClosed = reference.monthsAgo > 0 ? 0 : 1;
  const window = behavior.cashFlow
    .slice(firstClosed, firstClosed + GENEROSITY_MONTHS)
    .filter(month => month.income > 0);
  if (window.length < 2) {
    return [];
  }
  const helpingIds = balance.categories
    .filter(category => category.helpsOthers)
    .map(category => category.id);
  const income = window.reduce((sum, month) => sum + month.income, 0);
  const expense = window.reduce((sum, month) => sum + month.expense, 0);
  const given = window.reduce((sum, cashMonth) => {
    const ledgerMonth = balance.months.find(month => month.month === cashMonth.month);
    return (
      sum + helpingIds.reduce((inner, id) => inner + (ledgerMonth?.spentByCategory[id] ?? 0), 0)
    );
  }, 0);
  const savingsRate = (income - expense) / income;
  const givenShare = given / income;

  if (givenShare >= GENEROSITY_PRAISE_SHARE) {
    return [
      {
        key: 'stoic.praise_generosity',
        type: InsightType.STOIC_PRAISE,
        priority: 0,
        praise: true,
        params: {
          percent: pct(givenShare * 100),
          givenAmount: money(given),
          months: window.length,
        },
        data: { stoicClass: StoicClass.VIRTUE },
      },
    ];
  }
  if (savingsRate >= GENEROUS_SAVINGS_RATE && givenShare < GENEROSITY_HINT_SHARE) {
    return [
      {
        key: 'stoic.generosity_gap',
        type: InsightType.STOIC_GENEROSITY,
        priority: 38,
        params: {
          savingsPercent: pct(savingsRate * 100),
          incomeAmount: money(income),
          givenAmount: money(given),
          months: window.length,
        },
        data: { stoicClass: StoicClass.VIRTUE },
      },
    ];
  }
  return [];
}

function goalSignals(goals: StoicGoalView[]): StoicSignal[] {
  const notFeasible = goals.find(goal => goal.status === 'not_feasible');
  if (notFeasible && notFeasible.requiredPerMonth !== null) {
    return [
      {
        key: 'stoic.goal_not_feasible',
        type: InsightType.STOIC_GOAL,
        priority: 85,
        params: {
          goal: notFeasible.name,
          requiredAmount: money(notFeasible.requiredPerMonth),
          freeAmount: money(notFeasible.freePerMonth),
        },
        data: { goalId: notFeasible.id },
        subject: notFeasible.id,
      },
    ];
  }

  const behind = goals
    .filter(goal => (goal.monthsLate ?? 0) > 0 && goal.requiredPerMonth !== null)
    .sort((a, b) => (b.monthsLate ?? 0) - (a.monthsLate ?? 0))[0];
  if (behind) {
    return [
      {
        key: 'stoic.goal_behind',
        type: InsightType.STOIC_GOAL,
        priority: 50,
        params: {
          goal: behind.name,
          requiredAmount: money(behind.requiredPerMonth ?? 0),
          paceAmount: money(behind.pacePerMonth),
          monthsLate: behind.monthsLate ?? 0,
        },
        data: { goalId: behind.id },
        subject: behind.id,
      },
    ];
  }

  const onTrack = goals
    .filter(goal => goal.status === 'on_track')
    .sort((a, b) => b.percent - a.percent)[0];
  return onTrack
    ? [
        {
          key: 'stoic.praise_goal_on_track',
          type: InsightType.STOIC_PRAISE,
          priority: 0,
          praise: true,
          params: { goal: onTrack.name, percent: pct(onTrack.percent) },
          data: { goalId: onTrack.id },
        },
      ]
    : [];
}

function commitmentSignals(commitments: StoicCommitments | null): StoicSignal[] {
  if (!commitments?.shortfallDate) {
    return [];
  }
  return [
    {
      key: 'stoic.shortfall',
      type: InsightType.STOIC_COMMITMENTS,
      priority: 100,
      params: {
        date: commitments.shortfallDate,
        lowestAmount: money(commitments.lowestBalance),
        committedAmount: money(commitments.totalCommitted),
      },
    },
  ];
}
