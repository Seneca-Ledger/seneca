import type {
  DashboardResponse,
  DashboardTopCategory,
  DashboardTrendsResponse as TrendsResponse,
} from '@/app/lib/contracts';
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

function formatCounterparties(
  counterparties: TrendsResponse['counterparties'],
  currency: string,
): string {
  return counterparties
    .slice(0, 10)
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}: ${c.amount.toLocaleString()} ${currency} (${c.count} transactions)`,
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
      const trends = await fetchTrends(30);
      const dashboard = await fetchDashboard('30d');
      const formatted = formatCounterparties(trends.counterparties, dashboard.snapshot.currency);
      return `You are a financial analyst. Here are my top counterparties (people/companies I transact with) over the last 30 days:

${formatted}

Currency: ${dashboard.snapshot.currency}

Please:
1. Identify my most significant financial relationships
2. Categorize these counterparties (vendors, employers, services, etc.)
3. Flag any counterparties with unusually high transaction counts or amounts
4. Suggest if any relationships could be renegotiated for better terms`;
    },
  },
  {
    key: 'tax-preparation',
    async buildPrompt() {
      const dashboard = await fetchDashboard('90d');
      const { snapshot, topCategories } = dashboard;
      const cats = formatCategories(topCategories, snapshot.currency);
      return `You are a tax preparation assistant. Here is my financial summary for the last 90 days:

Income: ${snapshot.income30d.toLocaleString()} ${snapshot.currency}
Expenses: ${snapshot.expense30d.toLocaleString()} ${snapshot.currency}
Net flow: ${snapshot.netFlow30d.toLocaleString()} ${snapshot.currency}

Category breakdown:
${cats}

Please:
1. Identify potentially tax-deductible expenses
2. Summarize income vs expenses for tax reporting
3. Flag any transactions that may need special tax treatment
4. Suggest tax-saving strategies based on my spending patterns

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
      const dashboard = await fetchDashboard('30d');
      const { snapshot, topCategories } = dashboard;
      const cats = formatCategories(topCategories, snapshot.currency);
      return `You are a personal finance advisor. Here is my financial snapshot for the last 30 days:

Income: ${snapshot.income30d.toLocaleString()} ${snapshot.currency}
Expenses: ${snapshot.expense30d.toLocaleString()} ${snapshot.currency}
Net flow: ${snapshot.netFlow30d.toLocaleString()} ${snapshot.currency}
Balance: ${snapshot.totalBalance.toLocaleString()} ${snapshot.currency}

Expense breakdown by category:
${cats}

Please:
1. Create a recommended monthly budget based on my spending patterns
2. Apply the 50/30/20 rule (needs/wants/savings) to my data
3. Identify categories where I'm overspending
4. Suggest specific savings targets for each category
5. Provide a prioritized action plan to improve my financial health`;
    },
  },
];
