import type {
  AuthUser,
  BudgetItem,
  CategoryItem,
  CategoryRef,
  CryptoHolding,
  CryptoSummary,
  CurrentUser,
  Insight,
  Payable,
  ReceiptRecord,
  StorageFileDetails,
  StorageTag,
  SubscriptionItem,
  TaxJurisdictionItem,
  TransactionListItem,
  WalletItem,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceSummary,
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
    taxRelevant: false,
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
    unconvertedSpending: [],
    beforeStartSpending: [],
    subscriptionReserve: { amount: 0, items: [] },
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

/** A `GET /subscriptions` row as the API sends it (money as decimal strings). */
export function subscriptionRow(
  overrides: Partial<SubscriptionItem> & Pick<SubscriptionItem, 'id' | 'vendorName'>,
): SubscriptionItem {
  return {
    workspaceId: 'workspace-1',
    vendorRaw: null,
    vendorDomain: null,
    amount: '10.00',
    currency: 'USD',
    frequency: 'monthly',
    status: 'active',
    ownerId: null,
    reviewAt: null,
    reviewStatus: 'current',
    riskStatus: 'none',
    cancellationReason: null,
    realizedAnnualSavings: '0.00',
    confidence: null,
    nextChargeDate: null,
    lastChargeDate: null,
    categoryId: null,
    category: null,
    budgetId: null,
    usageCount: 0,
    usageSince: null,
    lastUsedAt: null,
    sinkingGoalId: null,
    detectionMeta: null,
    createdById: 'user-1',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    costPerUse: null,
    ...overrides,
  };
}

/** A `GET /payables` row as the API sends it (money as decimal strings). */
export function payableRow(overrides: Partial<Payable> & Pick<Payable, 'id' | 'vendor'>): Payable {
  return {
    workspaceId: 'workspace-1',
    direction: 'payable',
    amount: '100.00',
    currency: 'USD',
    dueDate: null,
    status: 'to_pay',
    paidAmount: '0.00',
    linkedTransactionId: null,
    source: 'manual',
    isRecurring: false,
    comment: null,
    statementId: null,
    paidAt: null,
    dueSoonNotifiedAt: null,
    createdById: 'user-1',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    deletedAt: null,
    ...overrides,
  };
}

export function workspaceMember(
  overrides: Partial<WorkspaceMember> & Pick<WorkspaceMember, 'id'>,
): WorkspaceMember {
  return {
    memberId: `member-${overrides.id}`,
    role: 'member',
    permissions: null,
    joinedAt: TIMESTAMP,
    ...overrides,
  };
}

/** `GET /workspaces/:id`: the workspace with its members. */
export function workspaceDetail(overrides: Partial<WorkspaceDetail> = {}): WorkspaceDetail {
  return {
    id: 'workspace-1',
    name: 'Home',
    description: null,
    icon: null,
    color: null,
    backgroundImage: null,
    currency: 'USD',
    isFavorite: false,
    settings: null,
    ownerId: 'user-1',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    members: [],
    ...overrides,
  };
}

export function receiptRecord(
  overrides: Partial<ReceiptRecord> & Pick<ReceiptRecord, 'id'>,
): ReceiptRecord {
  return {
    statementId: null,
    transactionId: null,
    source: 'scan',
    subject: 'Receipt',
    sender: 'scan',
    receivedAt: TIMESTAMP,
    status: 'draft',
    stage: 'submit',
    language: null,
    metadata: null,
    parsedData: null,
    confidence: null,
    taxAmount: null,
    isDuplicate: false,
    duplicateOfId: null,
    locationLat: null,
    locationLng: null,
    locationSource: null,
    locationAccuracyM: null,
    locationUpdatedAt: null,
    category: null,
    createdAt: TIMESTAMP,
    ...overrides,
  };
}

/** `POST /workspaces`, and a row of `GET /workspaces`. */
export function workspaceSummary(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  const { members: _members, ...summary } = workspaceDetail();
  return { ...summary, ...overrides };
}

/** `GET /auth/me`, and the `user` of the profile updates. */
export function currentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'user',
    workspaceId: 'workspace-1',
    permissions: null,
    telegramId: null,
    telegramChatId: null,
    locale: 'en',
    timeZone: null,
    dateFormat: 'auto',
    firstDayOfWeek: null,
    uiDensity: 'comfortable',
    reduceMotion: false,
    showDailyQuote: true,
    themePreference: 'auto',
    mapStylePreference: null,
    lastLogin: null,
    avatarUrl: null,
    onboardingCompletedAt: null,
    welcomeTutorialSeenAt: null,
    pageHintsSeen: {},
    ...overrides,
  };
}

/** The `user` of `POST /auth/login` and `POST /auth/register`. */
export function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'user',
    workspaceId: null,
    lastWorkspaceId: null,
    locale: 'en',
    timeZone: null,
    themePreference: 'auto',
    mapStylePreference: null,
    avatarUrl: null,
    onboardingCompletedAt: null,
    ...overrides,
  };
}

/** `GET /insights`: one page of insights. */
export function insightPage(items: Insight[]) {
  return { items, total: items.length, limit: 50, offset: 0 };
}

/** A jurisdiction as `GET /tax/settings` and `GET /tax/jurisdictions` send it: Germany by default. */
export function taxJurisdictionItem(
  overrides: Partial<TaxJurisdictionItem> = {},
): TaxJurisdictionItem {
  return {
    id: 'jurisdiction-de',
    code: 'DE',
    name: 'Germany',
    taxName: 'USt',
    currency: 'EUR',
    scheme: 'vat',
    isEu: true,
    filingPeriod: 'quarterly',
    registrationThreshold: '25000.00',
    thresholdPeriod: 'calendar_year',
    ...overrides,
  };
}

/** A row of `GET /transactions`: an unverified expense of 10.00 USD. */
export function transactionItem(
  overrides: Partial<TransactionListItem> & Pick<TransactionListItem, 'id'>,
): TransactionListItem {
  return {
    statementId: null,
    cryptoWalletId: null,
    transactionDate: '2026-01-01',
    transactionType: 'expense',
    isVerified: false,
    documentNumber: null,
    counterpartyName: 'Merchant',
    counterpartyBin: null,
    counterpartyAccount: null,
    counterpartyBank: null,
    paymentPurpose: 'Purchase',
    debit: '10.00',
    credit: null,
    currency: 'USD',
    exchangeRate: null,
    amountForeign: null,
    categoryId: null,
    branchId: null,
    walletId: null,
    article: null,
    comments: null,
    category: null,
    branch: null,
    wallet: null,
    amount: '-10.00',
    ownerMemberId: null,
    isPrivate: false,
    privateCategoryId: null,
    transferPairId: null,
    transferPairSource: null,
    transferPairKind: null,
    reimbursementOfId: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

/** `GET /storage/files/:id` for a statement with no rows, links or shares. */
export function storageFileDetails(id: string, tags: StorageTag[] = []): StorageFileDetails {
  return {
    statement: {
      id,
      fileName: 'statement-2026-03.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      bankName: 'Example Bank',
      accountNumber: null,
      statementDateFrom: null,
      statementDateTo: null,
      status: 'parsed',
      totalDebit: '0.00',
      totalCredit: '0.00',
      currency: 'EUR',
      createdAt: TIMESTAMP,
      deletedAt: null,
      categoryId: null,
      category: null,
      folderId: null,
      folder: null,
      tags,
    },
    transactions: [],
    sharedLinks: [],
    permissions: [],
    tags,
    isOwner: true,
    fileAvailability: { onDisk: true, inDb: false, status: 'disk' },
  };
}
