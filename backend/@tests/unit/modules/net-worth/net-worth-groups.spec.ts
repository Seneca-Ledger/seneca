import { type BalanceAccount, BalanceAccountKind, BalanceAccountType } from '@/entities/balance-account.entity';
import { DEBTS_ACCOUNT_CODE } from '@/modules/balance/balance.service';
import { CARD_DEBTS_CODE } from '@/modules/net-worth/computed-lines';
import { buildGroups } from '@/modules/net-worth/net-worth-groups';

const DATES = ['2026-01-01', '2026-01-15', '2026-02-01'];
const TO = DATES[DATES.length - 1];

function account(seed: Partial<BalanceAccount> & Pick<BalanceAccount, 'id' | 'code' | 'name' | 'accountType'>) {
  return {
    parentId: null,
    position: 0,
    nameEn: null,
    nameKk: null,
    accountKind: null,
    ...seed,
  } as BalanceAccount;
}

const CASH = account({ id: 'cash', code: 'ASSET_CASH', name: 'Cash', accountType: BalanceAccountType.ASSET, position: 0 });
const INVESTMENTS = account({ id: 'inv', code: 'ASSET_INVESTMENTS', name: 'Investments', accountType: BalanceAccountType.ASSET, position: 1 });
const FUND = account({ id: 'fund', code: 'ASSET_FUND', name: 'Index Fund', accountType: BalanceAccountType.ASSET, parentId: 'inv', accountKind: BalanceAccountKind.INVESTMENT });
const COINS = account({ id: 'coins', code: 'ASSET_COINS', name: 'Coin Wallet', accountType: BalanceAccountType.ASSET, parentId: 'inv', accountKind: BalanceAccountKind.CRYPTO });
const VEHICLES = account({ id: 'car', code: 'ASSET_VEHICLES', name: 'Vehicles', accountType: BalanceAccountType.ASSET, position: 3 });
const LOANS = account({ id: 'loans', code: 'LIABILITY_LOANS', name: 'Loans', accountType: BalanceAccountType.LIABILITY, position: 5 });
const CARDS = account({ id: 'cards', code: 'LIABILITY_CARDS', name: 'Credit cards', accountType: BalanceAccountType.LIABILITY, position: 4 });
const EQUITY = account({ id: 'eq', code: 'EQUITY_SECTION', name: 'Savings', accountType: BalanceAccountType.EQUITY });

const ACCOUNTS = [CASH, INVESTMENTS, FUND, COINS, VEHICLES, LOANS, CARDS, EQUITY];
const LEAVES = [CASH, FUND, COINS, VEHICLES, LOANS, CARDS, EQUITY];

/** Value of each line on each date, in the order of DATES. */
const VALUES: Record<string, number[]> = {
  cash: [1000, 1100, 1200],
  fund: [500, 0, 550],
  coins: [0, 0, 300],
  car: [0, 0, 0],
  loans: [400, 380, 360],
  cards: [0, 50, 100],
  eq: [9999, 9999, 9999],
};

const valueAt = (id: string, _code: string, date: string) => VALUES[id][DATES.indexOf(date)];

describe('buildGroups', () => {
  const groups = buildGroups(ACCOUNTS, LEAVES, valueAt, DATES, TO);
  const group = (key: string) => groups.find(item => item.key === key);

  it('lists assets first, then debts, and leaves equity and empty groups out', () => {
    expect(groups.map(item => [item.key, item.side])).toEqual([
      ['cash', 'asset'],
      ['investments', 'asset'],
      ['crypto', 'asset'],
      ['credit_cards', 'liability'],
      ['loans', 'liability'],
    ]);
  });

  it('pulls the crypto lines out of their investments section', () => {
    expect(group('investments')?.lines.map(line => line.name)).toEqual([FUND.name]);
    expect(group('crypto')?.amount).toBe(VALUES.coins[2]);
  });

  it('carries the value on every date and the change over the window', () => {
    expect(group('cash')?.series).toEqual(VALUES.cash);
    expect(group('cash')?.changePercent).toBe(20);
    expect(group('loans')?.changePercent).toBe(-10);
  });

  it('gives no percentage when the window starts at zero', () => {
    expect(group('crypto')?.changePercent).toBeNull();
    expect(group('credit_cards')?.changePercent).toBeNull();
  });

  it('splits the debts of the accounts into cards and loans', () => {
    const debts = account({ id: 'debts', code: DEBTS_ACCOUNT_CODE, name: 'Account debts', accountType: BalanceAccountType.LIABILITY, parentId: 'loans' });
    const owed = { total: 900, cards: 250 };
    const at = (id: string, code: string, date: string) =>
      code === CARD_DEBTS_CODE ? owed.cards : id === 'debts' ? owed.total : 0;
    const split = buildGroups([LOANS, debts], [debts], at, DATES, TO);
    expect(split.map(item => [item.key, item.amount])).toEqual([
      ['credit_cards', owed.cards],
      ['loans', owed.total - owed.cards],
    ]);
  });

  it('tells a business chart in the same groups', () => {
    const current = account({ id: 'cur', code: 'ASSET_CURRENT', name: 'II. Current assets', accountType: BalanceAccountType.ASSET });
    const cash = account({ id: 'c', code: 'ASSET_CASH', name: 'Cash', accountType: BalanceAccountType.ASSET, parentId: 'cur' });
    const stock = account({ id: 's', code: 'ASSET_INVENTORY', name: 'Inventory', accountType: BalanceAccountType.ASSET, parentId: 'cur' });
    const nonCurrent = account({ id: 'nc', code: 'ASSET_NON_CURRENT', name: 'I. Non-current assets', accountType: BalanceAccountType.ASSET });
    const held = account({ id: 'h', code: 'ASSET_INVESTMENTS', name: 'Long-term investments', accountType: BalanceAccountType.ASSET, parentId: 'nc' });
    const business = buildGroups([current, cash, stock, nonCurrent, held], [cash, stock, held], () => 10, DATES, TO);
    expect(business.map(item => item.key)).toEqual(['cash', 'investments', 'other_assets']);
  });
});
