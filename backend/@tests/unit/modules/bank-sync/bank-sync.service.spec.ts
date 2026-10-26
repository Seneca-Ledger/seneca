import { BadRequestException } from '@nestjs/common';
import { IntegrationStatus } from '../../../../src/entities';
import { BankSyncService } from '../../../../src/modules/bank-sync/bank-sync.service';
import {
  accountConfig,
  accessUrl,
  fakeStore,
  fakeTokenProvider,
  remoteAccount,
  user,
  workspaceId,
} from './support';

const connectionConfig = (overrides: Record<string, unknown> = {}) => ({
  provider: 'simplefin',
  label: 'Bridge',
  autoSync: true,
  links: [],
  accounts: [accountConfig()],
  lastSyncAt: null,
  lastError: null,
  pendingLink: null,
  ...overrides,
});

const build = (
  store: ReturnType<typeof fakeStore>,
  provider: ReturnType<typeof fakeTokenProvider>,
  overrides: { transactionRepository?: unknown; walletRepository?: unknown } = {},
) =>
  new BankSyncService(
    store.integrationRepository as never,
    store.settingsRepository as never,
    (overrides.transactionRepository ?? { findOne: vi.fn(async () => null) }) as never,
    (overrides.walletRepository ?? {
      findOne: vi.fn(async () => ({ id: 'wallet-1' })),
    }) as never,
    [provider] as never,
  );

describe('BankSyncService connections', () => {
  it('lists nothing until a token is claimed, then the accounts without the credential', async () => {
    const store = fakeStore();
    const provider = fakeTokenProvider();
    const service = build(store, provider);

    expect(await service.list(workspaceId)).toEqual([]);

    const connection = await service.connectWithToken(
      user,
      workspaceId,
      'simplefin',
      'token',
      'Bridge',
    );
    expect(provider.claim).toHaveBeenCalledWith('token');
    expect(connection.label).toBe('Bridge');
    expect(connection.config.accounts).toHaveLength(1);
    // Every account from a pasted token starts on: the token was pasted for them.
    expect(connection.config.accounts[0]).toMatchObject({ id: 'ACT-1', enabled: true });
    expect(JSON.stringify(connection)).not.toContain(accessUrl);
  });

  it('refuses a token for a provider that authorizes in the browser', async () => {
    const store = fakeStore();
    const redirect = { ...fakeTokenProvider(), key: 'enablebanking', linkStyle: 'redirect' as const };
    const service = build(store, redirect as never);
    await expect(
      service.connectWithToken(user, workspaceId, 'enablebanking', 'token'),
    ).rejects.toThrow(/browser/);
  });

  it('points an account at a wallet and refuses a wallet from another workspace', async () => {
    const store = fakeStore([
      { id: 'c1', provider: 'simplefin', status: IntegrationStatus.CONNECTED, workspaceId, config: connectionConfig() },
    ]);
    const service = build(store, fakeTokenProvider(), {
      walletRepository: { findOne: vi.fn(async () => null) },
    });
    await expect(
      service.updateAccount(workspaceId, 'c1', 'ACT-1', { walletId: 'wallet-elsewhere' }),
    ).rejects.toThrow(/does not belong/);

    const ok = build(store, fakeTokenProvider());
    const updated = await ok.updateAccount(workspaceId, 'c1', 'ACT-1', { walletId: 'wallet-1' });
    expect(updated.config.accounts[0].walletId).toBe('wallet-1');
  });

  it('refuses a second feed on a wallet that already has one, in any connection', async () => {
    const store = fakeStore([
      {
        id: 'c1',
        provider: 'simplefin',
        status: IntegrationStatus.CONNECTED,
        workspaceId,
        config: connectionConfig({ accounts: [accountConfig({ walletId: 'wallet-1' })] }),
      },
      {
        id: 'c2',
        provider: 'simplefin',
        status: IntegrationStatus.CONNECTED,
        workspaceId,
        config: connectionConfig({ accounts: [accountConfig({ id: 'ACT-9' })] }),
      },
    ]);
    const service = build(store, fakeTokenProvider());
    await expect(
      service.updateAccount(workspaceId, 'c2', 'ACT-9', { walletId: 'wallet-1' }),
    ).rejects.toThrow(/switch it instead/);
  });

  it('refreshes the account list, keeping choices and starting unknown accounts off', async () => {
    const store = fakeStore([
      {
        id: 'c1',
        provider: 'simplefin',
        status: IntegrationStatus.CONNECTED,
        workspaceId,
        config: connectionConfig({ accounts: [accountConfig({ walletId: 'wallet-1' })] }),
      },
    ]);
    const provider = fakeTokenProvider([remoteAccount(), remoteAccount({ id: 'ACT-NEW', name: 'Savings' })]);
    const refreshed = await build(store, provider).refreshAccounts(workspaceId, 'c1');
    expect(refreshed.config.accounts).toHaveLength(2);
    expect(refreshed.config.accounts[0]).toMatchObject({ enabled: true, walletId: 'wallet-1' });
    expect(refreshed.config.accounts[1]).toMatchObject({ id: 'ACT-NEW', enabled: false });
  });

  it('forgets the credential on disconnect but keeps the connection row', async () => {
    const store = fakeStore([
      { id: 'c1', provider: 'simplefin', status: IntegrationStatus.CONNECTED, workspaceId, config: connectionConfig() },
    ]);
    const service = build(store, fakeTokenProvider());
    await service.disconnect(workspaceId, 'c1');
    expect(store.rows.get('c1')?.status).toBe(IntegrationStatus.DISCONNECTED);
    expect(await service.list(workspaceId)).toEqual([]);
    await expect(service.refreshAccounts(workspaceId, 'c1')).rejects.toThrow(BadRequestException);
  });
});

describe('BankSyncService.switchFeed', () => {
  const twoConnections = () =>
    fakeStore([
      {
        id: 'c1',
        provider: 'simplefin',
        status: IntegrationStatus.CONNECTED,
        workspaceId,
        config: connectionConfig({
          accounts: [accountConfig({ walletId: 'wallet-1', lastSyncAt: '2026-09-30T00:00:00.000Z', health: 'ok' })],
        }),
      },
      {
        id: 'c2',
        provider: 'simplefin',
        status: IntegrationStatus.CONNECTED,
        workspaceId,
        config: connectionConfig({ label: 'Other', accounts: [accountConfig({ id: 'ACT-B', enabled: false })] }),
      },
    ]);

  it('moves the feed, keeps the history and starts the new one after the last known row', async () => {
    const store = twoConnections();
    const service = build(store, fakeTokenProvider(), {
      transactionRepository: {
        findOne: vi.fn(async () => ({ transactionDate: new Date('2026-09-28T00:00:00Z') })),
      },
    });

    const result = await service.switchFeed(workspaceId, {
      walletId: 'wallet-1',
      toConnectionId: 'c2',
      toAccountId: 'ACT-B',
    });

    expect(result.from).toEqual({ connectionId: 'c1', accountId: 'ACT-1' });
    // The day after the wallet's last row: the new provider replays its whole
    // history, and everything up to here is already in the wallet.
    expect(result.syncFrom).toBe('2026-09-29T00:00:00.000Z');

    const source = store.configOf('c1') as unknown as { accounts: Array<Record<string, unknown>> };
    expect(source.accounts[0]).toMatchObject({ walletId: null, enabled: false });

    const target = store.configOf('c2') as unknown as { accounts: Array<Record<string, unknown>> };
    expect(target.accounts[0]).toMatchObject({
      walletId: 'wallet-1',
      enabled: true,
      syncFrom: '2026-09-29T00:00:00.000Z',
      lastSyncAt: null,
      health: 'never_synced',
    });
  });

  it('leaves the floor open when the wallet has no history yet', async () => {
    const store = twoConnections();
    const service = build(store, fakeTokenProvider());
    const result = await service.switchFeed(workspaceId, {
      walletId: 'wallet-1',
      toConnectionId: 'c2',
      toAccountId: 'ACT-B',
    });
    expect(result.syncFrom).toBeNull();
    expect((store.configOf('c2') as unknown as { accounts: Array<Record<string, unknown>> }).accounts[0].syncFrom).toBeNull();
  });

  it('refuses a provider account that already feeds a different wallet', async () => {
    const store = twoConnections();
    (store.configOf('c2') as unknown as { accounts: Array<Record<string, unknown>> }).accounts[0].walletId = 'wallet-2';
    const service = build(store, fakeTokenProvider());
    await expect(
      service.switchFeed(workspaceId, {
        walletId: 'wallet-1',
        toConnectionId: 'c2',
        toAccountId: 'ACT-B',
      }),
    ).rejects.toThrow(/already feeds another wallet/);
  });
});
