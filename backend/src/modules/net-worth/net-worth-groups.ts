import type { NetWorthBreakdownItem, NetWorthGroup, NetWorthGroupKey } from '../../contracts';
import { type BalanceAccount, BalanceAccountKind, BalanceAccountType } from '../../entities';
import { CASH_ACCOUNT_CODE, DEBTS_ACCOUNT_CODE } from '../balance/balance.service';
import { balanceAccountName } from '../balance/balance-account-name';
import { CARD_DEBTS_CODE } from './computed-lines';
import { round2 } from './net-worth-math';

type ValueAt = (accountId: string, code: string, date: string) => number;

export function findRoot(
  account: BalanceAccount,
  byId: Map<string, BalanceAccount>,
): BalanceAccount {
  let current = account;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) {
      break;
    }
    current = parent;
  }
  return current;
}

/** Asset totals grouped under the top-level section each leaf belongs to. */
export function buildBreakdown(
  accounts: BalanceAccount[],
  leaves: BalanceAccount[],
  valueAt: ValueAt,
  date: string,
  assetsTotal: number,
  locale?: string,
): NetWorthBreakdownItem[] {
  const byId = new Map(accounts.map(account => [account.id, account]));
  const totals = new Map<string, number>();

  for (const leaf of leaves) {
    if (leaf.accountType !== BalanceAccountType.ASSET) continue;
    const root = findRoot(leaf, byId);
    totals.set(root.id, (totals.get(root.id) ?? 0) + valueAt(leaf.id, leaf.code, date));
  }

  const sections = [...totals.entries()]
    .map(([accountId, amount]) => ({
      account: byId.get(accountId) as BalanceAccount,
      amount: round2(amount),
    }))
    .filter(section => section.amount !== 0)
    .sort((a, b) => b.amount - a.amount || a.account.position - b.account.position);

  return sections.map(section => ({
    code: section.account.code,
    name: balanceAccountName(section.account, locale),
    amount: section.amount,
    percent: assetsTotal > 0 ? round2((section.amount / assetsTotal) * 100) : 0,
  }));
}

/** Display order, and which side each group sits on. */
const GROUP_ORDER: readonly NetWorthGroupKey[] = [
  'cash',
  'investments',
  'crypto',
  'retirement',
  'real_estate',
  'vehicles',
  'other_assets',
  'credit_cards',
  'loans',
  'mortgage',
  'other_liabilities',
];
const LIABILITY_GROUPS = new Set<NetWorthGroupKey>(
  GROUP_ORDER.slice(GROUP_ORDER.indexOf('credit_cards')),
);

/** Sections of either chart of accounts that name a group outright. */
const GROUP_BY_SECTION: Record<string, NetWorthGroupKey> = {
  ASSET_INVESTMENTS: 'investments',
  ASSET_RETIREMENT: 'retirement',
  ASSET_REAL_ESTATE: 'real_estate',
  ASSET_VEHICLES: 'vehicles',
  LIABILITY_CARDS: 'credit_cards',
  LIABILITY_LOANS: 'loans',
  LIABILITY_BORROWED: 'loans',
  LIABILITY_MORTGAGE: 'mortgage',
};

const GROUP_BY_KIND: Record<BalanceAccountKind, NetWorthGroupKey> = {
  [BalanceAccountKind.INVESTMENT]: 'investments',
  [BalanceAccountKind.METALS]: 'investments',
  [BalanceAccountKind.RETIREMENT]: 'retirement',
  [BalanceAccountKind.CRYPTO]: 'crypto',
};

interface Part {
  key: NetWorthGroupKey;
  id: string;
  code: string;
  name: string;
  at: (date: string) => number;
}

/**
 * What one leaf contributes, and to which group. The debts of the accounts
 * are one sheet line, split here into what is owed on cards and on loans.
 */
function partsOf(
  leaf: BalanceAccount,
  root: BalanceAccount,
  valueAt: ValueAt,
  locale?: string,
): Part[] {
  const name = balanceAccountName(leaf, locale);
  const own = (date: string) => valueAt(leaf.id, leaf.code, date);
  if (leaf.code === DEBTS_ACCOUNT_CODE) {
    const cards = (date: string) => valueAt(leaf.id, CARD_DEBTS_CODE, date);
    return [
      { key: 'credit_cards', id: `${leaf.id}:cards`, code: leaf.code, name, at: cards },
      { key: 'loans', id: leaf.id, code: leaf.code, name, at: date => own(date) - cards(date) },
    ];
  }
  const isLiability = leaf.accountType === BalanceAccountType.LIABILITY;
  const key =
    (leaf.accountKind && GROUP_BY_KIND[leaf.accountKind]) ||
    (leaf.code === CASH_ACCOUNT_CODE ? 'cash' : undefined) ||
    GROUP_BY_SECTION[root.code] ||
    GROUP_BY_SECTION[leaf.code] ||
    (isLiability ? 'other_liabilities' : 'other_assets');
  return [{ key, id: leaf.id, code: leaf.code, name, at: own }];
}

/**
 * Assets, then debts, in fixed groups whichever chart of accounts the
 * workspace keeps, each with its value on every date of the charted series.
 * A group with nothing in it over the whole window is left out.
 */
export function buildGroups(
  accounts: BalanceAccount[],
  leaves: BalanceAccount[],
  valueAt: ValueAt,
  dates: string[],
  to: string,
  locale?: string,
): NetWorthGroup[] {
  const byId = new Map(accounts.map(account => [account.id, account]));
  const parts = leaves
    .filter(leaf => leaf.accountType !== BalanceAccountType.EQUITY)
    .flatMap(leaf => partsOf(leaf, findRoot(leaf, byId), valueAt, locale));

  return GROUP_ORDER.map(key => {
    const inGroup = parts.filter(part => part.key === key);
    const series = dates.map(date => round2(inGroup.reduce((sum, part) => sum + part.at(date), 0)));
    const lines = inGroup
      .map(part => ({ id: part.id, code: part.code, name: part.name, amount: round2(part.at(to)) }))
      .filter(line => line.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
    const amount = round2(lines.reduce((sum, line) => sum + line.amount, 0));
    const first = series[0] ?? 0;
    return {
      key,
      side: LIABILITY_GROUPS.has(key) ? 'liability' : 'asset',
      amount,
      // Same rule as the total: no percentage of zero or of a negative start.
      changePercent: first > 0 ? round2(((amount - first) / first) * 100) : null,
      series,
      lines,
    } satisfies NetWorthGroup;
  }).filter(group => group.amount !== 0 || group.series.some(value => value !== 0));
}
