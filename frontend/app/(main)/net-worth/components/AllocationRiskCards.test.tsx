// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AllocationCard } from './AllocationCard';
import { plainLineName } from './net-worth-ui';
import { RiskCard } from './RiskCard';

const labels = {
  title: 'Risk and capital role',
  riskyShare: 'At risk',
  riskyHint: 'The 80/20 rule',
  unclassified: 'Not set',
  riskColumn: 'Risk',
  roleColumn: 'Role',
  risk: { low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
  role: { income: 'Income', neutral: 'Neutral', drain: 'Drain' },
};

describe('plainLineName', () => {
  it('drops balance-sheet article numerals and leaves other names alone', () => {
    expect(plainLineName('III. Cash')).toBe('Cash');
    expect(plainLineName('I. Non-current assets')).toBe('Non-current assets');
    expect(plainLineName('Investments')).toBe('Investments');
    expect(plainLineName('Ivy Lane flat')).toBe('Ivy Lane flat');
  });
});

describe('AllocationCard', () => {
  it('shows one cut at a time and switches between them', () => {
    render(
      <AllocationCard
        title="Asset allocation"
        currency="EUR"
        locale="en"
        views={[
          {
            key: 'sheet',
            label: 'Balance sheet',
            items: [{ code: 'cash', name: 'III. Cash', amount: 144180.36, percent: 77.48 }],
          },
          {
            key: 'class',
            label: 'By asset class',
            items: [{ code: 'other', name: 'Other', amount: 41912.4, percent: 22.52 }],
          },
        ]}
      />,
    );

    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.queryByText('III. Cash')).toBeNull();
    // Whole euros on the overview; the cents wait in the tooltip.
    expect(screen.getByTitle('€144,180.36').textContent).toBe('€144,180');
    fireEvent.click(screen.getByRole('tab', { name: 'By asset class' }));
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.queryByText('Cash')).toBeNull();
  });
});

describe('RiskCard', () => {
  const lines = [
    {
      id: 'cash',
      code: 'cash',
      name: 'III. Cash',
      amount: 1000,
      capitalRole: 'neutral' as const,
      riskLevel: 'low' as const,
      isClassifiable: false,
    },
    {
      id: 'inv',
      code: 'inv',
      name: 'Investments',
      amount: 500,
      capitalRole: 'income' as const,
      riskLevel: 'medium' as const,
      isClassifiable: true,
    },
  ];

  it('shows each line choice as text and opens a menu only on click', () => {
    const onClassify = vi.fn();
    render(
      <RiskCard
        byRisk={[]}
        byRole={[]}
        riskyPercent={15.3}
        lines={lines}
        currency="EUR"
        locale="en"
        labels={labels}
        onClassify={onClassify}
      />,
    );

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    // Cash's risk is fixed: plain text, nothing to press.
    expect(screen.queryByRole('button', { name: 'Risk: Low risk' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Risk: Medium risk' }));
    fireEvent.click(within(screen.getByRole('menu')).getByText('High risk'));
    expect(onClassify).toHaveBeenCalledWith('inv', { riskLevel: 'high' });
  });

  it('measures the share at risk against the 20% limit', () => {
    render(
      <RiskCard
        byRisk={[]}
        byRole={[]}
        riskyPercent={15.3}
        lines={lines}
        currency="EUR"
        locale="en"
        labels={labels}
        onClassify={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'At risk: 15.3% / 20%' })).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
