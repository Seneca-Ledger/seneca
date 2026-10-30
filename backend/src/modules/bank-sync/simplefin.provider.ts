import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type Cause, Data, Effect, Option, Schedule, Schema } from 'effect';
import {
  FetchHttpClient,
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/http';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { appError } from '../../common/errors/app-error';
import {
  BANK_SYNC_FETCH,
  type BankSyncAccount,
  BankSyncAuthError,
  type BankSyncContext,
  type BankSyncFetch,
  type BankSyncFetchOptions,
  BankSyncTemporaryError,
  type BankSyncTransaction,
  type TokenBankSyncProvider,
} from './bank-sync-provider.interface';

/** SimpleFIN answers a claim with an access URL that carries the credentials: `https://user:pass@host/simplefin`. */
const REQUEST_TIMEOUT_MS = 20_000;
/** The account listing with its retries; the bridge can be slow while it polls the banks. */
const LISTING_TIMEOUT_MS = 60_000;

// Every field is optional and nullable: aggregator data is uneven, and the
// mappers below decide what a usable row is.
const NumberOrString = Schema.optional(Schema.NullOr(Schema.Union([Schema.Number, Schema.String])));
const Text = Schema.optional(Schema.NullOr(Schema.String));

const SimpleFinTransaction = Schema.Struct({
  id: Text,
  posted: NumberOrString,
  transacted_at: NumberOrString,
  amount: NumberOrString,
  description: Text,
  payee: Text,
  memo: Text,
  pending: Schema.optional(Schema.NullOr(Schema.Boolean)),
});

const SimpleFinAccount = Schema.Struct({
  id: Text,
  name: Text,
  currency: Text,
  balance: NumberOrString,
  'balance-date': NumberOrString,
  org: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.String, Schema.Struct({ name: Text, domain: Text })])),
  ),
  transactions: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
});

/** Accounts and rows are decoded one by one, so one malformed row does not sink a whole sync. */
const SimpleFinResponse = Schema.Struct({
  errors: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  accounts: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
});

/** SimpleFIN answered, but not with the accounts. */
class SimpleFinRefused extends Data.TaggedError('SimpleFinRefused')<{ readonly status: number }> {}

const decodeAccount = Schema.decodeUnknownOption(SimpleFinAccount);
const decodeTransaction = Schema.decodeUnknownOption(SimpleFinTransaction);

/**
 * The SimpleFIN protocol (https://www.simplefin.org/protocol.html): a setup
 * token is a base64 claim URL; one POST to it returns the access URL; every
 * later call is `GET <access URL>/accounts` with HTTP Basic auth taken from
 * that URL. Both hops go through the egress guard: the claim URL and the
 * access URL are user-controlled destinations like any other integration host.
 */
@Injectable()
export class SimpleFinProvider implements TokenBankSyncProvider {
  readonly key = 'simplefin';
  readonly linkStyle = 'token' as const;

  constructor(
    @Inject(BANK_SYNC_FETCH) private readonly fetchUrl: BankSyncFetch,
    private readonly effects: EffectRuntime,
  ) {}

  async claim(setupToken: string): Promise<Record<string, string>> {
    const claimUrl = decodeSetupToken(setupToken);
    const response = await this.fetchUrl(claimUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 403 || response.status === 404) {
      throw new BadRequestException(appError('BANK_SYNC_SIMPLEFIN_TOKEN_REJECTED'));
    }
    if (!response.ok) {
      throw new BadRequestException(
        appError('BANK_SYNC_SIMPLEFIN_CLAIM_FAILED', { status: response.status }),
      );
    }
    const accessUrl = (await response.text()).trim();
    parseAccessUrl(accessUrl);
    return { accessUrl };
  }

  async fetchAccounts(
    context: BankSyncContext,
    options: BankSyncFetchOptions = {},
  ): Promise<BankSyncAccount[]> {
    const { url, authorization } = parseAccessUrl(context.secrets.accessUrl ?? '');
    const target = new URL(`${url.pathname.replace(/\/$/, '')}/accounts`, url);
    if (options.since) {
      target.searchParams.set('start-date', String(Math.floor(options.since.getTime() / 1000)));
    }
    if (options.balancesOnly) {
      target.searchParams.set('balances-only', '1');
    } else {
      target.searchParams.set('pending', '1');
    }
    const request = HttpClientRequest.get(target).pipe(
      HttpClientRequest.setHeaders({ authorization, accept: 'application/json' }),
    );
    // The listing is a read: a network error, 429 or 5xx is retried. The
    // one-time claim above never is — a retry could burn the token.
    const listing = Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.retryTransient({
          schedule: Schedule.exponential('500 millis').pipe(Schedule.jittered),
          times: 2,
        }),
      );
      const response = yield* client.execute(request).pipe(Effect.timeout(LISTING_TIMEOUT_MS));
      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.fail(new SimpleFinRefused({ status: response.status }));
      }
      return yield* HttpClientResponse.schemaBodyJson(SimpleFinResponse)(response);
    }).pipe(
      Effect.mapError(toListingException),
      // Through the egress-guarded fetch from DI, never the global one.
      Effect.provideService(FetchHttpClient.Fetch, (input, init) =>
        this.fetchUrl(String(input), init),
      ),
    );

    const body = await this.effects.run(listing);
    const accounts = body.accounts ?? [];
    const errors = body.errors ?? [];
    if (accounts.length === 0 && errors.length > 0) {
      // "We are upgrading this connection" can sit here for weeks. It is not an
      // auth problem, so it must not read as one.
      if (errors.some(isTemporaryError)) {
        throw new BankSyncTemporaryError(`SimpleFIN: ${errors.join('; ')}`);
      }
      throw new BadRequestException(
        appError('BANK_SYNC_SIMPLEFIN_ERRORS', { errors: errors.join('; ') }),
      );
    }
    return accounts.map(mapAccount).filter((account): account is BankSyncAccount => !!account);
  }
}

/** What the bank-sync service expects from a provider: auth errors flip the connection to re-auth. */
function toListingException(
  error:
    | SimpleFinRefused
    | HttpClientError.HttpClientError
    | Schema.SchemaError
    | Cause.TimeoutError,
): Error {
  switch (error._tag) {
    case 'SimpleFinRefused':
      if (error.status === 401 || error.status === 403) return new BankSyncAuthError();
      // Still refused after the retries: the bridge's own rate limit or outage, not the credential.
      if (error.status === 429 || error.status >= 500) {
        return new BankSyncTemporaryError(`SimpleFIN answered HTTP ${error.status}`);
      }
      return new BadRequestException(
        appError('BANK_SYNC_SIMPLEFIN_HTTP_ERROR', { status: error.status }),
      );
    case 'TimeoutError':
      return new BadGatewayException(appError('BANK_SYNC_SIMPLEFIN_TIMEOUT'));
    case 'SchemaError':
      return new BadGatewayException(appError('BANK_SYNC_SIMPLEFIN_UNREADABLE'));
    case 'HttpClientError':
      return new BadGatewayException(
        error.reason._tag === 'DecodeError'
          ? appError('BANK_SYNC_SIMPLEFIN_UNREADABLE')
          : appError('BANK_SYNC_SIMPLEFIN_UNREACHABLE'),
      );
  }
}

/** Errors SimpleFIN clears by itself; re-linking would be the wrong advice. */
function isTemporaryError(message: string): boolean {
  return /upgrad|try again|temporar|in progress|please wait/i.test(message);
}

/** A setup token is the base64 of the claim URL; anything else is a paste error, not a bug. */
export function decodeSetupToken(setupToken: string): string {
  const compact = setupToken.replace(/\s+/g, '');
  if (!compact) throw new BadRequestException(appError('BANK_SYNC_SETUP_TOKEN_EMPTY'));
  const decoded = Buffer.from(compact, 'base64').toString('utf8');
  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    throw new BadRequestException(appError('BANK_SYNC_SETUP_TOKEN_INVALID'));
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException(appError('BANK_SYNC_SIMPLEFIN_CLAIM_URL_INSECURE'));
  }
  return url.toString();
}

/** The access URL with its credentials moved into an Authorization header. */
export function parseAccessUrl(accessUrl: string): { url: URL; authorization: string } {
  let url: URL;
  try {
    url = new URL(accessUrl);
  } catch {
    throw new BadRequestException(appError('BANK_SYNC_SIMPLEFIN_ACCESS_URL_INVALID'));
  }
  if (url.protocol !== 'https:' || !url.username) {
    throw new BadRequestException(appError('BANK_SYNC_SIMPLEFIN_ACCESS_URL_INSECURE'));
  }
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);
  const clean = new URL(url.toString());
  clean.username = '';
  clean.password = '';
  return {
    url: clean,
    authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
  };
}

function epochToDate(value: number | string | null | undefined): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAccount(input: unknown): BankSyncAccount | null {
  const raw = Option.getOrUndefined(decodeAccount(input));
  if (!raw?.id) return null;
  const org = typeof raw.org === 'string' ? raw.org : raw.org?.name || raw.org?.domain || '';
  const transactions = (raw.transactions ?? [])
    .map(mapTransaction)
    .filter((item): item is BankSyncTransaction => !!item);
  return {
    id: String(raw.id),
    name: raw.name || String(raw.id),
    org,
    currency: (raw.currency || 'USD').toUpperCase(),
    balance: toNumber(raw.balance),
    balanceDate: epochToDate(raw['balance-date']),
    transactions,
  };
}

function mapTransaction(input: unknown): BankSyncTransaction | null {
  const raw = Option.getOrUndefined(decodeTransaction(input));
  if (!raw) return null;
  const posted = epochToDate(raw.posted) ?? epochToDate(raw.transacted_at);
  const amount = toNumber(raw.amount);
  if (!(raw.id && posted) || amount === null) return null;
  return {
    id: String(raw.id),
    posted,
    amount,
    description: raw.description || raw.payee || raw.memo || '',
    payee: raw.payee || undefined,
    memo: raw.memo || undefined,
    pending: raw.pending === true,
  };
}
