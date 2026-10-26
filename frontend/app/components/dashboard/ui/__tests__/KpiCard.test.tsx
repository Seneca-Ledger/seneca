// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PiggyBank } from '@/app/lib/category-line-icons';
import { SectionSpanProvider } from '../../section-span';
import { KpiCard } from '../KpiCard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('KpiCard', () => {
  it('shows the tone as a dot by the label, not on the value, and shows the caption', () => {
    const { container } = render(
      <KpiCard label="Spent" value="$3,072" tone="negative" caption="excludes transfers" />,
    );
    expect(screen.getByText('$3,072').className).toBe('seneca-dashboard__stat-value seneca-private');
    expect(container.querySelector('.seneca-dashboard__stat-dot--negative')).not.toBeNull();
    expect(screen.getByText('excludes transfers')).toBeInTheDocument();
  });

  it('marks the figure and the detail amounts for privacy mode, but not a count', () => {
    const { rerender } = render(
      <SectionSpanProvider value={6}>
        <KpiCard label="Income" value="$100" details={[{ label: 'Per day', value: '$10' }]} />
      </SectionSpanProvider>,
    );
    expect(screen.getByText('$100')).toHaveClass('seneca-private');
    expect(screen.getByText('$10')).toHaveClass('seneca-private');

    rerender(<KpiCard label="Counterparties" value={4} plainValue />);
    expect(screen.getByText('4')).not.toHaveClass('seneca-private');
  });

  it('draws no dot for a neutral tone', () => {
    const { container } = render(<KpiCard label="Net" value="$0" />);
    expect(container.querySelector('.seneca-dashboard__stat-dot')).toBeNull();
  });

  it('renders as a link when href is given', () => {
    render(<KpiCard label="Uncategorized" value={4} href="/statements/submit" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/statements/submit');
    expect(link.className).toContain('seneca-dashboard__stat--link');
  });

  it('renders a sparkline only with two or more points', () => {
    const { container, rerender } = render(
      <KpiCard label="Income" value="1" spark={{ points: [1] }} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    rerender(<KpiCard label="Income" value="1" spark={{ points: [1, 2, 3] }} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('shows its details only when given half a row or more', () => {
    const tile = (
      <KpiCard
        label="Income"
        value="$100"
        details={[{ label: 'Average per day', value: '$10' }]}
      />
    );
    const { rerender } = render(<SectionSpanProvider value={3}>{tile}</SectionSpanProvider>);
    expect(screen.queryByText('Average per day')).not.toBeInTheDocument();

    rerender(<SectionSpanProvider value={6}>{tile}</SectionSpanProvider>);
    expect(screen.getByText('Average per day')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
  });

  it('draws its icon as decoration behind the content, hidden from screen readers', () => {
    const { container } = render(<KpiCard label="Savings rate" value="98%" icon={PiggyBank} />);
    const icon = container.querySelector('svg.seneca-dashboard__stat-icon');

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    // First in the card, so the label and the figure stay the content read first.
    expect(container.querySelector('.seneca-dashboard__stat')?.firstElementChild).toBe(icon);
  });

  it('draws no icon unless given one', () => {
    const { container } = render(<KpiCard label="Net" value="$0" />);
    expect(container.querySelector('.seneca-dashboard__stat-icon')).toBeNull();
  });
});
