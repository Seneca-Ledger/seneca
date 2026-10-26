import type {
  BudgetList,
  DashboardResponse,
  DashboardTopCategory,
  ForecastResponse,
  GoalList,
  NetWorthResponse,
  PayablesSummary,
  SubscriptionList,
  SubscriptionSummary,
  TaxDeadlineList,
  TaxYearReport,
  DashboardTrendsResponse as TrendsResponse,
} from '@/app/lib/contracts';
import { payablesApi } from '@/app/lib/payables-api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

function fetchDashboard(range: '7d' | '30d' | '90d' = '30d'): Promise<DashboardResponse> {
  return apiQueryDecoded({ url: '/dashboard', params: { range }, contract: 'DashboardResponse' });
}

function fetchTrends(days = 30): Promise<TrendsResponse> {
  return apiQueryDecoded({
    url: '/dashboard/trends',
    params: { days },
    contract: 'DashboardTrendsResponse',
  });
}

const fetchBudgets = (): Promise<BudgetList> =>
  apiQueryDecoded({ url: '/budgets', contract: 'BudgetList' });

const fetchGoals = (): Promise<GoalList> =>
  apiQueryDecoded({ url: '/goals', contract: 'GoalList' });

const fetchForecast = (): Promise<ForecastResponse> =>
  apiQueryDecoded({ url: '/forecast', contract: 'ForecastResponse' });

const fetchNetWorth = (): Promise<NetWorthResponse> =>
  apiQueryDecoded({
    url: '/reports/net-worth',
    params: { range: '90d' },
    contract: 'NetWorthResponse',
  });

const fetchSubscriptions = (): Promise<SubscriptionList> =>
  apiQueryDecoded({
    url: '/subscriptions',
    params: { status: 'active' },
    contract: 'SubscriptionList',
  });

const fetchSubscriptionSummary = (): Promise<SubscriptionSummary> =>
  apiQueryDecoded({ url: '/subscriptions/summary', contract: 'SubscriptionSummary' });

const fetchTaxYearReport = (year: number): Promise<TaxYearReport> =>
  apiQueryDecoded({ url: '/tax/year-report', params: { year }, contract: 'TaxYearReport' });

const fetchTaxDeadlines = (): Promise<TaxDeadlineList> =>
  apiQueryDecoded({ url: '/tax/deadlines', contract: 'TaxDeadlineList' });

const fetchReceivables = (): Promise<PayablesSummary> => payablesApi.getSummary('receivable');

/**
 * A source the prompt can do without: a module the workspace does not use, or
 * one the user may not read, leaves its section out instead of the whole prompt.
 */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

const money = (amount: number | string, currency: string): string =>
  `${Number(amount).toLocaleString()} ${currency}`;

/** The figures leave out or count at face value amounts in currencies with no rate. */
function missingRatesNote(currencies: readonly string[]): string {
  return currencies.length > 0
    ? `\nNote: amounts in ${currencies.join(', ')} have no exchange rate and are counted at face value.\n`
    : '';
}

function formatCategories(
  categories: ReadonlyArray<Pick<DashboardTopCategory, 'name' | 'amount' | 'count'>>,
  currency: string,
): string {
  return categories
    .slice(0, 10)
    .map(
      (c, i) =>
        // `name` is null for uncategorized spend.
        `${i + 1}. ${c.name ?? 'Uncategorized'}: ${c.amount.toLocaleString()} ${currency} (${c.count} transactions)`,
    )
    .join('\n');
}

function formatNamedTotals(
  rows: ReadonlyArray<{ name: string; amount: number; count: number }>,
  currency: string,
  limit: number,
): string {
  return rows
    .slice(0, limit)
    .map(
      (row, i) =>
        `${i + 1}. ${row.name}: ${money(row.amount, currency)} (${row.count} transactions)`,
    )
    .join('\n');
}

function formatDailyTrend(daily: TrendsResponse['dailyTrend'], currency: string): string {
  return daily
    .slice(-14)
    .map(
      d =>
        `${d.date}: income ${d.income.toLocaleString()} ${currency}, expense ${d.expense.toLocaleString()} ${currency}`,
    )
    .join('\n');
}

function budgetLines(budgets: BudgetList): string {
  return budgets
    .filter(budget => budget.isActive)
    .map(
      budget =>
        `- ${budget.name} (${budget.category?.name ?? 'no category'}, ${budget.periodType}): limit ${money(budget.limitAmount, budget.currency)}, spent ${money(budget.spentAmount, budget.currency)} (${Math.round(budget.percentUsed)}%), left ${money(budget.availableAmount, budget.currency)}`,
    )
    .join('\n');
}

function taxYearSection(report: TaxYearReport): string {
  const categories = report.categories
    .slice(0, 15)
    .map(
      category =>
        `- ${category.name} (${category.type}): ${money(category.total, report.currency)}, ${category.count} rows, ${category.documentCount} with documents`,
    )
    .join('\n');
  return `Tax year ${report.year} — tax-relevant income ${money(report.total.income, report.currency)}, tax-relevant expenses ${money(report.total.expense, report.currency)}:
${categories || '- nothing marked tax-relevant yet'}
${missingRatesNote(report.missingRateCurrencies)}`;
}

export interface PromptTemplate {
  key: string;
  buildPrompt: () => Promise<string>;
}

export const promptTemplates: PromptTemplate[] = [
  {
    key: 'expense-summary',
    async buildPrompt() {
      const data = await fetchDashboard('30d');
      const { snapshot, topCategories } = data;
      const cats = formatCategories(topCategories, snapshot.currency);
      return `You are a financial analyst. Here are my expenses by category for the last 30 days:

${cats}

Currency: ${snapshot.currency}
Total expenses: ${snapshot.expense30d.toLocaleString()} ${snapshot.currency}
Total income: ${snapshot.income30d.toLocaleString()} ${snapshot.currency}
${missingRatesNote(snapshot.missingRates)}
Please:
1. Summarize my spending patterns
2. Identify the largest expense categories
3. Suggest areas where I could reduce spending
4. Compare category proportions and flag anything unusual`;
    },
  },
  {
    key: 'cash-flow',
    async buildPrompt() {
      const data = await fetchDashboard('30d');
      const { snapshot, cashFlow } = data;
      const daily = cashFlow
        .slice(-14)
        .map(
          d =>
            `${d.date}: income ${d.income.toLocaleString()}, expense ${d.expense.toLocaleString()}`,
        )
        .join('\n');
      return `You are a financial analyst. Here is my daily cash flow for the last 30 days (showing last 14 days):

${daily}

Currency: ${snapshot.currency}
Period totals — Income: ${snapshot.income30d.toLocaleString()}, Expenses: ${snapshot.expense30d.toLocaleString()}, Net: ${snapshot.netFlow30d.toLocaleString()}
${missingRatesNote(snapshot.missingRates)}
Please:
1. Analyze my cash flow trend
2. Identify days with unusual spikes or drops
3. Calculate my average daily net flow
4. Provide a forecast for the next 30 days based on these patterns`;
    },
  },
  {
    key: 'top-counterparties',
    async buildPrompt() {
      const [trends, dashboard] = await Promise.all([fetchTrends(30), fetchDashboard('30d')]);
      const currency = dashboard.snapshot.currency;
      // The trends list holds only who paid me; who I paid comes from the dashboard.
      const incomeSources = formatNamedTotals(trends.counterparties, currency, 10);
      const merchants = formatNamedTotals(dashboard.topMerchants, currency, 5);
      return `You are a financial analyst. Here is who I did business with over the last 30 days.

Who paid me (income sources):
${incomeSources || '- no income in this period'}

Who I paid most (spending merchants):
${merchants || '- no spending in this period'}

Currency: ${currency}
${missingRatesNote(dashboard.snapshot.missingRates)}
Please:
1. Say how dependent I am on my largest income sources
2. Categorize the merchants I pay (vendors, services, subscriptions, etc.)
3. Flag merchants with unusually high amounts or transaction counts
4. Suggest which spending relationships could be renegotiated or cancelled`;
    },
  },
  {
    key: 'tax-preparation',
    async buildPrompt() {
      const now = new Date();
      const year = now.getFullYear();
      // Early in the year last year's return is the one being prepared.
      const years = now.getMonth() < 3 ? [year - 1, year] : [year];
      const [dashboard, reports, deadlines, receivables] = await Promise.all([
        fetchDashboard('90d'),
        Promise.all(years.map(y => optional(() => fetchTaxYearReport(y)))),
        optional(fetchTaxDeadlines),
        optional(fetchReceivables),
      ]);
      const { snapshot, topCategories } = dashboard;
      const sections = reports.filter((report): report is TaxYearReport => report !== null);
      const upcoming = (deadlines ?? []).filter(deadline => !deadline.done).slice(0, 5);

      return `You are a tax preparation assistant. Here is my financial picture.

Last 90 days — income ${money(snapshot.income30d, snapshot.currency)}, expenses ${money(snapshot.expense30d, snapshot.currency)}, net ${money(snapshot.netFlow30d, snapshot.currency)}.
Spending by category:
${formatCategories(topCategories, snapshot.currency)}
${missingRatesNote(snapshot.missingRates)}
${sections.map(taxYearSection).join('\n')}${
  upcoming.length > 0
    ? `
Upcoming returns:
${upcoming.map(deadline => `- ${deadline.returnName} for ${deadline.periodStart} to ${deadline.periodEnd}: due ${deadline.dueDate} (${deadline.daysLeft} days left)`).join('\n')}
`
    : ''
}${
  receivables && receivables.toPay > 0
    ? `
Invoices still owed to me: ${money(receivables.toPay, snapshot.currency)}, of which overdue ${money(receivables.overdue, snapshot.currency)}.
`
    : ''
}
Please:
1. Identify potentially tax-deductible expenses, and categories I should mark tax-relevant
2. Summarize income vs expenses for tax reporting
3. Flag transactions that may need special tax treatment, and rows without documents
4. Tell me what to prepare for the upcoming returns
5. Suggest tax-saving strategies based on my spending patterns

Note: This is for informational purposes only. Always consult a qualified tax professional.`;
    },
  },
  {
    key: 'anomaly-detection',
    async buildPrompt() {
      const [dashboard, trends] = await Promise.all([fetchDashboard('30d'), fetchTrends(30)]);
      const daily = formatDailyTrend(trends.dailyTrend, dashboard.snapshot.currency);
      const cats = formatCategories(trends.categories, dashboard.snapshot.currency);
      return `You are a financial fraud and anomaly detection specialist. Here is my daily transaction data for the last 30 days (showing last 14 days):

${daily}

Category breakdown:
${cats}

Currency: ${dashboard.snapshot.currency}
${missingRatesNote(dashboard.snapshot.missingRates)}
Please:
1. Identify any unusual transactions or patterns
2. Flag days where spending significantly deviates from the average
3. Look for suspicious patterns (duplicate charges, unusual timing, etc.)
4. Rate the overall health of my transaction patterns (1-10)`;
    },
  },
  {
    key: 'budget-recommendations',
    async buildPrompt() {
      const [dashboard, budgets] = await Promise.all([
        fetchDashboard('30d'),
        optional(fetchBudgets),
      ]);
      const { snapshot, topCategories } = dashboard;
      const cats = formatCategories(topCategories, snapshot.currency);
      const current = budgets ? budgetLines(budgets) : '';
      const header = `You are a personal finance advisor. Here is my financial snapshot for the last 30 days:

Income: ${snapshot.income30d.toLocaleString()} ${snapshot.currency}
Expenses: ${snapshot.expense30d.toLocaleString()} ${snapshot.currency}
Net flow: ${snapshot.netFlow30d.toLocaleString()} ${snapshot.currency}
Balance: ${snapshot.totalBalance.toLocaleString()} ${snapshot.currency}

Expense breakdown by category:
${cats}
${missingRatesNote(snapshot.missingRates)}`;

      if (current) {
        return `${header}
My budgets this period:
${current}

Please:
1. Say which budgets I am on track with and which I will overrun
2. Point out spending categories that have no budget but should
3. Suggest new limits where a budget is clearly too tight or too loose
4. Provide a prioritized action plan to improve my financial health`;
      }
      return `${header}
Please:
1. Create a recommended monthly budget based on my spending patterns
2. Apply the 50/30/20 rule (needs/wants/savings) to my data
3. Identify categories where I'm overspending
4. Suggest specific savings targets for each category
5. Provide a prioritized action plan to improve my financial health`;
    },
  },
  {
    key: 'goals-runway',
    async buildPrompt() {
      const [goals, forecast, netWorth] = await Promise.all([
        optional(fetchGoals),
        optional(fetchForecast),
        optional(fetchNetWorth),
      ]);
      const goalLines = (goals ?? [])
        .map(
          goal =>
            `- ${goal.name}: ${money(goal.currentAmount, goal.currency)} of ${money(goal.targetAmount, goal.currency)} (${Math.round(goal.percent)}%)${goal.targetDate ? `, target date ${goal.targetDate}` : ''}${goal.isReached ? ', reached' : ''}`,
        )
        .join('\n');
      const forecastLines = forecast
        ? `Safe to spend until ${forecast.safeToSpend.untilDate}: ${money(forecast.safeToSpend.amount, forecast.currency)}
Typical month: income ${money(forecast.monthlyIncome, forecast.currency)}, expenses ${money(forecast.monthlyExpense, forecast.currency)}
Runway: ${forecast.runwayMonths === null ? 'n/a (not burning savings)' : `${forecast.runwayMonths.toFixed(1)} months`}${forecast.shortfallDate ? `\nThe balance runs short on ${forecast.shortfallDate}` : ''}`
        : '- no forecast available';
      const netWorthLine = netWorth
        ? `Net worth ${money(netWorth.current, netWorth.currency)} (assets ${money(netWorth.assetsTotal, netWorth.currency)}, liabilities ${money(netWorth.liabilitiesTotal, netWorth.currency)}), ${netWorth.change >= 0 ? 'up' : 'down'} ${money(Math.abs(netWorth.change), netWorth.currency)} over 90 days${missingRatesNote(netWorth.missingRates)}`
        : '';

      return `You are a personal finance coach. Here are my savings goals and where my money is heading.

Goals:
${goalLines || '- no goals yet'}

Cash forecast:
${forecastLines}
${netWorthLine ? `\n${netWorthLine}\n` : ''}
Please:
1. Tell me which goals are realistic at my current pace and which are not
2. Suggest a monthly amount for each goal that my cash flow can carry
3. Warn me if the forecast puts any goal or my safety cushion at risk
4. Suggest the order in which to fund the goals`;
    },
  },
  {
    key: 'subscriptions-review',
    async buildPrompt() {
      const [subscriptions, summary] = await Promise.all([
        optional(fetchSubscriptions),
        optional(fetchSubscriptionSummary),
      ]);
      const lines = (subscriptions ?? [])
        .map(
          subscription =>
            `- ${subscription.vendorName}: ${money(subscription.amount, subscription.currency)} ${subscription.frequency}${subscription.nextChargeDate ? `, next charge ${subscription.nextChargeDate}` : ''}`,
        )
        .join('\n');
      const totals = summary
        ? `Active subscriptions: ${summary.activeCount}, about ${summary.totalMonthlyCost.toLocaleString()} a month in my workspace currency.
Price changes noticed: ${summary.priceChangeCount}; likely duplicates: ${summary.duplicateCount}.`
        : '';

      return `You are a personal finance advisor. Here are my recurring subscriptions.

${lines || '- no active subscriptions found'}
${totals ? `\n${totals}\n` : ''}
Please:
1. Group them (essentials, work tools, entertainment, other)
2. Point out overlaps and services I may no longer need
3. Suggest cheaper plans or yearly billing where it would save money
4. Estimate what I could save per year by acting on your suggestions`;
    },
  },
];
