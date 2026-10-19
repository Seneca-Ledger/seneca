/**
 * Stoic advice texts live apart from insight-translations.ts: each situation
 * has five wordings, and the analyzer picks one per workspace and month so
 * the same situation does not read the same way twice in a row.
 *
 * Every wording of a key may use any of that key's params. Params ending in
 * `Amount` are formatted as money in the workspace currency, `date` as a day
 * and month, both in the reader's locale (see renderInsight).
 */
export type StoicMessageKey =
  // Plan against reality (Budgets)
  | 'stoic.total_over_plan' // percent, spentAmount, plannedAmount
  | 'stoic.leisure_over_plan' // planned, actual
  | 'stoic.leisure_habit' // months, window
  | 'stoic.virtue_under_plan' // planned, actual
  | 'stoic.virtue_neglected' // months
  | 'stoic.virtue_absent_plan' // (none)
  | 'stoic.necessity_over_plan' // planned, actual
  | 'stoic.necessity_creep' // months, percent
  | 'stoic.work_over_plan' // planned, actual
  | 'stoic.repeated_overrun' // category, months, window
  | 'stoic.budget_pace' // category, day, limitAmount, spentAmount
  | 'stoic.budget_unused' // category, months
  | 'stoic.unbudgeted_share' // percent, unbudgetedAmount
  | 'stoic.leisure_concentration' // category, percent
  | 'stoic.unclassified' // count
  // Behaviour (Dashboard)
  | 'stoic.small_purchases' // merchant, count, totalAmount
  | 'stoic.weekend_leisure' // percent
  | 'stoic.top_merchant' // merchant, percent, totalAmount
  | 'stoic.income_drop' // percent, incomeAmount, expenseAmount
  | 'stoic.subscriptions_share' // count, percent, monthlyAmount
  | 'stoic.generosity_gap' // savingsPercent, incomeAmount, givenAmount, months
  // Goals and commitments
  | 'stoic.goal_behind' // goal, requiredAmount, paceAmount, monthsLate
  | 'stoic.goal_not_feasible' // goal, requiredAmount, freeAmount
  | 'stoic.shortfall' // date, lowestAmount, committedAmount
  // Praise
  | 'stoic.praise_within_plan' // months
  | 'stoic.praise_virtue' // planned, actual
  | 'stoic.praise_leisure_restrained' // planned, actual
  | 'stoic.praise_under_plan' // percent, savedAmount
  | 'stoic.praise_goal_on_track' // goal, percent
  | 'stoic.praise_fewer_small' // merchant, before, after
  | 'stoic.praise_income_adapted' // incomePercent, expensePercent
  | 'stoic.praise_necessity_stable' // months
  | 'stoic.praise_generosity' // percent, givenAmount, months
  | 'stoic.praise_steady' // (none)
  // Named experts' principles applied to the user's numbers
  | 'expert.pay_yourself_first' // savingsPercent, tenthAmount, months
  | 'expert.rule_50_30_20' // needsPercent, wantsPercent, savingsPercent
  | 'expert.room_for_error' // cushionDays, targetAmount
  | 'expert.lifestyle_creep' // expenseGrowth, incomeGrowth
  | 'expert.life_energy'; // merchant, totalAmount, hours

export interface StoicText {
  title: string;
  message: string;
}

/** Exactly five wordings — the type refuses four or six. */
export type StoicVariants = readonly [StoicText, StoicText, StoicText, StoicText, StoicText];

export type StoicTextMap = Record<StoicMessageKey, StoicVariants>;

export const STOIC_VARIANT_COUNT = 5;
