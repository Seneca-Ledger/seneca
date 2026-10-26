import { IntegrationStatus } from '../../../../src/entities';
import { encryptText } from '../../../../src/common/utils/encryption.util';
import type {
  BankSyncAccount,
  BankSyncContext,
  BankSyncFetchOptions,
  BankSyncTransaction,
} from '../../../../src/modules/bank-sync/bank-sync-provider.interface';

// The credential round-trip is real in these tests, so the key has to exist
// before anything encrypts. process.env is shared by every file in a Jest
// worker, so it is put back afterwards: leaving it set would quietly change
// what the encryption suites see.
const keyBefore = process.env.INTEGRATIONS_ENCRYPTION_KEY;
process.env.INTEGRATIONS_ENCRYPTION_KEY = keyBefore || 'unit-test-key';
afterAll(() => {
  if (keyBefore === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  else process.env.INTEGRATIONS_ENCRYPTION_KEY = keyBefore;
});

export const workspaceId = 'ws-1';
export const user = { id: 'user-1' } as never;
export const accessUrl = 'https://demo:demo@bridge.example/simplefin';

export const remoteAccount = (overrides: Partial<BankSyncAccount> = {}): BankSyncAccount => ({
  id: 'ACT-1',
  name: 'Checking',
  org: 'Demo Bank',
  currency: 'USD',
  balance: 50,
  balanceDate: new Date('2026-09-30T00:00:00Z'),
  transactions: [],
  ...overrides,
});

export const remoteRow = (overrides: Partial<BankSyncTransaction> = {}): BankSyncTransaction => ({
  id: 'TRN-1',
  posted: new Date('2026-09-20T00:00:00Z'),
  amount: -4.5,
  description: 'Coffee',
  payee: 'Coffee Co',
  memo: 'card',
  pending: false,
  ...overrides,
});

/** An account entry as it sits in a connection's stored config. */
export const accountConfig = (overrides: Record<string, unknown> = {}) => ({
  id: 'ACT-1',
  name: 'Checking',
  org: 'Demo Bank',
  currency: 'USD',
  enabled: true,
  walletId: null,
  linkId: null,
  lastSyncAt: null,
  balance: null,
  balanceDate: null,
  consentExpiresAt: null,
  syncFrom: null,
  health: 'never_synced',
  lastError: null,
  balanceDrift: null,
  driftSince: null,
  ...overrides,
});

export interface FakeConnection {
  id: string;
  provider: string;
  status: IntegrationStatus;
  workspaceId: string;
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
  connectedByUser?: { id: string } | null;
}

/**
 * The integration + settings rows behave as one record per connection, which is
 * what the service sees through the two repositories.
 */
export function fakeStore(connections: FakeConnection[] = []) {
  const rows = new Map<string, FakeConnection>();
  for (const connection of connections) rows.set(connection.id, connection);

  const entityOf = (row: FakeConnection) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    status: row.status,
    connectedByUser: row.connectedByUser ?? null,
    connectedByUserId: row.connectedByUser?.id ?? null,
    openProtocolSettings: {
      id: `set-${row.id}`,
      integrationId: row.id,
      lastSyncAt: null,
      config: row.config,
      encryptedSecrets: Object.fromEntries(
        Object.entries(row.secrets ?? { accessUrl }).map(([key, value]) => [
          key,
          encryptText(value),
        ]),
      ),
    },
  });

  let nextId = rows.size + 1;
  const integrationRepository = {
    findOne: vi.fn(async (query: { where: { id?: string; workspaceId?: string } }) => {
      const row = query.where.id ? rows.get(query.where.id) : undefined;
      if (!row) return null;
      if (query.where.workspaceId && row.workspaceId !== query.where.workspaceId) return null;
      return entityOf(row);
    }),
    find: vi.fn(async (query?: { where?: { workspaceId?: string } }) =>
      [...rows.values()]
        .filter(row => !query?.where?.workspaceId || row.workspaceId === query.where.workspaceId)
        .map(entityOf),
    ),
    create: vi.fn((data: Record<string, unknown>) => ({ id: `int-${nextId++}`, ...data })),
    save: vi.fn(async (entity: Record<string, unknown>) => {
      const id = String(entity.id);
      const existing = rows.get(id);
      rows.set(id, {
        id,
        workspaceId: String(entity.workspaceId ?? existing?.workspaceId ?? workspaceId),
        provider: String(entity.provider ?? existing?.provider),
        status: (entity.status ?? existing?.status) as IntegrationStatus,
        config: existing?.config ?? {},
        secrets: existing?.secrets,
        connectedByUser: existing?.connectedByUser ?? null,
      });
      return entity;
    }),
  };

  const settingsRepository = {
    create: vi.fn((data: Record<string, unknown>) => ({ ...data })),
    save: vi.fn(async (entity: Record<string, unknown>) => {
      const id = String(entity.integrationId);
      const row = rows.get(id);
      if (row) {
        row.config = entity.config as Record<string, unknown>;
        if (entity.encryptedSecrets) {
          row.secrets = Object.fromEntries(
            Object.entries(entity.encryptedSecrets as Record<string, string>).map(([key]) => [
              key,
              accessUrl,
            ]),
          );
        }
      }
      return entity;
    }),
  };

  return {
    rows,
    integrationRepository,
    settingsRepository,
    configOf: (id: string) => rows.get(id)?.config as Record<string, never>,
  };
}

/** A token-style provider whose answers the test controls. */
export function fakeTokenProvider(accounts: BankSyncAccount[] = [remoteAccount()]) {
  return {
    key: 'simplefin',
    linkStyle: 'token' as const,
    claim: vi.fn(async () => ({ accessUrl })),
    fetchAccounts: vi.fn(
      async (_context: BankSyncContext, _options?: BankSyncFetchOptions) => accounts,
    ),
  };
}

/** Tolerances as shipped: ±3 days, ±2 % on the amount, 0.75 text similarity. */
export const importConfigStub = {
  getDedupDateToleranceDays: () => 3,
  getDedupAmountTolerancePercent: () => 2,
  getDedupTextSimilarityThreshold: () => 0.75,
} as never;
