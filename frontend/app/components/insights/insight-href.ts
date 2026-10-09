import type { Insight } from '@/app/hooks/useInsights';

type InsightData = Record<string, unknown> | null;

/**
 * Insights whose destination is the same page every time.
 *
 * Keyed on `type` rather than on the entity's `actions[]`: the same action type
 * (`VIEW_REPORT`) is emitted for a rising category and for a risky allocation,
 * which are two different pages, so the action alone cannot pick a route.
 *
 * `?focus=` names the element the page should scroll to and ring in green —
 * the target side lives in `data-attention` attributes, see useAttentionFocus.
 * `?month=` names the month the advice judged, so the page shows the numbers
 * the advice quoted instead of its own default period.
 */
/** The three leaderboards live as sections of one tab, so they share a route. */
const CASH_FLOW = '/reports?tab=cash-flow';

const STATIC_ROUTES: Record<string, string> = {
  'operational.unapproved_count': '/review',
  'operational.uncategorized_count': '/statements/submit?missingCategory=true',
  'operational.duplicate_detected': '/review',
  'pattern.risky_allocation': '/net-worth?focus=card:risk',
  'forecast.monthly': '/dashboard?tab=overview',
  'pattern.detected': '/subscriptions',
  'stoic.unclassified': '/budgets?focus=stoic:unclassified',
  'stoic.subscriptions': '/subscriptions',
};

/**
 * Adds the parameters a destination page needs to show what the advice says.
 * Null values are dropped: an insight written by hand for the showcase
 * workspace carries no `data`, and a bare page beats `month=undefined`.
 */
const withQuery = (path: string, query: Record<string, string | null>): string => {
  const parts = Object.entries(query)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  if (parts.length === 0) {
    return path;
  }
  return `${path}${path.includes('?') ? '&' : '?'}${parts.join('&')}`;
};

/** The month the advice judged, `YYYY-MM`; anything else is not a month. */
const readMonth = (data: InsightData): string | null => {
  const month = readString(data, 'month');
  return month !== null && /^\d{4}-\d{2}$/.test(month) ? month : null;
};

/** Stoic advice about a whole class lands on that class's card in Budgets. */
const stoicClassRoute = (data: InsightData): string => {
  const stoicClass = readString(data, 'stoicClass');
  return withQuery('/budgets', {
    month: readMonth(data),
    focus: stoicClass === null ? null : `stoic:${stoicClass}`,
  });
};

const EXPERT_TARGETS: Record<string, string> = {
  budgets: '/budgets',
  goals: '/goals',
  dashboard: '/dashboard?tab=overview',
  merchants: CASH_FLOW,
};

/** Advice about one budget lands on its card; otherwise on its class. */
const budgetRoute = (data: InsightData): string => {
  const categoryId = readString(data, 'categoryId');
  return categoryId === null
    ? stoicClassRoute(data)
    : withQuery('/budgets', { month: readMonth(data), focus: `budget:${categoryId}` });
};

/**
 * A habit is about one merchant in one month, so the leaderboard opens on
 * that month with the merchant's row ringed. Weekend spending names no
 * merchant — that one is about a whole class and belongs in Budgets.
 */
const habitRoute = (data: InsightData): string => {
  const merchant = readString(data, 'merchant');
  if (merchant === null) {
    return readString(data, 'stoicClass') === null
      ? withQuery(CASH_FLOW, { month: readMonth(data) })
      : stoicClassRoute(data);
  }
  return withQuery(CASH_FLOW, {
    month: readMonth(data),
    focus: `merchant:${merchant.trim().toLowerCase()}`,
  });
};

const goalRoute = (data: InsightData): string | null => {
  const goalId = readString(data, 'goalId');
  return goalId === null ? null : `/goals/${encodeURIComponent(goalId)}`;
};

/**
 * Insights that point at one record. Several of them are written by hand for
 * the showcase workspace and carry no `data` at all, so each resolver falls
 * back rather than building a URL out of `undefined`.
 */
const DATA_ROUTES: Record<string, (data: InsightData) => string | null> = {
  // The leaderboard has no category ids: a row is keyed by category name.
  'trend.spending_up': data => {
    const name = readString(data, 'categoryName');
    return name === null
      ? null
      : withQuery(CASH_FLOW, {
          month: readMonth(data),
          focus: `category:${name.trim().toLowerCase()}`,
        });
  },
  // The point of this insight is that no budget exists yet, so there is
  // nothing to highlight — open the form that creates one instead.
  'category.dominance': data => {
    const categoryId = readString(data, 'categoryId');
    return categoryId === null
      ? '/budgets'
      : `/budgets?newBudgetCategory=${encodeURIComponent(categoryId)}`;
  },
  'stoic.intent_gap': stoicClassRoute,
  'stoic.virtue_neglected': stoicClassRoute,
  'stoic.praise': data => goalRoute(data) ?? stoicClassRoute(data),
  // Either a class that keeps drifting or one budget that keeps breaking its limit.
  'stoic.repeated': budgetRoute,
  'stoic.plan': budgetRoute,
  'stoic.generosity': stoicClassRoute,
  // A principle points at where its numbers live.
  'expert.principle': data => EXPERT_TARGETS[readString(data, 'target') ?? ''] ?? '/advice',
  'stoic.habit': habitRoute,
  // The savings-rate KPI lives on Overview; the Trends tab has no such widget.
  'trend.savings_rate': data =>
    withQuery('/dashboard?tab=overview', {
      month: readMonth(data),
      focus: 'kpi:savings-rate',
    }),
  // Income and the cash runway both live on the dashboard overview. Without a
  // month it shows the latest one with data, which need not be the judged one.
  'stoic.fortune': data => withQuery('/dashboard?tab=overview', { month: readMonth(data) }),
  'stoic.commitments': data => withQuery('/dashboard?tab=overview', { month: readMonth(data) }),
  'stoic.goal': data => goalRoute(data) ?? '/goals',
  // Free-form text from the local model; `periodKey` is the only handle it
  // carries, and it is already the YYYY-MM the dashboard expects.
  'ai.summary': data => {
    const periodKey = readString(data, 'periodKey');
    return periodKey === null ? null : `/dashboard?tab=overview&month=${periodKey}`;
  },
};

/**
 * Where an insight can be looked at or acted on. An insight with no sensible
 * destination returns null and stays a plain, non-interactive notice — better
 * than a link that lands nowhere.
 */
export function insightHref(insight: Insight): string | null {
  const resolve = DATA_ROUTES[insight.type];
  return resolve ? resolve(insight.data) : (STATIC_ROUTES[insight.type] ?? null);
}

function readString(data: InsightData, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
