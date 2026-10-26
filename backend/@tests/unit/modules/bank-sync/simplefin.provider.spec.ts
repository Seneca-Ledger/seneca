import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { EffectRuntime } from '../../../../src/common/effect/effect-runtime';
import {
  BankSyncAuthError,
  BankSyncTemporaryError,
} from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import {
  decodeSetupToken,
  parseAccessUrl,
  SimpleFinProvider,
} from '../../../../src/modules/bank-sync/simplefin.provider';

const claimUrl = 'https://beta-bridge.simplefin.org/simplefin/claim/demo';
const setupToken = Buffer.from(claimUrl).toString('base64');
const accessUrl = 'https://demo:demo@beta-bridge.simplefin.org/simplefin';
/** The provider reads its credential out of the connection's decrypted secrets. */
const context = { secrets: { accessUrl }, links: [] };

const effects = new EffectRuntime();
afterAll(() => effects.onModuleDestroy());
const providerWith = (fetchUrl: (url: string, init?: RequestInit) => Promise<Response>) =>
  new SimpleFinProvider(fetchUrl, effects);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('SimpleFinProvider', () => {
  it('decodes a setup token into its https claim URL and refuses anything else', () => {
    expect(decodeSetupToken(` ${setupToken}\n`)).toBe(claimUrl);
    expect(() => decodeSetupToken('not base64 at all!')).toThrow(BadRequestException);
    expect(() => decodeSetupToken(Buffer.from('http://bridge/claim/x').toString('base64'))).toThrow(
      /https/,
    );
  });

  it('turns the access URL into a clean URL plus a Basic header', () => {
    const { url, authorization } = parseAccessUrl('https://us%40er:p%40ss@host.example/simplefin');
    expect(url.toString()).toBe('https://host.example/simplefin');
    expect(authorization).toBe(`Basic ${Buffer.from('us@er:p@ss').toString('base64')}`);
    expect(() => parseAccessUrl('https://host.example/simplefin')).toThrow(/credentials/);
  });

  it('claims a token with one POST and keeps the access URL it gets back', async () => {
    const fetchUrl = vi.fn(async () => new Response(accessUrl, { status: 200 }));
    const provider = providerWith(fetchUrl);
    await expect(provider.claim(setupToken)).resolves.toEqual({ accessUrl });
    expect(fetchUrl).toHaveBeenCalledWith(claimUrl, expect.objectContaining({ method: 'POST' }));
  });

  it('explains a used token', async () => {
    const provider = providerWith(async () => new Response('', { status: 403 }));
    await expect(provider.claim(setupToken)).rejects.toThrow(/used already/);
  });

  it('lists accounts with Basic auth, the start date and pending rows, mapping the protocol fields', async () => {
    const fetchUrl = vi.fn(async () =>
      jsonResponse(200, {
        errors: [],
        accounts: [
          {
            org: { domain: 'demo.example', name: 'Demo Bank' },
            id: 'ACT-1',
            name: 'Checking',
            currency: 'USD',
            balance: '100.25',
            'balance-date': Date.UTC(2026, 8, 30) / 1000,
            transactions: [
              {
                id: 'TRN-1',
                posted: 1758888000,
                amount: '-4.50',
                description: 'Coffee',
                payee: 'Coffee Co',
                memo: 'card',
              },
              { id: 'TRN-2', posted: 0, transacted_at: 1758974400, amount: '2000', description: 'Pay', pending: true },
              { id: '', posted: 1758974400, amount: '1', description: 'no id' },
            ],
          },
          { id: 'ACT-2', name: 'No org', currency: 'eur', transactions: [] },
        ],
      }),
    );
    const provider = providerWith(fetchUrl);
    const since = new Date('2026-09-01T00:00:00Z');
    const accounts = await provider.fetchAccounts(context, { since });

    const [url, init] = fetchUrl.mock.calls[0] as unknown as [string, RequestInit];
    const target = new URL(url);
    expect(target.origin + target.pathname).toBe('https://beta-bridge.simplefin.org/simplefin/accounts');
    expect(target.searchParams.get('start-date')).toBe(String(since.getTime() / 1000));
    expect(target.searchParams.get('pending')).toBe('1');
    expect(new Headers(init.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('demo:demo').toString('base64')}`,
    );

    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      id: 'ACT-1',
      name: 'Checking',
      org: 'Demo Bank',
      currency: 'USD',
      balance: 100.25,
    });
    expect(accounts[0].balanceDate?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(accounts[0].transactions).toHaveLength(2);
    expect(accounts[0].transactions[0]).toMatchObject({
      id: 'TRN-1',
      amount: -4.5,
      description: 'Coffee',
      payee: 'Coffee Co',
      memo: 'card',
      pending: false,
    });
    expect(accounts[0].transactions[1]).toMatchObject({ id: 'TRN-2', pending: true });
    expect(accounts[1]).toMatchObject({ org: '', currency: 'EUR', balance: null });
  });

  it('asks for balances only when told to', async () => {
    const fetchUrl = vi.fn(async () => jsonResponse(200, { accounts: [] }));
    await providerWith(fetchUrl).fetchAccounts(context, { balancesOnly: true });
    const target = new URL((fetchUrl.mock.calls[0] as unknown as [string])[0]);
    expect(target.searchParams.get('balances-only')).toBe('1');
    expect(target.searchParams.get('pending')).toBeNull();
  });

  it('retries a listing that failed on the way, through the injected fetch', async () => {
    const fetchUrl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(200, { accounts: [{ id: 'ACT-1' }] }));

    const accounts = await providerWith(fetchUrl).fetchAccounts(context);

    expect(accounts.map(account => account.id)).toEqual(['ACT-1']);
    expect(fetchUrl).toHaveBeenCalledTimes(3);
  });

  it('never retries the one-time claim', async () => {
    const fetchUrl = vi.fn(async () => new Response('', { status: 503 }));
    await expect(providerWith(fetchUrl).claim(setupToken)).rejects.toThrow(/HTTP 503/);
    expect(fetchUrl).toHaveBeenCalledTimes(1);
  });

  it('drops a malformed account or row instead of failing the whole sync', async () => {
    const accounts = await providerWith(async () =>
      jsonResponse(200, {
        accounts: [
          { id: 'ACT-1', balance: { odd: true } },
          {
            id: 'ACT-2',
            transactions: [
              { id: 'TRN-1', posted: 1758888000, amount: '-1', pending: 'yes' },
              { id: 'TRN-2', posted: 1758888000, amount: '-2', description: null },
            ],
          },
        ],
      }),
    ).fetchAccounts(context);

    expect(accounts.map(account => account.id)).toEqual(['ACT-2']);
    expect(accounts[0].transactions.map(row => row.id)).toEqual(['TRN-2']);
  });

  it('answers 502 when SimpleFIN cannot be reached or sends something unreadable', async () => {
    await expect(
      providerWith(async () => {
        throw new TypeError('fetch failed');
      }).fetchAccounts(context),
    ).rejects.toThrow(BadGatewayException);
    await expect(
      providerWith(async () => new Response('<html>', { status: 200 })).fetchAccounts(context),
    ).rejects.toThrow(/unreadable/);
  });

  it('gives up on a listing that does not finish within a minute', async () => {
    const hanging = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        ),
    );
    vi.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      const pending = providerWith(hanging).fetchAccounts(context);
      const outcome = expect(pending).rejects.toThrow(/did not answer in time/);
      await vi.advanceTimersByTimeAsync(60_000);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a rejected credential as an auth error and provider errors by their text', async () => {
    await expect(
      providerWith(async () => new Response('', { status: 401 })).fetchAccounts(context),
    ).rejects.toBeInstanceOf(BankSyncAuthError);
    await expect(
      providerWith(async () =>
        jsonResponse(200, { errors: ['Connection to Demo Bank needs attention'], accounts: [] }),
      ).fetchAccounts(context),
    ).rejects.toThrow(/needs attention/);
  });

  it('calls a connection the provider is still repairing temporary, not an auth problem', async () => {
    // SimpleFIN can sit on "We are upgrading this connection" for weeks. Telling
    // the user to re-link would be wrong advice, so it gets its own error type.
    await expect(
      providerWith(async () =>
        jsonResponse(200, {
          errors: ['We are upgrading this connection. Please wait...'],
          accounts: [],
        }),
      ).fetchAccounts(context),
    ).rejects.toBeInstanceOf(BankSyncTemporaryError);

    // Still rate-limited after the retries.
    await expect(
      providerWith(async () => new Response('', { status: 429 })).fetchAccounts(context),
    ).rejects.toBeInstanceOf(BankSyncTemporaryError);
  });
});
