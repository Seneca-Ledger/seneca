import {
  BalanceAccountSubType,
  BalanceAccountType,
  BalanceAutoSource,
} from '../../entities/balance-account.entity';
import type { DefaultBalanceAccountDefinition } from './balance-default-accounts';

/**
 * The household chart of accounts.
 *
 * A person does not own "non-current assets"; they own a flat, a car and a
 * pension, and they owe a mortgage and two cards. The sections are the groups
 * the allocation on the net worth page shows, so they have to be the words
 * someone would use about their own money — and they are leaves, so a value
 * can be typed straight into them instead of through a sub-account.
 *
 * `ASSET_CASH` and `ASSET_INVESTMENTS` keep their codes: cash is computed from
 * the wallets either way, and investment accounts are created under that
 * section by code.
 */
export const PERSONAL_BALANCE_ACCOUNTS: DefaultBalanceAccountDefinition[] = [
  {
    code: 'ASSET_CASH',
    name: 'Деньги',
    nameEn: 'Cash',
    nameKk: 'Ақша',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.CASH,
    parentCode: null,
    position: 0,
    isEditable: false,
    isExpandable: true,
    isAutoComputed: true,
    autoSource: BalanceAutoSource.WALLETS_AND_STATEMENTS,
  },
  {
    code: 'ASSET_INVESTMENTS',
    name: 'Инвестиции',
    nameEn: 'Investments',
    nameKk: 'Инвестициялар',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: null,
    position: 1,
    isEditable: false,
    isExpandable: true,
  },
  {
    code: 'ASSET_RETIREMENT',
    name: 'Пенсионные накопления',
    nameEn: 'Retirement',
    nameKk: 'Зейнетақы жинақтары',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: null,
    position: 2,
    isEditable: true,
  },
  {
    code: 'ASSET_REAL_ESTATE',
    name: 'Недвижимость',
    nameEn: 'Real estate',
    nameKk: 'Жылжымайтын мүлік',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: null,
    position: 3,
    isEditable: true,
  },
  {
    code: 'ASSET_VEHICLES',
    name: 'Транспорт',
    nameEn: 'Vehicles',
    nameKk: 'Көлік',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: null,
    position: 4,
    isEditable: true,
  },
  {
    code: 'ASSET_OTHER',
    name: 'Прочее имущество',
    nameEn: 'Other assets',
    nameKk: 'Басқа мүлік',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.CURRENT_ASSET,
    parentCode: null,
    position: 5,
    isEditable: true,
  },
  {
    code: 'LIABILITY_CARDS',
    name: 'Кредитные карты',
    nameEn: 'Credit cards',
    nameKk: 'Несие карталары',
    accountType: BalanceAccountType.LIABILITY,
    subType: BalanceAccountSubType.BORROWED_CAPITAL,
    parentCode: null,
    position: 0,
    isEditable: true,
  },
  {
    code: 'LIABILITY_LOANS',
    name: 'Кредиты',
    nameEn: 'Loans',
    nameKk: 'Несиелер',
    accountType: BalanceAccountType.LIABILITY,
    subType: BalanceAccountSubType.BORROWED_CAPITAL,
    parentCode: null,
    position: 1,
    isEditable: true,
  },
  {
    code: 'LIABILITY_MORTGAGE',
    name: 'Ипотека',
    nameEn: 'Mortgage',
    nameKk: 'Ипотека',
    accountType: BalanceAccountType.LIABILITY,
    subType: BalanceAccountSubType.BORROWED_CAPITAL,
    parentCode: null,
    position: 2,
    isEditable: true,
  },
  {
    code: 'LIABILITY_OTHER',
    name: 'Прочие долги',
    nameEn: 'Other debt',
    nameKk: 'Басқа борыштар',
    accountType: BalanceAccountType.LIABILITY,
    subType: BalanceAccountSubType.BORROWED_CAPITAL,
    parentCode: null,
    position: 3,
    isEditable: true,
  },
  {
    code: 'EQUITY_SECTION',
    name: 'Накопления',
    nameEn: 'Net worth',
    nameKk: 'Жинақтар',
    accountType: BalanceAccountType.EQUITY,
    subType: BalanceAccountSubType.EQUITY,
    parentCode: null,
    position: 4,
    isEditable: false,
  },
  {
    code: 'EQUITY_RETAINED_EARNINGS',
    name: 'Доходы минус расходы',
    nameEn: 'Income less spending',
    nameKk: 'Кірістер мен шығыстар айырмасы',
    accountType: BalanceAccountType.EQUITY,
    subType: BalanceAccountSubType.EQUITY,
    parentCode: 'EQUITY_SECTION',
    position: 0,
    isEditable: false,
    isAutoComputed: true,
    autoSource: BalanceAutoSource.TRANSACTIONS,
  },
];

/**
 * Where each line of the accounting chart lands in the household one. Only
 * cash, investments and equity have a true counterpart; everything else keeps
 * its own name and moves under "other", because nothing in the data says
 * whether "fixed assets" is a flat or a laser cutter.
 */
export const ACCOUNTING_TO_PERSONAL_SECTION: Record<string, string> = {
  ASSET_FIXED: 'ASSET_OTHER',
  ASSET_INTANGIBLE: 'ASSET_OTHER',
  ASSET_INVENTORY: 'ASSET_OTHER',
  ASSET_RECEIVABLES: 'ASSET_OTHER',
};

/**
 * Share capital is a company's idea of where its money came from. A household
 * has none, so an empty one is cleared away — one that somebody did put a
 * number in stays, because the number is theirs.
 */
export const ACCOUNTING_ONLY_LINES = ['EQUITY_AUTHORIZED', 'EQUITY_ADDITIONAL'];

/** Sections of the accounting chart that the household one has no use for. */
export const ACCOUNTING_ONLY_SECTIONS = [
  'ASSET_NON_CURRENT',
  'ASSET_CURRENT',
  'LIABILITY_BORROWED',
];
