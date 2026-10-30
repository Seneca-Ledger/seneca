// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetItem } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { ReceiptBudgetLine } from './ReceiptBudgetLine';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

const FUN = 'category-fun';

const budget = (overrides: Partial<BudgetItem> = {}): BudgetItem =>
  budgetItem({
    id: 'budget-1',
    name: 'Weekend fun',
    category: categoryRef({ id: FUN, name: 'Fun' }),
    spentAmount: 60,
    ...overrides,
  });

describe('ReceiptBudgetLine', () => {
  beforeEach(() => apiGet.mockReset());

  it("shows what is left of the category's budget in the receipt's period", async () => {
    apiGet.mockResolvedValue(apiResponse([budget()]));
    renderWithQuery(<ReceiptBudgetLine categoryId={FUN} date="2026-10-29" />);

    expect(await screen.findByRole('link', { name: 'Weekend fun' })).toHaveAttribute(
      'href',
      '/budgets',
    );
    expect(screen.getByText('$40.00')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(
      '/budgets',
      expect.objectContaining({ params: { date: '2026-10-29' } }),
    );
  });

  it('says by how much the budget is over', async () => {
    apiGet.mockResolvedValue(apiResponse([budget({ spentAmount: 130 })]));
    renderWithQuery(<ReceiptBudgetLine categoryId={FUN} date="2026-10-29" />);

    expect(await screen.findByText('$30.00')).toBeInTheDocument();
    expect(screen.getByText(/over the limit/)).toBeInTheDocument();
  });
});
