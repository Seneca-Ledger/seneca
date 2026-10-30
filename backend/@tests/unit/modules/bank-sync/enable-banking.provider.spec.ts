import { generateKeyPairSync } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import {
  BankSyncAuthError,
  BankSyncTemporaryError,
} from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import { EffectRuntime } from '../../../../src/common/effect/effect-runtime';
import { EnableBankingProvider } from '../../../../src/modules/bank-sync/enable-banking.provider';
import {
  normalizeTransaction,
  signJwt,
} from '../../../../src/modules/bank-sync/enable-banking.mapping';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const secrets = {
  applicationId: 'app-1',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};
const effects = new EffectRuntime();
afterAll(() => effects.onModuleDestroy());
const providerWith = (fetchUrl: (url: string, init?: RequestInit) => Promise<Response>) =>
  new EnableBankingProvider(fetchUrl, effects);

const context = { secrets, links: [{ id: 'sess-1', institution: 'Nordea', country: 'FI' }] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers each path with the queued body, recording the calls. */
function stubFetch(routes: Record<string, unknown | unknown[]>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const queues = new Map<string, unknown[]>(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );
  const fetchUrl = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const path = url.replace('https://api.enablebanking.com', '');
    for (const [prefix, queue] of queues) {
      if (path.startsWith(prefix)) {
        const next = queue.length > 1 ? queue.shift() : queue[0];
        return next instanceof Response ? next.clone() : json(next);
      }
    }
    return new Response('', { status: 404 });
  });
  return { fetchUrl, calls };
}

describe('EnableBankingProvider JWT', () => {
  it('signs RS256 over the application id with a verifiable signature', () => {
    const token = signJwt(secrets, Date.UTC(2026, 9, 2));
    const [header, payload, signature] = token.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      typ: 'JWT',
      alg: 'RS256',
      kid: 'app-1',
    });
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: Date.UTC(2026, 9, 2) / 1000,
      exp: Date.UTC(2026, 9, 2) / 1000 + 3600,
    });
    const { createVerify } = require('node:crypto') as typeof import('node:crypto');
    expect(
      createVerify('RSA-SHA256')
        .update(`${header}.${payload}`)
        .verify(publicKey, Buffer.from(signature, 'base64url')),
    ).toBe(true);
  });

  it('says what is missing rather than signing nothing', () => {
    expect(() => signJwt({ applicationId: 'app-1' })).toThrow(/private key/);
    expect(() => signJwt({ applicationId: 'app-1', privateKey: 'not a key' })).toThrow(
      /not a usable RSA key/,
    );
  });
});

describe('EnableBankingProvider linking', () => {
  it('lists a country’s banks with the consent ceiling each one advertises', async () => {
    const { fetchUrl, calls } = stubFetch({
      '/aspsps': {
        aspsps: [
          { name: 'Nordea', country: 'FI', maximum_consent_validity: 7_776_000 },
          { name: 'Beta Bank', country: 'FI', beta: true },
          { country: 'FI' },
        ],
      },
    });
    const banks = await providerWith(fetchUrl).listInstitutions(secrets, 'fi');
    expect(calls[0].url).toBe('https://api.enablebanking.com/aspsps?country=FI');
    expect(banks).toEqual([
      { name: 'Nordea', country: 'FI', maxConsentValiditySeconds: 7_776_000, beta: false },
      { name: 'Beta Bank', country: 'FI', maxConsentValiditySeconds: null, beta: true },
    ]);
  });

  it('asks for the longest consent the bank allows, capped at ninety days', async () => {
    const { fetchUrl, calls } = stubFetch({ '/auth': { url: 'https://bank.example/consent' } });
    const provider = providerWith(fetchUrl);

    await provider.beginLink(secrets, {
      institution: 'Nordea',
      country: 'fi',
      redirectUrl: 'https://lumio.example/callback',
      state: 'state-1',
      maxConsentValiditySeconds: 60 * 60 * 24 * 10,
    });
    const tenDays = JSON.parse(String(calls[0].init.body));
    expect(tenDays.aspsp).toEqual({ name: 'Nordea', country: 'FI' });
    expect(tenDays.state).toBe('state-1');
    const tenDaysOut = new Date(tenDays.access.valid_until).getTime() - Date.now();
    expect(Math.round(tenDaysOut / 86_400_000)).toBe(10);

    await provider.beginLink(secrets, {
      institution: 'Nordea',
      country: 'FI',
      redirectUrl: 'https://lumio.example/callback',
      state: 'state-2',
      maxConsentValiditySeconds: 60 * 60 * 24 * 400,
    });
    const capped = JSON.parse(String(calls[1].init.body));
    expect(
      Math.round((new Date(capped.access.valid_until).getTime() - Date.now()) / 86_400_000),
    ).toBe(90);
  });

  it('turns the callback code into a link that carries the consent expiry', async () => {
    const { fetchUrl, calls } = stubFetch({
      '/sessions': {
        session_id: 'sess-9',
        aspsp: { name: 'Nordea', country: 'FI' },
        access: { valid_until: '2026-12-01T00:00:00.000Z' },
      },
    });
    const link = await providerWith(fetchUrl).completeLink(secrets, 'code-1');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ code: 'code-1' });
    expect(link).toEqual({
      id: 'sess-9',
      institution: 'Nordea',
      country: 'FI',
      consentExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
    });
  });

  it('reports a refused credential as an auth error and a rate limit as temporary', async () => {
    await expect(
      providerWith(async () => new Response('', { status: 401 })).verifyCredentials(
        secrets,
      ),
    ).rejects.toBeInstanceOf(BankSyncAuthError);
    await expect(
      providerWith(async () => new Response('', { status: 429 })).verifyCredentials(
        secrets,
      ),
    ).rejects.toBeInstanceOf(BankSyncTemporaryError);
    await expect(
      providerWith(async () => json({ message: 'nope' }, 400)).verifyCredentials(
        secrets,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EnableBankingProvider pulling', () => {
  const session = {
    session_id: 'sess-1',
    aspsp: { name: 'Nordea', country: 'FI' },
    access: { valid_until: '2026-12-01T00:00:00.000Z' },
    accounts: [{ uid: 'acc-1', name: 'Käyttötili', currency: 'eur' }],
  };

  it('reads the closing booked balance and sends the PSU headers', async () => {
    const { fetchUrl, calls } = stubFetch({
      '/sessions/': session,
      '/accounts/acc-1/balances': {
        balances: [
          { balance_type: 'ITAV', balance_amount: { amount: '10.00', currency: 'EUR' } },
          {
            balance_type: 'CLBD',
            balance_amount: { amount: '1234.56', currency: 'EUR' },
            reference_date: '2026-09-30',
          },
        ],
      },
    });
    const accounts = await providerWith(fetchUrl).fetchAccounts(
      { ...context, psu: { ipAddress: '203.0.113.7', userAgent: 'Seneca/1.0' } },
      { balancesOnly: true },
    );
    expect(accounts[0]).toMatchObject({
      id: 'acc-1',
      name: 'Käyttötili',
      org: 'Nordea',
      currency: 'EUR',
      balance: 1234.56,
      linkId: 'sess-1',
      transactions: [],
    });
    expect(accounts[0].balanceDate?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(accounts[0].consentExpiresAt?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    const headers = calls.at(-1)?.init.headers as Record<string, string>;
    expect(headers['psu-ip-address']).toBe('203.0.113.7');
    expect(headers['psu-user-agent']).toBe('Seneca/1.0');
  });

  it('omits the PSU headers entirely when only one of them is known', async () => {
    // The API refuses a request that carries some but not all of them.
    const { fetchUrl, calls } = stubFetch({ '/sessions/': session, '/accounts/': { balances: [] } });
    await providerWith(fetchUrl).fetchAccounts(
      { ...context, psu: { ipAddress: '203.0.113.7' } },
      { balancesOnly: true },
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['psu-ip-address']).toBeUndefined();
    expect(headers['psu-user-agent']).toBeUndefined();
  });

  it('pages through transactions and does not duplicate the page when the bank echoes the key', async () => {
    // A real bank does this, and taking the page before noticing doubles every
    // row on it.
    const { fetchUrl, calls } = stubFetch({
      '/sessions/': session,
      '/accounts/acc-1/balances': { balances: [] },
      '/accounts/acc-1/transactions': [
        {
          transactions: [
            {
              entry_reference: 'T-1',
              booking_date: '2026-09-20',
              credit_debit_indicator: 'DBIT',
              transaction_amount: { amount: '4.50', currency: 'EUR' },
              creditor: { name: 'Coffee Co' },
            },
          ],
          continuation_key: 'page-2',
        },
        {
          transactions: [
            {
              entry_reference: 'T-2',
              booking_date: '2026-09-21',
              credit_debit_indicator: 'CRDT',
              transaction_amount: { amount: '100.00', currency: 'EUR' },
              debtor: { name: 'Acme' },
            },
          ],
          continuation_key: 'page-2',
        },
      ],
    });

    const accounts = await providerWith(fetchUrl).fetchAccounts(context, {
      since: new Date('2026-09-01T00:00:00Z'),
    });

    expect(accounts[0].transactions.map(row => row.id)).toEqual(['T-1']);
    const pages = calls.filter(call => call.url.includes('/transactions'));
    expect(pages).toHaveLength(2);
    expect(pages[0].url).toContain('date_from=2026-09-01');
    expect(pages[1].url).toContain('continuation_key=page-2');
  });
});

describe('EnableBankingProvider normalization', () => {
  const base = {
    entry_reference: 'T-1',
    booking_date: '2026-09-20',
    transaction_amount: { amount: '4.50', currency: 'EUR' },
  };

  it('signs the amount from the credit/debit indicator', () => {
    expect(normalizeTransaction({ ...base, credit_debit_indicator: 'DBIT' })?.amount).toBe(-4.5);
    expect(normalizeTransaction({ ...base, credit_debit_indicator: 'CRDT' })?.amount).toBe(4.5);
    // No indicator: the bank's own sign stands.
    expect(
      normalizeTransaction({ ...base, transaction_amount: { amount: '-4.50', currency: 'EUR' } })
        ?.amount,
    ).toBe(-4.5);
  });

  it('takes the counterparty, not the account holder, as payee', () => {
    // A card payment where `creditor` is empty must not be labelled with the
    // account holder's own name.
    expect(
      normalizeTransaction({
        ...base,
        credit_debit_indicator: 'DBIT',
        debtor: { name: 'Account Holder' },
        creditor: { name: 'Hardware Store' },
      })?.payee,
    ).toBe('Hardware Store');
    expect(
      normalizeTransaction({
        ...base,
        credit_debit_indicator: 'CRDT',
        debtor: { name: 'Employer Oy' },
        creditor: { name: 'Account Holder' },
      })?.payee,
    ).toBe('Employer Oy');
  });

  it('strips SEPA prefixes but keeps a merchant that starts like one', () => {
    expect(
      normalizeTransaction({
        ...base,
        remittance_information: ['EREF+invoice-42', 'SVWZ+Thanks'],
      })?.description,
    ).toBe('invoice-42 Thanks');
    expect(
      normalizeTransaction({ ...base, remittance_information: ['BMW+Service'] })?.description,
    ).toBe('BMW+Service');
  });

  it('marks only what the bank calls pending, and falls back through the dates', () => {
    expect(normalizeTransaction({ ...base, status: 'PDNG' })?.pending).toBe(true);
    expect(normalizeTransaction({ ...base, status: 'BOOK' })?.pending).toBe(false);
    // A bank that says nothing is treated as booked rather than guessed about.
    expect(normalizeTransaction(base)?.pending).toBe(false);
    expect(
      normalizeTransaction({
        entry_reference: 'T-9',
        value_date: '2026-09-18',
        transaction_amount: { amount: '1.00', currency: 'EUR' },
      })?.posted.toISOString(),
    ).toBe('2026-09-18T00:00:00.000Z');
  });

  it('drops a row it cannot import instead of failing the whole account', () => {
    expect(normalizeTransaction({ ...base, entry_reference: undefined })).toBeNull();
    expect(normalizeTransaction({ ...base, booking_date: undefined })).toBeNull();
    expect(normalizeTransaction({ ...base, booking_date: 'last tuesday' })).toBeNull();
    expect(
      normalizeTransaction({ ...base, transaction_amount: { amount: '   ', currency: 'EUR' } }),
    ).toBeNull();
    expect(
      normalizeTransaction({ ...base, transaction_amount: { amount: 'lots', currency: 'EUR' } }),
    ).toBeNull();
  });
});
