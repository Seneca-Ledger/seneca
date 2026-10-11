import type {
  BudgetItem,
  CategoryItem,
  CategoryRef,
  CryptoHolding,
  CryptoSummary,
  WalletItem,
} from '@/app/lib/contracts';

// Wire-format fixtures: outside production every API response is checked
// against its contract, so a mock has to look like what the backend sends.

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function categoryItem(
  overrides: Partial<CategoryItem> & Pick<CategoryItem, 'id' | 'name'>,
): CategoryItem {
  return {
    workspaceId: 'workspace-1',
    userId: null,
    type: 'expense',
    parentId: null,
    isSystem: false,
    source: 'user',
    isEnabled: true,
    color: null,
    icon: null,
    stoicClass: null,
    helpsOthers: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    parent: null,
    children: [],
    ...overrides,
  };
}

/** A category as it is nested in another row (no parent or children). */
export function categoryRef(
  overrides: Partial<CategoryRef> & Pick<CategoryRef, 'id' | 'name'>,
): CategoryRef {
  const { parent: _parent, children: _children, ...category } = categoryItem(overrides);
  return category;
}

export function walletItem(
  overrides: Partial<WalletItem> & Pick<WalletItem, 'id' | 'name'>,
): WalletItem {
  return {
    workspaceId: 'workspace-1',
    userId: 'user-1',
    accountNumber: null,
    bankName: null,
    currency: 'USD',
    initialBalance: '0.00',
    isActive: true,
    ownerMemberId: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function budgetItem(
  overrides: Partial<BudgetItem> & Pick<BudgetItem, 'id' | 'name'>,
): BudgetItem {
  const category = overrides.category ?? categoryRef({ id: 'category-1', name: 'Groceries' });
  return {
    workspaceId: 'workspace-1',
    categoryId: category.id,
    category,
    limitAmount: '100.00',
    currency: 'USD',
    periodType: 'monthly',
    rolloverMode: 'none',
    currentPeriodStart: '2026-01-01',
    startsOn: null,
    endsOn: null,
    goalId: null,
    createdById: 'user-1',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    spentAmount: 0,
    percentUsed: 0,
    availableAmount: 100,
    carriedAmount: 0,
    isActive: true,
    ...overrides,
  };
}

export function cryptoHolding(
  overrides: Partial<CryptoHolding> & Pick<CryptoHolding, 'asset' | 'amount' | 'value'>,
): CryptoHolding {
  return {
    price: 0,
    avgCost: null,
    cost: null,
    unrealized: null,
    unrealizedPercent: null,
    realized: 0,
    basisIncomplete: false,
    ...overrides,
  };
}

export function cryptoSummary(overrides: Partial<CryptoSummary> = {}): CryptoSummary {
  return {
    currency: 'USD',
    portfolioValue: 0,
    income: 0,
    expense: 0,
    walletCount: 1,
    holdings: [],
    unpriced: [],
    cost: null,
    unrealized: null,
    realized: 0,
    portfolioChangeSinceYesterday: null,
    ...overrides,
  };
}
