// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { normalizeBudgetItem } from '../hooks/useBudgetsPage';
import { BudgetCard } from './BudgetCard';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const card = (overrides: Parameters<typeof budgetItem>[0]) =>
  renderWithQuery(<BudgetCard
      budget={normalizeBudgetItem(budgetItem(overrides))} onEdit={vi.fn()} onDelete={vi.fn()} />);

describe('BudgetCard', () => {
  it('says which spending is left out for want of a rate, instead of hiding it', () => {
    card({
      id: 'b-1',
      name: 'Charity',
      limitAmount: '20.00',
      availableAmount: 20,
      spentAmount: 5,
      percentUsed: 25,
      unconvertedSpending: [{ currency: 'XYZ', amount: 150 }],
    });

    const note = screen.getByText(/XYZ/);
    expect(note.textContent).toContain('150');
    expect(note.textContent).toContain('USD');
  });

  it('adds no note when every row was converted', () => {
    const { container } = card({ id: 'b-1', name: 'Charity', spentAmount: 12, percentUsed: 60 });

    expect(container.textContent).not.toMatch(/XYZ|UAH/);
  });

  it("names a system category in the reader's language, not as it was stored", () => {
    appLocale.current = 'ru';
    const { container } = card({
      id: 'b-ad',
      name: 'Реклама вакансий',
      category: categoryRef({ id: 'cat-ad', name: 'Advertising', isSystem: true }),
    });
    appLocale.current = 'en';

    expect(container.textContent).toContain('Реклама ·');
    expect(container.textContent).not.toContain('Advertising');
  });

  it('keeps the name of a category the user made', () => {
    const { container } = card({
      id: 'b-own',
      name: 'Gifts',
      category: categoryRef({ id: 'cat-own', name: 'Donate' }),
    });

    expect(container.textContent).toContain('Donate ·');
  });

  it('shows when a budget starts and the spending before that it leaves out', () => {
    const { container } = card({
      id: 'b-window',
      name: 'Реклама вакансий',
      startsOn: '2026-10-16',
      spentAmount: 0,
      percentUsed: 0,
      beforeStartSpending: [{ currency: 'ILS', amount: 8.9 }],
    });

    expect(container.textContent).toContain('from Oct 16');
    expect(container.textContent).toMatch(/Not counted: .*8\.90 — spent before the budget starts/);
  });

  it('says nothing about a start when the budget has none', () => {
    const { container } = card({ id: 'b-open', name: 'Charity' });

    expect(container.textContent).not.toMatch(/from |Not counted/);
  });
});
