import { StoicClass } from '../../../entities/category.entity';
import { InsightType } from '../../../entities/insight.entity';
import type { CashFlowMonth } from './stoic-behavior.service';
import type { StoicContext, StoicSignal } from './stoic-signals';
import { JUDGE_CURRENT_FROM_DAY } from './stoic-signals';

/** Below a tenth of income kept, "pay yourself first" (Clason). */
const PAY_YOURSELF_FIRST_RATE = 0.1;
/** 50/30/20 with some slack: the rule is a guide, not a tripwire. */
const NEEDS_CEILING = 0.55;
const WANTS_CEILING = 0.35;
const SAVINGS_FLOOR = 0.15;
/** Three months of spending is the usual floor for an emergency cushion. */
const CUSHION_MONTHS = 3;
/** Spending growing this much faster than income over two quarters. */
const CREEP_EXPENSE_GROWTH = 0.1;
const CREEP_GAP = 0.05;
/** Roughly the working hours in a month, for pricing things in hours of life. */
const WORK_HOURS_PER_MONTH = 160;
const LIFE_ENERGY_MIN_HOURS = 8;

type Expert = { expert: string; work: string; target: string };

const EXPERTS = {
  payYourselfFirst: {
    expert: 'George S. Clason',
    work: 'The Richest Man in Babylon (1926)',
    target: 'goals',
  },
  rule503020: {
    expert: 'Elizabeth Warren & Amelia Warren Tyagi',
    work: 'All Your Worth (2005)',
    target: 'budgets',
  },
  roomForError: {
    expert: 'Morgan Housel',
    work: 'The Psychology of Money (2020)',
    target: 'dashboard',
  },
  lifestyleCreep: {
    expert: 'Thomas J. Stanley & William D. Danko',
    work: 'The Millionaire Next Door (1996)',
    target: 'dashboard',
  },
  lifeEnergy: {
    expert: 'Vicki Robin & Joe Dominguez',
    work: 'Your Money or Your Life (1992)',
    target: 'merchants',
  },
} satisfies Record<string, Expert>;

const pct = (value: number) => Math.round(value * 100);
const money = (value: number) => Math.round(value);

function expertSignal(
  key: StoicSignal['key'],
  priority: number,
  source: Expert,
  params: Record<string, string | number>,
): StoicSignal {
  return {
    key,
    type: InsightType.EXPERT_PRINCIPLE,
    priority,
    params,
    data: { expert: source.expert, work: source.work, target: source.target },
  };
}

/** Finished months only, newest first, skipping months with no income recorded. */
function finishedMonths(context: StoicContext): CashFlowMonth[] {
  const firstClosed = context.now.getDate() < JUDGE_CURRENT_FROM_DAY ? 0 : 1;
  return (context.behavior?.cashFlow ?? []).slice(firstClosed).filter(month => month.income > 0);
}

/** The last finished quarter (or two months of it) in one place. */
interface Quarter {
  months: CashFlowMonth[];
  income: number;
  expense: number;
  avgIncome: number;
  avgExpense: number;
  savingsRate: number;
}

function summarize(months: CashFlowMonth[]): Quarter {
  const income = months.reduce((sum, month) => sum + month.income, 0);
  const expense = months.reduce((sum, month) => sum + month.expense, 0);
  return {
    months,
    income,
    expense,
    avgIncome: income / months.length,
    avgExpense: expense / months.length,
    savingsRate: (income - expense) / income,
  };
}

/**
 * Principles from named personal-finance authors, applied to the user's own
 * numbers. The principle is stated in our words with its source; the numbers
 * are what make it about this user rather than a poster on the wall.
 */
export function collectExpertSignals(context: StoicContext): StoicSignal[] {
  const months = finishedMonths(context);
  if (months.slice(0, 3).length < 2) {
    return [];
  }
  const quarter = summarize(months.slice(0, 3));
  return [
    ...savingsPrinciples(context, quarter),
    ...roomForError(context, quarter),
    ...lifestyleCreep(months, quarter),
    ...lifeEnergy(context, quarter),
  ];
}

/** Below a tenth kept, Clason; otherwise, if the split is off, Warren & Tyagi. */
function savingsPrinciples(context: StoicContext, quarter: Quarter): StoicSignal[] {
  if (quarter.savingsRate < PAY_YOURSELF_FIRST_RATE) {
    return [
      expertSignal('expert.pay_yourself_first', 60, EXPERTS.payYourselfFirst, {
        savingsPercent: pct(Math.max(quarter.savingsRate, 0)),
        tenthAmount: money(quarter.avgIncome / 10),
        months: quarter.months.length,
      }),
    ];
  }
  const needs = quarter.months.reduce((sum, cashMonth) => {
    const ledgerMonth = context.balance.months.find(month => month.month === cashMonth.month);
    return sum + (ledgerMonth?.actual[StoicClass.NECESSITY] ?? 0);
  }, 0);
  const needsShare = needs / quarter.income;
  const wantsShare = (quarter.expense - needs) / quarter.income;
  const offBalance =
    needsShare > NEEDS_CEILING || wantsShare > WANTS_CEILING || quarter.savingsRate < SAVINGS_FLOOR;
  return needs > 0 && offBalance
    ? [
        expertSignal('expert.rule_50_30_20', 40, EXPERTS.rule503020, {
          needsPercent: pct(needsShare),
          wantsPercent: pct(Math.max(wantsShare, 0)),
          savingsPercent: pct(quarter.savingsRate),
        }),
      ]
    : [];
}

function roomForError(context: StoicContext, quarter: Quarter): StoicSignal[] {
  const balance = context.commitments?.openingBalance;
  if (balance === undefined || quarter.avgExpense <= 0) {
    return [];
  }
  const cushionDays = Math.max(0, Math.floor(balance / (quarter.avgExpense / 30)));
  return cushionDays < CUSHION_MONTHS * 30
    ? [
        expertSignal('expert.room_for_error', 70, EXPERTS.roomForError, {
          cushionDays,
          targetAmount: money(quarter.avgExpense * CUSHION_MONTHS),
        }),
      ]
    : [];
}

/** The last finished quarter against the one before it. */
function lifestyleCreep(months: CashFlowMonth[], quarter: Quarter): StoicSignal[] {
  const earlierMonths = months.slice(3, 6);
  if (earlierMonths.length < 2) {
    return [];
  }
  const earlier = summarize(earlierMonths);
  const expenseGrowth = quarter.avgExpense / earlier.avgExpense - 1;
  const incomeGrowth = quarter.avgIncome / earlier.avgIncome - 1;
  const creeping =
    Number.isFinite(expenseGrowth) &&
    expenseGrowth >= CREEP_EXPENSE_GROWTH &&
    expenseGrowth - incomeGrowth >= CREEP_GAP;
  return creeping
    ? [
        expertSignal('expert.lifestyle_creep', 50, EXPERTS.lifestyleCreep, {
          expenseGrowth: pct(expenseGrowth),
          incomeGrowth: pct(incomeGrowth),
        }),
      ]
    : [];
}

/** The priciest leisure merchant this month, priced in hours of work. */
function lifeEnergy(context: StoicContext, quarter: Quarter): StoicSignal[] {
  const classOf = new Map(
    context.balance.categories.map(category => [category.id, category.stoicClass]),
  );
  const hourly = quarter.avgIncome / WORK_HOURS_PER_MONTH;
  const priciest = (context.behavior?.merchants ?? [])
    .filter(
      merchant =>
        merchant.categoryId !== null && classOf.get(merchant.categoryId) === StoicClass.LEISURE,
    )
    .sort((a, b) => b.total - a.total)[0];
  return priciest && hourly > 0 && priciest.total / hourly >= LIFE_ENERGY_MIN_HOURS
    ? [
        expertSignal('expert.life_energy', 30, EXPERTS.lifeEnergy, {
          merchant: priciest.name,
          totalAmount: money(priciest.total),
          hours: Math.round(priciest.total / hourly),
        }),
      ]
    : [];
}
