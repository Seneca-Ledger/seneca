import { STATEMENTS_GMAIL_SYNC_EVENT } from '@/app/lib/statement-upload-actions';
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StatementsListView from './StatementsListView';

const apiMocks = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiDelete: vi.fn(),
  mockListReceipts: vi.fn(),
}));

const gmailMappingMocks = vi.hoisted(() => ({
  mockMapGmailReceiptsToStatements: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const statementsListItemPropsSpy = vi.hoisted(() => vi.fn());
const filtersDrawerPropsSpy = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.mockApiGet,
    post: apiMocks.mockApiPost,
    delete: apiMocks.mockApiDelete,
  },
  gmailReceiptsApi: {
    listReceipts: apiMocks.mockListReceipts,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastMocks.success,
    error: toastMocks.error,
  },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'KZT' } }),
}));

vi.mock('next-intlayer', () => ({
  useIntlayer: () => ({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/statements/submit',
}));

vi.mock('@/app/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/app/hooks/useLockBodyScroll', () => ({
  useLockBodyScroll: () => undefined,
}));

vi.mock('@/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    handlers: {},
    pullDistance: 0,
    isRefreshing: false,
    isReadyToRefresh: false,
  }),
}));

vi.mock('@/app/lib/statement-status', () => ({
  getStatementDisplayMerchant: () => 'Merchant',
  getStatementMerchantLabel: () => 'Merchant',
  hasProcessingStatements: () => false,
  isManualExpenseStatement: () => false,
}));

vi.mock('@/app/(main)/statements/components/filters/statement-filters', () => ({
  DEFAULT_STATEMENT_FILTERS: {
    type: null,
    statuses: [],
    date: null,
    from: [],
    to: [],
    keywords: '',
    amountMin: null,
    amountMax: null,
    approved: null,
    billable: null,
    groupBy: null,
    has: [],
    currencies: [],
    exported: null,
    paid: null,
    limit: null,
  },
  loadStatementFilters: () => ({
    type: 'pdf',
    statuses: ['processing'],
    date: { mode: 'on', date: '2026-03-01' },
    from: [],
    to: [],
    keywords: 'alex',
    amountMin: 10,
    amountMax: null,
    approved: true,
    billable: null,
    groupBy: 'amount',
    has: ['errors'],
    currencies: ['KZT'],
    exported: false,
    paid: null,
    limit: 25,
  }),
  resetSingleStatementFilter: (filters: unknown) => filters,
  saveStatementFilters: () => undefined,
}));

vi.mock('@/app/(main)/statements/components/columns/statement-columns', () => ({
  STATEMENT_COLUMNS_STORAGE_KEY: 'lumio-statement-columns',
  DEFAULT_STATEMENT_COLUMNS: [
    { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
    { id: 'merchant', label: 'Merchant', visible: true, order: 1 },
    { id: 'amount', label: 'Amount', visible: true, order: 2 },
    { id: 'approved', label: 'Approved', visible: false, order: 3 },
    { id: 'billable', label: 'Billable', visible: false, order: 4 },
    { id: 'exported', label: 'Exported', visible: false, order: 5 },
  ],
  COLUMN_FILTER_MAP: {
    receipt: ['type', 'statuses'],
    merchant: ['keywords'],
    amount: ['amountMin', 'amountMax'],
    approved: ['approved'],
    billable: ['billable'],
    exported: ['exported'],
  },
  loadStatementColumns: () => [
    { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
    { id: 'merchant', label: 'Merchant', visible: true, order: 1 },
    { id: 'amount', label: 'Amount', visible: true, order: 2 },
    { id: 'approved', label: 'Approved', visible: false, order: 3 },
    { id: 'billable', label: 'Billable', visible: false, order: 4 },
    { id: 'exported', label: 'Exported', visible: false, order: 5 },
  ],
  saveStatementColumns: () => undefined,
  reorderStatementColumns: (columns: unknown) => columns,
  getAllowedStatementFilterKeys: () => [
    'amountMax',
    'amountMin',
    'date',
    'exported',
    'groupBy',
    'has',
    'keywords',
    'limit',
    'paid',
    'statuses',
    'type',
  ],
  resetDisallowedStatementFilters: (filters: unknown) => filters,
  statementColumnWidthStyle: () => ({ flex: '1 1 0', minWidth: 0 }),
}));

vi.mock('@/app/components/ui/spinner', () => ({
  Spinner: () => null,
}));

vi.mock('@/app/components/PDFPreviewModal', () => ({
  PDFPreviewModal: () => null,
}));

vi.mock('@/app/(main)/statements/components/filters/FiltersDrawer', () => ({
  FiltersDrawer: (props: any) => {
    filtersDrawerPropsSpy(props);
    return null;
  },
}));

vi.mock('@/app/(main)/statements/components/columns/ColumnsDrawer', () => ({
  ColumnsDrawer: () => null,
}));

vi.mock('@/app/(main)/statements/components/CreateExpenseDrawer', () => ({
  default: (props: any) => (
    <>
      <button
        type="button"
        data-testid="mock-create-expense-drawer-submit-scan"
        onClick={() =>
          props.onSubmitScan({
            files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
            allowDuplicates: true,
            requireManualCategorySelection: false,
          })
        }
      >
        trigger-scan
      </button>
      <button
        type="button"
        data-testid="mock-create-expense-drawer-submit-scan-pdf"
        onClick={() =>
          props.onSubmitScan({
            files: [new File(['statement'], 'statement.pdf', { type: 'application/pdf' })],
            allowDuplicates: true,
            requireManualCategorySelection: false,
          })
        }
      >
        trigger-scan-pdf
      </button>
      <button
        type="button"
        data-testid="mock-create-expense-drawer-submit-scan-mixed"
        onClick={() =>
          props.onSubmitScan({
            files: [
              new File(['statement'], 'statement.pdf', { type: 'application/pdf' }),
              new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
            ],
            allowDuplicates: true,
            requireManualCategorySelection: false,
          })
        }
      >
        trigger-scan-mixed
      </button>
    </>
  ),
}));

vi.mock('@/app/components/ui/checkbox', () => ({
  Checkbox: () => null,
}));

vi.mock('@/app/components/ui/filter-chip-button', () => ({
  FilterChipButton: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/app/(main)/statements/components/filters/DateFilterDropdown', () => ({
  DateFilterDropdown: () => null,
}));

vi.mock('@/app/(main)/statements/components/filters/FromFilterDropdown', () => ({
  FromFilterDropdown: () => null,
}));

vi.mock('@/app/(main)/statements/components/filters/StatusFilterDropdown', () => ({
  StatusFilterDropdown: () => null,
}));

vi.mock('@/app/(main)/statements/components/filters/TypeFilterDropdown', () => ({
  TypeFilterDropdown: () => null,
}));

vi.mock('@/app/(main)/statements/components/StatementsListItem', () => ({
  StatementsListItem: (props: any) => {
    statementsListItemPropsSpy(props);
    return null;
  },
}));

vi.mock('@/app/(main)/statements/components/gmail-receipt-mapping', () => ({
  hasGmailReceiptAmount: () => true,
  mapGmailReceiptsToStatements: (...args: any[]) =>
    gmailMappingMocks.mockMapGmailReceiptsToStatements(...args),
  resolveGmailMerchantLabel: () => 'Merchant',
}));

vi.mock('@/app/components/ui/pagination', () => ({
  AppPagination: () => null,
}));

describe('StatementsListView Gmail sync skeleton', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    sessionStorage.clear();
    apiMocks.mockApiGet.mockReset();
    apiMocks.mockApiPost.mockReset();
    apiMocks.mockApiDelete.mockReset();
    apiMocks.mockListReceipts.mockReset();
    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReset();
    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([]);
    statementsListItemPropsSpy.mockReset();
    filtersDrawerPropsSpy.mockReset();
    routerPushMock.mockReset();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null as unknown as HTMLDivElement;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const getLatestRenderedStatementProps = () => {
    const latestById = new Map<string, any>();
    statementsListItemPropsSpy.mock.calls.forEach((call: any[]) => {
      const props = call[0];
      const id = props?.statement?.id;
      if (id) {
        latestById.set(id, props);
      }
    });
    return Array.from(latestById.values());
  };

  it('renders Gmail sync skeleton rows from storage count', () => {
    act(() => {
      root.render(<StatementsListView />);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(STATEMENTS_GMAIL_SYNC_EVENT, {
          detail: { count: 3, timestamp: Date.now() },
        }),
      );
    });

    const skeletonRows = container.querySelectorAll('[data-testid="gmail-sync-skeleton-row"]');
    expect(skeletonRows).toHaveLength(3);
  });

  it('sorts statements by date when date header clicked', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'newer',
                source: 'statement',
                fileName: 'newer.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 100,
                totalCredit: 0,
                createdAt: '2026-03-17T00:00:00Z',
                statementDateFrom: '2026-03-16',
                statementDateTo: '2026-03-17',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
              {
                id: 'older',
                source: 'statement',
                fileName: 'older.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 50,
                totalCredit: 0,
                createdAt: '2026-03-01T00:00:00Z',
                statementDateFrom: '2026-02-28',
                statementDateTo: '2026-03-01',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
            ],
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    act(() => {
      root.render(<StatementsListView />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const initialIds = statementsListItemPropsSpy.mock.calls
      .map((call: any[]) => call[0]?.statement?.id)
      .filter(Boolean);
    const firstNewerIndex = initialIds.indexOf('newer');
    const firstOlderIndex = initialIds.indexOf('older');
    expect(firstNewerIndex).toBeGreaterThanOrEqual(0);
    expect(firstOlderIndex).toBeGreaterThanOrEqual(0);
    expect(firstNewerIndex).toBeLessThan(firstOlderIndex);

    statementsListItemPropsSpy.mockClear();

    const sortButton = container.querySelector(
      '[data-testid="statements-date-sort"]',
    ) as HTMLButtonElement | null;
    expect(sortButton).toBeTruthy();

    act(() => {
      sortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sortedIds = statementsListItemPropsSpy.mock.calls
      .map((call: any[]) => call[0]?.statement?.id)
      .filter(Boolean);
    const secondNewerIndex = sortedIds.indexOf('newer');
    const secondOlderIndex = sortedIds.indexOf('older');
    expect(secondNewerIndex).toBeGreaterThanOrEqual(0);
    expect(secondOlderIndex).toBeGreaterThanOrEqual(0);
    expect(secondOlderIndex).toBeLessThan(secondNewerIndex);
  });

  it('sends serialized server-side filters to /statements and passes visible screens to FiltersDrawer', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string, config?: { params?: unknown }) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        expect(config?.params).toEqual({
          type: 'pdf',
          statuses: ['processing'],
          dateMode: 'on',
          dateFrom: '2026-03-01',
          keywords: 'alex',
          amountMin: 10,
          limit: 25,
          approved: true,
          groupBy: 'amount',
          has: ['errors'],
          currencies: ['KZT'],
          exported: false,
          page: 1,
        });

        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const lastFiltersDrawerProps = filtersDrawerPropsSpy.mock.calls.at(-1)?.[0];
    expect(lastFiltersDrawerProps?.visibleScreens).toEqual([
      'amount',
      'date',
      'groupBy',
      'has',
      'keywords',
      'limit',
      'status',
      'type',
    ]);
    expect(lastFiltersDrawerProps?.statusOptions).toEqual([
      { value: 'uploaded', label: 'Uploaded' },
      { value: 'processing', label: 'Processing' },
      { value: 'parsed', label: 'Parsed' },
      { value: 'validated', label: 'Validated' },
      { value: 'completed', label: 'Completed' },
      { value: 'error', label: 'Error' },
    ]);
    expect(lastFiltersDrawerProps?.typeOptions).toEqual([
      { value: 'receipt', label: 'Receipt' },
      { value: 'expense', label: 'Expense' },
      { value: 'expense_report', label: 'Expense Report' },
      { value: 'chat', label: 'Chat' },
      { value: 'trip', label: 'Trip' },
      { value: 'task', label: 'Task' },
      { value: 'gmail', label: 'Gmail' },
      { value: 'pdf', label: 'PDF' },
      { value: 'xlsx', label: 'Excel' },
      { value: 'csv', label: 'CSV' },
      { value: 'image', label: 'Image' },
    ]);
  });

  it('applies the receipt type filter to local receipts without including gmail receipts', async () => {
    apiMocks.mockApiGet.mockImplementation(
      (url: string, config?: { params?: Record<string, unknown> }) => {
        if (url === '/categories' || url === '/tax-rates') {
          return Promise.resolve({ data: [] });
        }

        if (url === '/statements') {
          expect(config?.params).toMatchObject({
            type: 'receipt',
            statuses: ['processing'],
            keywords: 'alex',
          });

          return Promise.resolve({ data: { data: [], total: 0 } });
        }

        return Promise.resolve({ data: [] });
      },
    );

    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'scan-1',
            source: 'scan',
            subject: 'Store receipt',
            sender: 'camera-scan',
            receivedAt: '2026-03-27T00:00:00.000Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
            },
          },
          {
            id: 'gmail-1',
            source: 'gmail',
            subject: 'Receipt email',
            sender: 'billing@example.com',
            receivedAt: '2026-03-27T00:00:00.000Z',
            status: 'draft',
            parsedData: {
              amount: 44.1,
              currency: 'KZT',
              vendor: 'Amazon',
            },
          },
        ],
      },
    });

    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([
      {
        id: 'scan-1',
        source: 'scan',
        receiptSource: 'scan',
        fileName: 'Walmart',
        subject: 'Store receipt',
        sender: 'camera-scan',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00.000Z',
        statementDateTo: null,
        bankName: 'receipt',
        fileType: 'receipt',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00.000Z',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
        },
      },
      {
        id: 'gmail-1',
        source: 'gmail',
        receiptSource: 'gmail',
        fileName: 'Amazon',
        subject: 'Receipt email',
        sender: 'billing@example.com',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 44.1,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00.000Z',
        statementDateTo: null,
        bankName: 'gmail',
        fileType: 'gmail',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00.000Z',
        parsedData: {
          amount: 44.1,
          currency: 'KZT',
          vendor: 'Amazon',
        },
      },
    ]);

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const renderedIds = getLatestRenderedStatementProps()
      .map((props: any) => props?.statement?.id)
      .filter(Boolean);

    expect(renderedIds).toEqual(['scan-1']);
  });

  it('uses dark-safe duplicate selection styles for detected duplicates action', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'duplicate-1',
                source: 'statement',
                fileName: 'duplicate-1.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 125,
                totalCredit: 0,
                createdAt: '2026-03-10T00:00:00Z',
                statementDateFrom: '2026-03-10',
                statementDateTo: '2026-03-10',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
              {
                id: 'duplicate-2',
                source: 'statement',
                fileName: 'duplicate-2.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 125,
                totalCredit: 0,
                createdAt: '2026-03-11T00:00:00Z',
                statementDateFrom: '2026-03-10',
                statementDateTo: '2026-03-10',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
            ],
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const duplicateButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Select duplicates'),
    );

    expect(duplicateButton).toBeTruthy();
    expect(duplicateButton?.className).toContain('dark:border-amber-500/30');
    expect(duplicateButton?.className).toContain('dark:bg-amber-500/10');
    expect(duplicateButton?.className).toContain('dark:text-amber-100');

    const duplicateCountBadge = duplicateButton?.querySelector('span');
    expect(duplicateCountBadge?.className).toContain('dark:bg-slate-950/60');
    expect(duplicateCountBadge?.className).toContain('dark:text-amber-100');
  });

  it('routes scan uploads to the receipt-scan statements endpoint', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockApiPost.mockResolvedValue({ data: { data: [{ id: 'stmt-1' }] } });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('statements:open-expense-drawer', {
          detail: { mode: 'scan' },
        }),
      );
    });

    const trigger = container.querySelector(
      '[data-testid="mock-create-expense-drawer-submit-scan"]',
    ) as HTMLButtonElement | null;

    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(apiMocks.mockApiPost).not.toHaveBeenCalledWith(
      '/statements/upload',
      expect.anything(),
      expect.anything(),
    );
  });

  it('routes PDF scans to the statement upload endpoint', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockApiPost.mockResolvedValue({ data: { data: [{ id: 'stmt-pdf-1' }] } });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('statements:open-expense-drawer', {
          detail: { mode: 'scan' },
        }),
      );
    });

    const trigger = container.querySelector(
      '[data-testid="mock-create-expense-drawer-submit-scan-pdf"]',
    ) as HTMLButtonElement | null;

    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(apiMocks.mockApiPost).not.toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.anything(),
      expect.anything(),
    );
  });

  it('splits mixed scan uploads between statement and receipt endpoints', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockApiPost.mockResolvedValue({ data: { data: [{ id: 'stmt-mixed-1' }] } });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('statements:open-expense-drawer', {
          detail: { mode: 'scan' },
        }),
      );
    });

    const trigger = container.querySelector(
      '[data-testid="mock-create-expense-drawer-submit-scan-mixed"]',
    ) as HTMLButtonElement | null;

    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  });

  it('surfaces receipt upload validation errors from the backend', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockApiPost.mockRejectedValue({
      response: {
        data: {
          message: 'Receipt amount could not be determined',
        },
      },
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('statements:open-expense-drawer', {
          detail: { mode: 'scan' },
        }),
      );
    });

    const trigger = container.querySelector(
      '[data-testid="mock-create-expense-drawer-submit-scan"]',
    ) as HTMLButtonElement | null;

    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastMocks.success).not.toHaveBeenCalledWith('Files uploaded');
    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  });

  it('does not render scanned receipts from gmail receipts feed as duplicate gmail items', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'statement-receipt-1',
                source: 'statement',
                fileName: 'receipt.jpg',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 90.32,
                totalCredit: 0,
                createdAt: '2026-03-27T00:00:00Z',
                statementDateFrom: '2026-03-27',
                statementDateTo: '2026-03-27',
                bankName: 'other',
                fileType: 'image',
                currency: 'KZT',
                parsingDetails: {
                  detectedBy: 'receipt-scan',
                  importPreview: {
                    source: 'receipt-scan',
                    merchant: 'Walmart',
                  },
                },
              },
            ],
            total: 1,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'receipt-1',
            source: 'scan',
            subject: 'receipt.jpg',
            sender: 'camera-scan',
            receivedAt: '2026-03-27T00:00:00Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
              date: '2026-03-27',
            },
          },
        ],
      },
    });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const renderedIds = statementsListItemPropsSpy.mock.calls
      .map((call: any[]) => call[0]?.statement?.id)
      .filter(Boolean);

    expect(renderedIds).toContain('statement-receipt-1');
    expect(renderedIds).not.toContain('receipt-1');
  });

  it('filters derived receipt statements even when api rows omit source', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'statement-receipt-nosource-1',
                fileName: 'receipt.jpg',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 90.32,
                totalCredit: 0,
                createdAt: '2026-03-27T00:00:00Z',
                statementDateFrom: '2026-03-27',
                statementDateTo: '2026-03-27',
                bankName: 'other',
                fileType: 'image',
                currency: 'KZT',
                parsingDetails: {
                  detectedBy: 'receipt-scan',
                  importPreview: {
                    source: 'receipt-scan',
                    merchant: 'Walmart',
                  },
                },
              },
            ],
            total: 1,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'receipt-nosource-1',
            source: 'scan',
            subject: 'receipt.jpg',
            sender: 'camera-scan',
            receivedAt: '2026-03-27T00:00:00Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
              date: '2026-03-27',
            },
          },
        ],
      },
    });

    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([
      {
        id: 'receipt-nosource-1',
        source: 'scan',
        receiptSource: 'scan',
        fileName: 'Walmart',
        subject: 'receipt.jpg',
        sender: 'camera-scan',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00Z',
        statementDateTo: null,
        bankName: 'receipt',
        fileType: 'receipt',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00Z',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
          date: '2026-03-27',
        },
      },
    ]);

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const renderedIds = getLatestRenderedStatementProps()
      .map((props: any) => props?.statement?.id)
      .filter(Boolean);

    expect(renderedIds).toEqual(['receipt-nosource-1']);
  });

  it('routes store receipts to the dedicated details page instead of opening the scan upload drawer', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'scan-1',
            source: 'scan',
            subject: 'Store receipt',
            sender: 'camera-scan',
            receivedAt: '2026-03-27T00:00:00.000Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
              date: '2026-03-27',
            },
          },
        ],
      },
    });
    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([
      {
        id: 'scan-1',
        source: 'scan',
        receiptSource: 'scan',
        fileName: 'Walmart',
        subject: 'Store receipt',
        sender: 'camera-scan',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00.000Z',
        statementDateTo: null,
        bankName: 'receipt',
        fileType: 'receipt',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00.000Z',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
          date: '2026-03-27',
        },
      },
    ]);

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      getLatestRenderedStatementProps()[0]?.onView?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(routerPushMock).not.toHaveBeenCalledWith('/statements/submit?openExpenseDrawer=scan');
    expect(routerPushMock).toHaveBeenCalledWith('/storage/receipts/scan-1');
  });

  it('keeps export and delete actions visible when duplicate actions are shown', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'duplicate-1',
                source: 'statement',
                fileName: 'duplicate-1.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 125,
                totalCredit: 0,
                createdAt: '2026-03-10T00:00:00Z',
                statementDateFrom: '2026-03-10',
                statementDateTo: '2026-03-10',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
              {
                id: 'duplicate-2',
                source: 'statement',
                fileName: 'duplicate-2.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 125,
                totalCredit: 0,
                createdAt: '2026-03-11T00:00:00Z',
                statementDateFrom: '2026-03-10',
                statementDateTo: '2026-03-10',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
            ],
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const selectDuplicatesButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Select duplicates'),
    ) as HTMLButtonElement | undefined;
    expect(selectDuplicatesButton).toBeTruthy();

    await act(async () => {
      selectDuplicatesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const selectedActionsButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('selected'),
    ) as HTMLButtonElement | undefined;
    expect(selectedActionsButton).toBeTruthy();

    await act(async () => {
      selectedActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Merge duplicates');
    expect(container.textContent).toContain('Mark as duplicate');
    expect(container.textContent).toContain('Dismiss');
    expect(container.textContent).toContain('Export');
    expect(container.textContent).toContain('Delete');
  });

  it('shows Mark as duplicate for any selection and creates one manual duplicate group', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'statement-a',
                source: 'statement',
                fileName: 'statement-a.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 100,
                totalCredit: 0,
                createdAt: '2026-03-10T00:00:00Z',
                statementDateFrom: '2026-03-10',
                statementDateTo: '2026-03-10',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
              {
                id: 'statement-b',
                source: 'statement',
                fileName: 'statement-b.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 155,
                totalCredit: 0,
                createdAt: '2026-03-11T00:00:00Z',
                statementDateFrom: '2026-03-11',
                statementDateTo: '2026-03-11',
                bankName: 'halyk',
                fileType: 'pdf',
                currency: 'KZT',
              },
            ],
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      const currentProps = getLatestRenderedStatementProps();
      currentProps[0]?.onToggleSelect?.();
      currentProps[1]?.onToggleSelect?.();
      await Promise.resolve();
    });

    const selectedActionsButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('selected'),
    ) as HTMLButtonElement | undefined;

    expect(selectedActionsButton).toBeTruthy();

    await act(async () => {
      selectedActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Mark as duplicate');

    const markDuplicateButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Mark as duplicate'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      markDuplicateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const latestProps = getLatestRenderedStatementProps();
    const statementA = latestProps.find(props => props.statement.id === 'statement-a');
    const statementB = latestProps.find(props => props.statement.id === 'statement-b');

    expect(statementA?.isPossibleDuplicate).toBe(true);
    expect(statementB?.isPossibleDuplicate).toBe(true);
    expect(statementA?.duplicateGroupSize).toBe(2);
    expect(statementB?.duplicateGroupSize).toBe(2);
    expect([statementA?.duplicateRole, statementB?.duplicateRole].sort()).toEqual([
      'primary',
      'suspected',
    ]);
    expect(statementA?.duplicateGroupLabel).toBe(statementB?.duplicateGroupLabel);
  });

  it('exports successful selected files even when another selected file fails', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'statement-ok',
                source: 'statement',
                fileName: 'statement-ok.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 100,
                totalCredit: 0,
                createdAt: '2026-03-10T00:00:00Z',
                statementDateFrom: '2026-03-10',
                statementDateTo: '2026-03-10',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
              {
                id: 'statement-missing',
                source: 'statement',
                fileName: 'statement-missing.pdf',
                status: 'completed',
                totalTransactions: 1,
                totalDebit: 110,
                totalCredit: 0,
                createdAt: '2026-03-11T00:00:00Z',
                statementDateFrom: '2026-03-11',
                statementDateTo: '2026-03-11',
                bankName: 'kaspi',
                fileType: 'pdf',
                currency: 'KZT',
              },
            ],
            total: 2,
          },
        });
      }

      if (url === '/statements/statement-ok/file') {
        return Promise.resolve({ data: new Blob(['ok']) });
      }

      if (url === '/statements/statement-missing/file') {
        return Promise.reject(new Error('missing-file'));
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      const currentProps = getLatestRenderedStatementProps();
      currentProps[0]?.onToggleSelect?.();
      currentProps[1]?.onToggleSelect?.();
      await Promise.resolve();
    });

    const selectedActionsButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('selected'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      selectedActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const exportButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Export'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      exportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.mockApiGet).toHaveBeenCalledWith('/statements/statement-ok/file', {
      responseType: 'blob',
    });
    expect(apiMocks.mockApiGet).toHaveBeenCalledWith('/statements/statement-missing/file', {
      responseType: 'blob',
    });
    expect(toastMocks.success).toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalledWith('Failed to export selected statements');
  });

  it('exports scanned receipts through the receipts file endpoint', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      if (url === '/receipts/scan-1/file') {
        return Promise.resolve({ data: new Blob(['scan']) });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'scan-1',
            source: 'scan',
            subject: 'Store receipt',
            sender: 'camera-scan',
            receivedAt: '2026-03-27T00:00:00.000Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
            },
          },
        ],
      },
    });
    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([
      {
        id: 'scan-1',
        source: 'scan',
        receiptSource: 'scan',
        fileName: 'Walmart',
        subject: 'Store receipt',
        sender: 'camera-scan',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00.000Z',
        statementDateTo: null,
        bankName: 'gmail',
        fileType: 'gmail',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00.000Z',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
        },
      },
    ]);

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      const currentProps = getLatestRenderedStatementProps();
      currentProps[0]?.onToggleSelect?.();
      await Promise.resolve();
    });

    const selectedActionsButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('selected'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      selectedActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const exportButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Export'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      exportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.mockApiGet).toHaveBeenCalledWith('/receipts/scan-1/file', {
      responseType: 'blob',
    });
    expect(apiMocks.mockApiGet).not.toHaveBeenCalledWith('/statements/scan-1/file', {
      responseType: 'blob',
    });
  });

  it('deletes scanned receipts through the receipts endpoint', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockApiDelete.mockResolvedValue({});
    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'scan-1',
            source: 'scan',
            subject: 'Store receipt',
            sender: 'camera-scan',
            receivedAt: '2026-03-27T00:00:00.000Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
            },
          },
        ],
      },
    });
    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([
      {
        id: 'scan-1',
        source: 'scan',
        receiptSource: 'scan',
        fileName: 'Walmart',
        subject: 'Store receipt',
        sender: 'camera-scan',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00.000Z',
        statementDateTo: null,
        bankName: 'gmail',
        fileType: 'gmail',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00.000Z',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
        },
      },
    ]);

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      const currentProps = getLatestRenderedStatementProps();
      currentProps[0]?.onToggleSelect?.();
      await Promise.resolve();
    });

    const selectedActionsButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('selected'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      selectedActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const deleteButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Delete'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.mockApiDelete).toHaveBeenCalledWith('/receipts/scan-1');
    expect(apiMocks.mockApiDelete).not.toHaveBeenCalledWith('/statements/scan-1');
  });

  it('shows one gmail-only bulk-action error and closes the menu', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({
      data: {
        receipts: [
          {
            id: 'gmail-1',
            source: 'gmail',
            subject: 'Receipt email',
            sender: 'billing@example.com',
            receivedAt: '2026-03-27T00:00:00.000Z',
            status: 'draft',
            parsedData: {
              amount: 90.32,
              currency: 'KZT',
              vendor: 'Walmart',
            },
          },
        ],
      },
    });
    gmailMappingMocks.mockMapGmailReceiptsToStatements.mockReturnValue([
      {
        id: 'gmail-1',
        source: 'gmail',
        receiptSource: 'gmail',
        fileName: 'Walmart',
        subject: 'Receipt email',
        sender: 'billing@example.com',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        exported: null,
        paid: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        processedAt: undefined,
        statementDateFrom: '2026-03-27T00:00:00.000Z',
        statementDateTo: null,
        bankName: 'gmail',
        fileType: 'gmail',
        currency: 'KZT',
        user: null,
        errorMessage: null,
        receivedAt: '2026-03-27T00:00:00.000Z',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
        },
      },
    ]);

    await act(async () => {
      root.render(<StatementsListView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      const currentProps = getLatestRenderedStatementProps();
      currentProps[0]?.onToggleSelect?.();
      await Promise.resolve();
    });

    const selectedActionsButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('selected'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      selectedActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Export');

    const exportButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Export'),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      exportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Selected receipts cannot be exported from this menu',
    );
    expect(container.textContent).not.toContain('Delete');
  });
});
