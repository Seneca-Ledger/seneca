import { countedSql } from '@/common/utils/counted-transactions.util';
import { BudgetPeriodType } from '@/entities/budget.entity';
import { StoicClass } from '@/entities/category.entity';
import { StoicLedgerService } from '@/modules/budgets/stoic/stoic-ledger.service';

type SpendingRow = { categoryId: string; month: string; total: string; currency?: string };

function transactionRepository(rows: SpendingRow[]) {
  const qb: any = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => rows.map(row => ({ currency: 'EUR', ...row })));
  return { createQueryBuilder: jest.fn(() => qb), qb };
}

const categories = [
  { id: 'rent', name: 'Rent', parentId: null, stoicClass: null },
  {
    id: 'fun',
    name: 'Fun stuff',
    parentId: null,
    stoicClass: StoicClass.LEISURE,
  },
  { id: 'fun-child', name: 'Concerts', parentId: 'fun', stoicClass: null },
  { id: 'misc', name: 'Misc', parentId: null, stoicClass: null },
  { id: 'gifts', name: 'Gifts for family', parentId: null, stoicClass: null, helpsOthers: null },
  { id: 'club', name: 'Chess club', parentId: null, stoicClass: null, helpsOthers: true },
];

function budget(overrides: Record<string, unknown>) {
  return {
    categoryId: 'rent',
    limitAmount: '1000',
    periodType: BudgetPeriodType.MONTHLY,
    startsOn: null,
    endsOn: null,
    currency: 'EUR',
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

/** 1 USD = 0.5 EUR, to make conversion visible. */
const exchangeRates = {
  getRate: jest.fn(async (from: string) => (from === 'USD' ? 0.5 : 1)),
};

function service(budgets: unknown[], rows: SpendingRow[]) {
  const transactions = transactionRepository(rows);
  const ledger = new StoicLedgerService(
    { find: jest.fn(async () => categories) } as any,
    { find: jest.fn(async () => budgets) } as any,
    transactions as any,
    { findOne: jest.fn(async () => ({ id: 'ws-1', currency: 'EUR' })) } as any,
    exchangeRates as any,
  );
  return { ledger, transactions };
}

const NOW = new Date(2026, 8, 20);

describe('StoicLedgerService', () => {
  it('splits intent and reality into classes, newest month first', async () => {
    const { ledger } = service(
      [
        budget({}),
        budget({
          categoryId: 'fun',
          limitAmount: '100',
          periodType: BudgetPeriodType.WEEKLY,
        }),
      ],
      [
        { categoryId: 'rent', month: '2026-09', total: '900' },
        { categoryId: 'fun-child', month: '2026-09', total: '600' },
        { categoryId: 'misc', month: '2026-09', total: '50' },
        { categoryId: 'fun', month: '2026-08', total: '20' },
      ],
    );

    const balance = await ledger.monthlyBalance('ws-1', 3, NOW);

    expect(balance.months.map(month => month.month)).toEqual(['2026-09', '2026-08', '2026-07']);
    expect(balance.months[0].intended).toMatchObject({
      necessity: 1000,
      // A weekly limit counts as 52/12 weeks a month.
      leisure: 433.33,
    });
    expect(balance.months[0].actual).toMatchObject({
      necessity: 900,
      // A subcategory the user left alone inherits the parent's class.
      leisure: 600,
      unclassified: 50,
    });
    expect(balance.months[1].actual.leisure).toBe(20);
  });

  it('marks categories that went past their monthly limit', async () => {
    const { ledger } = service(
      [budget({ categoryId: 'fun', limitAmount: '100' })],
      [
        { categoryId: 'fun', month: '2026-09', total: '150' },
        { categoryId: 'fun', month: '2026-08', total: '90' },
      ],
    );

    const balance = await ledger.monthlyBalance('ws-1', 2, NOW);

    expect(balance.months[0].overBudgetCategoryIds).toEqual(['fun']);
    expect(balance.months[1].overBudgetCategoryIds).toEqual([]);
  });

  it('does not credit a month with a budget that did not exist yet', async () => {
    const { ledger } = service([budget({ createdAt: new Date(2026, 8, 5) })], []);

    const balance = await ledger.monthlyBalance('ws-1', 2, NOW);

    expect(balance.months[0].intended.necessity).toBe(1000);
    expect(balance.months[1].intended.necessity).toBe(0);
  });

  it('does not credit a month outside the budget window', async () => {
    const { ledger } = service([budget({ endsOn: '2026-08-31' })], []);

    const balance = await ledger.monthlyBalance('ws-1', 2, NOW);

    expect(balance.months[0].intended.necessity).toBe(0);
    expect(balance.months[1].intended.necessity).toBe(1000);
  });

  it('says where each class came from', async () => {
    const { ledger } = service(
      [budget({})],
      [{ categoryId: 'misc', month: '2026-07', total: '10' }],
    );

    const { categories: judged } = await ledger.monthlyBalance('ws-1', 3, NOW);
    const byId = Object.fromEntries(judged.map(category => [category.id, category]));

    expect(byId.rent).toMatchObject({
      stoicClass: 'necessity',
      source: 'suggested',
      budgeted: true,
    });
    expect(byId.fun).toMatchObject({ stoicClass: 'leisure', source: 'user' });
    expect(byId['fun-child']).toMatchObject({
      stoicClass: 'leisure',
      source: 'user',
    });
    expect(byId.misc).toMatchObject({
      stoicClass: null,
      source: null,
      active: true,
      spent: 0,
    });
  });

  it('scopes the spending query to the workspace, confirmed rows only, no duplicates', async () => {
    const { ledger, transactions } = service([], []);

    await ledger.monthlyBalance('ws-1', 1, NOW);

    expect(transactions.qb.where).toHaveBeenCalledWith('t.workspace_id = :workspaceId', {
      workspaceId: 'ws-1',
    });
    expect(transactions.qb.andWhere).toHaveBeenCalledWith('t.is_duplicate = false');
    expect(transactions.qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
  });

  it('converts spending and limits into the workspace currency', async () => {
    const { ledger } = service(
      [budget({ categoryId: 'fun', limitAmount: '400', currency: 'USD' })],
      [
        { categoryId: 'fun', month: '2026-09', total: '100', currency: 'USD' },
        { categoryId: 'fun', month: '2026-09', total: '30', currency: 'EUR' },
      ],
    );

    const balance = await ledger.monthlyBalance('ws-1', 1, NOW);

    expect(balance.currency).toBe('EUR');
    expect(balance.months[0].intended.leisure).toBe(200);
    expect(balance.months[0].spentByCategory).toEqual({ fun: 80 });
    expect(balance.months[0].limitByCategory).toEqual({ fun: 200 });
  });

  it('marks money given to others by the user, or guesses it from the name', async () => {
    const { ledger } = service([], []);

    const { categories: judged } = await ledger.monthlyBalance('ws-1', 1, NOW);
    const byId = Object.fromEntries(judged.map(category => [category.id, category]));

    expect(byId.gifts).toMatchObject({ helpsOthers: true, helpsOthersSource: 'suggested' });
    expect(byId.club).toMatchObject({ helpsOthers: true, helpsOthersSource: 'user' });
    expect(byId.rent).toMatchObject({ helpsOthers: false, helpsOthersSource: 'suggested' });
  });
});
