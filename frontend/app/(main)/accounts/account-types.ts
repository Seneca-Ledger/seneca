import {
  Banknote,
  CreditCard,
  Landmark,
  Lock,
  type LucideIcon,
  Percent,
  PiggyBank,
  TrendingUp,
} from '@/app/components/icons';
import type { WalletItem, WalletType } from '@/app/lib/contracts';

/** How the Accounts page is split: by what the money is for, debts last. */
export type AccountGroup = 'everyday' | 'savings' | 'investments' | 'debts';

export const ACCOUNT_GROUPS: AccountGroup[] = ['everyday', 'savings', 'investments', 'debts'];

/** Every type in the order the form offers them. */
export const ACCOUNT_TYPES: Array<{ type: WalletType; group: AccountGroup; icon: LucideIcon }> = [
  { type: 'checking', group: 'everyday', icon: Landmark },
  { type: 'cash', group: 'everyday', icon: Banknote },
  { type: 'savings', group: 'savings', icon: PiggyBank },
  { type: 'deposit', group: 'savings', icon: Lock },
  { type: 'brokerage', group: 'investments', icon: TrendingUp },
  { type: 'credit_card', group: 'debts', icon: CreditCard },
  { type: 'loan', group: 'debts', icon: Percent },
];

const BY_TYPE = new Map(ACCOUNT_TYPES.map(entry => [entry.type, entry]));

export const accountGroupOf = (type: WalletType): AccountGroup =>
  BY_TYPE.get(type)?.group ?? 'everyday';

export const accountIconOf = (type: WalletType): LucideIcon => BY_TYPE.get(type)?.icon ?? Landmark;

/** A debt's balance is what is owed, kept below zero; it is shown as a positive "owed". */
export const isDebtType = (type: WalletType): boolean => accountGroupOf(type) === 'debts';

/** "••0001": the end of an account number is enough to recognise it. */
export function maskedAccountNumber(accountNumber: string | null): string | null {
  const compact = (accountNumber ?? '').replace(/\s+/g, '');
  if (!compact) {
    return null;
  }
  return compact.length > 4 ? `••${compact.slice(-4)}` : compact;
}

/** Parsers name a few banks; everything else is "other", which says nothing. */
const BANK_LABELS: Record<string, string> = {
  kaspi: 'Kaspi',
  bereke_new: 'Bereke',
  bereke_old: 'Bereke',
  hapoalim: 'Hapoalim',
  absa: 'Absa Bank',
  ally: 'Ally Bank',
  anz: 'ANZ',
  associated: 'Associated Bank',
  atb: 'ATB Financial',
  axis: 'Axis Bank',
  banco_do_brasil: 'Banco do Brasil',
  bank_of_china: 'Bank of China (Hong Kong)',
  bank_of_scotland: 'Bank of Scotland',
  barclays: 'Barclays',
};

export const statementBankLabel = (bankName: string): string | null =>
  BANK_LABELS[bankName] ?? null;

/** The muted line under an account's name: "ACME Bank · ••0001". */
export function accountSubtitle(account: Pick<WalletItem, 'bankName' | 'accountNumber'>): string {
  return [account.bankName, maskedAccountNumber(account.accountNumber)].filter(Boolean).join(' · ');
}
