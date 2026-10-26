import type { Mock } from 'vitest';
import * as nodeFs from 'node:fs';
import { PayableStatus } from '../../../src/entities/payable.entity';
import { SubscriptionFrequency } from '../../../src/entities/subscription.entity';
import { TransactionType } from '../../../src/entities/transaction.entity';
import { BudgetsTarget } from '../../../src/modules/entity-imports/targets/budgets.target';
import { PayablesTarget } from '../../../src/modules/entity-imports/targets/payables.target';
import { SubscriptionsTarget } from '../../../src/modules/entity-imports/targets/subscriptions.target';
import type { ImportContext } from '../../../src/modules/entity-imports/targets/target.types';
import { TransactionsTarget } from '../../../src/modules/entity-imports/targets/transactions.target';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

type RepoMock = {
  find: Mock;
  save: Mock;
  update: Mock;
  insert: Mock;
  create: Mock;
};

const repoMock = (found: unknown[] = []): RepoMock => {
  let counter = 0;
  return {
    find: vi.fn().mockResolvedValue(found),
    save: vi.fn(async (value: unknown) =>
      Array.isArray(value)
        ? value.map(item => ({ ...(item as object), id: `id-${++counter}` }))
        : { ...(value as object), id: `id-${++counter}` },
    ),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    insert: vi.fn().mockResolvedValue({}),
    create: vi.fn((value: unknown) => value),
  };
};

const buildContext = (
  mapping: Record<string, number>,
  repos: Record<string, RepoMock>,
): ImportContext => ({
  workspaceId: WORKSPACE_ID,
  userId: USER_ID,
  manager: {
    getRepository: (entity: { name: string }) => {
      const repo = repos[entity.name];
      if (!repo) {
        throw new Error(`No mock for ${entity.name}`);
      }
      return repo;
    },
  } as unknown as ImportContext['manager'],
  currency: 'USD',
  fileName: 'sheet.xlsx',
  categorize: false,
  cell: (row, field) => (Number.isInteger(mapping[field]) ? String(row[mapping[field]] ?? '') : ''),
  category: vi.fn(async (name: string) => `cat-${name.toLowerCase()}`),
  created: [],
  updated: [],
});

describe('PayablesTarget', () => {
  it('creates new payables, skips ones already present and reports bad rows', async () => {
    const payables = repoMock([{ vendor: 'Landlord', amount: '1500.00', dueDate: '2026-10-01' }]);
    const ctx = buildContext({ vendor: 0, amount: 1, dueDate: 2, status: 3 }, { Payable: payables });
    const results = await new PayablesTarget().run(
      [
        ['Electric Co', '$120.50', '2026-10-15', 'unpaid'],
        ['Landlord', '1500', '2026-10-01', 'paid'],
        ['', '10', '', ''],
        ['Water', 'n/a', '', ''],
      ],
      ctx,
      false,
    );
    expect(results.map(r => r.status)).toEqual(['created', 'skipped', 'error', 'error']);
    expect(results[1].reason).toBe('duplicate');
    expect(results[2].reason).toBe('vendor');
    expect(results[3].reason).toBe('amount');
    expect(payables.save).toHaveBeenCalledTimes(1);
    const saved = payables.save.mock.calls[0][0];
    expect(saved).toMatchObject({ vendor: 'Electric Co', amount: 120.5, currency: 'USD', status: PayableStatus.TO_PAY });
    expect(ctx.created).toEqual([{ kind: 'payable', id: 'id-1' }]);
  });

  it('writes nothing in a dry run', async () => {
    const payables = repoMock();
    const ctx = buildContext({ vendor: 0, amount: 1 }, { Payable: payables });
    const results = await new PayablesTarget().run([['A', '1'], ['B', '2']], ctx, true);
    expect(results.every(r => r.status === 'created')).toBe(true);
    expect(payables.save).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsTarget', () => {
  it('updates a known vendor and remembers the previous values', async () => {
    const subscriptions = repoMock([
      { id: 'sub-1', vendorName: 'Netflix', amount: '12.00', frequency: SubscriptionFrequency.MONTHLY, nextChargeDate: null, currency: 'USD' },
    ]);
    const ctx = buildContext({ vendorName: 0, amount: 1, frequency: 2 }, { Subscription: subscriptions });
    const results = await new SubscriptionsTarget().run(
      [
        ['netflix', '15.99', 'monthly'],
        ['Spotify', '9.99', 'yearly'],
        ['Spotify', '9.99', 'yearly'],
      ],
      ctx,
      false,
    );
    expect(results.map(r => r.status)).toEqual(['updated', 'created', 'skipped']);
    expect(subscriptions.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ amount: 15.99 }));
    expect(ctx.updated).toEqual([
      { kind: 'subscription', id: 'sub-1', before: { amount: 12, frequency: 'monthly', nextChargeDate: null, currency: 'USD' } },
    ]);
    expect(subscriptions.save.mock.calls[0][0]).toMatchObject({ vendorName: 'Spotify', frequency: SubscriptionFrequency.ANNUAL });
  });
});

describe('BudgetsTarget', () => {
  it('replaces the limit of an existing budget and creates missing ones', async () => {
    const budgets = repoMock([{ id: 'b-1', categoryId: 'cat-food', periodType: 'monthly', limitAmount: '400.00', currency: 'USD' }]);
    const ctx = buildContext({ category: 0, limit: 1, periodType: 2 }, { Budget: budgets });
    const results = await new BudgetsTarget().run(
      [
        ['Food', '500', 'monthly'],
        ['Rent', '1200', ''],
        ['Food', '500', 'monthly'],
      ],
      ctx,
      false,
    );
    expect(results.map(r => r.status)).toEqual(['updated', 'created', 'skipped']);
    expect(budgets.update).toHaveBeenCalledWith('b-1', { limitAmount: 500 });
    expect(ctx.updated[0]).toEqual({ kind: 'budget', id: 'b-1', before: { limitAmount: 400, currency: 'USD' } });
    expect(budgets.save.mock.calls[0][0]).toMatchObject({ categoryId: 'cat-rent', periodType: 'monthly', limitAmount: 1200 });
  });
});

describe('TransactionsTarget', () => {
  it('skips fingerprints already in the workspace and infers the type from signs only when mixed', async () => {
    const transactions = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions });
    const rows = [
      ['2026-09-01', 'Coffee', '-4.50'],
      ['2026-09-02', 'Salary', '3000'],
      ['2026-09-01', 'Coffee', '-4.50'],
      ['bad', 'x', '1'],
    ];
    const results = await new TransactionsTarget().run(rows, ctx, true);
    expect(results.map(r => r.status)).toEqual(['created', 'created', 'skipped', 'error']);
    expect(results[3].reason).toBe('date');
    expect(transactions.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WORKSPACE_ID }) }),
    );
  });

  it('treats an all-positive sheet without a type column as expenses', async () => {
    const transactions = repoMock();
    const statements = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions, Statement: statements });
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run(
      [
        ['2026-09-01', 'Coffee', '4.50'],
        ['2026-09-02', 'Lunch', '12'],
      ],
      ctx,
      false,
    );
    const saved = transactions.save.mock.calls[0][0] as Array<{ transactionType: TransactionType; debit: number | null }>;
    expect(saved.map(tx => tx.transactionType)).toEqual([TransactionType.EXPENSE, TransactionType.EXPENSE]);
    expect(saved[0].debit).toBe(4.5);
    expect(ctx.created[0]).toEqual({ kind: 'statement', id: 'id-1' });
    expect(statements.update).toHaveBeenCalledWith('id-1', expect.objectContaining({ fileData: expect.any(Buffer) }));
  });

  it('reads separate money-out and money-in columns, and rows with both or neither are errors', async () => {
    const transactions = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2, credit: 3 }, { Transaction: transactions });
    const rows = [
      ['2026-09-01', 'ACME Store - Wireless Buds', '19.99', ''],
      ['2026-09-02', 'Employer One', '', '1500'],
      ['2026-09-03', 'Both Sides', '5', '5'],
      ['2026-09-04', 'Neither', '', ''],
    ];
    const results = await new TransactionsTarget().run(rows, ctx, true);
    expect(results.map(r => r.status)).toEqual(['created', 'created', 'error', 'error']);
    expect(results[2].reason).toBe('amount');
    expect(results[3].reason).toBe('amount');
  });

  it('books money in from a credit column as income even when no row spends', async () => {
    const transactions = repoMock();
    const statements = repoMock();
    const ctx = buildContext(
      { date: 0, merchant: 1, amount: 2, credit: 3 },
      { Transaction: transactions, Statement: statements },
    );
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run([['2026-09-02', 'Employer One', '', '1500']], ctx, false);
    const [saved] = transactions.save.mock.calls[0][0] as Array<{ transactionType: TransactionType; credit: number | null }>;
    expect(saved.transactionType).toBe(TransactionType.INCOME);
    expect(saved.credit).toBe(1500);
  });

  it('reads a month-first date column month-first once one date settles the order', async () => {
    const transactions = repoMock();
    const statements = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions, Statement: statements });
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run(
      [
        ['01/02/2026', 'Corner Cafe', '-4.50'],
        ['12/31/2026', 'Corner Cafe', '-5.00'],
      ],
      ctx,
      false,
    );
    const saved = transactions.save.mock.calls[0][0] as Array<{ transactionDate: Date }>;
    expect(saved.map(tx => tx.transactionDate.toISOString().slice(0, 10))).toEqual(['2026-01-02', '2026-12-31']);
  });
});
