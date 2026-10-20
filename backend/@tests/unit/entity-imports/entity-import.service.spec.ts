import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityImportService } from '../../../src/modules/entity-imports/entity-import.service';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const BATCH_ID = '33333333-3333-4333-8333-333333333333';

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn(async (value: unknown) => ({ ...(value as object), id: BATCH_ID })),
  create: jest.fn((value: unknown) => value),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

const build = () => {
  const repos = new Map<string, ReturnType<typeof repoMock>>();
  const manager = {
    getRepository: (entity: { name: string }) => {
      if (!repos.has(entity.name)) {
        repos.set(entity.name, repoMock());
      }
      return repos.get(entity.name);
    },
  };
  const dataSource = {
    manager,
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)),
    getRepository: manager.getRepository,
  };
  const batches = repoMock();
  const members = repoMock();
  const audit = { createEvent: jest.fn() };
  const service = new EntityImportService(
    dataSource as never,
    batches as never,
    members as never,
    audit as never,
  );
  return { service, repos, batches, audit, dataSource };
};

describe('EntityImportService', () => {
  it("refuses an API key without the target's create scope, before reading a row", async () => {
    const { service, dataSource } = build();
    const readOnlyKey = { scopes: ['payable.view', 'statement.view'] };
    const dto = { target: 'payables' as const, mapping: { vendor: 0, amount: 1 }, rows: [['A', '1']] };

    await expect(service.run(USER_ID, WORKSPACE_ID, dto, readOnlyKey)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    await expect(
      service.run(USER_ID, WORKSPACE_ID, dto, { scopes: ['payable.create'] }),
    ).resolves.toMatchObject({ target: 'payables' });
  });

  it('rejects a mapping without the required fields', async () => {
    const { service } = build();
    await expect(
      service.run(USER_ID, WORKSPACE_ID, { target: 'payables', mapping: { vendor: 0 }, rows: [['A']] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records what was created in a batch and audits it', async () => {
    const { service, batches, audit, repos } = build();
    const result = await service.run(USER_ID, WORKSPACE_ID, {
      target: 'payables',
      mapping: { vendor: 0, amount: 1 },
      rows: [
        ['Electric', '100'],
        ['', '5'],
      ],
      fileName: 'bills.xlsx',
    });
    expect(result.counts).toEqual({ created: 1, updated: 0, skipped: 0, errors: 1 });
    expect(result.batchId).toBe(BATCH_ID);
    expect(result.createdIds).toHaveLength(1);
    expect(batches.save).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'payables', fileName: 'bills.xlsx', createdRefs: [{ kind: 'payable', id: BATCH_ID }] }),
    );
    expect(audit.createEvent).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'payable', action: 'import' }));
    expect(repos.get('Payable')?.save).toHaveBeenCalledTimes(1);
  });

  it('does not write a batch in a dry run', async () => {
    const { service, batches, dataSource } = build();
    const result = await service.run(USER_ID, WORKSPACE_ID, {
      target: 'payables',
      mapping: { vendor: 0, amount: 1 },
      rows: [['Electric', '100']],
      dryRun: true,
    });
    expect(result.batchId).toBeNull();
    expect(batches.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('fails when no row could be imported', async () => {
    const { service } = build();
    await expect(
      service.run(USER_ID, WORKSPACE_ID, { target: 'payables', mapping: { vendor: 0, amount: 1 }, rows: [['', '']] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('undo removes created records, restores updated ones and marks the batch', async () => {
    const { service, batches, repos } = build();
    batches.findOne.mockResolvedValue({
      id: BATCH_ID,
      workspaceId: WORKSPACE_ID,
      target: 'subscriptions',
      undoneAt: null,
      createdRefs: [
        { kind: 'subscription', id: 's-new' },
        { kind: 'category', id: 'c-new' },
      ],
      updatedRefs: [{ kind: 'subscription', id: 's-old', before: { amount: 12 } }],
    });
    const result = await service.undo(USER_ID, WORKSPACE_ID, BATCH_ID);
    expect(result).toEqual({ undone: true, removed: 1, restored: 1 });
    const subs = repos.get('Subscription');
    expect(subs?.delete).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE_ID }));
    expect(subs?.update).toHaveBeenCalledWith({ id: 's-old', workspaceId: WORKSPACE_ID }, { amount: 12 });
    expect(repos.get('Category')?.delete).toBeUndefined();
    expect(repos.get('ImportBatch')?.update).toHaveBeenCalledWith(BATCH_ID, { undoneAt: expect.any(Date) });
  });

  it('refuses to undo twice or for another workspace', async () => {
    const { service, batches } = build();
    batches.findOne.mockResolvedValueOnce(null);
    await expect(service.undo(USER_ID, WORKSPACE_ID, BATCH_ID)).rejects.toBeInstanceOf(NotFoundException);
    batches.findOne.mockResolvedValueOnce({ id: BATCH_ID, workspaceId: WORKSPACE_ID, target: 'payables', undoneAt: new Date(), createdRefs: [], updatedRefs: [] });
    await expect(service.undo(USER_ID, WORKSPACE_ID, BATCH_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EntityImportService categorising imported transactions', () => {
  const STATEMENT_ID = '44444444-4444-4444-8444-444444444444';

  const setup = (classified: Array<Record<string, unknown>>) => {
    const { dataSource } = build();
    const classification = {
      classifyTransaction: jest.fn(),
    };
    for (const result of classified) {
      classification.classifyTransaction.mockResolvedValueOnce(result);
    }
    const service = new EntityImportService(
      dataSource as never,
      repoMock() as never,
      repoMock() as never,
      { createEvent: jest.fn() } as never,
      classification as never,
    );
    const transactions = dataSource.getRepository({ name: 'Transaction' }) as ReturnType<typeof repoMock>;
    transactions.find.mockResolvedValue([
      { id: 't-1', counterpartyName: 'REWE', paymentPurpose: '', transactionType: 'expense' },
      { id: 't-2', counterpartyName: 'New Shop', paymentPurpose: '', transactionType: 'expense' },
    ]);
    const run = () =>
      (service as unknown as { categorize: (...args: unknown[]) => Promise<void> }).categorize(
        USER_ID,
        WORKSPACE_ID,
        [{ kind: 'statement', id: STATEMENT_ID }],
      );
    return { run, classification, transactions };
  };

  it('stores what the rules and payee history decided for each row', async () => {
    const { run, transactions } = setup([
      { categoryId: 'groceries', categorySource: 'history', categoryReason: 'REWE' },
      { categoryId: 'uncategorized', categorySource: 'default', categoryReason: null },
    ]);

    await run();

    expect(transactions.update).toHaveBeenCalledWith(
      { id: 't-1', workspaceId: WORKSPACE_ID },
      { categoryId: 'groceries', categorySource: 'history', categoryReason: 'REWE' },
    );
    expect(transactions.update).toHaveBeenCalledWith(
      { id: 't-2', workspaceId: WORKSPACE_ID },
      { categoryId: 'uncategorized', categorySource: 'default', categoryReason: null },
    );
  });
});
