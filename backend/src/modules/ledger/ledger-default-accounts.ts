import { LedgerAccountType } from '../../entities/ledger-account.entity';

/** Codes the posting rules refer to. System accounts cannot be deleted or re-coded. */
export const LEDGER_ACCOUNT_CODES = {
  ASSETS: 'ASSETS',
  CASH: 'ASSET_CASH',
  CASH_UNALLOCATED: 'ASSET_CASH_UNALLOCATED',
  VAT_RECEIVABLE: 'ASSET_VAT_RECEIVABLE',
  RECEIVABLES: 'ASSET_RECEIVABLES',
  SUSPENSE: 'ASSET_SUSPENSE',
  CRYPTO: 'ASSET_CRYPTO',
  LIABILITIES: 'LIABILITIES',
  VAT_PAYABLE: 'LIABILITY_VAT_PAYABLE',
  PAYABLES: 'LIABILITY_PAYABLES',
  EQUITY: 'EQUITY',
  OPENING_BALANCE: 'EQUITY_OPENING_BALANCE',
  RETAINED_EARNINGS: 'EQUITY_RETAINED_EARNINGS',
  INCOME: 'INCOME',
  FX_GAIN: 'INCOME_FX_GAIN',
  SALES_REVENUE: 'INCOME_SALES_REVENUE',
  EXPENSES: 'EXPENSES',
  FX_LOSS: 'EXPENSE_FX_LOSS',
} as const;

type DefaultLedgerAccountDefinition = {
  code: string;
  /** English; the UI localises system accounts by code. */
  name: string;
  accountType: LedgerAccountType;
  parentCode: string | null;
  position: number;
  isPostable: boolean;
};

const C = LEDGER_ACCOUNT_CODES;

/** Parents precede their children, so the seed can resolve `parentCode` in one pass. */
export const DEFAULT_LEDGER_ACCOUNTS: DefaultLedgerAccountDefinition[] = [
  {
    code: C.ASSETS,
    name: 'Assets',
    accountType: LedgerAccountType.ASSET,
    parentCode: null,
    position: 0,
    isPostable: false,
  },
  // Parent of the per-statement cash accounts the posting engine opens.
  {
    code: C.CASH,
    name: 'Cash and bank',
    accountType: LedgerAccountType.ASSET,
    parentCode: C.ASSETS,
    position: 0,
    isPostable: false,
  },
  {
    code: C.CASH_UNALLOCATED,
    name: 'Cash, account unknown',
    accountType: LedgerAccountType.ASSET,
    parentCode: C.CASH,
    position: 0,
    isPostable: true,
  },
  {
    code: C.VAT_RECEIVABLE,
    name: 'VAT receivable',
    accountType: LedgerAccountType.ASSET,
    parentCode: C.ASSETS,
    position: 1,
    isPostable: true,
  },
  {
    code: C.RECEIVABLES,
    name: 'Accounts receivable',
    accountType: LedgerAccountType.ASSET,
    parentCode: C.ASSETS,
    position: 2,
    isPostable: true,
  },
  {
    code: C.SUSPENSE,
    name: 'Suspense (uncategorised)',
    accountType: LedgerAccountType.ASSET,
    parentCode: C.ASSETS,
    position: 3,
    isPostable: true,
  },
  // Parent of the per-wallet crypto accounts the posting engine opens.
  {
    code: C.CRYPTO,
    name: 'Crypto assets',
    accountType: LedgerAccountType.ASSET,
    parentCode: C.ASSETS,
    position: 4,
    isPostable: false,
  },

  {
    code: C.LIABILITIES,
    name: 'Liabilities',
    accountType: LedgerAccountType.LIABILITY,
    parentCode: null,
    position: 1,
    isPostable: false,
  },
  {
    code: C.VAT_PAYABLE,
    name: 'VAT payable',
    accountType: LedgerAccountType.LIABILITY,
    parentCode: C.LIABILITIES,
    position: 0,
    isPostable: true,
  },
  {
    code: C.PAYABLES,
    name: 'Accounts payable',
    accountType: LedgerAccountType.LIABILITY,
    parentCode: C.LIABILITIES,
    position: 1,
    isPostable: true,
  },

  {
    code: C.EQUITY,
    name: 'Equity',
    accountType: LedgerAccountType.EQUITY,
    parentCode: null,
    position: 2,
    isPostable: false,
  },
  {
    code: C.OPENING_BALANCE,
    name: 'Opening balances',
    accountType: LedgerAccountType.EQUITY,
    parentCode: C.EQUITY,
    position: 0,
    isPostable: true,
  },
  {
    code: C.RETAINED_EARNINGS,
    name: 'Retained earnings',
    accountType: LedgerAccountType.EQUITY,
    parentCode: C.EQUITY,
    position: 1,
    isPostable: true,
  },

  // Category accounts (INCOME_<id> / EXPENSE_<id>) are added under these two.
  {
    code: C.INCOME,
    name: 'Income',
    accountType: LedgerAccountType.INCOME,
    parentCode: null,
    position: 3,
    isPostable: false,
  },
  {
    code: C.FX_GAIN,
    name: 'Foreign exchange gains',
    accountType: LedgerAccountType.INCOME,
    parentCode: C.INCOME,
    position: 0,
    isPostable: true,
  },
  // Fallback for invoice line items with no category of their own.
  {
    code: C.SALES_REVENUE,
    name: 'Sales revenue',
    accountType: LedgerAccountType.INCOME,
    parentCode: C.INCOME,
    position: 1,
    isPostable: true,
  },
  {
    code: C.EXPENSES,
    name: 'Expenses',
    accountType: LedgerAccountType.EXPENSE,
    parentCode: null,
    position: 4,
    isPostable: false,
  },
  {
    code: C.FX_LOSS,
    name: 'Foreign exchange losses',
    accountType: LedgerAccountType.EXPENSE,
    parentCode: C.EXPENSES,
    position: 0,
    isPostable: true,
  },
];

/**
 * Code of the account a root category books to. Derived from the category id
 * rather than numbered, so two requests seeding the same category at once
 * collide on the unique code instead of creating two accounts.
 */
export function categoryAccountCode(type: 'income' | 'expense', categoryId: string): string {
  const prefix = type === 'income' ? 'INCOME' : 'EXPENSE';
  return `${prefix}_${categoryId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export type { DefaultLedgerAccountDefinition };
