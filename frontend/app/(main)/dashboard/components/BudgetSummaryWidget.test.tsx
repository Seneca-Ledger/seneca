// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionSpanProvider } from '@/app/components/dashboard/section-span';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { BudgetSummaryWidget, budgetTone } from './BudgetSummaryWidget';

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

const now = new Date();
const THIS_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

describe('BudgetSummaryWidget', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation(async () => ({ data: BUDGETS }));
  });

  it('shows the five most used at half width, with percentages only', async () => {
    renderWithQuery(
      <SectionSpanProvider value={6}>
        <BudgetSummaryWidget month={THIS_MONTH} monthLabel="This month" />
      </SectionSpanProvider>,
    );

    expect(await screen.findAllByText(/^Budget \d$/)).toHaveLength(5);
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('shows every budget, with spent against the limit and what is left or over, at full width', async () => {
    renderWithQuery(
      <SectionSpanProvider value={12}>
        <BudgetSummaryWidget month={THIS_MONTH} monthLabel="This month" />
      </SectionSpanProvider>,
    );

    expect(await screen.findAllByText(/^Budget \d$/)).toHaveLength(7);
    expect(screen.getByText('$130.00 of $100.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00 over')).toBeInTheDocument();
    expect(screen.getAllByText('$60.00 left')).toHaveLength(6);
  });

  it('asks for this month without a date, sharing the budgets page cache', async () => {
    renderWithQuery(<BudgetSummaryWidget month={THIS_MONTH} monthLabel="This month" />);

    await screen.findAllByText(/^Budget \d$/);
    expect(apiGet).toHaveBeenCalledWith('/budgets', expect.objectContaining({ params: undefined }));
  });

  it('measures another month on its last day', async () => {
    renderWithQuery(<BudgetSummaryWidget month="2024-02" monthLabel="February 2024" />);

    await screen.findAllByText(/^Budget \d$/);
    expect(apiGet).toHaveBeenCalledWith(
      '/budgets',
      expect.objectContaining({ params: { date: '2024-02-29' } }),
    );
    expect(screen.getByText('February 2024')).toBeInTheDocument();
  });
});

describe('budgetTone', () => {
  it('keeps colour for what needs acting on: the last tenth, then past the limit', () => {
    expect(budgetTone(0)).toBe('calm');
    expect(budgetTone(88)).toBe('calm');
    expect(budgetTone(90)).toBe('near');
    expect(budgetTone(100)).toBe('near');
    expect(budgetTone(105)).toBe('over');
  });
});
