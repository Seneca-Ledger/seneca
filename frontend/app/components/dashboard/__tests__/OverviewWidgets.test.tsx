// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastResponse, Insight } from '@/app/lib/contracts';
import { insightPage } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { AdviceCard } from '../AdviceCard';
import { currentMonthKey } from '../month-end';
import { MoneyOwedCard } from '../MoneyOwedCard';
import { OverviewMonthProvider } from '../overview-month';
import { SafeToSpendTile } from '../SafeToSpendTile';
import { SectionSpanProvider } from '../section-span';
import { TaxesCard } from '../TaxesCard';
import { UpcomingChargesCard } from '../UpcomingChargesCard';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet, post: vi.fn() },
  apiBaseUrl: '/api/v1',
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('./intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});
vi.mock('@/app/(main)/forecast/components/ForecastChart', () => ({
  ForecastChart: () => <div data-testid="forecast-chart" />,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const money = (value: number) => `${value} €`;

/** Answers each url with its own body; anything else fails like a missing route. */
function serve(routes: Record<string, unknown>) {
  apiGet.mockImplementation(async (url: string) => {
    if (url in routes) {
      return { data: routes[url] };
    }
    throw new Error(`no route ${url}`);
  });
}

function forecast(overrides: Partial<ForecastResponse> = {}): ForecastResponse {
  return {
    currency: 'EUR',
    profile: 'home',
    horizonDays: 90,
    openingBalance: 1200,
    closingBalance: 900,
    totalInflow: 3000,
    totalOutflow: 3300,
    totalEveryday: 1500,
    totalIrregularIncome: 0,
    days: [],
    events: [],
    lowestBalance: 140,
    lowestBalanceDate: '2026-10-29',
    shortfallDate: null,
    safeToSpend: { amount: 430, untilDate: '2026-10-31', nextIncomeDate: '2026-10-31' },
    runwayMonths: null,
    runwayChange: 1200,
    runwayDays: 365,
    everydayMonthly: 500,
    irregularIncomeMonthly: 0,
    monthlyIncome: 3000,
    monthlyExpense: 2800,
    monthsObserved: 6,
    caveats: [],
    recurringIncome: [],
    unscheduledCommitted: 0,
    ...overrides,
  };
}

function insight(overrides: Partial<Insight> & Pick<Insight, 'id' | 'title'>): Insight {
  return {
    type: 'spending.observation',
    category: 'spending',
    severity: 'info',
    message: `${overrides.title} message`,
    messageKey: null,
    messageParams: null,
    data: null,
    createdAt: '2026-10-13T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  apiGet.mockReset();
});

describe('SafeToSpendTile', () => {
  it('shows what is safe to spend until payday and links to the forecast', async () => {
    serve({ '/forecast': forecast() });
    renderWithQuery(<SafeToSpendTile formatAmount={money} />);

    const value = await screen.findByText('430 €');
    expect(value.closest('a')).toHaveAttribute('href', '/forecast');
    expect(screen.getByText('safeToSpend')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(
      '/forecast',
      expect.objectContaining({ params: { days: 90 } }),
    );
  });

  it('reads the runway for a business and lists the low point with room', async () => {
    serve({ '/forecast': forecast({ profile: 'business', runwayMonths: 2 }) });
    renderWithQuery(
      <SectionSpanProvider value={6}>
        <SafeToSpendTile formatAmount={money} />
      </SectionSpanProvider>,
    );

    expect(await screen.findByText('runway')).toBeInTheDocument();
    expect(screen.queryByText('safeToSpend')).toBeNull();
    expect(screen.getByText('lowestBalance')).toBeInTheDocument();
  });

  it('draws the projected balance as a sparkline in a narrow tile', async () => {
    const days = [900, 850, 1200].map((balance, index) => ({
      date: `2026-10-1${index + 3}`,
      inflow: 0,
      outflow: 0,
      everyday: 0,
      irregularIncome: 0,
      balance,
    }));
    serve({ '/forecast': forecast({ days }) });
    const { container } = renderWithQuery(
      <SectionSpanProvider value={3}>
        <SafeToSpendTile formatAmount={money} />
      </SectionSpanProvider>,
    );

    await screen.findByText('430 €');
    expect(container.querySelector('.seneca-dashboard__stat-spark svg')).not.toBeNull();
  });

  it('draws the forecast page chart in place of the sparkline with room', async () => {
    const days = [900, 850, 1200].map((balance, index) => ({
      date: `2026-10-1${index + 3}`,
      inflow: 0,
      outflow: 0,
      everyday: 0,
      irregularIncome: 0,
      balance,
    }));
    serve({ '/forecast': forecast({ days }) });
    const { container } = renderWithQuery(
      <SectionSpanProvider value={6}>
        <SafeToSpendTile formatAmount={money} />
      </SectionSpanProvider>,
    );

    expect(await screen.findByTestId('forecast-chart')).toBeInTheDocument();
    expect(container.querySelector('.seneca-dashboard__stat-spark')).toBeNull();
  });

  it('says it is today\'s figure while the Overview shows another month', async () => {
    serve({ '/forecast': forecast() });
    renderWithQuery(
      <OverviewMonthProvider value="2024-02">
        <SafeToSpendTile formatAmount={money} />
      </OverviewMonthProvider>,
    );

    expect(await screen.findByText('safeToSpend · Today')).toBeInTheDocument();
  });

  it('needs no note in the month we are in', async () => {
    serve({ '/forecast': forecast() });
    renderWithQuery(
      <OverviewMonthProvider value={currentMonthKey()}>
        <SafeToSpendTile formatAmount={money} />
      </OverviewMonthProvider>,
    );

    expect(await screen.findByText('safeToSpend')).toBeInTheDocument();
  });

  it('draws nothing when there is nothing to forecast from', async () => {
    serve({
      '/forecast': forecast({ events: [], everydayMonthly: 0, openingBalance: 0 }),
    });
    const { container } = renderWithQuery(<SafeToSpendTile formatAmount={money} />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('UpcomingChargesCard', () => {
  it('lists the charges due this week with the flags from the summary', async () => {
    serve({
      '/subscriptions/upcoming': [
        {
          id: 's-1',
          vendorName: 'Netflix',
          amount: '12.99',
          currency: 'EUR',
          nextChargeDate: '2026-10-15',
        },
      ],
      '/subscriptions/summary': {
        totalMonthlyCost: 80,
        activeCount: 6,
        upcomingCount: 1,
        upcoming30DaysCount: 4,
        upcoming30DaysAmount: 0,
        priceChangeCount: 2,
        priceChangeYearlyEffect: 24,
        duplicateCount: 0,
        overdueReviewCount: 0,
        realizedAnnualSavings: 0,
      },
    });
    renderWithQuery(<UpcomingChargesCard formatAmount={money} />);

    expect(await screen.findByText('Netflix')).toBeInTheDocument();
    // A row leads to its own subscription, ringed.
    expect(screen.getByText('Netflix').closest('a')).toHaveAttribute(
      'href',
      '/subscriptions?focus=subscription:s-1',
    );
    // The chip leads to the subscriptions it is about, ringed.
    expect((await screen.findByText('priceChanges')).closest('a')).toHaveAttribute(
      'href',
      '/subscriptions?focus=price-changed',
    );
    expect(screen.queryByText('duplicates')).toBeNull();
    expect(apiGet).toHaveBeenCalledWith(
      '/subscriptions/upcoming',
      expect.objectContaining({ params: { days: 7 } }),
    );
  });

  it('says so when nothing charges this week', async () => {
    serve({ '/subscriptions/upcoming': [] });
    renderWithQuery(<UpcomingChargesCard formatAmount={money} />);

    expect(await screen.findByText('upcomingEmpty')).toBeInTheDocument();
  });

  it('draws nothing when the subscriptions cannot be read', async () => {
    serve({});
    const { container } = renderWithQuery(<UpcomingChargesCard formatAmount={money} />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    // The card holds its place while the request is out, then leaves.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('MoneyOwedCard', () => {
  const bucket = {
    current: 100,
    days1to30: 50,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    total: 150,
    count: 2,
  };

  it('shows receivables with what is overdue, and the bills to pay', async () => {
    serve({
      '/invoices/ageing': {
        rows: [
          { ...bucket, clientId: 'c-1', clientName: 'Acme', currency: 'EUR', oldestDays: 12 },
        ],
        totals: [{ ...bucket, currency: 'EUR' }],
      },
    });
    renderWithQuery(<MoneyOwedCard payable={300} overduePayable={0} formatAmount={money} />);

    const owed = await screen.findByText('owedToYou');
    expect(owed.closest('a')).toHaveAttribute('href', '/invoices');
    expect(screen.getByText('youOwe').closest('a')).toHaveAttribute('href', '/statements/pay');
    expect(screen.getByText('overdueAmount')).toBeInTheDocument();
    expect(screen.getByText('nothingOverdue')).toBeInTheDocument();
  });

  it('counts overdue bills into what is owed, not only the ones still due', async () => {
    serve({ '/invoices/ageing': { rows: [], totals: [] } });
    renderWithQuery(<MoneyOwedCard payable={300} overduePayable={50} formatAmount={money} />);

    const row = (await screen.findByText('youOwe')).closest('a');
    expect(row).toHaveAttribute('href', '/statements/pay?status=overdue');
    expect(row).toHaveTextContent('350 €');
  });

  it('shows a card for bills that are all overdue', async () => {
    serve({ '/invoices/ageing': { rows: [], totals: [] } });
    renderWithQuery(<MoneyOwedCard payable={0} overduePayable={80} formatAmount={money} />);

    expect((await screen.findByText('youOwe')).closest('a')).toHaveTextContent('80 €');
  });

  it('draws nothing when no one owes anything either way', async () => {
    serve({ '/invoices/ageing': { rows: [], totals: [] } });
    const { container } = renderWithQuery(
      <MoneyOwedCard payable={0} overduePayable={0} formatAmount={money} />,
    );

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TaxesCard', () => {
  it('shows the reserve and the next return due, not the ones already filed', async () => {
    serve({
      '/tax/settings/reserve/amount': {
        currency: 'EUR',
        year: 2026,
        asOf: '2026-10-13',
        vat: { net: 400, outputTax: 600, inputTax: 200 },
        incomeTax: null,
        payments: { categoryId: null, amount: 0, count: 0 },
        total: 400,
        missingRateCurrencies: [],
      },
      '/tax/settings/threshold': null,
      '/tax/deadlines': [
        {
          kind: 'vat_return',
          periodStart: '2026-07-01',
          periodEnd: '2026-09-30',
          dueDate: '2026-10-10',
          daysLeft: -3,
          done: true,
          filedElsewhere: false,
          returnName: 'Filed Q3',
          basis: 'statute',
          checkedAt: '2026-10-01',
        },
        {
          kind: 'income_tax',
          periodStart: '2025-01-01',
          periodEnd: '2025-12-31',
          dueDate: '2026-11-02',
          daysLeft: 20,
          done: false,
          filedElsewhere: false,
          returnName: 'Income tax 2025',
          basis: 'statute',
          checkedAt: '2026-10-01',
        },
      ],
    });
    renderWithQuery(<TaxesCard />);

    const due = await screen.findByText('Income tax 2025');
    expect(due.closest('a')).toHaveAttribute('href', '/tax-declaration');
    expect(screen.getByText('reserveCaption')).toBeInTheDocument();
    expect(screen.queryByText('Filed Q3')).toBeNull();
  });

  it('draws nothing for a workspace with no tax setup', async () => {
    serve({
      '/tax/settings/reserve/amount': {
        currency: 'EUR',
        year: 2026,
        vat: null,
        incomeTax: null,
        total: 0,
      },
      '/tax/settings/threshold': null,
      '/tax/deadlines': [],
    });
    const { container } = renderWithQuery(<TaxesCard />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(3));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AdviceCard', () => {
  it('shows the top three pieces of advice, the Stoic reading first', async () => {
    serve({
      '/insights': insightPage([
        insight({ id: 'i-1', title: 'First observation' }),
        insight({ id: 'i-2', title: 'Second observation' }),
        insight({ id: 'i-3', title: 'Third observation' }),
        insight({ id: 'i-4', title: 'Stoic reading', type: 'stoic.balance' }),
        insight({ id: 'i-5', title: 'A warning', severity: 'warn' }),
      ]),
    });
    renderWithQuery(<AdviceCard />);

    await screen.findByText('Stoic reading');
    const titles = [...document.querySelectorAll('.seneca-dashboard__row-primary')].map(
      node => node.textContent,
    );
    expect(titles).toEqual(['Stoic reading', 'First observation', 'Second observation']);
  });

  it('draws nothing without advice', async () => {
    serve({ '/insights': insightPage([]) });
    const { container } = renderWithQuery(<AdviceCard />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
