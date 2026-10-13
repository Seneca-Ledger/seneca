import { BudgetPeriodType, BudgetRolloverMode } from '../../../../src/entities/budget.entity';
import { BudgetVsActualReport } from '../../../../src/modules/reports/budget-vs-actual.report';
import {
  categoryFamily,
  monthsCovered,
  overlap,
  plannedForWindow,
} from '../../../../src/modules/reports/budget-variance.util';
import { renderTemplateLabels } from '../../../../src/modules/reports/report-template.translations';
import type { TemplateReportRow } from '../../../../src/modules/reports/report-template.types';

describe('budget window arithmetic', () => {
  it('counts whole months exactly and a partial month by its own days', () => {
    expect(monthsCovered('2026-01-01', '2026-03-31')).toBe(3);
    expect(monthsCovered('2026-04-01', '2026-04-15')).toBe(0.5);
    expect(monthsCovered('2026-03-10', '2026-03-01')).toBe(0);
  });

  it('expresses every period type per month before stretching it over the window', () => {
    const quarter = { from: '2026-01-01', to: '2026-03-31' };
    expect(plannedForWindow(120, BudgetPeriodType.MONTHLY, quarter)).toBe(360);
    expect(plannedForWindow(300, BudgetPeriodType.QUARTERLY, quarter)).toBe(300);
    expect(plannedForWindow(1200, BudgetPeriodType.ANNUAL, quarter)).toBe(300);
    expect(plannedForWindow(12, BudgetPeriodType.WEEKLY, quarter)).toBeCloseTo(156);
  });

  it('clips a window to a budget that starts or ends inside it', () => {
    const period = { from: '2026-01-01', to: '2026-12-31' };
    expect(overlap(period, { from: '2026-05-01', to: null })).toEqual({
      from: '2026-05-01',
      to: '2026-12-31',
    });
    expect(overlap(period, { from: null, to: '2025-12-31' })).toBeNull();
  });

  it('takes a category with every descendant, however deep', () => {
    const parentOf = new Map<string, string | null>([
      ['food', null],
      ['groceries', 'food'],
      ['organic', 'groceries'],
      ['rent', null],
    ]);
    expect(Array.from(categoryFamily('food', parentOf)).sort()).toEqual([
      'food',
      'groceries',
      'organic',
    ]);
  });
});

function row(overrides: Partial<TemplateReportRow>): TemplateReportRow {
  return {
    id: 'r',
    date: '2026-01-15',
    categoryKey: '',
    categoryName: 'X',
    groupName: 'X',
    counterparty: '',
    accountName: '',
    comment: '',
    tags: [],
    isIncome: false,
    amount: 0,
    originalAmount: 0,
    originalCurrency: 'EUR',
    ...overrides,
  };
}

function budget(overrides: Record<string, unknown>) {
  return {
    id: 'b',
    name: 'Budget',
    categoryId: 'food',
    category: { name: 'Food', parent: null },
    limitAmount: 100,
    currency: 'EUR',
    periodType: BudgetPeriodType.MONTHLY,
    rolloverMode: BudgetRolloverMode.NONE,
    startsOn: null,
    endsOn: null,
    goalId: null,
    goal: null,
    ...overrides,
  };
}

describe('BudgetVsActualReport', () => {
  const text = renderTemplateLabels('en');
  const categories = [
    { id: 'food', parentId: null },
    { id: 'groceries', parentId: 'food' },
    { id: 'rent', parentId: null },
  ];

  function build(
    budgets: unknown[],
    rows: TemplateReportRow[],
    dto: Record<string, unknown> = {},
    rate: (from: string) => number | null = () => 2,
  ) {
    const report = new BudgetVsActualReport(
      { find: jest.fn(async () => budgets) } as never,
      { find: jest.fn(async () => categories) } as never,
      { getRateOrNull: jest.fn(async (from: string) => rate(from)) } as never,
    );
    return report.build(
      'ws1',
      { templateId: 'budget-vs-actual', dateFrom: '2026-01-01', dateTo: '2026-03-31', format: 'csv', ...dto } as never,
      text,
      'subtitle',
      'EUR',
      rows,
    );
  }

  it('compares the plan over the period with spending in the category and its children', async () => {
    const { document } = await build(
      [budget({})],
      [
        row({ categoryKey: 'food', amount: 50 }),
        row({ categoryKey: 'groceries', amount: 200 }),
        // Income in the category is not spending.
        row({ categoryKey: 'food', amount: 999, isIncome: true }),
      ],
    );

    // 100 a month over three months; 250 spent; 50 left; 83% used.
    expect(document.sections[0].rows[0]).toEqual([
      'Food',
      'Food',
      'Budget',
      'Monthly',
      300,
      250,
      50,
      83,
    ]);
  });

  it('measures a budget that starts inside the period only from its start, plan and spending alike', async () => {
    const { document } = await build(
      [budget({ startsOn: '2026-03-01' })],
      [row({ categoryKey: 'food', date: '2026-01-10', amount: 70 }), row({ categoryKey: 'food', date: '2026-03-10', amount: 30 })],
    );

    const line = document.sections[0].rows[0];
    expect(line[3]).toBe('Monthly (2026-03-01 — 2026-03-31)');
    expect(line.slice(4, 6)).toEqual([100, 30]);
    // January's 70 is not under any budget, so it is listed outside them.
    expect(document.sections[1].rows).toEqual([['X', 'X', 70]]);
  });

  it('counts a row two budgets cover once in the total', async () => {
    const { document } = await build(
      [
        budget({ id: 'b1' }),
        budget({ id: 'b2', name: 'Trip', goalId: 'g1', goal: { name: 'Lisbon' } }),
      ],
      [row({ categoryKey: 'food', amount: 40 })],
    );

    expect(document.sections[0].rows.map(line => line[2])).toEqual(
      expect.arrayContaining(['Budget', 'Trip · Lisbon']),
    );
    // Planned adds up (two limits); spent does not (one purchase).
    expect(document.sections[0].total?.slice(4, 6)).toEqual([600, 40]);
    expect(document.footer).toEqual([['TOTAL EXPENSES', 40]]);
  });

  it('drops a budget whose goal was archived', async () => {
    const { document } = await build(
      [budget({ goalId: 'gone', goal: null })],
      [row({ categoryKey: 'food', amount: 10 })],
    );

    expect(document.sections[0].rows).toEqual([]);
    expect(document.sections[1].rows).toEqual([['X', 'X', 10]]);
  });

  it('converts a limit in another currency and reports one it cannot convert', async () => {
    const converted = await build([budget({ currency: 'USD' })], [], {}, () => 2);
    expect(converted.document.sections[0].rows[0][4]).toBe(600);
    expect(converted.missingRates).toEqual([]);

    const missing = await build([budget({ currency: 'XYZ' })], [], {}, () => null);
    expect(missing.document.sections[0].rows[0][4]).toBe(0);
    expect(missing.missingRates).toEqual(['XYZ']);
  });

  it('warns that carried-over amounts are not applied when a budget rolls over', async () => {
    const plain = await build([budget({})], []);
    expect(plain.document.notes).toBeUndefined();

    const rolling = await build([budget({ rolloverMode: BudgetRolloverMode.CARRY })], []);
    expect(rolling.document.notes).toEqual([text.rolloverNote]);
  });

  it('keeps only budgets in the category filter', async () => {
    const { document } = await build(
      [budget({}), budget({ id: 'b2', categoryId: 'rent', category: { name: 'Rent', parent: null } })],
      [],
      { categoryIds: ['rent'] },
    );

    expect(document.sections[0].rows.map(line => line[1])).toEqual(['Rent']);
  });
});
