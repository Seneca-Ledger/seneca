import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastData } from '../hooks/useForecast';
import { ForecastContent } from './ForecastContent';

const hookMock = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  toggleExcluded: vi.fn(),
  setFactor: vi.fn(),
  setHorizon: vi.fn(),
}));

vi.mock('../hooks/useForecast', async importOriginal => ({
  ...(await importOriginal<typeof import('../hooks/useForecast')>()),
  useForecast: () => hookMock.state,
}));
vi.mock('./ForecastChart', () => ({ ForecastChart: () => <div data-testid="forecast-chart" /> }));
vi.mock('@/app/components/review/UnconfirmedNotice', () => ({
  UnconfirmedNotice: () => <div data-testid="unconfirmed-notice" />,
}));

const data: ForecastData = {
  currency: 'USD',
  profile: 'home',
  horizonDays: 90,
  openingBalance: 1000,
  closingBalance: 700,
  totalInflow: 2000,
  totalOutflow: 1800,
  totalEveryday: 500,
  totalIrregularIncome: 0,
  days: [
    { date: '2026-10-01', inflow: 0, outflow: 0, everyday: 5, irregularIncome: 0, balance: 995 },
  ],
  events: [
    { date: '2026-10-05', label: 'Landlord', amount: -500, kind: 'payable', sourceId: 'p1' },
    { date: '2026-10-10', label: 'ACME', amount: 2000, kind: 'income', sourceId: 'income:0' },
  ],
  lowestBalance: 480,
  lowestBalanceDate: '2026-10-09',
  shortfallDate: null,
  safeToSpend: { amount: 480, untilDate: '2026-10-09', nextIncomeDate: '2026-10-10' },
  runwayMonths: null,
  everydayMonthly: 300,
  irregularIncomeMonthly: 0,
  monthlyIncome: 2000,
  monthlyExpense: 1700,
  monthsObserved: 3,
  unscheduledCommitted: 0,
};

const setState = (overrides: Partial<ForecastData> = {}, extra: Record<string, unknown> = {}) => {
  hookMock.state = {
    data: { ...data, ...overrides },
    isPending: false,
    isFetching: false,
    error: null,
    horizon: 90,
    setHorizon: hookMock.setHorizon,
    scenario: { incomeFactor: 1, expenseFactor: 1, exclude: [] },
    toggleExcluded: hookMock.toggleExcluded,
    setFactor: hookMock.setFactor,
    ...extra,
  };
};

describe('ForecastContent', () => {
  beforeEach(() => {
    hookMock.toggleExcluded.mockReset();
    hookMock.setFactor.mockReset();
  });

  it('shows safe-to-spend until payday at home and lists what is ahead with a checkbox each', () => {
    setState();
    render(<ForecastContent />);

    expect(screen.getByText('Safe to spend')).toBeInTheDocument();
    expect(screen.getByText(/until payday/)).toBeInTheDocument();
    expect(screen.getByText('None expected in this horizon')).toBeInTheDocument();
    expect(screen.getByText('Landlord')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Landlord' }));
    expect(hookMock.toggleExcluded).toHaveBeenCalledWith('p1');
  });

  it('lists an item once while the previous curve is still on screen after unticking it', () => {
    setState();
    const { rerender } = render(<ForecastContent />);

    setState({}, { scenario: { incomeFactor: 1, expenseFactor: 1, exclude: ['p1'] } });
    rerender(<ForecastContent />);

    expect(screen.getAllByRole('checkbox', { name: 'Landlord' })).toHaveLength(1);
  });

  it('shows the runway for a business and names the shortfall day', () => {
    setState({ profile: 'business', runwayMonths: 2.5, shortfallDate: '2026-11-20' });
    render(<ForecastContent />);

    expect(screen.getByText('Runway')).toBeInTheDocument();
    expect(screen.getByText('2.5 months at the current burn')).toBeInTheDocument();
    expect(screen.getByText(/balance goes negative on/)).toBeInTheDocument();
    expect(screen.queryByText('Safe to spend')).not.toBeInTheDocument();
  });

  it('rounds the runway to one decimal', () => {
    setState({ profile: 'business', runwayMonths: 18.09 });
    render(<ForecastContent />);

    expect(screen.getByText('18.1 months at the current burn')).toBeInTheDocument();
  });

  it('says what the averages hold, income beyond the paydays included', () => {
    setState({ irregularIncomeMonthly: 450 });
    render(<ForecastContent />);

    expect(screen.getByText(/everyday spending/)).toHaveTextContent(
      /\$450\.00 a month of other income beyond regular paydays/,
    );
  });

  it('warns that unconfirmed rows are left out, like every screen with numbers', () => {
    setState();
    render(<ForecastContent />);

    expect(screen.getByTestId('unconfirmed-notice')).toBeInTheDocument();
  });

  it('offers an empty state when there is nothing to project', () => {
    setState({ events: [], everydayMonthly: 0, openingBalance: 0 });
    render(<ForecastContent />);

    expect(screen.getByText(/Nothing to forecast yet/)).toBeInTheDocument();
  });
});
