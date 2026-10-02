import type { WorkspaceProfile } from '../../common/utils/workspace-profile.util';
import {
  BalanceAccountSubType,
  BalanceAccountType,
  BalanceAutoSource,
} from '../../entities/balance-account.entity';

type DefaultBalanceAccountDefinition = {
  code: string;
  name: string;
  nameEn: string;
  nameKk: string;
  accountType: BalanceAccountType;
  subType: BalanceAccountSubType;
  parentCode: string | null;
  position: number;
  isEditable?: boolean;
  isAutoComputed?: boolean;
  autoSource?: BalanceAutoSource | null;
  isExpandable?: boolean;
};

/**
 * The accounting chart of accounts: the one a business files with. Sections
 * are Roman-numbered because that is how the form is printed.
 */
export const DEFAULT_BALANCE_ACCOUNTS: DefaultBalanceAccountDefinition[] = [
  {
    code: 'ASSET_NON_CURRENT',
    name: 'I. Внеоборотные активы',
    nameEn: 'I. Non-current assets',
    nameKk: 'I. Айналымнан тыс активтер',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: null,
    position: 0,
    isEditable: false,
  },
  {
    code: 'ASSET_FIXED',
    name: 'Основные средства',
    nameEn: 'Fixed assets',
    nameKk: 'Негізгі құралдар',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: 'ASSET_NON_CURRENT',
    position: 0,
    isEditable: true,
  },
  {
    code: 'ASSET_INTANGIBLE',
    name: 'Нематериальные активы',
    nameEn: 'Intangible assets',
    nameKk: 'Материалдық емес активтер',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: 'ASSET_NON_CURRENT',
    position: 1,
    isEditable: true,
  },
  {
    code: 'ASSET_INVESTMENTS',
    name: 'Инвестиции',
    nameEn: 'Investments',
    nameKk: 'Инвестициялар',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.NON_CURRENT_ASSET,
    parentCode: 'ASSET_NON_CURRENT',
    position: 2,
    isEditable: false,
    isExpandable: true,
  },
  {
    code: 'ASSET_CURRENT',
    name: 'II. Оборотные активы',
    nameEn: 'II. Current assets',
    nameKk: 'II. Айналым активтері',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.CURRENT_ASSET,
    parentCode: null,
    position: 1,
    isEditable: false,
  },
  {
    code: 'ASSET_INVENTORY',
    name: 'Запасы',
    nameEn: 'Inventory',
    nameKk: 'Қорлар',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.CURRENT_ASSET,
    parentCode: 'ASSET_CURRENT',
    position: 0,
    isEditable: true,
  },
  {
    code: 'ASSET_RECEIVABLES',
    name: 'Дебиторская задолженность',
    nameEn: 'Accounts receivable',
    nameKk: 'Дебиторлық берешек',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.CURRENT_ASSET,
    parentCode: 'ASSET_CURRENT',
    position: 1,
    isEditable: false,
    isExpandable: true,
  },
  {
    code: 'ASSET_CASH',
    name: 'III. Деньги',
    nameEn: 'III. Cash',
    nameKk: 'III. Ақша',
    accountType: BalanceAccountType.ASSET,
    subType: BalanceAccountSubType.CASH,
    parentCode: null,
    position: 2,
    isEditable: false,
    isExpandable: true,
    isAutoComputed: true,
    autoSource: BalanceAutoSource.WALLETS_AND_STATEMENTS,
  },
  {
    code: 'EQUITY_SECTION',
    name: 'I. Собственный капитал',
    nameEn: 'I. Equity',
    nameKk: 'I. Меншікті капитал',
    accountType: BalanceAccountType.EQUITY,
    subType: BalanceAccountSubType.EQUITY,
    parentCode: null,
    position: 0,
    isEditable: false,
  },
  {
    code: 'EQUITY_AUTHORIZED',
    name: 'Уставный капитал',
    nameEn: 'Authorized capital',
    nameKk: 'Жарғылық капитал',
    accountType: BalanceAccountType.EQUITY,
    subType: BalanceAccountSubType.EQUITY,
    parentCode: 'EQUITY_SECTION',
    position: 0,
    isEditable: true,
  },
  {
    code: 'EQUITY_ADDITIONAL',
    name: 'Дополнительный капитал',
    nameEn: 'Additional capital',
    nameKk: 'Қосымша капитал',
    accountType: BalanceAccountType.EQUITY,
    subType: BalanceAccountSubType.EQUITY,
    parentCode: 'EQUITY_SECTION',
    position: 1,
    isEditable: true,
  },
  {
    code: 'EQUITY_RETAINED_EARNINGS',
    name: 'Нераспределённая прибыль (непокрытый убыток)',
    nameEn: 'Retained earnings (uncovered loss)',
    nameKk: 'Бөлінбеген пайда (жабылмаған залал)',
    accountType: BalanceAccountType.EQUITY,
    subType: BalanceAccountSubType.EQUITY,
    parentCode: 'EQUITY_SECTION',
    position: 2,
    isEditable: false,
    isAutoComputed: true,
    autoSource: BalanceAutoSource.TRANSACTIONS,
  },
  {
    code: 'LIABILITY_BORROWED',
    name: 'II. Ссудный капитал',
    nameEn: 'II. Borrowed capital',
    nameKk: 'II. Қарыз капиталы',
    accountType: BalanceAccountType.LIABILITY,
    subType: BalanceAccountSubType.BORROWED_CAPITAL,
    parentCode: null,
    position: 1,
    isEditable: false,
    isExpandable: true,
  },
];

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
  EQUITY_AUTHORIZED: 'EQUITY_SECTION',
  EQUITY_ADDITIONAL: 'EQUITY_SECTION',
};

/** Sections of the accounting chart that the household one has no use for. */
export const ACCOUNTING_ONLY_SECTIONS = [
  'ASSET_NON_CURRENT',
  'ASSET_CURRENT',
  'LIABILITY_BORROWED',
];

/** The chart a workspace starts from, by what kind of money it keeps. */
export function defaultAccountsFor(
  profile: WorkspaceProfile,
): readonly DefaultBalanceAccountDefinition[] {
  return profile === 'home' ? PERSONAL_BALANCE_ACCOUNTS : DEFAULT_BALANCE_ACCOUNTS;
}

export type { DefaultBalanceAccountDefinition };
