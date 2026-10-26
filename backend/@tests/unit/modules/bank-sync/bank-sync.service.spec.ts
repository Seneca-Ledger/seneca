import { BadRequestException } from '@nestjs/common';
import { IntegrationProvider, IntegrationStatus, WorkspaceKind } from '../../../../src/entities';
import {
  type BankSyncAccount,
  BankSyncAuthError,
} from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import { BankSyncService } from '../../../../src/modules/bank-sync/bank-sync.service';
import { encryptText } from '../../../../src/common/utils/encryption.util';

const user = { id: 'user-1' } as never;
const workspaceId = 'ws-1';
const accessUrl = 'https://demo:demo@bridge.example/simplefin';

const remoteAccount = (overrides: Partial<BankSyncAccount> = {}): BankSyncAccount => ({
  id: 'ACT-1',
  name: 'Checking',
  org: 'Demo Bank',
  currency: 'USD',
  balance: 50,
  balanceDate: new Date('2026-09-30T00:00:00Z'),
  transactions: [],
  ...overrides,
});

describe('BankSyncService', () => {
  let integration: Record<string, unknown> | null;
  let settings: Record<string, unknown> | null;
  const integrationRepository = {
    findOne: vi.fn(async () => (integration ? { ...integration, openProtocolSettings: settings } : null)),
    find: vi.fn(async () => []),
    create: vi.fn((data: Record<string, unknown>) => ({ id: 'int-1', ...data })),
    save: vi.fn(async (entity: Record<string, unknown>) => {
      integration = { ...(integration ?? {}), ...entity };
      return integration;
    }),
  };
  const settingsRepository = {
    create: vi.fn((data: Record<string, unknown>) => ({ id: 'set-1', ...data })),
    save: vi.fn(async (entity: Record<string, unknown>) => {
      settings = { ...(settings ?? {}), ...entity };
      return settings;
    }),
  };
  const transactionRepository = { find: vi.fn(async () => []) };
  const walletRepository = { find: vi.fn(async () => [{ id: 'wallet-1' }]) };
  const statementsService = { create: vi.fn(async () => ({ id: 'stmt-1' })) };
  const provider = {
    claim: vi.fn(async () => accessUrl),
    fetchAccounts: vi.fn(async (): Promise<BankSyncAccount[]> => [remoteAccount()]),
  };

  const service = () =>
    new BankSyncService(
      integrationRepository as never,
      settingsRepository as never,
      transactionRepository as never,
      walletRepository as never,
      statementsService as never,
      provider as never,
    );

  const connected = (config: Record<string, unknown> = {}) => {
    integration = {
      id: 'int-1',
      workspaceId,
      provider: IntegrationProvider.SIMPLEFIN,
      status: IntegrationStatus.CONNECTED,
    };
    settings = {
      id: 'set-1',
      integrationId: 'int-1',
      encryptedSecrets: { accessUrl: encryptText(accessUrl) },
      config: {
        provider: 'simplefin',
        autoSync: true,
        accounts: [
          {
            id: 'ACT-1',
            name: 'Checking',
            org: 'Demo Bank',
            currency: 'USD',
            enabled: true,
            walletId: null,
            lastSyncAt: null,
            balance: null,
            balanceDate: null,
          },
        ],
        lastSyncAt: null,
        lastError: null,
        ...config,
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    integration = null;
    settings = null;
    transactionRepository.find.mockResolvedValue([]);
    provider.fetchAccounts.mockResolvedValue([remoteAccount()]);
    statementsService.create.mockResolvedValue({ id: 'stmt-1' });
    process.env.INTEGRATIONS_ENCRYPTION_KEY = process.env.INTEGRATIONS_ENCRYPTION_KEY || 'unit-test-key';
  });

  it('is disconnected until a token is claimed, then lists the accounts without the credential', async () => {
    expect(await service().status(workspaceId)).toMatchObject({ connected: false, settings: null });

    const status = await service().connect(user, workspaceId, 'token');
    expect(provider.claim).toHaveBeenCalledWith('token');
    expect(provider.fetchAccounts).toHaveBeenCalledWith(accessUrl, { balancesOnly: true });
    expect(status.connected).toBe(true);
    expect(status.settings?.accounts).toEqual([
      expect.objectContaining({ id: 'ACT-1', enabled: true, walletId: null, balance: 50 }),
    ]);
    expect(JSON.stringify(status)).not.toContain('demo:demo');
    expect((settings?.encryptedSecrets as Record<string, string>).accessUrl).not.toContain('demo:demo');
  });

  it('pulls each enabled account into one OFX statement, skipping pending and already-imported rows', async () => {
    connected();
    provider.fetchAccounts.mockResolvedValue([
      remoteAccount({
        transactions: [
          { id: 'TRN-old', posted: new Date('2026-09-01'), amount: -1, description: 'old', pending: false },
          { id: 'TRN-new', posted: new Date('2026-09-20'), amount: -2, description: 'new', pending: false },
          { id: 'TRN-pending', posted: new Date('2026-09-21'), amount: -3, description: 'p', pending: true },
        ],
      }),
    ]);
    transactionRepository.find.mockResolvedValue([{ documentNumber: 'ACT-1:TRN-old' }]);

    const result = await service().sync(user, workspaceId);

    expect(result).toMatchObject({ imported: 1, statements: 1 });
    expect(result.accounts[0]).toMatchObject({ id: 'ACT-1', imported: 1, statementId: 'stmt-1' });
    const [, , file, walletId] = statementsService.create.mock.calls[0] as unknown as [
      unknown,
      string,
      Express.Multer.File,
      string | undefined,
    ];
    expect(file.originalname).toMatch(/^demo-bank-checking-\d{8}\.ofx$/);
    expect(file.buffer.toString()).toContain('<FITID>ACT-1:TRN-new');
    expect(file.buffer.toString()).not.toContain('TRN-old');
    expect(file.buffer.toString()).not.toContain('TRN-pending');
    expect(walletId).toBeUndefined();
    const config = settings?.config as { accounts: Array<{ lastSyncAt: string | null; balance: number | null }>; lastSyncAt: string | null };
    expect(config.accounts[0].lastSyncAt).not.toBeNull();
    expect(config.accounts[0].balance).toBe(50);
    expect(config.lastSyncAt).not.toBeNull();
  });

  it('keeps a transaction id seen on another account: ids are unique per account only', async () => {
    connected();
    settings = {
      ...settings,
      config: {
        ...(settings?.config as Record<string, unknown>),
        accounts: [
          { id: 'ACT-1', name: 'Checking', enabled: true, walletId: null, lastSyncAt: null },
          { id: 'ACT-2', name: 'Savings', enabled: true, walletId: null, lastSyncAt: null },
        ],
      },
    };
    const row = { id: 'TRN-1', posted: new Date(), amount: -5, description: 'x', pending: false };
    provider.fetchAccounts.mockResolvedValue([
      remoteAccount({ transactions: [row] }),
      remoteAccount({ id: 'ACT-2', name: 'Savings', transactions: [row] }),
    ]);
    // ACT-1's row is already in the workspace; ACT-2's row of the same id is not.
    transactionRepository.find.mockImplementation(async ({ where }: { where: { documentNumber: { value: string[] } } }) =>
      where.documentNumber.value.includes('ACT-1:TRN-1') ? [{ documentNumber: 'ACT-1:TRN-1' }] : [],
    );

    const result = await service().sync(user, workspaceId);

    expect(result.accounts).toEqual([
      expect.objectContaining({ id: 'ACT-1', imported: 0 }),
      expect.objectContaining({ id: 'ACT-2', imported: 1 }),
    ]);
  });

  it('asks the provider from a week before the last pull, and 90 days back the first time', async () => {
    connected({
      accounts: [
        { id: 'ACT-1', name: 'A', org: '', currency: 'USD', enabled: true, walletId: null, lastSyncAt: '2026-09-30T00:00:00.000Z', balance: null, balanceDate: null },
        { id: 'ACT-2', name: 'B', org: '', currency: 'USD', enabled: false, walletId: null, lastSyncAt: null, balance: null, balanceDate: null },
      ],
    });
    await service().sync(user, workspaceId);
    const since = (provider.fetchAccounts.mock.calls[0] as unknown as [string, { since: Date }])[1].since;
    expect(since.toISOString()).toBe('2026-09-23T00:00:00.000Z');
    expect(statementsService.create).not.toHaveBeenCalled();

    vi.clearAllMocks();
    connected();
    const before = Date.now();
    await service().sync(user, workspaceId);
    const first = (provider.fetchAccounts.mock.calls[0] as unknown as [string, { since: Date }])[1].since;
    expect(Math.round((before - first.getTime()) / 86_400_000)).toBe(90);
  });

  it('makes no statement when nothing is new and never pulls a disabled account', async () => {
    connected({
      accounts: [
        { id: 'ACT-1', name: 'A', org: '', currency: 'USD', enabled: false, walletId: null, lastSyncAt: null, balance: null, balanceDate: null },
      ],
    });
    const result = await service().sync(user, workspaceId);
    expect(result).toMatchObject({ imported: 0, statements: 0, accounts: [] });
    expect(provider.fetchAccounts).not.toHaveBeenCalled();
  });

  it('routes an account to its wallet and refuses a wallet from another workspace', async () => {
    connected();
    await service().updateSettings(workspaceId, { accounts: [{ id: 'ACT-1', walletId: 'wallet-1' }] });
    provider.fetchAccounts.mockResolvedValue([
      remoteAccount({
        transactions: [{ id: 'TRN-1', posted: new Date('2026-09-20'), amount: -2, description: 'x', pending: false }],
      }),
    ]);
    await service().sync(user, workspaceId);
    expect(statementsService.create.mock.calls[0][3]).toBe('wallet-1');

    walletRepository.find.mockResolvedValueOnce([]);
    await expect(
      service().updateSettings(workspaceId, { accounts: [{ id: 'ACT-1', walletId: 'wallet-9' }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('flips to needs-reauth when the provider rejects the credential', async () => {
    connected();
    provider.fetchAccounts.mockRejectedValue(new BankSyncAuthError());
    await expect(service().sync(user, workspaceId)).rejects.toThrow(/new setup token/);
    expect(integration?.status).toBe(IntegrationStatus.NEEDS_REAUTH);
    expect((settings?.config as { lastError: string }).lastError).toMatch(/new setup token/);
  });

  it('forgets the credential on disconnect but keeps the row for the status', async () => {
    connected();
    await service().disconnect(workspaceId);
    expect(settings?.encryptedSecrets).toEqual({});
    expect(integration?.status).toBe(IntegrationStatus.DISCONNECTED);
    expect(await service().status(workspaceId)).toMatchObject({ connected: false });
    await expect(service().sync(user, workspaceId)).rejects.toThrow(/not connected/);
  });

  it('refreshes the account list, keeping switches and starting unknown accounts off', async () => {
    connected();
    provider.fetchAccounts.mockResolvedValue([remoteAccount(), remoteAccount({ id: 'ACT-2', name: 'Savings' })]);
    const status = await service().refreshAccounts(workspaceId);
    expect(status.settings?.accounts.map(item => [item.id, item.enabled])).toEqual([
      ['ACT-1', true],
      ['ACT-2', false],
    ]);
  });

  it('auto-syncs connections of ordinary workspaces only, never a past version', async () => {
    await service().autoSync();

    expect(integrationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspace: { kind: WorkspaceKind.STANDARD } }),
      }),
    );
  });
});
