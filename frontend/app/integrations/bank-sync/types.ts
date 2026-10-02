export type BankSyncHealth = 'ok' | 'never_synced' | 'stale' | 'incomplete' | 'needs_reauth';

export type BankSyncAccount = {
  id: string;
  name: string;
  org: string;
  currency: string;
  enabled: boolean;
  walletId: string | null;
  linkId: string | null;
  lastSyncAt: string | null;
  balance: number | null;
  balanceDate: string | null;
  consentExpiresAt: string | null;
  syncFrom: string | null;
  health: BankSyncHealth;
  lastError: string | null;
  balanceDrift: number | null;
};

export type BankSyncLink = {
  id: string;
  institution: string;
  country: string | null;
  consentExpiresAt: string | null;
};

export type BankSyncConnection = {
  id: string;
  provider: string;
  linkStyle: 'token' | 'redirect';
  label: string;
  status: 'connected' | 'disconnected' | 'needs_reauth';
  config: {
    label: string;
    autoSync: boolean;
    links: BankSyncLink[];
    accounts: BankSyncAccount[];
    lastSyncAt: string | null;
    lastError: string | null;
  };
};

export type BankSyncProviderInfo = { key: string; linkStyle: 'token' | 'redirect' };

export type BankSyncInstitution = {
  name: string;
  country: string;
  maxConsentValiditySeconds: number | null;
  beta: boolean;
};

export type BankSyncResult = {
  imported: number;
  statements: number;
  accounts: Array<{ id: string; imported: number; skipped: number; error?: string }>;
};

export type WalletOption = { id: string; name: string; currency: string };

export type Message = { tone: 'ok' | 'error'; text: string };

export const BANK_SYNC_BASE = '/integrations/bank-sync';

/** Health states that mean the feed is not delivering, so another provider is worth trying. */
export const UNHEALTHY: readonly BankSyncHealth[] = ['stale', 'incomplete', 'needs_reauth'];

/** Warn this far ahead of a consent running out; a lapse is silent otherwise. */
export const CONSENT_WARNING_DAYS = 14;

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null;
}
