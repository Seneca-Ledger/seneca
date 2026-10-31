import { CategorizationRule } from '@/entities/categorization-rule.entity';
import {
  type Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import type { AuditService } from '@/modules/audit/audit.service';
import { ClassificationService } from '@/modules/classification/services/classification.service';
import { RuleApplicationService } from '@/modules/classification/services/rule-application.service';

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

function build(
  rows: Transaction[],
  options: { ownsRefs?: boolean; rules?: unknown[]; allRules?: unknown[]; tags?: string[] } = {},
) {
  const query = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn(async () => rows),
  };
  // Every rule of the workspace, best first, as the preview reads them to rank.
  const allRules = { find: vi.fn(async () => options.allRules ?? []) };
  // The tags of the workspace that still exist.
  const tags = {
    find: vi.fn(async ({ where }: { where: { id: { value: string[] } } }) =>
      where.id.value.filter(id => (options.tags ?? []).includes(id)).map(id => ({ id })),
    ),
  };
  const manager = {
    getRepository: (entity: unknown) => (entity === CategorizationRule ? allRules : tags),
    query: vi.fn(async () => undefined),
  };
  const transactions = {
    createQueryBuilder: vi.fn(() => query),
    update: vi.fn(async () => undefined),
    manager,
  };
  const rules = {
    find: vi.fn(async () => options.rules ?? []),
    update: vi.fn(async () => undefined),
  };
  const wallets = {
    manager: {
      getRepository: () => ({
        countBy: async ({ id }: { id: { value: string[] } }) =>
          options.ownsRefs === false ? 0 : id.value.length,
      }),
    },
  };
  const cache = { get: vi.fn(), set: vi.fn() };
  const audit = { createEvent: vi.fn(), createBatchEvents: vi.fn() };
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
  const rulesService = new RuleApplicationService(
    transactions as never,
    service,
    audit as unknown as AuditService,
    cache as never,
  );
  return { service, rulesService, query, transactions, rules, cache, audit, manager };
}

describe('rule preview', () => {
  it('counts matches and how many of them nobody decided', async () => {
    const { rulesService } = build([
      row('open'),
      row('picked', { categoryId: 'cat-food', categorySource: TransactionCategorySource.MANUAL }),
      row('guessed', { categoryId: 'cat-food', categorySource: TransactionCategorySource.HISTORY }),
      row('other', { counterpartyName: 'Corner Bakery' }),
    ]);

    const preview = await rulesService.previewRule({
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
    const { rulesService } = build([
      row('mine'),
      row('theirs', { isPrivate: true, ownerMemberId: PARTNER }),
    ]);

    const preview = await rulesService.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: [{ field: 'amount', operator: 'greater_than', value: 10 }],
    });

    expect(preview.matches.map(match => match.id)).toEqual(['mine']);
    expect(preview.totalTransactions).toBe(1);
  });

  it('scopes the scan to the workspace and to the ids asked for', async () => {
    const { rulesService, query } = build([row('a')]);

    await rulesService.previewRule({
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
    const { rulesService } = build(Array.from({ length: 5001 }, (_, index) => row(`tx-${index}`)));

    const preview = await rulesService.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
    });

    expect(preview.truncated).toBe(true);
    expect(preview.totalTransactions).toBe(5000);
    expect(preview.matches).toHaveLength(50);
  });
});

describe('rule preview against the rules ranked above', () => {
  const bakeryFirst = {
    id: 'rule-top',
    name: 'Anything with buds is a gift',
    conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'wireless buds' }],
    isActive: true,
  };

  it('marks the matches a higher rule takes first, and counts them', async () => {
    const { rulesService } = build([row('buds'), row('cable', { counterpartyName: 'ACME Store - Cable' })], {
      allRules: [bakeryFirst, { ...storeRule }],
    });

    const preview = await rulesService.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
      ruleId: storeRule.id,
    });

    expect(preview.shadowed).toBe(1);
    expect(preview.matches.map(match => [match.id, match.wonBy?.id ?? null])).toEqual([
      ['buds', 'rule-top'],
      ['cable', null],
    ]);
  });

  it('ignores a paused rule above, and ranks nothing above a rule not saved yet', async () => {
    const { rulesService } = build([row('buds')], {
      allRules: [{ ...bakeryFirst, isActive: false }, { ...storeRule }],
    });

    const saved = await rulesService.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
      ruleId: storeRule.id,
    });
    const draft = await rulesService.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: storeRule.conditions,
    });

    expect(saved.shadowed).toBe(0);
    expect(draft.shadowed).toBe(0);
  });

  it('matches on direction and account, and says which a row is', async () => {
    const { rulesService } = build([
      row('spent', { transactionType: TransactionType.EXPENSE, walletId: 'wallet-card' }),
      row('refund', { transactionType: TransactionType.INCOME, walletId: 'wallet-card' }),
      row('cash', { transactionType: TransactionType.EXPENSE, walletId: 'wallet-cash' }),
    ]);

    const preview = await rulesService.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: ME,
      conditions: [
        { field: 'direction', operator: 'equals', value: 'expense' },
        { field: 'wallet', operator: 'equals', value: 'wallet-card' },
      ],
    });

    expect(preview.matches.map(match => [match.id, match.direction])).toEqual([['spent', 'expense']]);
  });
});

describe('applying a rule to existing rows', () => {
  it('adds its tags to every match, filed by hand or not, and the category only where nobody decided', async () => {
    const taggingRule = {
      ...storeRule,
      result: { categoryId: 'cat-electronics', tagIds: ['tag-gadgets', 'tag-deleted'] },
    } as unknown as CategorizationRule;
    const { rulesService, transactions, manager } = build(
      [
        row('open'),
        row('picked', { categoryId: 'cat-food', categorySource: TransactionCategorySource.MANUAL }),
        row('other', { counterpartyName: 'Corner Bakery' }),
      ],
      { tags: ['tag-gadgets'] },
    );

    const result = await rulesService.applyRuleToExisting({
      rule: taggingRule,
      userId: 'user-1',
      viewerMemberId: ME,
    });

    expect(result).toEqual({ applied: 1, skippedManual: 1, tagged: 2 });
    expect((transactions.update.mock.calls[0] as unknown as [{ id: { value: string[] } }])[0].id.value).toEqual([
      'open',
    ]);
    // Added with ON CONFLICT DO NOTHING, never assigned: a deleted tag is dropped.
    const [sql, params] = manager.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT DO NOTHING');
    expect(params).toEqual([WORKSPACE, ['open', 'picked'], ['tag-gadgets']]);
  });

  it('tags without a category leaves every category as it was', async () => {
    const tagOnly = { ...storeRule, result: { tagIds: ['tag-gadgets'] } } as unknown as CategorizationRule;
    const { rulesService, transactions } = build([row('open')], { tags: ['tag-gadgets'] });

    const result = await rulesService.applyRuleToExisting({
      rule: tagOnly,
      userId: 'user-1',
      viewerMemberId: ME,
    });

    expect(result).toEqual({ applied: 0, skippedManual: 0, tagged: 1 });
    expect(transactions.update).not.toHaveBeenCalled();
  });

  it('files only undecided matches and keeps what a person or a rule chose', async () => {
    const { rulesService, transactions, rules, audit } = build([
      row('open'),
      row('guessed', { categoryId: 'cat-food', categorySource: TransactionCategorySource.HISTORY }),
      row('picked', { categoryId: 'cat-food', categorySource: TransactionCategorySource.MANUAL }),
      row('ruled', { categoryId: 'cat-food', categorySource: TransactionCategorySource.RULE }),
      row('other', { counterpartyName: 'Corner Bakery' }),
    ]);

    const result = await rulesService.applyRuleToExisting({
      rule: storeRule,
      userId: 'user-1',
      viewerMemberId: ME,
    });

    expect(result).toEqual({ applied: 2, skippedManual: 2, tagged: 0 });
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
    const { rulesService, transactions } = build([
      row('theirs', { isPrivate: true, ownerMemberId: PARTNER }),
    ]);

    const result = await rulesService.applyRuleToExisting({
      rule: storeRule,
      userId: 'user-1',
      viewerMemberId: ME,
    });

    expect(result).toEqual({ applied: 0, skippedManual: 0, tagged: 0 });
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
    vi
      .spyOn(service as unknown as { matchByPayeeHistory: () => unknown }, 'matchByPayeeHistory')
      .mockResolvedValue(undefined);

    await expect(suggest(service)).resolves.toBeNull();
    expect(rules.update).not.toHaveBeenCalled();
  });
});
