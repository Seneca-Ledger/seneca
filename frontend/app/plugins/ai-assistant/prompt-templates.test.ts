import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptTemplates } from './prompt-templates';

const responses = vi.hoisted(() => ({
  byUrl: new Map<string, unknown>(),
  receivables: null as unknown,
}));

vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async ({ url, params }: { url: string; params?: Record<string, unknown> }) => {
    const key = params?.year ? `${url}?year=${params.year}` : url;
    if (!responses.byUrl.has(key)) {
      throw new Error(`HTTP 403 ${key}`);
    }
    return responses.byUrl.get(key);
  }),
}));
vi.mock('@/app/lib/payables-api', () => ({
  payablesApi: {
    getSummary: vi.fn(async () => {
      if (!responses.receivables) throw new Error('HTTP 403');
      return responses.receivables;
    }),
  },
}));

const build = (key: string) => {
  const template = promptTemplates.find(candidate => candidate.key === key);
  if (!template) throw new Error(`no template ${key}`);
  return template.buildPrompt();
};

const dashboard = (missingRates: string[] = []) => ({
  snapshot: {
    totalBalance: 5000,
    income30d: 3000,
    expense30d: 1200,
    netFlow30d: 1800,
    currency: 'EUR',
    missingRates,
  },
  topCategories: [{ name: 'Groceries', amount: 400, count: 12 }],
  topMerchants: Array.from({ length: 8 }, (_, i) => ({ name: `Shop ${i + 1}`, amount: 100 - i, count: 2 })),
  cashFlow: [{ date: '2026-10-01', income: 100, expense: 50 }],
});

const trends = {
  counterparties: [{ name: 'ACME Payroll', amount: 3000, count: 1 }],
  categories: [{ name: 'Groceries', amount: 400, count: 12 }],
  dailyTrend: [{ date: '2026-10-01', income: 100, expense: 50 }],
};

describe('AI assistant prompts', () => {
  beforeEach(() => {
    responses.byUrl = new Map<string, unknown>([
      ['/dashboard', dashboard()],
      ['/dashboard/trends', trends],
    ]);
    responses.receivables = null;
  });

  it('tells income sources from the merchants I pay, at most five of those', async () => {
    const prompt = await build('top-counterparties');

    expect(prompt).toMatch(/Who paid me \(income sources\):\n1\. ACME Payroll/);
    expect(prompt).toMatch(/Who I paid most \(spending merchants\):\n1\. Shop 1/);
    expect(prompt).toContain('5. Shop 5');
    expect(prompt).not.toContain('Shop 6');
  });

  it('notes currencies counted at face value only when there are some', async () => {
    expect(await build('expense-summary')).not.toMatch(/no exchange rate/);

    responses.byUrl.set('/dashboard', dashboard(['USD', 'GBP']));
    expect(await build('expense-summary')).toMatch(
      /amounts in USD, GBP have no exchange rate and are counted at face value/,
    );
  });

  it('prepares taxes from the tax year, upcoming returns and what clients owe', async () => {
    const year = new Date().getFullYear();
    responses.byUrl.set(`/tax/year-report?year=${year}`, {
      year,
      currency: 'EUR',
      categories: [{ name: 'Office rent', type: 'expense', count: 12, total: 9600, documentCount: 10 }],
      rows: [],
      total: { income: 50000, expense: 9600 },
      missingRateCurrencies: [],
    });
    responses.byUrl.set('/tax/deadlines', [
      {
        returnName: 'UStVA Q3',
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        dueDate: '2026-11-10',
        daysLeft: 23,
        done: false,
      },
      { returnName: 'Filed', periodStart: '', periodEnd: '', dueDate: '', daysLeft: 0, done: true },
    ]);
    responses.receivables = { toPay: 1200, overdue: 300 };

    const prompt = await build('tax-preparation');

    expect(prompt).toContain(`Tax year ${year}`);
    expect(prompt).toMatch(/Office rent \(expense\): 9[,.\s ]?600 EUR, 12 rows, 10 with documents/);
    expect(prompt).toMatch(/UStVA Q3 for 2026-07-01 to 2026-09-30: due 2026-11-10 \(23 days left\)/);
    expect(prompt).not.toContain('Filed');
    expect(prompt).toMatch(/Invoices still owed to me: 1[,.\s ]?200 EUR, of which overdue 300 EUR/);
  });

  it('still prepares taxes when the tax sources cannot be read', async () => {
    const prompt = await build('tax-preparation');

    expect(prompt).toContain('Last 90 days');
    expect(prompt).not.toContain('Tax year');
    expect(prompt).not.toContain('Upcoming returns');
    expect(prompt).not.toContain('Invoices still owed');
  });

  it('reviews the budgets I have, or proposes 50/30/20 when there are none', async () => {
    responses.byUrl.set('/budgets', [
      {
        name: 'Food',
        category: { name: 'Groceries' },
        periodType: 'monthly',
        limitAmount: '500.00',
        spentAmount: 420,
        percentUsed: 84,
        availableAmount: 80,
        currency: 'EUR',
        isActive: true,
      },
    ]);
    expect(await build('budget-recommendations')).toMatch(
      /Food \(Groceries, monthly\): limit 500 EUR, spent 420 EUR \(84%\), left 80 EUR/,
    );

    responses.byUrl.set('/budgets', []);
    expect(await build('budget-recommendations')).toContain('50/30/20');
  });

  it('weighs goals against the cash forecast and net worth', async () => {
    responses.byUrl.set('/goals', [
      {
        name: 'Emergency fund',
        currentAmount: 2000,
        targetAmount: 6000,
        currency: 'EUR',
        percent: 33.3,
        targetDate: '2027-06-30',
        isReached: false,
      },
    ]);
    responses.byUrl.set('/forecast', {
      currency: 'EUR',
      safeToSpend: { amount: 750, untilDate: '2026-10-31', nextIncomeDate: '2026-11-01' },
      monthlyIncome: 3000,
      monthlyExpense: 2400,
      runwayMonths: null,
      runwayChange: 1200,
      runwayDays: 365,
      shortfallDate: null,
    });

    const prompt = await build('goals-runway');

    expect(prompt).toMatch(/Emergency fund: 2[,.\s ]?000 EUR of 6[,.\s ]?000 EUR \(33%\), target date 2027-06-30/);
    expect(prompt).toContain('Safe to spend until 2026-10-31: 750 EUR');
    expect(prompt).toContain('Runway: n/a (not burning savings)');
    // Net worth could not be read: its line is left out, not the prompt.
    expect(prompt).not.toContain('Net worth');
  });

  it('lists active subscriptions with what they cost', async () => {
    responses.byUrl.set('/subscriptions', [
      { vendorName: 'Netflix', amount: '13.99', currency: 'EUR', frequency: 'monthly', nextChargeDate: '2026-11-02' },
    ]);
    responses.byUrl.set('/subscriptions/summary', {
      activeCount: 1,
      totalMonthlyCost: 13.99,
      priceChangeCount: 0,
      duplicateCount: 0,
    });

    const prompt = await build('subscriptions-review');

    expect(prompt).toMatch(/Netflix: 13[.,]99 EUR monthly, next charge 2026-11-02/);
    expect(prompt).toContain('Active subscriptions: 1');
  });

  it('builds every prompt even when every optional source fails', async () => {
    for (const template of promptTemplates) {
      await expect(template.buildPrompt()).resolves.toMatch(/Please:/);
    }
  });
});
