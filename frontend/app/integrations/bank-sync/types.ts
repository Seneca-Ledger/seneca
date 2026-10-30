import type { ContractType } from '@/app/lib/query-fn-schema';

export type BankSyncHealth = ContractType<'BankSyncHealth'>;
export type BankSyncConnection = ContractType<'BankSyncConnection'>;
export type BankSyncAccount = BankSyncConnection['config']['accounts'][number];
export type BankSyncProviderInfo = ContractType<'BankSyncProviderList'>[number];
export type BankSyncInstitution = ContractType<'BankSyncInstitutionList'>[number];
export type WalletOption = { id: string; name: string; currency: string };

/** One wallet's feed: the provider account behind it. */
export type FeedRef = { connectionId: string; accountId: string; walletId: string };

/** Runs one action and shows what came of it. */
export type RunAction = (
  key: string,
  action: () => Promise<Message | null>,
  failure: string,
) => Promise<void>;

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
