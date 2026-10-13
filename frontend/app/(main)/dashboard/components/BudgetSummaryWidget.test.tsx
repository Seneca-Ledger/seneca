// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionSpanProvider } from '@/app/components/dashboard/section-span';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { BudgetSummaryWidget } from './BudgetSummaryWidget';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useIntlayer: () =>
      autoDictionary({
        spentOfLimit: value('{{spent}} of {{limit}}'),
        left: value('{{amount}} left'),
        over: value('{{amount}} over'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const BUDGETS = Array.from({ length: 7 }, (_, index) =>
  budgetItem({
    id: `b-${index}`,
    name: `Budget ${index}`,
    // The widget names a budget by its category.
    category: categoryRef({ id: `c-${index}`, name: `Budget ${index}` }),
    currency: 'USD',
    limitAmount: '100.00',
    spentAmount: index === 0 ? 130 : 40,
    percentUsed: index === 0 ? 130 : 40 - index,
  }),
);

describe('BudgetSummaryWidget', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation(async () => ({ data: BUDGETS }));
  });

  it('shows the five most used at half width, with percentages only', async () => {
    renderWithQuery(
      <SectionSpanProvider value={6}>
        <BudgetSummaryWidget />
      </SectionSpanProvider>,
    );

    expect(await screen.findAllByText(/^Budget \d$/)).toHaveLength(5);
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('shows every budget, with spent against the limit and what is left or over, at full width', async () => {
    renderWithQuery(
      <SectionSpanProvider value={12}>
        <BudgetSummaryWidget />
      </SectionSpanProvider>,
    );

    expect(await screen.findAllByText(/^Budget \d$/)).toHaveLength(7);
    expect(screen.getByText('$130.00 of $100.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00 over')).toBeInTheDocument();
    expect(screen.getAllByText('$60.00 left')).toHaveLength(6);
  });
});
