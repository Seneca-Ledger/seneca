import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReturnsData } from '../hooks/useReturns';
import { PerformanceTab } from './PerformanceTab';

const hook = vi.hoisted(() => ({
  data: undefined as ReturnsData | undefined,
  range: null as string | null,
}));

vi.mock('../hooks/useReturns', async importOriginal => ({
  ...(await importOriginal<typeof import('../hooks/useReturns')>()),
  useReturns: (range: string) => {
    hook.range = range;
    return { data: hook.data, isPending: !hook.data, isError: false };
  },
}));

vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyReturnsArea: () => <div data-testid="returns-area" />,
}));

function returns(overrides: Partial<ReturnsData> = {}): ReturnsData {
  return {
    range: '1y',
    from: '2025-10-10',
    to: '2026-10-10',
    days: 365,
    currency: 'EUR',
    summary: {
      startValue: 10_000,
      endValue: 12_500,
      contributions: 1_500,
      withdrawals: 0,
      income: 120,
      gain: 1_120,
      netInvested: 11_000,
      returnPercent: 10.4,
      method: 'modified_dietz',
      annualizedPercent: 10.1,
      annualizedMethod: 'xirr',
    },
    series: [],
    sources: [
      {
        kind: 'account',
        id: 'broker',
        name: 'Broker',
        scope: 'period',
        startValue: 10_000,
        endValue: 12_500,
        contributions: 1_500,
        withdrawals: 0,
        income: 120,
        gain: 1_120,
        returnPercent: 10.4,
        includedInReturn: true,
        flags: [],
      },
    ],
    flags: [],
    ...overrides,
  };
}

describe('PerformanceTab', () => {
  beforeEach(() => {
    hook.data = undefined;
    hook.range = null;
  });

  it('leads with money in, value now and the gain, and names the method behind the percentage', () => {
    hook.data = returns();

    render(<PerformanceTab range="1y" onRangeChange={vi.fn()} />);

    const kpis = within(screen.getByTestId('returns-kpis'));
    expect(kpis.getByText('€11,000.00')).toBeInTheDocument();
    expect(kpis.getByText('€12,500.00')).toBeInTheDocument();
    expect(kpis.getByText('€1,120.00')).toBeInTheDocument();
    expect(kpis.getByText('+10.4%')).toBeInTheDocument();
    expect(kpis.getByText(/incl\. €120\.00 in dividends and interest/)).toBeInTheDocument();
    expect(
      kpis.getByText('Money-weighted (Modified Dietz) · +10.1% a year (XIRR)'),
    ).toBeInTheDocument();
  });

  it('states no annual rate for a window shorter than a year', () => {
    hook.data = returns({
      range: '30d',
      days: 30,
      summary: { ...returns().summary, annualizedPercent: null, annualizedMethod: null },
    });

    render(<PerformanceTab range="30d" onRangeChange={vi.fn()} />);

    expect(screen.getByText('Money-weighted (Modified Dietz)')).toBeInTheDocument();
    expect(screen.queryByText(/a year \(XIRR\)/)).toBeNull();
  });

  it('says what keeps a line out of the figures, by name, before the notes', () => {
    hook.data = returns({
      sources: [
        { ...returns().sources[0] },
        {
          ...returns().sources[0],
          id: 'pension',
          name: 'Pension',
          includedInReturn: false,
          returnPercent: null,
          flags: ['opening_value_unknown'],
        },
        {
          ...returns().sources[0],
          kind: 'crypto',
          id: 'crypto',
          name: 'crypto',
          scope: 'all_time',
          includedInReturn: false,
          returnPercent: null,
          flags: ['crypto_not_in_return'],
        },
      ],
      flags: [
        { code: 'crypto_not_in_return', sourceId: 'crypto' },
        { code: 'opening_value_unknown', sourceId: 'pension' },
      ],
    });

    render(<PerformanceTab range="1y" onRangeChange={vi.fn()} />);

    const alerts = within(screen.getByTestId('returns-flags')).getAllByRole('alert');
    expect(alerts[0]).toHaveTextContent(/^Pension is not in the return/);
    expect(alerts[1]).toHaveTextContent(/^Crypto is shown over its whole history/);
    expect(screen.getByText('Crypto not included')).toBeInTheDocument();
    const table = within(screen.getByTestId('returns-sources'));
    expect(table.getByText('Crypto')).toBeInTheDocument();
    expect(table.getByText('all time · not in the return')).toBeInTheDocument();
  });

  it('points to the net worth page when there is nothing to measure', () => {
    hook.data = returns({ sources: [] });

    render(<PerformanceTab range="1y" onRangeChange={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Open Net worth' })).toHaveAttribute(
      'href',
      '/net-worth',
    );
  });

  it('switches the window', () => {
    hook.data = returns();
    const onRangeChange = vi.fn();

    render(<PerformanceTab range="1y" onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByRole('button', { name: '5Y' }));

    expect(hook.range).toBe('1y');
    expect(onRangeChange).toHaveBeenCalledWith('5y');
  });
});
