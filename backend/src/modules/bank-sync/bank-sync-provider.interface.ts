/**
 * A bank-sync provider is an account the user holds with a data aggregator.
 * Lumio never talks to a bank itself and holds no provider contract of its
 * own: the user brings their own provider account, Lumio keeps the credential
 * encrypted and pulls what the aggregator exposes.
 *
 * Providers link in one of two styles, because the free tiers differ:
 *  - `token`: the user pastes a one-time token that becomes a lasting
 *    credential (SimpleFIN Bridge).
 *  - `redirect`: the user holds application credentials and each bank is
 *    authorized in the browser, producing a session per bank (Enable Banking).
 */

export interface BankSyncTransaction {
  /** The aggregator's id, stable only within its account. */
  id: string;
  posted: Date;
  /** Signed: negative is money out. */
  amount: number;
  description: string;
  payee?: string;
  memo?: string;
  pending: boolean;
}

export interface BankSyncAccount {
  id: string;
  name: string;
  /** The institution as the aggregator names it. */
  org: string;
  currency: string;
  balance: number | null;
  balanceDate: Date | null;
  transactions: BankSyncTransaction[];
  /**
   * The link (bank authorization) this account came through, for providers
   * that have one. Accounts sharing a link re-authorize together.
   */
  linkId?: string | null;
  /** When the bank's consent for this account's link runs out, if the provider says. */
  consentExpiresAt?: Date | null;
}

export interface BankSyncFetchOptions {
  /** Transactions posted on or after this instant; omitted means "the provider's default". */
  since?: Date;
  /** Only the account list and balances, no transactions. */
  balancesOnly?: boolean;
}

/** One bank authorization inside a connection. `token` providers have exactly one, implicit. */
export interface BankSyncLink {
  id: string;
  /** The institution as the provider names it, for display and re-auth. */
  institution: string;
  country?: string | null;
  consentExpiresAt?: Date | null;
}

export interface BankSyncInstitution {
  name: string;
  country: string;
  /** Seconds the bank allows a consent to last, when it advertises a ceiling. */
  maxConsentValiditySeconds?: number | null;
  beta?: boolean;
}

/**
 * Everything a provider needs for a pull: the decrypted secrets, the links to
 * walk, and the PSU context. Forwarding the PSU headers is not cosmetic —
 * several banks apply a four-calls-a-day ceiling to requests that do not
 * carry them.
 */
export interface BankSyncContext {
  secrets: Record<string, string>;
  links: BankSyncLink[];
  psu?: { ipAddress?: string; userAgent?: string };
}

interface BankSyncProviderBase {
  readonly key: string;
  /** Pulls the accounts the context can see. */
  fetchAccounts(
    context: BankSyncContext,
    options?: BankSyncFetchOptions,
  ): Promise<BankSyncAccount[]>;
}

/** SimpleFIN style: paste a setup token, get a credential that keeps working. */
export interface TokenBankSyncProvider extends BankSyncProviderBase {
  readonly linkStyle: 'token';
  /** Exchanges the one-time setup token for the secrets later calls use. */
  claim(setupToken: string): Promise<Record<string, string>>;
}

/** Enable Banking style: hold application credentials, authorize each bank in the browser. */
export interface RedirectBankSyncProvider extends BankSyncProviderBase {
  readonly linkStyle: 'redirect';
  /** Rejects application credentials the provider does not accept, before anything is stored. */
  verifyCredentials(secrets: Record<string, string>): Promise<void>;
  /** The banks this provider can offer in a country. */
  listInstitutions(
    secrets: Record<string, string>,
    country: string,
  ): Promise<BankSyncInstitution[]>;
  /** Starts a bank authorization; the user is sent to `url` and comes back with a code. */
  beginLink(
    secrets: Record<string, string>,
    input: {
      institution: string;
      country: string;
      redirectUrl: string;
      state: string;
      maxConsentValiditySeconds?: number | null;
    },
  ): Promise<{ url: string }>;
  /** Turns the callback's code into a link. */
  completeLink(secrets: Record<string, string>, code: string): Promise<BankSyncLink>;
}

export type BankSyncProvider = TokenBankSyncProvider | RedirectBankSyncProvider;

export function isRedirectProvider(
  provider: BankSyncProvider,
): provider is RedirectBankSyncProvider {
  return provider.linkStyle === 'redirect';
}

/** The provider refused the credential: the user has to connect again. */
export class BankSyncAuthError extends Error {
  constructor(message = 'The bank-sync provider rejected the stored credential') {
    super(message);
    this.name = 'BankSyncAuthError';
  }
}

/**
 * The provider answered, but asked us to come back later (its own rate limit,
 * or a connection it is still repairing). Distinct from an auth error: nothing
 * is wrong with the credential, so re-linking would be the wrong advice.
 */
export class BankSyncTemporaryError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'BankSyncTemporaryError';
  }
}

/** The outbound HTTP function the providers use; a DI token so tests can swap it. */
export const BANK_SYNC_FETCH = Symbol('BANK_SYNC_FETCH');
export type BankSyncFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Every provider implementation, injected as a group. */
export const BANK_SYNC_PROVIDERS = Symbol('BANK_SYNC_PROVIDERS');
