import { IntegrationStatus, WorkspaceKind } from '../../../../src/entities';
import { IntelligentDeduplicationService } from '../../../../src/modules/parsing/services/intelligent-deduplication.service';
import { BankSyncPullService } from '../../../../src/modules/bank-sync/bank-sync-pull.service';
import { BankSyncService } from '../../../../src/modules/bank-sync/bank-sync.service';
import { BankSyncDedupeService } from '../../../../src/modules/bank-sync/bank-sync-dedupe.service';
import { BankSyncAuthError } from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import {
  accountConfig,
  fakeStore,
  fakeTokenProvider,
  importConfigStub,
  remoteAccount,
  remoteRow,
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

/**
 * A stored transaction exactly as Postgres returns one: `date` comes back as a
 * string and `decimal` as a string. Using real Dates and numbers here would
 * make the tolerant pass look fine in tests and throw in production.
 */
const storedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-1',
  transactionDate: '2026-09-20',
  counterpartyName: 'Coffee Co',
  paymentPurpose: 'card',
  debit: '4.50',
  credit: null,
  currency: 'USD',
  documentNumber: 'ACT-1:TRN-1',
  ...overrides,
});

interface Harness {
  pull: BankSyncPullService;
  store: ReturnType<typeof fakeStore>;
  provider: ReturnType<typeof fakeTokenProvider>;
  statements: { create: ReturnType<typeof vi.fn> };
  imported: () => string[];
}

function harness(options: {
  config?: Record<string, unknown>;
  accounts?: Parameters<typeof fakeTokenProvider>[0];
  knownIds?: string[];
  existingRows?: Array<Record<string, unknown>>;
  claim?: () => never;
}): Harness {
  const store = fakeStore([
    {
      id: 'c1',
      provider: 'simplefin',
      status: IntegrationStatus.CONNECTED,
      workspaceId,
      config: options.config ?? connectionConfig(),
    },
  ]);
  const provider = fakeTokenProvider(options.accounts);
  if (options.claim) provider.fetchAccounts = vi.fn(options.claim) as never;

  const transactionRepository = {
    findOne: vi.fn(async () => null),
    find: vi.fn(async (query: { where: Record<string, unknown> }) => {
      if ('documentNumber' in query.where) {
        return (options.knownIds ?? []).map(documentNumber => ({ documentNumber }));
      }
      return options.existingRows ?? [];
    }),
  };

  const connections = new BankSyncService(
    store.integrationRepository as never,
    store.settingsRepository as never,
    transactionRepository as never,
    { findOne: vi.fn(async () => ({ id: 'wallet-1' })) } as never,
    [provider] as never,
  );

  const statements = { create: vi.fn(async () => ({ id: 'stmt-1' })) };
  const pull = new BankSyncPullService(
    store.integrationRepository as never,
    connections,
    statements as never,
    new BankSyncDedupeService(
      transactionRepository as never,
      new IntelligentDeduplicationService(importConfigStub),
      importConfigStub,
    ),
  );

  return {
    pull,
    store,
    provider,
    statements,
    imported: () =>
      statements.create.mock.calls.flatMap(call => {
        const file = call[2] as { buffer: Buffer };
        return [...file.buffer.toString('utf8').matchAll(/<FITID>([^\n<]+)/g)].map(m => m[1]);
      }),
  };
}

describe('BankSyncPullService', () => {
  it('imports each enabled account once, skipping pending rows and rows already known by id', async () => {
    const h = harness({
      accounts: [
        remoteAccount({
          transactions: [
            remoteRow({ id: 'TRN-1' }),
            remoteRow({ id: 'TRN-2', posted: new Date('2026-09-21T00:00:00Z'), amount: -9 }),
            remoteRow({ id: 'TRN-3', pending: true }),
          ],
        }),
      ],
      knownIds: ['ACT-1:TRN-1'],
    });

    const result = await h.pull.sync(user, workspaceId, 'c1');

    expect(h.statements.create).toHaveBeenCalledTimes(1);
    expect(h.imported()).toEqual(['ACT-1:TRN-2']);
    expect(result).toMatchObject({ imported: 1, statements: 1 });
    expect(result.accounts[0]).toMatchObject({ id: 'ACT-1', imported: 1, skipped: 1 });
  });

  it('keeps a transaction id already seen on another account: ids are unique per account only', async () => {
    const h = harness({
      accounts: [remoteAccount({ transactions: [remoteRow({ id: 'TRN-1' })] })],
      knownIds: ['ACT-OTHER:TRN-1'],
    });
    await h.pull.sync(user, workspaceId, 'c1');
    expect(h.imported()).toEqual(['ACT-1:TRN-1']);
  });

  it('asks 90 days back the first time and a week before the last pull afterwards', async () => {
    const first = harness({ accounts: [remoteAccount()] });
    await first.pull.sync(user, workspaceId, 'c1');
    const firstSince = first.provider.fetchAccounts.mock.calls[0][1]?.since as Date;
    const firstAge = Date.now() - firstSince.getTime();
    expect(Math.round(firstAge / 86_400_000)).toBe(90);

    const later = harness({
      config: connectionConfig({
        accounts: [accountConfig({ lastSyncAt: '2026-09-30T00:00:00.000Z' })],
      }),
      accounts: [remoteAccount()],
    });
    await later.pull.sync(user, workspaceId, 'c1');
    expect(
      (later.provider.fetchAccounts.mock.calls[0][1]?.since as Date).toISOString(),
    ).toBe('2026-09-23T00:00:00.000Z');
  });

  it('honours the floor a feed switch left, then clears it', async () => {
    const h = harness({
      config: connectionConfig({
        accounts: [
          accountConfig({ walletId: 'wallet-1', syncFrom: '2026-09-29T00:00:00.000Z' }),
        ],
      }),
      accounts: [
        remoteAccount({
          transactions: [
            // The new provider replays history the wallet already holds.
            remoteRow({ id: 'B-OLD', posted: new Date('2026-09-10T00:00:00Z') }),
            remoteRow({ id: 'B-NEW', posted: new Date('2026-09-30T00:00:00Z'), amount: -12 }),
          ],
        }),
      ],
    });

    await h.pull.sync(user, workspaceId, 'c1');

    expect((h.provider.fetchAccounts.mock.calls[0][1]?.since as Date).toISOString()).toBe(
      '2026-09-29T00:00:00.000Z',
    );
    expect(h.imported()).toEqual(['ACT-1:B-NEW']);
    const account = (h.store.configOf('c1') as unknown as { accounts: Array<Record<string, unknown>> })
      .accounts[0];
    expect(account.syncFrom).toBeNull();
  });

  it('writes no statement when nothing is new and never pulls a disabled account', async () => {
    const nothingNew = harness({
      accounts: [remoteAccount({ transactions: [remoteRow({ id: 'TRN-1' })] })],
      knownIds: ['ACT-1:TRN-1'],
    });
    await nothingNew.pull.sync(user, workspaceId, 'c1');
    expect(nothingNew.statements.create).not.toHaveBeenCalled();

    const disabled = harness({
      config: connectionConfig({ accounts: [accountConfig({ enabled: false })] }),
    });
    const result = await disabled.pull.sync(user, workspaceId, 'c1');
    expect(disabled.provider.fetchAccounts).not.toHaveBeenCalled();
    expect(result.accounts).toEqual([]);
  });

  it('flips the connection to needs-reauth when the credential is rejected', async () => {
    const h = harness({
      claim: (() => {
        throw new BankSyncAuthError();
      }) as never,
    });
    await expect(h.pull.sync(user, workspaceId, 'c1')).rejects.toBeInstanceOf(BankSyncAuthError);
    expect(h.store.rows.get('c1')?.status).toBe(IntegrationStatus.NEEDS_REAUTH);
  });
});

describe('BankSyncPullService tolerant dedupe', () => {
  it('does not import the same purchase again when a new provider numbers it differently', async () => {
    // The case every switch-provider flow gets wrong: same amount and merchant,
    // a different provider id, and a date one day off because the two providers
    // disagree about when it posted.
    const h = harness({
      config: connectionConfig({ accounts: [accountConfig({ walletId: 'wallet-1' })] }),
      accounts: [
        remoteAccount({
          transactions: [remoteRow({ id: 'B-1', posted: new Date('2026-09-21T00:00:00Z') })],
        }),
      ],
      existingRows: [storedRow()],
    });

    const result = await h.pull.sync(user, workspaceId, 'c1');

    expect(h.statements.create).not.toHaveBeenCalled();
    expect(result.accounts[0]).toMatchObject({ imported: 0, skipped: 1 });
  });

  it('still imports a row that only looks similar', async () => {
    const h = harness({
      config: connectionConfig({ accounts: [accountConfig({ walletId: 'wallet-1' })] }),
      accounts: [
        remoteAccount({
          transactions: [
            remoteRow({
              id: 'B-2',
              posted: new Date('2026-09-21T00:00:00Z'),
              amount: -98.4,
              payee: 'Hardware Store',
              description: 'Hardware Store',
              memo: 'card',
            }),
          ],
        }),
      ],
      existingRows: [storedRow()],
    });
    await h.pull.sync(user, workspaceId, 'c1');
    expect(h.imported()).toEqual(['ACT-1:B-2']);
  });

  it('lets one stored row account for only one incoming row', async () => {
    // Two genuine coffees on the same day must not both vanish against one stored row.
    const h = harness({
      config: connectionConfig({ accounts: [accountConfig({ walletId: 'wallet-1' })] }),
      accounts: [
        remoteAccount({
          transactions: [remoteRow({ id: 'B-3' }), remoteRow({ id: 'B-4' })],
        }),
      ],
      existingRows: [storedRow()],
    });
    await h.pull.sync(user, workspaceId, 'c1');
    expect(h.imported()).toEqual(['ACT-1:B-4']);
  });

  it('keeps the tolerant pass off when the account feeds no wallet', async () => {
    // Without a wallet there is nothing to scope the comparison to, and matching
    // across the workspace would drop honest look-alikes from other accounts.
    const h = harness({
      accounts: [
        remoteAccount({
          transactions: [remoteRow({ id: 'B-5', posted: new Date('2026-09-21T00:00:00Z') })],
        }),
      ],
      existingRows: [storedRow()],
    });
    await h.pull.sync(user, workspaceId, 'c1');
    expect(h.imported()).toEqual(['ACT-1:B-5']);
  });
});

describe('BankSyncPullService health', () => {
  it('calls an account stale when the provider stopped moving its balance date', async () => {
    const h = harness({
      accounts: [
        remoteAccount({ balanceDate: new Date(Date.now() - 30 * 86_400_000), transactions: [] }),
      ],
    });
    const result = await h.pull.sync(user, workspaceId, 'c1');
    expect(result.accounts[0].health).toBe('stale');
  });

  it('calls it stale when the provider stops returning the account at all', async () => {
    const h = harness({ accounts: [remoteAccount({ id: 'ACT-SOMETHING-ELSE' })] });
    const result = await h.pull.sync(user, workspaceId, 'c1');
    expect(result.accounts[0]).toMatchObject({ health: 'stale', error: 'not returned by provider' });
  });

  it('waits for a second pull before calling a balance gap incomplete', async () => {
    // A one-off gap is usually a pending row the provider counts in the balance
    // but will not list. A gap still there next time is a row that never came.
    const config = connectionConfig({
      accounts: [
        accountConfig({ balance: 100, balanceDate: '2026-09-20T00:00:00.000Z' }),
      ],
    });
    const h = harness({
      config,
      accounts: [remoteAccount({ balance: 95, balanceDate: new Date(), transactions: [] })],
    });

    const first = await h.pull.sync(user, workspaceId, 'c1');
    expect(first.accounts[0].health).toBe('ok');
    const afterFirst = (
      h.store.configOf('c1') as unknown as { accounts: Array<Record<string, unknown>> }
    ).accounts[0];
    expect(afterFirst.balanceDrift).toBe(-5);
    expect(afterFirst.driftSince).not.toBeNull();

    const second = harness({
      config: h.store.configOf('c1') as unknown as Record<string, unknown>,
      accounts: [remoteAccount({ balance: 90, balanceDate: new Date(), transactions: [] })],
    });
    const result = await second.pull.sync(user, workspaceId, 'c1');
    expect(result.accounts[0].health).toBe('incomplete');
  });

  it('auto-syncs connections of ordinary workspaces only, never a past version', async () => {
    const h = harness({});
    await h.pull.autoSync();

    expect(h.store.integrationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspace: { kind: WorkspaceKind.STANDARD } }),
      }),
    );
  });
});
