import { ActorType, AuditAction, EntityType } from '../../../../src/entities/audit-event.entity';
import { CryptoService } from '../../../../src/modules/crypto/crypto.service';

const WORKSPACE = 'ws-1';
const EVM_ADDRESS = '0x1111111111111111111111111111111111111111';

function build(options: { imported?: number; existing?: Record<string, unknown> | null } = {}) {
  const stored: Record<string, unknown>[] = [];
  const walletRepo = {
    findOne: jest.fn(async ({ where }: { where: { id?: string } }) =>
      where.id ? (options.existing ?? null) : null,
    ),
    create: jest.fn((row: Record<string, unknown>) => row),
    save: jest.fn(async (row: Record<string, unknown>) => {
      const saved = { id: `w-${stored.length + 1}`, ...row };
      stored.push(saved);
      return saved;
    }),
    find: jest.fn(async () => stored),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const queryBuilder: Record<string, jest.Mock> = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }
  queryBuilder.getRawMany = jest.fn(async () => []);
  const transactionRepo = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    count: jest.fn(async () => 7),
  };
  const syncService = {
    syncWallet: jest.fn(async () => ({ imported: options.imported ?? 0, skipped: 2 })),
  };
  const auditService = {
    createEvent: jest.fn().mockResolvedValue({}),
    createBatchEvents: jest.fn().mockResolvedValue({ batchId: 'b', events: [] }),
  };
  const service = new CryptoService(
    walletRepo as never,
    transactionRepo as never,
    syncService as never,
    {} as never,
    {} as never,
    auditService as never,
    {} as never,
    { writePortfolioSnapshot: jest.fn() } as never,
  );
  return { service, auditService, walletRepo, transactionRepo };
}

const wallet = {
  id: 'w-9',
  workspaceId: WORKSPACE,
  address: EVM_ADDRESS,
  chainId: 1,
  label: 'Ledger',
};

describe('CryptoService audit', () => {
  it('logs a connected wallet as a CREATE with a shortened address', async () => {
    const { service, auditService } = build();

    await service.connect(WORKSPACE, 'u-1', { address: EVM_ADDRESS, chainId: 1 });

    expect(auditService.createEvent).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      actorType: ActorType.USER,
      actorId: 'u-1',
      entityType: EntityType.CRYPTO_WALLET,
      entityId: 'w-1',
      action: AuditAction.CREATE,
      diff: {
        before: null,
        after: { address: '0x1111…1111', chainId: 1, chainName: 'Ethereum', label: null },
      },
      meta: { chain: 'Ethereum', chainId: 1 },
    });
  });

  it('groups the wallets of one multi-network connect into a batch', async () => {
    const { service, auditService } = build();

    await service.connect(WORKSPACE, 'u-1', { address: EVM_ADDRESS, chainIds: [1, 8453] });

    expect(auditService.createEvent).not.toHaveBeenCalled();
    const [events, batchId] = auditService.createBatchEvents.mock.calls[0];
    expect(batchId).toEqual(expect.any(String));
    expect(events.map((event: { entityId: string }) => event.entityId)).toEqual(['w-1', 'w-2']);
    expect(events.every((event: { workspaceId: string }) => event.workspaceId === WORKSPACE)).toBe(
      true,
    );
  });

  it('logs a removed wallet as a DELETE with its cascaded transaction count', async () => {
    const { service, auditService, walletRepo } = build({ existing: wallet });

    await service.remove(WORKSPACE, 'w-9', 'u-1');

    expect(walletRepo.delete).toHaveBeenCalledWith('w-9');
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE,
        actorId: 'u-1',
        entityType: EntityType.CRYPTO_WALLET,
        entityId: 'w-9',
        action: AuditAction.DELETE,
        diff: {
          before: expect.objectContaining({ address: '0x1111…1111', label: 'Ledger' }),
          after: null,
        },
        meta: { chain: 'Ethereum', transactionCount: 7 },
      }),
    );
  });

  it('logs a manual sync as an IMPORT only when it imported transactions', async () => {
    const empty = build({ existing: wallet, imported: 0 });
    await empty.service.sync(WORKSPACE, 'w-9', 'u-1');
    expect(empty.auditService.createEvent).not.toHaveBeenCalled();

    const busy = build({ existing: wallet, imported: 3 });
    await busy.service.sync(WORKSPACE, 'w-9', 'u-1');
    expect(busy.auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE,
        entityType: EntityType.CRYPTO_WALLET,
        entityId: 'w-9',
        action: AuditAction.IMPORT,
        meta: expect.objectContaining({ count: 3 }),
      }),
    );
  });

  it('never fails the operation when the audit write fails', async () => {
    const { service, auditService } = build({ existing: wallet, imported: 1 });
    auditService.createEvent.mockRejectedValue(new Error('audit down'));

    await expect(service.sync(WORKSPACE, 'w-9', 'u-1')).resolves.toEqual({
      imported: 1,
      skipped: 2,
    });
    await expect(service.remove(WORKSPACE, 'w-9', 'u-1')).resolves.toBeUndefined();
  });
});
