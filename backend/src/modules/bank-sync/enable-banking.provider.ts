import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type Cause, Data, Effect, Option, Schema } from 'effect';
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
  type BankSyncInstitution,
  type BankSyncLink,
  BankSyncTemporaryError,
  type BankSyncTransaction,
  type RedirectBankSyncProvider,
} from './bank-sync-provider.interface';
import {
  EnableBankingBalances,
  EnableBankingInstitution,
  EnableBankingInstitutions,
  EnableBankingSession,
  EnableBankingTransaction,
  EnableBankingTransactionPage,
  normalizeTransaction,
  signJwt,
} from './enable-banking.mapping';

const BASE_URL = 'https://api.enablebanking.com';
const REQUEST_TIMEOUT_MS = 30_000;
/** Most banks default a consent to 90 days; none of them grant more than asked. */
const DEFAULT_CONSENT_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A runaway continuation key must not loop forever. */
const MAX_PAGES = 100;

/** Enable Banking answered, but not with what was asked. */
class EnableBankingRefused extends Data.TaggedError('EnableBankingRefused')<{
  readonly status: number;
  readonly retryAfterSeconds?: number;
}> {}

const decodeInstitution = Schema.decodeUnknownOption(EnableBankingInstitution);
const decodeTransaction = Schema.decodeUnknownOption(EnableBankingTransaction);

type PsuHeaders = { ipAddress?: string; userAgent?: string };

/**
 * Enable Banking: the user holds the application credentials (an application id
 * and the RSA key behind the certificate they registered) and authorizes each
 * bank in the browser. On the free "restricted production" tier the API returns
 * only the accounts that application's owner linked themselves, which is why a
 * workspace may need one connection per person.
 */
@Injectable()
export class EnableBankingProvider implements RedirectBankSyncProvider {
  readonly key = 'enablebanking';
  readonly linkStyle = 'redirect' as const;

  constructor(
    @Inject(BANK_SYNC_FETCH) private readonly fetchUrl: BankSyncFetch,
    private readonly effects: EffectRuntime,
  ) {}

  async verifyCredentials(secrets: Record<string, string>): Promise<void> {
    await this.request('GET', '/application', secrets, Schema.Unknown);
  }

  async listInstitutions(
    secrets: Record<string, string>,
    country: string,
  ): Promise<BankSyncInstitution[]> {
    const body = await this.request(
      'GET',
      `/aspsps?country=${encodeURIComponent(country.toUpperCase())}`,
      secrets,
      EnableBankingInstitutions,
    );
    const list = Array.isArray(body) ? body : (('aspsps' in body ? body.aspsps : null) ?? []);
    return list.flatMap(item => {
      const raw = Option.getOrUndefined(decodeInstitution(item));
      if (!raw) return [];
      return [
        {
          name: raw.name,
          country: (raw.country ?? country).toUpperCase(),
          maxConsentValiditySeconds: raw.maximum_consent_validity ?? null,
          beta: raw.beta === true,
        },
      ];
    });
  }

  async beginLink(
    secrets: Record<string, string>,
    input: {
      institution: string;
      country: string;
      redirectUrl: string;
      state: string;
      maxConsentValiditySeconds?: number | null;
    },
  ): Promise<{ url: string }> {
    // Ask for as long as the bank allows, capped at our own ceiling. Asking for
    // the default instead is what turns one re-authorization a quarter into the
    // thing people quit over.
    const allowed = input.maxConsentValiditySeconds;
    const consentMs =
      allowed && allowed > 0
        ? Math.min(allowed * 1000, DEFAULT_CONSENT_DAYS * DAY_MS)
        : DEFAULT_CONSENT_DAYS * DAY_MS;
    const body = await this.request('POST', '/auth', secrets, AuthStarted, {
      body: {
        aspsp: { name: input.institution, country: input.country.toUpperCase() },
        redirect_url: input.redirectUrl,
        state: input.state,
        access: { valid_until: new Date(Date.now() + consentMs).toISOString() },
        psu_type: 'personal',
      },
    });
    if (!body.url) {
      throw new BadRequestException(appError('BANK_SYNC_ENABLEBANKING_NO_AUTH_URL'));
    }
    return { url: body.url };
  }

  async completeLink(secrets: Record<string, string>, code: string): Promise<BankSyncLink> {
    const session = await this.request('POST', '/sessions', secrets, EnableBankingSession, {
      body: { code },
    });
    if (!session.session_id) {
      throw new BadRequestException(appError('BANK_SYNC_ENABLEBANKING_NO_SESSION'));
    }
    return {
      id: session.session_id,
      institution: session.aspsp?.name ?? 'Unknown',
      country: session.aspsp?.country ?? null,
      consentExpiresAt: session.access?.valid_until ? new Date(session.access.valid_until) : null,
    };
  }

  async fetchAccounts(
    context: BankSyncContext,
    options: BankSyncFetchOptions = {},
  ): Promise<BankSyncAccount[]> {
    const accounts: BankSyncAccount[] = [];
    for (const link of context.links) {
      const session = await this.request(
        'GET',
        `/sessions/${encodeURIComponent(link.id)}`,
        context.secrets,
        EnableBankingSession,
        { psu: context.psu },
      );
      const consentExpiresAt = session.access?.valid_until
        ? new Date(session.access.valid_until)
        : (link.consentExpiresAt ?? null);
      for (const raw of session.accounts ?? []) {
        if (!raw.uid) continue;
        accounts.push({
          id: raw.uid,
          name: raw.name || raw.account_id?.iban || raw.uid,
          org: session.aspsp?.name || raw.account_servicer?.name || link.institution,
          currency: (raw.currency || '').toUpperCase(),
          ...(await this.balanceOf(raw.uid, context)),
          transactions: options.balancesOnly
            ? []
            : await this.transactionsOf(raw.uid, context, options.since),
          linkId: link.id,
          consentExpiresAt,
        });
      }
    }
    return accounts;
  }

  private async balanceOf(
    accountUid: string,
    context: BankSyncContext,
  ): Promise<{ balance: number | null; balanceDate: Date | null }> {
    const body = await this.request(
      'GET',
      `/accounts/${encodeURIComponent(accountUid)}/balances`,
      context.secrets,
      EnableBankingBalances,
      { psu: context.psu },
    );
    const balances = body.balances ?? [];
    // Prefer the closing booked balance; it is the one that matches the rows.
    const chosen =
      balances.find(item => (item.balance_type ?? '').toUpperCase() === 'CLBD') ?? balances[0];
    if (!chosen) return { balance: null, balanceDate: null };
    const amount = Number(chosen.balance_amount?.amount ?? Number.NaN);
    return {
      balance: Number.isFinite(amount) ? amount : null,
      balanceDate: chosen.reference_date ? new Date(chosen.reference_date) : null,
    };
  }

  private async transactionsOf(
    accountUid: string,
    context: BankSyncContext,
    since?: Date,
  ): Promise<BankSyncTransaction[]> {
    const from = (since ?? new Date(Date.now() - 90 * DAY_MS)).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const raw: unknown[] = [];
    let continuationKey: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ date_from: from, date_to: to });
      if (continuationKey) query.set('continuation_key', continuationKey);
      const body = await this.request(
        'GET',
        `/accounts/${encodeURIComponent(accountUid)}/transactions?${query.toString()}`,
        context.secrets,
        EnableBankingTransactionPage,
        { psu: context.psu },
      );
      const next = body.continuation_key ?? undefined;
      // Some banks echo the key they were given. Stopping before taking the page
      // matters: taking it first duplicates every row on the page.
      if (next && next === continuationKey) break;
      raw.push(...(body.transactions ?? []));
      if (!next) break;
      continuationKey = next;
    }

    return raw.flatMap(item => {
      const decoded = Option.getOrUndefined(decodeTransaction(item));
      const row = decoded ? normalizeTransaction(decoded) : null;
      return row ? [row] : [];
    });
  }

  /**
   * One call, signed with a fresh JWT. Never retried: several banks allow only
   * a handful of calls a day, and a retry would spend them.
   */
  private request<A>(
    method: 'GET' | 'POST',
    path: string,
    secrets: Record<string, string>,
    schema: Schema.Codec<A, unknown>,
    options: { body?: unknown; psu?: PsuHeaders } = {},
  ): Promise<A> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${signJwt(secrets)}`,
      accept: 'application/json',
    };
    // Either every PSU header or none, otherwise the API refuses the call. They
    // are what marks the user as present: without them several banks apply a
    // four-calls-a-day ceiling meant for background jobs.
    if (options.psu?.ipAddress && options.psu.userAgent) {
      headers['psu-ip-address'] = options.psu.ipAddress;
      headers['psu-user-agent'] = options.psu.userAgent;
    }
    const url = `${BASE_URL}${path}`;
    const request = (
      method === 'GET'
        ? HttpClientRequest.get(url)
        : HttpClientRequest.post(url).pipe(HttpClientRequest.bodyJsonUnsafe(options.body ?? {}))
    ).pipe(HttpClientRequest.setHeaders(headers));

    const exchange = Effect.gen(function* () {
      const response = yield* (yield* HttpClient.HttpClient).execute(request);
      if (response.status < 200 || response.status >= 300) {
        const retryAfter = Number(response.headers['retry-after']);
        return yield* Effect.fail(
          new EnableBankingRefused({
            status: response.status,
            retryAfterSeconds:
              Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
          }),
        );
      }
      return yield* HttpClientResponse.schemaBodyJson(schema)(response);
    }).pipe(
      Effect.timeout(REQUEST_TIMEOUT_MS),
      Effect.mapError(toProviderError),
      // Through the egress-guarded fetch from DI, never the global one.
      Effect.provideService(FetchHttpClient.Fetch, (input, init) =>
        this.fetchUrl(String(input), init),
      ),
    );
    return this.effects.run(exchange);
  }
}

const AuthStarted = Schema.Struct({ url: Schema.optional(Schema.NullOr(Schema.String)) });

/** What the bank-sync services expect: auth errors flip the connection to re-auth, the rest say "wait". */
function toProviderError(
  error:
    | EnableBankingRefused
    | HttpClientError.HttpClientError
    | Schema.SchemaError
    | Cause.TimeoutError,
): Error {
  switch (error._tag) {
    case 'EnableBankingRefused':
      if (error.status === 401 || error.status === 403) {
        return new BankSyncAuthError(
          'Enable Banking rejected the application credentials or consent',
        );
      }
      if (error.status === 429 || error.status >= 500) {
        return new BankSyncTemporaryError(
          `Enable Banking answered HTTP ${error.status}`,
          error.retryAfterSeconds,
        );
      }
      return new BadRequestException(
        appError('BANK_SYNC_ENABLEBANKING_HTTP_ERROR', { status: error.status }),
      );
    case 'TimeoutError':
      return new BadGatewayException(appError('BANK_SYNC_ENABLEBANKING_TIMEOUT'));
    case 'SchemaError':
      return new BadGatewayException(appError('BANK_SYNC_ENABLEBANKING_UNREADABLE'));
    case 'HttpClientError':
      return new BadGatewayException(
        error.reason._tag === 'DecodeError'
          ? appError('BANK_SYNC_ENABLEBANKING_UNREADABLE')
          : appError('BANK_SYNC_ENABLEBANKING_UNREACHABLE'),
      );
  }
}
