import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { PayeeMode } from '@/entities/payee.entity';
import {
  type Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import type { AuditService } from '@/modules/audit/audit.service';
import { ClassificationService } from '@/modules/classification/services/classification.service';
import { RuleOrderService } from '@/modules/classification/services/rule-order.service';
import { RuleSuggestionsService } from '@/modules/classification/services/rule-suggestions.service';

const WORKSPACE = 'workspace-1';
const ME = 'member-me';
const PARTNER = 'member-partner';
const STORE = 'ACME Store - Wireless Buds';

describe('a rule that tags and asks for the account', () => {
  const tagRule = {
    id: 'rule-1',
    workspaceId: WORKSPACE,
    name: 'Card spending at ACME',
    conditions: [
      { field: 'counterparty_name', operator: 'contains', value: 'acme store' },
      { field: 'direction', operator: 'equals', value: 'expense' },
      { field: 'wallet', operator: 'equals', value: 'wallet-card' },
    ],
    result: { categoryId: 'cat-electronics', tagIds: ['tag-gadgets', 'tag-deleted'] },
    priority: 0,
    isActive: true,
  };

  function build() {
    const rules = { find: vi.fn(async () => [tagRule]), update: vi.fn() };
    const tags = {
      // Only tag-gadgets still exists in the workspace.
      find: vi.fn(async ({ where }: { where: { id: { value: string[] }; workspaceId: string } }) =>
        where.workspaceId === WORKSPACE
          ? where.id.value.filter(id => id === 'tag-gadgets').map(id => ({ id }))
          : [],
      ),
    };
    const wallets = {
      manager: {
        getRepository: (entity: { name?: string }) =>
          entity.name === 'Tag' ? tags : { countBy: async ({ id }: { id: { value: string[] } }) => id.value.length },
      },
    };
    const service = new ClassificationService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: vi.fn(async () => []) } as never,
      wallets as never,
      rules as never,
      {} as never,
      { get: vi.fn(), set: vi.fn() } as never,
      { createEvent: vi.fn() } as unknown as AuditService,
    );
    return service;
  }

  const imported = (walletId: string) =>
    ({
      workspaceId: WORKSPACE,
      counterpartyName: STORE,
      paymentPurpose: 'Card payment',
      debit: 25,
      credit: null,
      amount: 25,
      transactionType: TransactionType.EXPENSE,
      walletId,
    }) as unknown as Transaction;

  it('hands the tags that still exist to the new row, with the category', async () => {
    const classification = await build().classifyTransaction(imported('wallet-card'), 'user-1');

    expect(classification.categoryId).toBe('cat-electronics');
    expect(classification.categorySource).toBe(TransactionCategorySource.RULE);
    expect(classification.tags).toEqual([{ id: 'tag-gadgets' }]);
  });

  it('does not fire for a row of another account', async () => {
    const service = build();
    vi.spyOn(service as never, 'autoClassifyCategory').mockResolvedValue(undefined as never);

    const classification = await service.classifyTransaction(imported('wallet-cash'), 'user-1');

    expect(classification.categorySource).not.toBe(TransactionCategorySource.RULE);
    expect(classification.tags).toBeUndefined();
  });
});

describe('putting rules in order', () => {
  const stored = (id: string, priority: number) =>
    ({ id, workspaceId: WORKSPACE, priority }) as unknown as CategorizationRule;

  function build(rules: CategorizationRule[]) {
    const repository = {
      find: vi.fn(async () => rules),
      findOne: vi.fn(async () => [...rules].sort((a, b) => b.priority - a.priority)[0] ?? null),
      update: vi.fn(async () => undefined),
    };
    const outer = {
      ...repository,
      manager: {
        transaction: async (work: (manager: unknown) => Promise<unknown>) =>
          work({ getRepository: (entity: unknown) => (entity === CategorizationRule ? repository : null) }),
      },
    };
    const audit = { createBatchEvents: vi.fn() };
    return {
      service: new RuleOrderService(outer as never, audit as unknown as AuditService),
      repository,
      audit,
    };
  }

  it('gives the first rule the highest priority and writes only what moved', async () => {
    const { service, repository, audit } = build([stored('a', 3), stored('b', 2), stored('c', 1)]);

    await service.reorder({ workspaceId: WORKSPACE, userId: 'user-1', ids: ['c', 'b', 'a'] });

    expect(repository.update.mock.calls).toEqual([
      [{ id: 'c', workspaceId: WORKSPACE }, { priority: 3 }],
      [{ id: 'a', workspaceId: WORKSPACE }, { priority: 1 }],
    ]);
    expect(audit.createBatchEvents.mock.calls[0][0]).toHaveLength(2);
  });

  it.each([
    ['one is missing', ['a', 'b']],
    ['one is not of the workspace', ['a', 'b', 'x']],
    ['one comes twice', ['a', 'b', 'b']],
  ])('refuses a list where %s', async (_case, ids) => {
    const { service, repository } = build([stored('a', 3), stored('b', 2), stored('c', 1)]);

    await expect(service.reorder({ workspaceId: WORKSPACE, userId: 'user-1', ids })).rejects.toThrow(
      'The rules changed meanwhile',
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('puts a new rule above every other one', async () => {
    await expect(build([stored('a', 7), stored('b', 2)]).service.topPriority(WORKSPACE)).resolves.toBe(8);
    await expect(build([]).service.topPriority(WORKSPACE)).resolves.toBe(0);
  });
});

describe('rule suggestions', () => {
  const PAYEE = { id: 'payee-acme', name: 'ACME Store', mode: PayeeMode.AUTO };
  let day = 30;
  const decided = (overrides: Partial<Transaction> = {}) =>
    ({
      id: `tx-${day}`,
      workspaceId: WORKSPACE,
      payeeId: PAYEE.id,
      counterpartyName: STORE,
      paymentPurpose: 'Card payment',
      categoryId: 'cat-electronics',
      categorySource: TransactionCategorySource.MANUAL,
      transactionDate: `2026-10-${String(day--).padStart(2, '0')}`,
      isPrivate: false,
      ownerMemberId: null,
      ...overrides,
    }) as unknown as Transaction;

  function build(rows: Transaction[], options: { payees?: unknown[]; rules?: unknown[] } = {}) {
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn(async () => rows),
    };
    const service = new RuleSuggestionsService(
      { createQueryBuilder: () => query } as never,
      { find: vi.fn(async () => options.payees ?? [PAYEE]) } as never,
      { find: vi.fn(async () => options.rules ?? []) } as never,
    );
    return { service, query };
  }

  beforeEach(() => {
    day = 30;
  });

  it('offers a rule for a payee filed by hand three times under one category', async () => {
    const { service, query } = build([decided(), decided(), decided()]);

    await expect(service.suggest(WORKSPACE, ME)).resolves.toEqual([
      {
        payeeId: PAYEE.id,
        payeeName: PAYEE.name,
        categoryId: 'cat-electronics',
        decidedCount: 3,
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: PAYEE.name }],
      },
    ]);
    expect(query.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
      workspaceId: WORKSPACE,
    });
  });

  it('waits for the third decision', async () => {
    await expect(build([decided(), decided()]).service.suggest(WORKSPACE, ME)).resolves.toEqual([]);
  });

  it("does not learn from another member's private rows", async () => {
    const theirs = { isPrivate: true, ownerMemberId: PARTNER };
    const { service } = build([decided(theirs), decided(theirs), decided()]);

    await expect(service.suggest(WORKSPACE, ME)).resolves.toEqual([]);
  });

  it('leaves a payee pinned on the Payees page alone', async () => {
    const { service } = build([decided(), decided(), decided()], {
      payees: [{ ...PAYEE, mode: PayeeMode.ALWAYS }],
    });

    await expect(service.suggest(WORKSPACE, ME)).resolves.toEqual([]);
  });

  it('does not offer what an active rule already catches', async () => {
    const { service } = build([decided(), decided(), decided()], {
      rules: [{ conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme' }] }],
    });

    await expect(service.suggest(WORKSPACE, ME)).resolves.toEqual([]);
  });

  it("falls back to the bank's own text when it does not carry the payee's name", async () => {
    const descriptor = 'POS 4411 WIRELESS BUDS';
    const { service } = build(
      [decided(), decided(), decided()].map(row => ({ ...row, counterpartyName: descriptor }) as Transaction),
    );

    const [suggestion] = await service.suggest(WORKSPACE, ME);

    expect(suggestion.conditions).toEqual([
      { field: 'counterparty_name', operator: 'equals', value: descriptor },
    ]);
  });
});
