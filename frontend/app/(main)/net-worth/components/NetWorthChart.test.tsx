// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trendColor } from '@/app/components/charts/NetWorthArea';
import { NetWorthChart } from './NetWorthChart';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    chartProps(props);
    return React.createElement('div', { 'data-testid': 'mock-chart' });
  },
}));

vi.mock('@/app/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));

const points = [
  { date: '2025-12-20', value: 1000 },
  { date: '2026-01-05', value: 1200 },
];

describe('NetWorthChart', () => {
  beforeEach(() => {
    chartProps.mockClear();
  });

  it('passes the series, trend and value formatter to the chart', () => {
    const formatValue = (value: number) => `$${value}`;
    render(<NetWorthChart points={points} positive={false} formatValue={formatValue} />);

    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect(props).toMatchObject({ points, positive: false, locale: 'en', formatValue });
  });

  it('labels the first and last day under the chart', () => {
    render(<NetWorthChart points={points} positive formatValue={String} />);

    expect(screen.getByText('Dec 20, 2025')).toBeInTheDocument();
    expect(screen.getByText('Jan 5, 2026')).toBeInTheDocument();
  });

  it('skips the footer for a single point', () => {
    render(<NetWorthChart points={points.slice(0, 1)} positive formatValue={String} />);

    expect(screen.queryByText('Dec 20, 2025')).not.toBeInTheDocument();
  });

  it('colours growth sage and decline terracotta', () => {
    expect(trendColor(true)).toBe('var(--money-up)');
    expect(trendColor(false)).toBe('var(--money-down)');
  });
});
