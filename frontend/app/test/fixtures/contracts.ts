import type { CategoryItem, WalletItem } from '@/app/lib/contracts';

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
