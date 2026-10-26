import type { BankSyncAccount, BankSyncLink } from './bank-sync-provider.interface';

/**
 * How a feed is doing. `stale` and `incomplete` exist because the loudest
 * complaint about every bank-sync product is not the outage, it is the outage
 * that looks fine: a provider can answer 200 for weeks while repairing a
 * connection, and a green dot over missing data is worse than an error.
 */
export type BankSyncHealth = 'ok' | 'never_synced' | 'stale' | 'incomplete' | 'needs_reauth';

export interface BankSyncAccountSetting {
  /** The provider's account id. */
  id: string;
  name: string;
  org: string;
  currency: string;
  /** Off: listed but never pulled. Accounts found after linking start off. */
  enabled: boolean;
  /** The wallet this feed lands in. One wallet takes at most one feed. */
  walletId: string | null;
  /** The link (bank authorization) this account arrived through; null for token providers. */
  linkId: string | null;
  lastSyncAt: string | null;
  balance: number | null;
  balanceDate: string | null;
  consentExpiresAt: string | null;
  /**
   * Never import a row posted before this date. Set when a wallet's feed moves
   * to another provider: the new provider replays its whole history, and
   * everything up to the wallet's last known row is already here.
   */
  syncFrom: string | null;
  health: BankSyncHealth;
  lastError: string | null;
  /** Set when the provider's balance moved further than the rows that arrived explain. */
  balanceDrift: number | null;
  /**
   * When that gap was first seen. A single pull's gap is usually a pending row
   * the provider counts in the balance but will not list yet; a gap still
   * there on the next pull is a row that never arrived.
   */
  driftSince: string | null;
}

export interface BankSyncLinkSetting {
  id: string;
  institution: string;
  country: string | null;
  consentExpiresAt: string | null;
}

export interface BankSyncConnectionConfig {
  provider: string;
  /** What the user calls this connection; several connections per provider are normal. */
  label: string;
  autoSync: boolean;
  links: BankSyncLinkSetting[];
  accounts: BankSyncAccountSetting[];
  lastSyncAt: string | null;
  lastError: string | null;
  /** The state of an authorization the user has started but not finished. */
  pendingLink: { state: string; institution: string; country: string } | null;
}

export const DEFAULT_CONNECTION_CONFIG: BankSyncConnectionConfig = {
  provider: '',
  label: '',
  autoSync: true,
  links: [],
  accounts: [],
  lastSyncAt: null,
  lastError: null,
  pendingLink: null,
};

/** A config read back from jsonb: every field defaulted, nothing trusted. */
export function normalizeConfig(raw: unknown, provider: string): BankSyncConnectionConfig {
  const value = (raw ?? {}) as Partial<BankSyncConnectionConfig>;
  return {
    ...DEFAULT_CONNECTION_CONFIG,
    provider: value.provider || provider,
    label: typeof value.label === 'string' ? value.label : '',
    autoSync: value.autoSync ?? true,
    links: Array.isArray(value.links) ? value.links.map(normalizeLink) : [],
    accounts: Array.isArray(value.accounts) ? value.accounts.map(normalizeAccount) : [],
    lastSyncAt: value.lastSyncAt ?? null,
    lastError: value.lastError ?? null,
    pendingLink: value.pendingLink ?? null,
  };
}

function normalizeLink(raw: Partial<BankSyncLinkSetting>): BankSyncLinkSetting {
  return {
    id: String(raw.id ?? ''),
    institution: raw.institution ?? '',
    country: raw.country ?? null,
    consentExpiresAt: raw.consentExpiresAt ?? null,
  };
}

function normalizeAccount(raw: Partial<BankSyncAccountSetting>): BankSyncAccountSetting {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    org: raw.org ?? '',
    currency: raw.currency ?? '',
    enabled: raw.enabled ?? false,
    walletId: raw.walletId ?? null,
    linkId: raw.linkId ?? null,
    lastSyncAt: raw.lastSyncAt ?? null,
    balance: raw.balance ?? null,
    balanceDate: raw.balanceDate ?? null,
    consentExpiresAt: raw.consentExpiresAt ?? null,
    syncFrom: raw.syncFrom ?? null,
    health: raw.health ?? 'never_synced',
    lastError: raw.lastError ?? null,
    balanceDrift: raw.balanceDrift ?? null,
    driftSince: raw.driftSince ?? null,
  };
}

/** Carries a pulled account into settings, keeping whatever the user had chosen. */
export function accountSettingOf(
  account: BankSyncAccount,
  previous: BankSyncAccountSetting | undefined,
  enabledWhenNew: boolean,
): BankSyncAccountSetting {
  return {
    ...normalizeAccount(previous ?? {}),
    id: account.id,
    name: account.name,
    org: account.org,
    currency: account.currency,
    enabled: previous?.enabled ?? enabledWhenNew,
    linkId: account.linkId ?? previous?.linkId ?? null,
    balance: account.balance,
    balanceDate: account.balanceDate?.toISOString() ?? null,
    consentExpiresAt: account.consentExpiresAt?.toISOString() ?? previous?.consentExpiresAt ?? null,
  };
}

export function linkSettingOf(link: BankSyncLink): BankSyncLinkSetting {
  return {
    id: link.id,
    institution: link.institution,
    country: link.country ?? null,
    consentExpiresAt: link.consentExpiresAt?.toISOString() ?? null,
  };
}

export function linksOf(config: BankSyncConnectionConfig): BankSyncLink[] {
  return config.links.map(link => ({
    id: link.id,
    institution: link.institution,
    country: link.country,
    consentExpiresAt: link.consentExpiresAt ? new Date(link.consentExpiresAt) : null,
  }));
}
