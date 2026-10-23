import { describe, expect, it } from 'vitest';
import { budgetItem } from '@/app/test/fixtures/contracts';
import { leftToSpend } from './left-to-spend';

const MONTH = '2026-10';

describe('leftToSpend', () => {
  it('is null without any budget, so the tile keeps showing what was spent', () => {
    expect(leftToSpend([], MONTH)).toBeNull();
  });

  it('is null when the only budget starts after the month', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', startsOn: '2026-11-01' });

    expect(leftToSpend([budget], MONTH)).toBeNull();
  });

  it('is null when the only budget ended before the month', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', endsOn: '2026-09-30' });

    expect(leftToSpend([budget], MONTH)).toBeNull();
  });

  it('leaves out a budget that starts after the month when another one counts', () => {
    const counted = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 100, spentAmount: 40 });
    const later = budgetItem({
      id: 'b-2',
      name: 'Travel',
      startsOn: '2026-11-01',
      availableAmount: 500,
      spentAmount: 0,
    });

    expect(leftToSpend([counted, later], MONTH)).toEqual([{ currency: 'USD', amount: 60 }]);
  });

  it('counts a budget without a window as what it still allows', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 300, spentAmount: 120 });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: 180 }]);
  });

  it('counts a budget that starts during the month', () => {
    const budget = budgetItem({
      id: 'b-1',
      name: 'Groceries',
      startsOn: '2026-10-15',
      availableAmount: 200,
      spentAmount: 50,
    });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: 150 }]);
  });

  it('counts a budget that ends during the month', () => {
    const budget = budgetItem({
      id: 'b-1',
      name: 'Groceries',
      endsOn: '2026-10-01',
      availableAmount: 200,
      spentAmount: 50,
    });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: 150 }]);
  });

  it('adds budgets up per currency', () => {
    const budgets = [
      budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 300, spentAmount: 100 }),
      budgetItem({ id: 'b-2', name: 'Travel', availableAmount: 50, spentAmount: 20 }),
      budgetItem({
        id: 'b-3',
        name: 'Rent',
        currency: 'EUR',
        availableAmount: 900,
        spentAmount: 0,
      }),
    ];

    expect(leftToSpend(budgets, MONTH)).toEqual([
      { currency: 'USD', amount: 230 },
      { currency: 'EUR', amount: 900 },
    ]);
  });

  it('goes below zero once the month is over budget', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 100, spentAmount: 130 });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: -30 }]);
  });
});
