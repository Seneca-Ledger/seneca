import { createSign } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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

const BASE_URL = 'https://api.enablebanking.com';
const REQUEST_TIMEOUT_MS = 30_000;
/** Most banks default a consent to 90 days; none of them grant more than asked. */
const DEFAULT_CONSENT_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A runaway continuation key must not loop forever. */
const MAX_PAGES = 100;

type EnableBankingTransaction = {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount?: { currency?: string; amount?: string };
  creditor?: { name?: string };
  debtor?: { name?: string };
  credit_debit_indicator?: 'CRDT' | 'DBIT';
  status?: 'BOOK' | 'PDNG';
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  remittance_information?: string[];
};

type EnableBankingAccount = {
  uid: string;
  name?: string;
  currency?: string;
  account_id?: { iban?: string };
  account_servicer?: { name?: string };
};

type EnableBankingSession = {
  session_id?: string;
  accounts?: EnableBankingAccount[];
  aspsp?: { name?: string; country?: string };
  access?: { valid_until?: string };
};

/**
 * SEPA structured remittance prefixes (`EREF+invoice-42`). They address
 * clearing systems, not people, so they are stripped off the front of each
 * line. An allowlist rather than `[A-Z]{3,}\+`, so a merchant that genuinely
 * starts with `BMW+` keeps its name.
 */
const SEPA_PREFIX_RE =
  /^(?:EREF|KREF|MREF|CRED|DBTR|CDTR|SVWZ|SVCL|PURP|RTRN|REJT|REFE|SDVA|INDA|NTAV|ULTC|ULTD|ULTB|ABWA|ABWE|IBAN|BIC|COAM|OAMT|REMI|SQTP|ROC)\+/;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  constructor(@Inject(BANK_SYNC_FETCH) private readonly fetchUrl: BankSyncFetch) {}

  async verifyCredentials(secrets: Record<string, string>): Promise<void> {
    await this.request('GET', '/application', secrets);
  }

  async listInstitutions(
    secrets: Record<string, string>,
    country: string,
  ): Promise<BankSyncInstitution[]> {
    const body = await this.request<{ aspsps?: unknown } | unknown[]>(
      'GET',
      `/aspsps?country=${encodeURIComponent(country.toUpperCase())}`,
      secrets,
    );
    const list = Array.isArray(body)
      ? body
      : Array.isArray((body as { aspsps?: unknown }).aspsps)
        ? ((body as { aspsps: unknown[] }).aspsps as unknown[])
        : [];
    return list
      .map(raw => raw as Record<string, unknown>)
      .filter(raw => typeof raw.name === 'string')
      .map(raw => ({
        name: String(raw.name),
        country: String(raw.country ?? country).toUpperCase(),
        maxConsentValiditySeconds:
          typeof raw.maximum_consent_validity === 'number' ? raw.maximum_consent_validity : null,
        beta: raw.beta === true,
      }));
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
    const body = await this.request<{ url?: string }>('POST', '/auth', secrets, {
      body: {
        aspsp: { name: input.institution, country: input.country.toUpperCase() },
        redirect_url: input.redirectUrl,
        state: input.state,
        access: { valid_until: new Date(Date.now() + consentMs).toISOString() },
        psu_type: 'personal',
      },
    });
    if (!body.url) {
      throw new BadRequestException('Enable Banking did not return an authorization URL');
    }
    return { url: body.url };
  }

  async completeLink(secrets: Record<string, string>, code: string): Promise<BankSyncLink> {
    const session = await this.request<EnableBankingSession>('POST', '/sessions', secrets, {
      body: { code },
    });
    if (!session.session_id) {
      throw new BadRequestException('Enable Banking did not return a session');
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
      const session = await this.request<EnableBankingSession>(
        'GET',
        `/sessions/${encodeURIComponent(link.id)}`,
        context.secrets,
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
    const body = await this.request<{ balances?: Array<Record<string, unknown>> }>(
      'GET',
      `/accounts/${encodeURIComponent(accountUid)}/balances`,
      context.secrets,
      { psu: context.psu },
    );
    const balances = Array.isArray(body.balances) ? body.balances : [];
    // Prefer the closing booked balance; it is the one that matches the rows.
    const chosen =
      balances.find(item => String(item.balance_type ?? '').toUpperCase() === 'CLBD') ??
      balances[0];
    if (!chosen) return { balance: null, balanceDate: null };
    const amount = Number(
      (chosen.balance_amount as { amount?: string } | undefined)?.amount ?? Number.NaN,
    );
    const referenceDate = chosen.reference_date;
    return {
      balance: Number.isFinite(amount) ? amount : null,
      balanceDate: typeof referenceDate === 'string' ? new Date(referenceDate) : null,
    };
  }

  private async transactionsOf(
    accountUid: string,
    context: BankSyncContext,
    since?: Date,
  ): Promise<BankSyncTransaction[]> {
    const from = (since ?? new Date(Date.now() - 90 * DAY_MS)).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const raw: EnableBankingTransaction[] = [];
    let continuationKey: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ date_from: from, date_to: to });
      if (continuationKey) query.set('continuation_key', continuationKey);
      const body = await this.request<{
        transactions?: EnableBankingTransaction[];
        continuation_key?: string;
      }>(
        'GET',
        `/accounts/${encodeURIComponent(accountUid)}/transactions?${query.toString()}`,
        context.secrets,
        { psu: context.psu },
      );
      const next = body.continuation_key;
      // Some banks echo the key they were given. Stopping before taking the page
      // matters: taking it first duplicates every row on the page.
      if (next && next === continuationKey) break;
      raw.push(...(body.transactions ?? []));
      if (!next) break;
      continuationKey = next;
    }

    return raw.map(normalizeTransaction).filter((row): row is BankSyncTransaction => row !== null);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    secrets: Record<string, string>,
    options: { body?: unknown; psu?: { ipAddress?: string; userAgent?: string } } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${signJwt(secrets)}`,
      'content-type': 'application/json',
      accept: 'application/json',
    };
    // Either every PSU header or none, otherwise the API refuses the call. They
    // are what marks the user as present: without them several banks apply a
    // four-calls-a-day ceiling meant for background jobs.
    if (options.psu?.ipAddress && options.psu.userAgent) {
      headers['psu-ip-address'] = options.psu.ipAddress;
      headers['psu-user-agent'] = options.psu.userAgent;
    }
    const response = await this.fetchUrl(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) {
      throw new BankSyncAuthError('Enable Banking rejected the application credentials or consent');
    }
    if (response.status === 429 || response.status >= 500) {
      throw new BankSyncTemporaryError(`Enable Banking answered HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new BadRequestException(
        `Enable Banking answered HTTP ${response.status}: ${await errorTextOf(response)}`,
      );
    }
    return (await response.json()) as T;
  }
}

/** The JWT every call carries: RS256 over the application's own key. */
export function signJwt(secrets: Record<string, string>, now = Date.now()): string {
  const applicationId = secrets.applicationId;
  const privateKey = secrets.privateKey;
  if (!(applicationId && privateKey)) {
    throw new BadRequestException(
      'Enable Banking needs the application id and the private key of its registered certificate',
    );
  }
  const issued = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: applicationId }));
  const payload = base64url(
    JSON.stringify({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: issued,
      exp: issued + 3600,
    }),
  );
  let signature: Buffer;
  try {
    signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey);
  } catch {
    throw new BadRequestException('That private key is not a usable RSA key');
  }
  return `${header}.${payload}.${base64url(signature)}`;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

async function errorTextOf(response: Response): Promise<string> {
  try {
    return JSON.stringify(await response.json()).slice(0, 300);
  } catch {
    return (await response.text().catch(() => '')).slice(0, 300) || 'no body';
  }
}

function stripSepaPrefix(line: string): string {
  return line.replace(SEPA_PREFIX_RE, '').trim();
}

/**
 * Maps one ISO 20022 entry onto a provider row.
 *
 * The payee is whichever party is not the account holder, which is why the
 * credit/debit indicator decides: reading `creditor` for a card payment that
 * has none would label the row with the account holder's own name.
 */
export function normalizeTransaction(raw: EnableBankingTransaction): BankSyncTransaction | null {
  const id = raw.entry_reference || raw.transaction_id;
  const posted = raw.booking_date || raw.value_date || raw.transaction_date;
  const rawAmount = (raw.transaction_amount?.amount ?? '').trim();
  // A row with no date or a non-numeric amount cannot be imported, and must not
  // take the rest of the account down with it.
  if (!id || !posted || !ISO_DATE_RE.test(posted) || rawAmount === '') return null;
  const magnitude = Number(rawAmount.replace(/^[+-]/, ''));
  if (!Number.isFinite(magnitude)) return null;

  const lines = (raw.remittance_information ?? []).map(stripSepaPrefix).filter(Boolean);
  let payee = '';
  if (raw.credit_debit_indicator === 'CRDT' && raw.debtor?.name) payee = raw.debtor.name;
  else if (raw.credit_debit_indicator === 'DBIT' && raw.creditor?.name) payee = raw.creditor.name;
  else payee = raw.creditor?.name || raw.debtor?.name || lines[0] || '';

  const signed =
    raw.credit_debit_indicator === 'DBIT'
      ? -magnitude
      : raw.credit_debit_indicator === 'CRDT'
        ? magnitude
        : Number(rawAmount);

  const description = lines.join(' ') || payee;
  return {
    id,
    posted: new Date(`${posted}T00:00:00.000Z`),
    amount: signed,
    description,
    payee: payee || undefined,
    memo: description !== payee ? description : undefined,
    // A bank that does not say treats everything as booked; the booked/pending
    // split is the bank's, not ours to guess.
    pending: raw.status === 'PDNG',
  };
}
