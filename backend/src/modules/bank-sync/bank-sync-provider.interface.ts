/**
 * A bank-sync provider is an account the user holds with a data aggregator
 * (SimpleFIN Bridge today). Seneca never talks to a bank itself: it exchanges
 * the one-time setup token the user pastes for a long-lived credential, keeps
 * that credential encrypted, and pulls what the aggregator exposes.
 */
export interface BankSyncTransaction {
  /** The aggregator's stable id; becomes the row's document number, so a re-pull is not a re-import. */
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
}

export interface BankSyncFetchOptions {
  /** Transactions posted on or after this instant; omitted means "whatever the provider returns by default". */
  since?: Date;
  /** Only the account list and balances, no transactions. */
  balancesOnly?: boolean;
}

export interface BankSyncProvider {
  readonly key: string;
  /** Exchanges a one-time setup token for the credential later calls use. */
  claim(setupToken: string): Promise<string>;
  /** The accounts the credential can see, with transactions unless `balancesOnly`. */
  fetchAccounts(credential: string, options?: BankSyncFetchOptions): Promise<BankSyncAccount[]>;
}

/** The provider refused the credential: the user has to connect again. */
export class BankSyncAuthError extends Error {
  constructor(message = 'The bank-sync provider rejected the stored credential') {
    super(message);
    this.name = 'BankSyncAuthError';
  }
}

/** The outbound HTTP function the providers use; a DI token so tests can swap it. */
export const BANK_SYNC_FETCH = Symbol('BANK_SYNC_FETCH');
export type BankSyncFetch = (url: string, init?: RequestInit) => Promise<Response>;
