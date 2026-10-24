import type { CategorizationRule } from '@/entities/categorization-rule.entity';
import {
  type Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import type { AuditService } from '@/modules/audit/audit.service';
import { ClassificationService } from '@/modules/classification/services/classification.service';

const WORKSPACE = 'workspace-1';
const ME = 'member-me';
const PARTNER = 'member-partner';
const STORE = 'ACME Store - Wireless Buds';

function row(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    workspaceId: WORKSPACE,
    counterpartyName: STORE,
    paymentPurpose: 'Card payment',
    transactionDate: '2026-10-01',
    debit: 25,
    credit: null,
    amount: 25,
    categoryId: null,
    categorySource: null,
    isPrivate: false,
    ownerMemberId: null,
    ...overrides,
  } as unknown as Transaction;
}

const storeRule = {
  id: 'rule-1',
  workspaceId: WORKSPACE,
  name: 'ACME is electronics',
  conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme store' }],
  result: { categoryId: 'cat-electronics' },
  priority: 0,
  isActive: true,
} as unknown as CategorizationRule;

function build(rows: Transaction[], options: { ownsRefs?: boolean; rules?: unknown[] } = {}) {
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => rows),
  };
  const transactions = {
    createQueryBuilder: jest.fn(() => query),
    update: jest.fn(async () => undefined),
  };
  const rules = {
    find: jest.fn(async () => options.rules ?? []),
    update: jest.fn(async () => undefined),
  };
  const wallets = {
    manager: {
      getRepository: () => ({
        countBy: async ({ id }: { id: { value: string[] } }) =>
          options.ownsRefs === false ? 0 : id.value.length,
      }),
    },
  };
  const cache = { get: jest.fn(), set: jest.fn() };
  const audit = { createEvent: jest.fn(), createBatchEvents: jest.fn() };
  const service = new ClassificationService(
    {} as never,
    transactions as never,
    {} as never,
    {} as never,
    {} as never,
    wallets as never,
    rules as never,
    {} as never,
    cache as never,
    audit as unknown as AuditService,
  );
  return { service, query, transactions, rules, cache, audit };
}

describe('rule preview', () => {
  it('counts matches and how many of them nobody decided', async () => {
    const { service } = build([
      row('open'),
      row('picked', { categoryId: 'cat-food', categorySource: TransactionCategorySource.MANUAL }),
      row('guessed', { categoryId: 'cat-food', categorySource: TransactionCategorySource.HISTORY }),
      row('other', { counterpartyName: 'Corner Bakery' }),
    ]);

    const preview = await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
    });

    expect(preview.totalTransactions).toBe(4);
    expect(preview.matchedTransactions).toBe(3);
    expect(preview.overridable).toBe(2);
    expect(preview.truncated).toBe(false);
    expect(preview.matches.map(match => match.id)).toEqual(['open', 'picked', 'guessed']);
    expect(preview.matches[0].matchReason).toBe('counterparty_name contains "acme store"');
  });

  it("leaves another member's private row out, even for a rule on the amount", async () => {
    const { service } = build([
      row('mine'),
      row('theirs', { isPrivate: true, ownerMemberId: PARTNER }),
    ]);

    const preview = await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: [{ field: 'amount', operator: 'greater_than', value: 10 }],
    });

    expect(preview.matches.map(match => match.id)).toEqual(['mine']);
    expect(preview.totalTransactions).toBe(1);
  });

  it('scopes the scan to the workspace and to the ids asked for', async () => {
    const { service, query } = build([row('a')]);

    await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
      transactionIds: ['a'],
    });

    expect(query.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
      workspaceId: WORKSPACE,
    });
    expect(query.andWhere).toHaveBeenCalledWith('transaction.id IN (:...transactionIds)', {
      transactionIds: ['a'],
    });
  });

  it('says when there were more rows than it looked at', async () => {
    const { service } = build(Array.from({ length: 5001 }, (_, index) => row(`tx-${index}`)));

    const preview = await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
    });

    expect(preview.truncated).toBe(true);
    expect(preview.totalTransactions).toBe(5000);
    expect(preview.matches).toHaveLength(20);
  });
});

describe('applying a rule to existing rows', () => {
  it('files only undecided matches and keeps what a person or a rule chose', async () => {
    const { service, transactions, rules, audit } = build([
      row('open'),
      row('guessed', { categoryId: 'cat-food', categorySource: TransactionCategorySource.HISTORY }),
      row('picked', { categoryId: 'cat-food', categorySource: TransactionCategorySource.MANUAL }),
      row('ruled', { categoryId: 'cat-food', categorySource: TransactionCategorySource.RULE }),
      row('other', { counterpartyName: 'Corner Bakery' }),
    ]);

    const result = await service.applyRuleToExisting({
      rule: storeRule,
      userId: 'user-1',
      viewerMemberId: ME,
    });

    expect(result).toEqual({ applied: 2, skippedManual: 2 });
    const [where, values] = transactions.update.mock.calls[0] as unknown as [
      { id: { value: string[] }; workspaceId: string },
      Record<string, unknown>,
    ];
    expect(where.id.value).toEqual(['open', 'guessed']);
    expect(where.workspaceId).toBe(WORKSPACE);
    expect(values).toEqual({
      categoryId: 'cat-electronics',
      categorySource: TransactionCategorySource.RULE,
      categoryReason: storeRule.name,
    });
    expect(audit.createBatchEvents.mock.calls[0][0]).toHaveLength(2);
    expect(rules.update).toHaveBeenCalledWith(
      { id: storeRule.id, workspaceId: WORKSPACE },
      expect.objectContaining({ lastMatchedAt: expect.any(Date) }),
    );
  });

  it("never touches another member's private row", async () => {
    const { service, transactions } = build([
      row('theirs', { isPrivate: true, ownerMemberId: PARTNER }),
    ]);

    const result = await service.applyRuleToExisting({
      rule: storeRule,
      userId: 'user-1',
      viewerMemberId: ME,
    });

    expect(result).toEqual({ applied: 0, skippedManual: 0 });
    expect(transactions.update).not.toHaveBeenCalled();
  });
});

describe('rules on a receipt or an invoice', () => {
  const suggest = (service: ClassificationService) =>
    service.suggestForPayee({
      workspaceId: WORKSPACE,
      userId: 'user-1',
      counterpartyName: STORE,
      transactionType: TransactionType.EXPENSE,
      amount: 25,
    });

  it('applies a rule and counts the match', async () => {
    const { service, rules } = build([], { rules: [storeRule] });

    await expect(suggest(service)).resolves.toEqual({
      categoryId: 'cat-electronics',
      source: TransactionCategorySource.RULE,
      reason: storeRule.name,
    });
    expect(rules.update).toHaveBeenCalledTimes(1);
  });

  it("passes over a rule naming another workspace's category", async () => {
    const { service, rules } = build([], { rules: [storeRule], ownsRefs: false });
    jest
      .spyOn(service as unknown as { matchByPayeeHistory: () => unknown }, 'matchByPayeeHistory')
      .mockResolvedValue(undefined);

    await expect(suggest(service)).resolves.toBeNull();
    expect(rules.update).not.toHaveBeenCalled();
  });
});
