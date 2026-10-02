import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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

type SimpleFinTransaction = {
  id?: string;
  posted?: number | string;
  transacted_at?: number | string;
  amount?: number | string;
  description?: string;
  payee?: string;
  memo?: string;
  pending?: boolean;
};

type SimpleFinAccount = {
  id?: string;
  name?: string;
  currency?: string;
  balance?: number | string;
  'balance-date'?: number | string;
  org?: { name?: string; domain?: string; id?: string } | string;
  transactions?: SimpleFinTransaction[];
};

type SimpleFinResponse = {
  errors?: string[];
  accounts?: SimpleFinAccount[];
};

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

  constructor(@Inject(BANK_SYNC_FETCH) private readonly fetchUrl: BankSyncFetch) {}

  async claim(setupToken: string): Promise<Record<string, string>> {
    const claimUrl = decodeSetupToken(setupToken);
    const response = await this.fetchUrl(claimUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 403 || response.status === 404) {
      throw new BadRequestException(
        'SimpleFIN did not accept the setup token: it may have been used already (a token works once)',
      );
    }
    if (!response.ok) {
      throw new BadRequestException(`SimpleFIN claim failed with HTTP ${response.status}`);
    }
    const accessUrl = (await response.text()).trim();
    parseAccessUrl(accessUrl);
    return { accessUrl };
  }

  async fetchAccounts(
    context: BankSyncContext,
    options: BankSyncFetchOptions = {},
  ): Promise<BankSyncAccount[]> {
    const { url, authorization } = parseAccessUrl(context.secrets.accessUrl);
    const target = new URL(`${url.pathname.replace(/\/$/, '')}/accounts`, url);
    if (options.since) {
      target.searchParams.set('start-date', String(Math.floor(options.since.getTime() / 1000)));
    }
    if (options.balancesOnly) {
      target.searchParams.set('balances-only', '1');
    } else {
      target.searchParams.set('pending', '1');
    }
    const response = await this.fetchUrl(target.toString(), {
      method: 'GET',
      headers: { authorization, accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) {
      throw new BankSyncAuthError();
    }
    if (response.status === 429 || response.status >= 500) {
      throw new BankSyncTemporaryError(`SimpleFIN answered HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new BadRequestException(`SimpleFIN answered HTTP ${response.status}`);
    }
    const body = (await response.json()) as SimpleFinResponse;
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const errors = Array.isArray(body.errors) ? body.errors : [];
    if (accounts.length === 0 && errors.length > 0) {
      // "We are upgrading this connection" can sit here for weeks. It is not an
      // auth problem, so it must not read as one.
      if (errors.some(isTemporaryError)) {
        throw new BankSyncTemporaryError(`SimpleFIN: ${errors.join('; ')}`);
      }
      throw new BadRequestException(`SimpleFIN: ${errors.join('; ')}`);
    }
    return accounts.map(mapAccount).filter((account): account is BankSyncAccount => !!account);
  }
}

/** Errors SimpleFIN clears by itself; re-linking would be the wrong advice. */
function isTemporaryError(message: string): boolean {
  return /upgrad|try again|temporar|in progress|please wait/i.test(message);
}

/** A setup token is the base64 of the claim URL; anything else is a paste error, not a bug. */
export function decodeSetupToken(setupToken: string): string {
  const compact = setupToken.replace(/\s+/g, '');
  if (!compact) throw new BadRequestException('Setup token is empty');
  const decoded = Buffer.from(compact, 'base64').toString('utf8');
  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    throw new BadRequestException('Setup token is not a SimpleFIN token');
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException('SimpleFIN claim URL must use https');
  }
  return url.toString();
}

/** The access URL with its credentials moved into an Authorization header. */
export function parseAccessUrl(accessUrl: string): { url: URL; authorization: string } {
  let url: URL;
  try {
    url = new URL(accessUrl);
  } catch {
    throw new BadRequestException('SimpleFIN returned an access URL that is not a URL');
  }
  if (url.protocol !== 'https:' || !url.username) {
    throw new BadRequestException('SimpleFIN access URL must be https with credentials');
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

function epochToDate(value: number | string | undefined): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAccount(raw: SimpleFinAccount): BankSyncAccount | null {
  if (!raw.id) return null;
  const org = typeof raw.org === 'string' ? raw.org : raw.org?.name || raw.org?.domain || '';
  const transactions = (Array.isArray(raw.transactions) ? raw.transactions : [])
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

function mapTransaction(raw: SimpleFinTransaction): BankSyncTransaction | null {
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
