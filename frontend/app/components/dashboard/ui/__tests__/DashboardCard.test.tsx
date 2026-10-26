// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CardLink, DashboardCard } from '../DashboardCard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/components/icons', () => ({
  ArrowRight: () => <span data-testid="arrow-right" />,
}));

describe('DashboardCard', () => {
  it('renders title, subtitle, action slot and body', () => {
    render(
      <DashboardCard
        title="Recent transactions"
        subtitle="August 2026"
        action={<CardLink href="/statements/transactions">All transactions</CardLink>}
      >
        <p>body</p>
      </DashboardCard>,
    );
    expect(screen.getByText('Recent transactions').className).toContain(
      'seneca-dashboard__card-title',
    );
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All transactions/ })).toHaveAttribute(
      'href',
      '/statements/transactions',
    );
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('adds the shell modifier and custom class', () => {
    const { container } = render(
      <DashboardCard title="T" variant="shell" className="custom-card-class">
        x
      </DashboardCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.tagName).toBe('SECTION');
    expect(card.className).toContain('seneca-dashboard__card--shell');
    expect(card.className).toContain('custom-card-class');
  });
});
