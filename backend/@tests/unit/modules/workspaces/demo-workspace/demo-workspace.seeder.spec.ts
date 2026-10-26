import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { BalanceAccount, Category, CategoryType, Transaction } from '@/entities';
import { generateDemoData } from '@/modules/workspaces/demo-workspace/demo-data.generator';
import { seedDemoWorkspace } from '@/modules/workspaces/demo-workspace/demo-workspace.seeder';

const WORKSPACE_ID = 'ws-demo';
const USER_ID = 'user-1';
const SYSTEM_CATEGORIES = [
  'Services',
  'Interest income',
  'Rent',
  'Utilities',
  'Insurance',
  'Professional services',
  'Fees and charges',
  'Taxes',
  'Meals and entertainment',
  'Travel',
  'Office supplies',
  'Advertising',
  'Equipment',
];

type Saved = { entity: string; row: Record<string, unknown> };

/** A manager that keeps every row written through it, with ids handed out. */
function recordingManager() {
  const saved: Saved[] = [];
  const store = (entity: string, row: Record<string, unknown>) => {
    const withId = { id: randomUUID(), ...row };
    saved.push({ entity, row: withId });
    return withId;
  };
  const nameOf = (target: unknown) => (target as { name: string }).name;
  const manager = {
    create: vi.fn((target: unknown, row: Record<string, unknown>) => ({
      __entity: nameOf(target),
      ...row,
    })),
    save: vi.fn(async (first: unknown, second?: unknown) => {
      const rows = (second ?? first) as Record<string, unknown> | Record<string, unknown>[];
      const one = (row: Record<string, unknown>) => {
        const { __entity, ...rest } = row;
        return store(String(__entity), rest);
      };
      return Array.isArray(rows) ? rows.map(one) : one(rows);
    }),
    find: vi.fn(async (target: unknown) =>
      target === Category
        ? SYSTEM_CATEGORIES.map(name => ({
            id: `cat-${name}`,
            name,
            workspaceId: WORKSPACE_ID,
            type: CategoryType.EXPENSE,
          }))
        : [],
    ),
    findOne: vi.fn(async (target: unknown) =>
      target === BalanceAccount ? { id: 'asset-fixed', code: 'ASSET_FIXED' } : null,
    ),
    update: vi.fn(async () => ({ affected: 1 })),
  };
  return { manager: manager as unknown as EntityManager, mock: manager, saved };
}

describe('seedDemoWorkspace', () => {
  it('writes every row into the new workspace', async () => {
    const { manager, saved } = recordingManager();
    await seedDemoWorkspace(
      manager,
      { workspaceId: WORKSPACE_ID, userId: USER_ID },
      generateDemoData('2026-09-28'),
    );

    // Columns and rows of a custom table hang off the table, which carries the workspace.
    const tableIds = new Set(
      saved.filter(entry => entry.entity === 'CustomTable').map(entry => entry.row.id),
    );
    const outside = saved.filter(({ entity, row }) =>
      entity === 'CustomTableColumn' || entity === 'CustomTableRow'
        ? !tableIds.has(row.tableId)
        : row.workspaceId !== WORKSPACE_ID,
    );
    expect(outside).toEqual([]);
    expect(new Set(saved.map(entry => entry.entity))).toEqual(
      new Set([
        'Category',
        'Wallet',
        'Statement',
        'Transaction',
        'Budget',
        'Subscription',
        'SubscriptionCharge',
        'Goal',
        'GoalContribution',
        'BalanceSnapshot',
        'CustomTable',
        'CustomTableColumn',
        'CustomTableRow',
      ]),
    );
  });

  it('books every row the generator made, confirmed or not, with debit or credit by direction', async () => {
    const { manager, saved } = recordingManager();
    const data = generateDemoData('2026-09-28');
    await seedDemoWorkspace(manager, { workspaceId: WORKSPACE_ID, userId: USER_ID }, data);

    const transactions = saved.filter(entry => entry.entity === Transaction.name).map(e => e.row);
    expect(transactions).toHaveLength(data.statements.flatMap(s => s.transactions).length);
    expect(transactions.filter(row => row.isVerified === false)).toHaveLength(5);
    for (const row of transactions) {
      expect(row.statementId).toEqual(expect.any(String));
      expect(row.walletId).toEqual(expect.any(String));
      expect(row.fingerprint).toEqual(expect.any(String));
      if (row.transactionType === 'expense') {
        expect(row).toMatchObject({ debit: row.amount, credit: null });
      } else {
        expect(row).toMatchObject({ credit: row.amount, debit: null });
      }
    }
    // Both legs of a card payment share a pair id, and nothing else does.
    const pairs = new Map<unknown, number>();
    for (const row of transactions.filter(row => row.transferPairId)) {
      pairs.set(row.transferPairId, (pairs.get(row.transferPairId) ?? 0) + 1);
    }
    expect([...pairs.values()].every(count => count === 2)).toBe(true);
  });

  it('adds IT services once and marks the deductible categories in the same workspace', async () => {
    const { manager, mock, saved } = recordingManager();
    await seedDemoWorkspace(
      manager,
      { workspaceId: WORKSPACE_ID, userId: USER_ID },
      generateDemoData('2026-09-28'),
    );
    expect(saved.filter(entry => entry.entity === 'Category').map(e => e.row.name)).toEqual([
      'IT services',
    ]);
    expect(mock.update).toHaveBeenCalledWith(
      Category,
      expect.objectContaining({ workspaceId: WORKSPACE_ID }),
      { taxRelevant: true },
    );
  });
});
