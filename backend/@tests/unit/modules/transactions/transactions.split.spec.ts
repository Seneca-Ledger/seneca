import { TransactionType } from '@/entities/transaction.entity';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { NotFoundException } from '@nestjs/common';

const ORIGINAL = {
  id: 'tx-1',
  workspaceId: 'ws-1',
  statementId: 'stmt-1',
  walletId: 'wallet-1',
  transactionDate: new Date('2026-08-01'),
  counterpartyName: 'Magnum',
  paymentPurpose: 'Groceries',
  comments: 'original note',
  currency: 'KZT',
  transactionType: TransactionType.EXPENSE,
  amount: 12000,
  debit: 12000,
  credit: null,
  amountForeign: null,
  exchangeRate: null,
  categoryId: 'cat-food',
  categoryHint: 'groceries',
  transactionNature: 'operational',
  taxDetected: true,
  enrichmentConfidence: 0.9,
  isDuplicate: false,
  fingerprint: 'fp-of-12000',
  splitGroupId: null,
  splitIndex: null,
};

describe('TransactionsService.split', () => {
  let service: TransactionsService;
  let savedRows: any[];
  let transactionRepository: any;
  let auditService: any;
  let cacheManager: any;
  let lockedFindOne: jest.Mock;
  // When set, the in-transaction locked re-read returns this instead of a fresh
  // copy of the outer findOne result. Lets a test simulate a concurrent writer
  // landing between the two reads.
  let lockedRow: any;
  // Category ids this workspace owns, counted by the cross-tenant guard.
  // `null` means "every id asked about is owned", the case for most tests.
  let ownedCategoryIds: Set<string> | null;

  const makeManager = () => {
    const repo = {
      findOne: lockedFindOne,
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (row: any) => {
        const stored = { ...row, id: row.id ?? `new-${savedRows.length}` };
        savedRows.push(stored);
        return stored;
      }),
    };
    return {
      transaction: jest.fn(async (cb: any) => cb({ getRepository: () => repo })),
      // Used by the guard that rejects another workspace's category ids.
      getRepository: () => ({
        countBy: jest.fn(async ({ id }: any) => {
          const ids: string[] = id.value;
          return ownedCategoryIds ? ids.filter(one => ownedCategoryIds?.has(one)).length : ids.length;
        }),
      }),
    };
  };

  beforeEach(() => {
    savedRows = [];
    lockedRow = undefined;
    ownedCategoryIds = null;
    auditService = { createEvent: jest.fn() };
    cacheManager = { set: jest.fn() };
    // Always a FRESH object, never the same instance twice: the unlocked read and
    // the locked read must not alias, or a bug that derives from the stale read
    // would pass unnoticed.
    lockedFindOne = jest.fn(
      async () => lockedRow ?? { ...(await transactionRepository.findOne()) },
    );
    transactionRepository = {
      findOne: jest.fn(async () => ({ ...ORIGINAL })),
      manager: makeManager(),
    };
    service = new TransactionsService(
      transactionRepository,
      {} as any,
      { findOne: jest.fn(async () => ({ id: 'u-1', role: 'admin' })) } as any,
      { findOne: jest.fn(async () => ({ permissions: { canEditStatements: true } })) } as any,
      { findOne: jest.fn(async () => null), create: jest.fn(x => x), save: jest.fn(async x => x) } as any,
      cacheManager as any,
      auditService as any,
      { bulkConvert: jest.fn() } as any,
      { resolve: jest.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } as any,
    );
    // ensureCanEditStatements is a private permission check with its own coverage;
    // stub it so these tests stay focused on split arithmetic.
    (service as any).ensureCanEditStatements = jest.fn();
  });

  it('splits an expense into parts whose amounts sum to the original', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [
        { amount: 8000, categoryId: 'cat-food' },
        { amount: 4000, categoryId: 'cat-household' },
      ],
    });

    expect(parts).toHaveLength(2);
    expect(parts.map(p => Number(p.amount))).toEqual([8000, 4000]);
    // Must equal the ORIGINAL row's amount, not merely the DTO echoed back.
    expect(parts.reduce((s, p) => s + Number(p.amount), 0)).toBe(Number(ORIGINAL.amount));
  });

  // The DTO only validates that categoryId is a UUID. Without the workspace
  // check a part could be pointed at another tenant's category, whose name then
  // comes back through the `category` relation loaded by getSplitParts.
  it('refuses a part pointing at a category from another workspace', async () => {
    ownedCategoryIds = new Set(['cat-food']);

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', {
        parts: [
          { amount: 8000, categoryId: 'cat-food' },
          { amount: 4000, categoryId: 'cat-of-other-workspace' },
        ],
      }),
    ).rejects.toThrow(NotFoundException);

    expect(savedRows).toHaveLength(0);
  });

  it('writes amount, debit and credit consistently for an expense', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    for (const part of parts) {
      expect(part.debit).toBe(Number(part.amount));
      expect(part.credit).toBeNull();
    }
  });

  it('writes credit instead of debit for an income transaction', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      transactionType: TransactionType.INCOME,
      debit: null,
      credit: 12000,
    }));

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    for (const part of parts) {
      expect(part.credit).toBe(Number(part.amount));
      expect(part.debit).toBeNull();
    }
  });

  it('makes every part inherit statementId so dashboard innerJoin still sees them', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    for (const part of parts) {
      expect(part.statementId).toBe('stmt-1');
      expect(part.walletId).toBe('wallet-1');
    }
  });

  it('assigns one shared splitGroupId and sequential splitIndex', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    expect(new Set(parts.map(p => p.splitGroupId)).size).toBe(1);
    expect(parts[0].splitGroupId).toEqual(expect.any(String));
    expect(parts.map(p => p.splitIndex)).toEqual([0, 1]);
    expect(parts[0].id).toBe('tx-1');
  });

  it('rejects parts that do not sum to the original amount', async () => {
    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 8000 }, { amount: 3000 }] }),
    ).rejects.toThrow(/must sum to/i);
  });

  it('rejects splitting a transaction that is already split', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      splitGroupId: 'grp-1',
    }));

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 8000 }, { amount: 4000 }] }),
    ).rejects.toThrow(/already part of a split/i);
  });

  it('prorates amountForeign across the parts', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      amountForeign: 24,
      exchangeRate: 500,
    }));

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    expect(parts.map(p => p.amountForeign)).toEqual([16, 8]);
  });

  it('rejects splitting a transaction marked as a duplicate', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      isDuplicate: true,
    }));

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 8000 }, { amount: 4000 }] }),
    ).rejects.toThrow(/marked as a duplicate/i);
  });

  it('rejects splitting a transaction without a positive amount', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      amount: 0,
      debit: null,
      credit: null,
    }));

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 1 }, { amount: 1 }] }),
    ).rejects.toThrow(/positive amount/i);
  });

  it('clears the fingerprint on every part so backfill recomputes them', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    for (const part of parts) {
      expect(part.fingerprint).toBeNull();
    }
  });

  it('re-checks under the pessimistic lock and rejects a concurrent split', async () => {
    // Outer read sees a clean row; by the time the lock is taken another request
    // has already split it.
    lockedRow = { ...ORIGINAL, splitGroupId: 'grp-concurrent' };

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 8000 }, { amount: 4000 }] }),
    ).rejects.toThrow(/already part of a split/i);
    expect(savedRows).toHaveLength(0);
  });

  it('takes the lock scoped to both the id and the workspace', async () => {
    await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    expect(lockedFindOne).toHaveBeenCalledWith({
      where: { id: 'tx-1', workspaceId: 'ws-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('re-checks the duplicate flag under the lock', async () => {
    lockedRow = { ...ORIGINAL, isDuplicate: true };

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 8000 }, { amount: 4000 }] }),
    ).rejects.toThrow(/marked as a duplicate/i);
    expect(savedRows).toHaveLength(0);
  });

  it('derives debit/credit from the locked row when a concurrent update flipped the type', async () => {
    // Unlocked read still says EXPENSE; by the time the lock is taken the row is
    // INCOME. Deriving from the stale read would write debit instead of credit.
    lockedRow = {
      ...ORIGINAL,
      transactionType: TransactionType.INCOME,
      debit: null,
      credit: 12000,
    };

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    for (const part of parts) {
      expect(part.credit).toBe(Number(part.amount));
      expect(part.debit).toBeNull();
    }
  });

  it('rejects when a concurrent update changed the amount before the lock', async () => {
    // Parts were validated against 12000 by the fast path, but the locked row is
    // now 10000. Silently absorbing the 2000 into the last part would be wrong.
    lockedRow = { ...ORIGINAL, amount: 10000, debit: 10000 };

    await expect(
      service.split('tx-1', 'ws-1', 'u-1', { parts: [{ amount: 8000 }, { amount: 4000 }] }),
    ).rejects.toThrow(/must sum to 10000/i);
    expect(savedRows).toHaveLength(0);
  });

  it('prorates amountForeign from the locked row, not the stale read', async () => {
    lockedRow = { ...ORIGINAL, amountForeign: 24, exchangeRate: 500 };

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    expect(parts.map(p => p.amountForeign)).toEqual([16, 8]);
  });

  it('makes the last part absorb penny drift so parts sum exactly to the original', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      amount: 100,
      debit: 100,
    }));

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 50 }, { amount: 49.99 }],
    });

    expect(parts.reduce((s, p) => s + Number(p.amount), 0)).toBe(100);
    expect(parts.map(p => Number(p.amount))).toEqual([50, 50]);
  });

  it('makes amountForeign of the parts sum exactly to the original amountForeign', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      amountForeign: 10,
      exchangeRate: 1200,
    }));

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 4000 }, { amount: 4000 }, { amount: 4000 }],
    });

    expect(parts.map(p => Number(p.amountForeign))).toEqual([3.33, 3.33, 3.34]);
    expect(parts.reduce((s, p) => s + Number(p.amountForeign), 0)).toBe(10);
  });

  it('handles decimal columns returned by Postgres as strings', async () => {
    transactionRepository.findOne.mockImplementation(async () => ({
      ...ORIGINAL,
      amount: '12000.00',
      debit: '12000.00',
      amountForeign: '24.00',
    }));

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    expect(parts.map(p => Number(p.amount))).toEqual([8000, 4000]);
    expect(parts.map(p => Number(p.debit))).toEqual([8000, 4000]);
    expect(parts.map(p => Number(p.amountForeign))).toEqual([16, 8]);
  });

  it('applies per-part overrides and leaves omitted fields inherited', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [
        {
          amount: 8000,
          categoryId: 'cat-household',
          paymentPurpose: 'Cleaning supplies',
          comments: 'part one',
        },
        { amount: 4000 },
      ],
    });

    expect(parts[0].categoryId).toBe('cat-household');
    expect(parts[0].paymentPurpose).toBe('Cleaning supplies');
    expect(parts[0].comments).toBe('part one');

    expect(parts[1].categoryId).toBe('cat-food');
    expect(parts[1].paymentPurpose).toBe('Groceries');
    expect(parts[1].comments).toBe('original note');
  });

  it('records an audit event and invalidates the reports cache', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    expect(cacheManager.set).toHaveBeenCalledWith('reports:version:u-1', expect.any(String), 0);
    expect(auditService.createEvent).toHaveBeenCalledTimes(1);
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityId: 'tx-1',
        meta: expect.objectContaining({
          operation: 'split',
          partCount: 2,
          splitGroupId: parts[0].splitGroupId,
        }),
      }),
    );
  });

  it('gives every part the same enrichment metadata as the row it came from', async () => {
    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 8000 }, { amount: 4000 }],
    });

    // These describe the underlying charge, which is the same charge for each
    // part. Part 0 keeps them by virtue of being the mutated original, so the
    // siblings must inherit them or one split group holds two different answers.
    for (const part of parts) {
      expect(part.categoryHint).toBe('groceries');
      expect(part.transactionNature).toBe('operational');
      expect(part.taxDetected).toBe(true);
      expect(part.enrichmentConfidence).toBe(0.9);
    }
  });
});

describe('TransactionsService.unsplit', () => {
  const PART_0 = {
    ...ORIGINAL,
    id: 'tx-1',
    amount: 8000,
    debit: 8000,
    credit: null,
    fingerprint: 'fp-of-8000',
    splitGroupId: 'grp-1',
    splitIndex: 0,
  };
  const PART_1 = {
    ...ORIGINAL,
    id: 'tx-2',
    amount: 4000,
    debit: 4000,
    credit: null,
    fingerprint: 'fp-of-4000',
    splitGroupId: 'grp-1',
    splitIndex: 1,
    categoryId: 'cat-household',
    paymentPurpose: 'Cleaning supplies',
    comments: 'part two',
  };

  let service: TransactionsService;
  // In-memory row store. Every read hands back a COPY, so the unlocked read and
  // the locked read can never alias — a bug that derives from the stale read has
  // to show up rather than hide behind a shared object instance.
  let store: Map<string, any>;
  let removedBatches: any[][];
  // Per-entity repos handed out by manager.getRepository, plus an ordered log of
  // the writes, so a test can assert the FK repoints happen BEFORE the delete —
  // afterwards the ON DELETE SET NULL has already fired and the link is gone.
  let repos: Record<string, any>;
  let opsLog: string[];
  let lockedFind: jest.Mock;
  // When set, the in-transaction locked read returns this instead of the current
  // store contents. Lets a test simulate a writer landing between the two reads.
  let lockedParts: any[] | undefined;
  let transactionRepository: any;
  let auditService: any;
  let cacheManager: any;
  let newIdCounter: number;

  const groupRows = (workspaceId: string, splitGroupId: string) =>
    [...store.values()]
      .filter(row => row.workspaceId === workspaceId && row.splitGroupId === splitGroupId)
      .sort((a, b) => a.splitIndex - b.splitIndex)
      .map(row => ({ ...row }));

  const readOne = async ({ where }: any) => {
    const row = store.get(where.id);
    return row && row.workspaceId === where.workspaceId ? { ...row } : null;
  };

  const makeManager = () => {
    const txRepo = {
      findOne: jest.fn(readOne),
      find: lockedFind,
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (row: any) => {
        const stored = { ...row, id: row.id ?? `new-${newIdCounter++}` };
        store.set(stored.id, { ...stored });
        return stored;
      }),
      update: jest.fn(async () => {
        opsLog.push('update:Transaction');
        return { affected: 0 };
      }),
      remove: jest.fn(async (rows: any[]) => {
        opsLog.push('remove');
        removedBatches.push(rows);
        for (const row of rows) {
          store.delete(row.id);
        }
        return rows;
      }),
    };
    repos = {
      Transaction: txRepo,
      Receipt: {
        update: jest.fn(async () => {
          opsLog.push('update:Receipt');
          return { affected: 0 };
        }),
      },
      Payable: {
        update: jest.fn(async () => {
          opsLog.push('update:Payable');
          return { affected: 0 };
        }),
      },
    };
    return {
      transaction: jest.fn(async (cb: any) =>
        cb({ getRepository: (entity: any) => repos[entity?.name] ?? txRepo }),
      ),
    };
  };

  beforeEach(() => {
    store = new Map([
      ['tx-1', { ...PART_0 }],
      ['tx-2', { ...PART_1 }],
    ]);
    removedBatches = [];
    opsLog = [];
    lockedParts = undefined;
    newIdCounter = 0;
    auditService = { createEvent: jest.fn() };
    cacheManager = { set: jest.fn() };
    lockedFind = jest.fn(async (options: any) =>
      lockedParts
        ? lockedParts.map(part => ({ ...part }))
        : groupRows(options.where.workspaceId, options.where.splitGroupId),
    );
    transactionRepository = {
      findOne: jest.fn(readOne),
      find: jest.fn(async ({ where }: any) => groupRows(where.workspaceId, where.splitGroupId)),
      manager: makeManager(),
    };
    service = new TransactionsService(
      transactionRepository,
      {} as any,
      { findOne: jest.fn(async () => ({ id: 'u-1', role: 'admin' })) } as any,
      { findOne: jest.fn(async () => ({ permissions: { canEditStatements: true } })) } as any,
      { findOne: jest.fn(async () => null), create: jest.fn(x => x), save: jest.fn(async x => x) } as any,
      cacheManager as any,
      auditService as any,
      { bulkConvert: jest.fn() } as any,
      { resolve: jest.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } as any,
    );
    (service as any).ensureCanEditStatements = jest.fn();
  });

  it('collapses the group into one row carrying the exact total', async () => {
    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(merged.id).toBe('tx-1');
    expect(Number(merged.amount)).toBe(12000);
    expect(Number(merged.debit)).toBe(12000);
    expect(merged.credit).toBeNull();
  });

  it('clears splitGroupId and splitIndex on the survivor', async () => {
    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(merged.splitGroupId).toBeNull();
    expect(merged.splitIndex).toBeNull();
  });

  it('deletes the non-surviving parts', async () => {
    await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(removedBatches).toHaveLength(1);
    expect(removedBatches[0].map((row: any) => row.id)).toEqual(['tx-2']);
    expect(store.has('tx-2')).toBe(false);
    expect(store.has('tx-1')).toBe(true);
  });

  it('nulls the survivor fingerprint so backfill recomputes it from the merged amount', async () => {
    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(merged.fingerprint).toBeNull();
  });

  it('rejects a transaction that is not part of a split', async () => {
    store.set('tx-1', { ...ORIGINAL });

    await expect(service.unsplit('tx-1', 'ws-1', 'u-1')).rejects.toThrow(/not part of a split/i);
    expect(removedBatches).toHaveLength(0);
  });

  it('takes the group lock scoped to the workspace and ordered by splitIndex', async () => {
    await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(lockedFind).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', splitGroupId: 'grp-1' },
      order: { splitIndex: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('rejects when a concurrent unsplit already merged the group', async () => {
    // Outer read still sees the group; by the time the lock is granted the other
    // request has committed, so the locked read comes back empty.
    lockedParts = [];

    await expect(service.unsplit('tx-1', 'ws-1', 'u-1')).rejects.toThrow(/not part of a split/i);
    expect(removedBatches).toHaveLength(0);
  });

  it('derives the total from the locked rows, not the stale unlocked read', async () => {
    // A third part landed between the two reads. Totalling the stale read would
    // lose 3000 and leave the ledger short.
    lockedParts = [
      { ...PART_0 },
      { ...PART_1 },
      { ...PART_1, id: 'tx-3', amount: 3000, debit: 3000, splitIndex: 2 },
    ];

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(Number(merged.amount)).toBe(15000);
    expect(removedBatches[0].map((row: any) => row.id)).toEqual(['tx-2', 'tx-3']);
  });

  it('sums decimal columns returned by Postgres as strings', async () => {
    lockedParts = [
      { ...PART_0, amount: '8000.00', debit: '8000.00', amountForeign: '16.00' },
      { ...PART_1, amount: '4000.00', debit: '4000.00', amountForeign: '8.00' },
    ];

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(Number(merged.amount)).toBe(12000);
    expect(Number(merged.debit)).toBe(12000);
    expect(Number(merged.amountForeign)).toBe(24);
  });

  it('writes credit instead of debit for an income group', async () => {
    lockedParts = [
      { ...PART_0, transactionType: TransactionType.INCOME, debit: null, credit: 8000 },
      { ...PART_1, transactionType: TransactionType.INCOME, debit: null, credit: 4000 },
    ];

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(Number(merged.credit)).toBe(12000);
    expect(merged.debit).toBeNull();
  });

  it('leaves amountForeign null when no part carries one', async () => {
    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(merged.amountForeign).toBeNull();
  });

  it('keeps a present-but-zero foreign total as 0 rather than nulling it', async () => {
    lockedParts = [
      { ...PART_0, amountForeign: 0 },
      { ...PART_1, amountForeign: 0 },
    ];

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(merged.amountForeign).toBe(0);
  });

  it('records an audit event with the pre-merge parts and invalidates the reports cache', async () => {
    await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(cacheManager.set).toHaveBeenCalledWith('reports:version:u-1', expect.any(String), 0);
    expect(auditService.createEvent).toHaveBeenCalledTimes(1);
    const event = auditService.createEvent.mock.calls[0][0];
    expect(event).toEqual(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityId: 'tx-1',
        meta: expect.objectContaining({
          operation: 'unsplit',
          splitGroupId: 'grp-1',
          partCount: 2,
        }),
      }),
    );
    // The `before` snapshot must show the parts as they were, not the mutated
    // survivor carrying the merged total.
    expect(event.diff.before.map((row: any) => Number(row.amount))).toEqual([8000, 4000]);
    expect(event.diff.before[0].splitGroupId).toBe('grp-1');
  });

  it('checks edit permission before merging', async () => {
    await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect((service as any).ensureCanEditStatements).toHaveBeenCalledWith('u-1', 'ws-1');
  });

  it('merges into part 0 even when called with a non-part-0 id', async () => {
    const merged = await service.unsplit('tx-2', 'ws-1', 'u-1');

    expect(merged.id).toBe('tx-1');
    expect(Number(merged.amount)).toBe(12000);
    expect(removedBatches[0].map((row: any) => row.id)).toEqual(['tx-2']);
    expect(store.has('tx-1')).toBe(true);
  });

  it('refuses to merge a group whose non-surviving part is flagged as a duplicate', async () => {
    // A part can be flagged AFTER the split: isSameSplitGroup only excludes pairs
    // that share a splitGroupId, so a part still matches rows in other statements.
    // Folding a flagged (report-excluded) amount into the unflagged survivor would
    // make reported spend jump with no visible cause.
    lockedParts = [{ ...PART_0 }, { ...PART_1, isDuplicate: true }];

    await expect(service.unsplit('tx-1', 'ws-1', 'u-1')).rejects.toThrow(
      /unsplit .*marked as a duplicate/i,
    );
    expect(removedBatches).toHaveLength(0);
  });

  it('refuses to merge when part 0 itself is flagged as a duplicate', async () => {
    // Worse case: the survivor stays isDuplicate=true and the whole original
    // amount disappears from reports.
    lockedParts = [{ ...PART_0, isDuplicate: true }, { ...PART_1 }];

    await expect(service.unsplit('tx-1', 'ws-1', 'u-1')).rejects.toThrow(
      /unsplit .*marked as a duplicate/i,
    );
    expect(removedBatches).toHaveLength(0);
  });

  it('ignores a duplicate flag on the stale unlocked read, checking the locked rows', async () => {
    store.set('tx-1', { ...PART_0, isDuplicate: true });
    lockedParts = [{ ...PART_0 }, { ...PART_1 }];

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(Number(merged.amount)).toBe(12000);
  });

  it('repoints another row duplicate_of_id at the survivor before deleting the part', async () => {
    // duplicate_of_id is ON DELETE SET NULL: a row whose master is a deleted part
    // would be left isDuplicate=true with a null master — excluded from reports
    // forever, with no UI path to unflag it.
    await service.unsplit('tx-1', 'ws-1', 'u-1');

    const [where, patch] = repos.Transaction.update.mock.calls[0];
    expect(where.workspaceId).toBe('ws-1');
    expect(where.duplicateOfId.value).toEqual(['tx-2']);
    expect(patch).toEqual({ duplicateOfId: 'tx-1' });
    expect(opsLog.indexOf('update:Transaction')).toBeLessThan(opsLog.indexOf('remove'));
  });

  it('repoints receipts and payables at the survivor before deleting the part', async () => {
    // Both FKs are ON DELETE SET NULL too: a receipt documents the whole charge,
    // which the survivor represents again once the group is merged.
    await service.unsplit('tx-1', 'ws-1', 'u-1');

    const [receiptWhere, receiptPatch] = repos.Receipt.update.mock.calls[0];
    expect(receiptWhere.workspaceId).toBe('ws-1');
    expect(receiptWhere.transactionId.value).toEqual(['tx-2']);
    expect(receiptPatch).toEqual({ transactionId: 'tx-1' });

    const [payableWhere, payablePatch] = repos.Payable.update.mock.calls[0];
    expect(payableWhere.workspaceId).toBe('ws-1');
    expect(payableWhere.linkedTransactionId.value).toEqual(['tx-2']);
    expect(payablePatch).toEqual({ linkedTransactionId: 'tx-1' });

    expect(opsLog.indexOf('update:Receipt')).toBeLessThan(opsLog.indexOf('remove'));
    expect(opsLog.indexOf('update:Payable')).toBeLessThan(opsLog.indexOf('remove'));
  });

  it('records the repointed counts in the audit meta so the relinking is traceable', async () => {
    repos.Transaction.update.mockResolvedValue({ affected: 1 });
    repos.Receipt.update.mockResolvedValue({ affected: 2 });
    repos.Payable.update.mockResolvedValue({ affected: 3 });

    await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(auditService.createEvent.mock.calls[0][0].meta).toEqual(
      expect.objectContaining({
        operation: 'unsplit',
        duplicatesRepointed: 1,
        receiptsRepointed: 2,
        payablesRepointed: 3,
      }),
    );
  });

  it('clears the markers without deleting or repointing when the group has one part', async () => {
    lockedParts = [{ ...PART_0 }];

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(merged.splitGroupId).toBeNull();
    expect(merged.splitIndex).toBeNull();
    expect(Number(merged.amount)).toBe(8000);
    expect(removedBatches).toHaveLength(0);
    expect(repos.Transaction.update).not.toHaveBeenCalled();
    expect(repos.Receipt.update).not.toHaveBeenCalled();
    expect(repos.Payable.update).not.toHaveBeenCalled();
  });

  it('round-trips: split then unsplit restores the original amount exactly', async () => {
    store = new Map([['tx-1', { ...ORIGINAL }]]);

    const parts = await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 7999.99 }, { amount: 4000.01 }],
    });
    expect(parts).toHaveLength(2);

    const merged = await service.unsplit('tx-1', 'ws-1', 'u-1');

    expect(Number(merged.amount)).toBe(Number(ORIGINAL.amount));
    expect(merged.splitGroupId).toBeNull();
    expect(merged.splitIndex).toBeNull();
    expect(store.size).toBe(1);
  });
});

describe('TransactionsService.getSplitParts', () => {
  let service: TransactionsService;
  let transactionRepository: any;
  let row: any;
  let group: any[];

  beforeEach(() => {
    row = { ...ORIGINAL };
    group = [];
    transactionRepository = {
      findOne: jest.fn(async () => ({ ...row })),
      find: jest.fn(async () => group.map(part => ({ ...part }))),
      manager: { transaction: jest.fn() },
    };
    service = new TransactionsService(
      transactionRepository,
      {} as any,
      { findOne: jest.fn() } as any,
      { findOne: jest.fn() } as any,
      { set: jest.fn() } as any,
      { createEvent: jest.fn() } as any,
      { bulkConvert: jest.fn() } as any,
      { resolve: jest.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } as any,
    );
  });

  it('returns just the transaction when it is not part of a split', async () => {
    const parts = await service.getSplitParts('tx-1', 'ws-1');

    expect(parts).toHaveLength(1);
    expect(parts[0].id).toBe('tx-1');
    expect(transactionRepository.find).not.toHaveBeenCalled();
  });

  it('returns the whole group ordered by splitIndex, scoped to the workspace', async () => {
    row = { ...ORIGINAL, splitGroupId: 'grp-1', splitIndex: 1 };
    group = [
      { ...ORIGINAL, id: 'tx-1', splitGroupId: 'grp-1', splitIndex: 0, amount: 8000 },
      { ...ORIGINAL, id: 'tx-2', splitGroupId: 'grp-1', splitIndex: 1, amount: 4000 },
    ];

    const parts = await service.getSplitParts('tx-1', 'ws-1');

    expect(parts.map(p => p.id)).toEqual(['tx-1', 'tx-2']);
    expect(transactionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws-1', splitGroupId: 'grp-1' },
        order: { splitIndex: 'ASC' },
      }),
    );
  });
});

describe('TransactionsService.allocateParts', () => {
  // The highest-risk arithmetic in split(), exercised directly rather than
  // through eight mocked constructor dependencies.
  const allocate = (total: number, foreignTotal: number | null, amounts: number[]) =>
    (TransactionsService.prototype as any).allocateParts.call(
      TransactionsService.prototype,
      total,
      foreignTotal,
      amounts.map(amount => ({ amount })),
    );

  it('returns the requested amounts when they already sum exactly', () => {
    const { amounts, foreignAmounts } = allocate(12000, null, [8000, 4000]);

    expect(amounts).toEqual([8000, 4000]);
    expect(foreignAmounts).toEqual([null, null]);
  });

  it('makes the last part absorb the residual', () => {
    const { amounts } = allocate(100, null, [50, 49.99]);

    expect(amounts).toEqual([50, 50]);
    expect(amounts.reduce((s: number, a: number) => s + a, 0)).toBe(100);
  });

  it('absorbs the residual in the other direction too', () => {
    const { amounts } = allocate(100, null, [50, 50.01]);

    expect(amounts).toEqual([50, 50]);
  });

  it('prorates and reconciles a 3-way foreign split that does not divide evenly', () => {
    const { foreignAmounts } = allocate(12000, 10, [4000, 4000, 4000]);

    expect(foreignAmounts).toEqual([3.33, 3.33, 3.34]);
    expect(foreignAmounts.reduce((s: number, a: number) => s + a, 0)).toBe(10);
  });

  it('prorates unequal parts', () => {
    const { amounts, foreignAmounts } = allocate(12000, 24, [8000, 4000]);

    expect(amounts).toEqual([8000, 4000]);
    expect(foreignAmounts).toEqual([16, 8]);
  });

  it('rounds requested amounts to cents', () => {
    const { amounts } = allocate(30, null, [10.005, 10, 9.99]);

    expect(amounts).toEqual([10.01, 10, 9.99]);
    expect(amounts.reduce((s: number, a: number) => s + a, 0)).toBe(30);
  });
});
