// @vitest-environment jsdom
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/app/test/query-wrapper';
import StatementsListView from './StatementsListView';

const apiMocks = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiDelete: vi.fn(),
  mockListReceipts: vi.fn(),
}));

const receiptMappingMocks = vi.hoisted(() => ({
  mockMapReceiptsToStatements: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const statementsListItemPropsSpy = vi.hoisted(() => vi.fn());
const filtersDrawerPropsSpy = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({ user: { id: 'user-1' } }));
const storedFilters = vi.hoisted(() => ({ overrides: {} as Record<string, unknown> }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.mockApiGet,
    post: apiMocks.mockApiPost,
    delete: apiMocks.mockApiDelete,
  },
  receiptDocumentsApi: {
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
  // Список грузится только для вошедшего пользователя (enabled: Boolean(user));
  // объект один на все рендеры, как у настоящего useAuth.
  useAuth: () => authMock,
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'workspace-1', currency: 'KZT' } }),
  useReadOnlyWorkspace: () => ({ isReadOnly: false, version: null }),
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

vi.mock('@/app/lib/statement-status', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/lib/statement-status')>()),
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
  // Фильтры уходят на сервер (/statements params); клиентский проход — тождество.
  applyStatementsFilters: (items: unknown[]) => items,
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
    ...storedFilters.overrides,
  }),
  resetSingleStatementFilter: (filters: unknown) => filters,
  saveStatementFilters: () => undefined,
}));

vi.mock('@/app/(main)/statements/components/columns/statement-columns', () => ({
  STATEMENT_COLUMNS_STORAGE_KEY: 'seneca-statement-columns',
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

// Настоящая шторка ловит отказ onSubmitScan и показывает его тостом.
const submitScanFailed = (error: Error) => toastMocks.error(error.message);

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
          }).catch(submitScanFailed)
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
          }).catch(submitScanFailed)
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
          }).catch(submitScanFailed)
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



vi.mock('@/app/(main)/statements/components/StatementsListItem', () => ({
  StatementsListItem: (props: any) => {
    statementsListItemPropsSpy(props);
    return null;
  },
}));

vi.mock('@/app/(main)/statements/components/receipt-document-mapping', () => ({
  hasReceiptAmount: () => true,
  mapReceiptsToStatements: (...args: any[]) =>
    receiptMappingMocks.mockMapReceiptsToStatements(...args),
  resolveReceiptMerchantLabel: () => 'Merchant',
}));

vi.mock('@/app/components/ui/pagination', () => ({
  AppPagination: () => null,
}));

// Ответ /statements проверяется контрактом StatementList: строки дополняются
// до формы, которую шлёт бэкенд (суммы — десятичные строки).
const statementRows = (rows: Array<Record<string, unknown>>) =>
  rows.map(row => ({
    stage: 'submit',
    errorMessage: null,
    balanceStart: null,
    balanceEnd: null,
    statementDateFrom: null,
    statementDateTo: null,
    updatedAt: row.createdAt,
    processedAt: null,
    categoryId: null,
    category: null,
    tags: [],
    user: null,
    parsingDetails: null,
    transactionSummary: {
      description: null,
      exchangeRate: null,
      exchangeRateMixed: false,
      cardLabel: null,
    },
    ...row,
    totalDebit: String(row.totalDebit ?? 0),
    totalCredit: String(row.totalCredit ?? 0),
  }));

describe('StatementsListView', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    storedFilters.overrides = {};
    sessionStorage.clear();
    apiMocks.mockApiGet.mockReset();
    apiMocks.mockApiPost.mockReset();
    apiMocks.mockApiDelete.mockReset();
    apiMocks.mockListReceipts.mockReset();
    receiptMappingMocks.mockMapReceiptsToStatements.mockReset();
    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([]);
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

  // Список выписок читается через React Query: свой клиент на тест, без кэша между ними.
  const renderView = () =>
    root.render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StatementsListView />
      </QueryClientProvider>,
    );

  // queryFn проверяет ответ контрактом через динамический import — пары
  // микрозадач на это не хватает, нужен макротаск.
  const flushQueries = () => new Promise(resolve => setTimeout(resolve, 0));

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
            data: statementRows([
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
            ]),
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    act(() => {
      renderView();
    });

    await act(async () => {
      await flushQueries();
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
      renderView();
      await flushQueries();
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
      { value: 'pdf', label: 'PDF' },
      { value: 'xlsx', label: 'Excel' },
      { value: 'csv', label: 'CSV' },
      { value: 'image', label: 'Image' },
    ]);
  });

  it('applies the receipt type filter to receipts', async () => {
    // Черновой скан ещё не одобрен: фильтр Approved: Yes его бы скрыл.
    storedFilters.overrides = { type: 'receipt', approved: null };
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
        ],
      },
    });

    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([
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
    ]);

    await act(async () => {
      renderView();
      await flushQueries();
    });

    const renderedIds = getLatestRenderedStatementProps()
      .map((props: any) => props?.statement?.id)
      .filter(Boolean);

    expect(renderedIds).toEqual(['scan-1']);
  });

  it('shows the detected duplicates action with its count', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: statementRows([
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
            ]),
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      renderView();
      await flushQueries();
    });

    const duplicateButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Select duplicates'),
    );

    // Цвета чипа теперь в _statements.scss на токенах темы, а не dark:-классами.
    expect(duplicateButton).toBeTruthy();
    expect(duplicateButton?.className).toBe('seneca-stmt-list-view__duplicate-chip');

    const duplicateCountBadge = duplicateButton?.querySelector(
      '.seneca-stmt-list-view__duplicate-count',
    );
    expect(duplicateCountBadge?.textContent).toBe('(2)');
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
      renderView();
      await flushQueries();
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
      await flushQueries();
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

  it('routes PDF scans through the receipt-scan endpoint too', async () => {
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
      renderView();
      await flushQueries();
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
      await flushQueries();
    });

    // С cda4ab6d скан не делит файлы по типу: PDF тоже уходит в receipt-scan,
    // бэкенд (assertReceiptFileSupported) принимает PDF и сам связывает выписку.
    expect(apiMocks.mockApiPost).toHaveBeenCalledTimes(1);
    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'multipart/form-data' }),
      }),
    );
    const sentFiles = (apiMocks.mockApiPost.mock.calls[0][1] as FormData).getAll('files');
    expect(sentFiles.map(file => (file as File).name)).toEqual(['statement.pdf']);
  });

  it('sends mixed scan uploads to the receipt-scan endpoint in one batch', async () => {
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
      renderView();
      await flushQueries();
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
      await flushQueries();
    });

    // Один пакет receipt-scan на оба файла (до RECEIPT_SCAN_UPLOAD_BATCH_SIZE).
    expect(apiMocks.mockApiPost).toHaveBeenCalledTimes(1);
    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'multipart/form-data' }),
      }),
    );
    const sentFiles = (apiMocks.mockApiPost.mock.calls[0][1] as FormData).getAll('files');
    expect(sentFiles.map(file => (file as File).name)).toEqual(['statement.pdf', 'receipt.jpg']);
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
      renderView();
      await flushQueries();
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
      await flushQueries();
    });

    expect(toastMocks.success).not.toHaveBeenCalledWith('Files uploaded');
    expect(toastMocks.error).toHaveBeenCalledWith('Receipt amount could not be determined');
    expect(apiMocks.mockApiPost).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  });

  it('does not render scanned receipts from the receipts feed as duplicate items', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: statementRows([
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
            ]),
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

    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([
      {
        id: 'receipt-1',
        source: 'scan',
        receiptSource: 'scan',
        fileName: 'Walmart',
        status: 'draft',
        totalTransactions: 0,
        totalDebit: 90.32,
        totalCredit: null,
        createdAt: '2026-03-27T00:00:00Z',
        statementDateFrom: '2026-03-27T00:00:00Z',
        statementDateTo: null,
        bankName: 'receipt',
        fileType: 'receipt',
        currency: 'KZT',
        user: null,
        errorMessage: null,
      },
    ]);

    await act(async () => {
      renderView();
      await flushQueries();
    });

    const renderedIds = statementsListItemPropsSpy.mock.calls
      .map((call: any[]) => call[0]?.statement?.id)
      .filter(Boolean);

    // Скан и его выписка — один документ: с 983cdaf1 строку даёт чек, а
    // выписку, порождённую сканом, список пропускает.
    expect(renderedIds).toContain('receipt-1');
    expect(renderedIds).not.toContain('statement-receipt-1');
  });

  it('filters derived receipt statements even when api rows omit source', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/categories' || url === '/tax-rates') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: statementRows([
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
            ]),
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

    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([
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
      renderView();
      await flushQueries();
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
    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([
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
      renderView();
      await flushQueries();
    });

    await act(async () => {
      getLatestRenderedStatementProps()[0]?.onView?.();
      await flushQueries();
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
            data: statementRows([
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
            ]),
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      renderView();
      await flushQueries();
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
            data: statementRows([
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
            ]),
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    apiMocks.mockListReceipts.mockResolvedValue({ data: { receipts: [] } });

    await act(async () => {
      renderView();
      await flushQueries();
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
            data: statementRows([
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
            ]),
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
      renderView();
      await flushQueries();
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
      await flushQueries();
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
    // Черновой скан не одобрен: без этого Approved: Yes из сохранённых фильтров его скрыл бы.
    storedFilters.overrides = { approved: null };
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
    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([
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
    ]);

    await act(async () => {
      renderView();
      await flushQueries();
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
      await flushQueries();
    });

    expect(apiMocks.mockApiGet).toHaveBeenCalledWith('/receipts/scan-1/file', {
      responseType: 'blob',
    });
    expect(apiMocks.mockApiGet).not.toHaveBeenCalledWith('/statements/scan-1/file', {
      responseType: 'blob',
    });
  });

  it('deletes scanned receipts through the receipts endpoint', async () => {
    // Черновой скан не одобрен: без этого Approved: Yes из сохранённых фильтров его скрыл бы.
    storedFilters.overrides = { approved: null };
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
    receiptMappingMocks.mockMapReceiptsToStatements.mockReturnValue([
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
    ]);

    await act(async () => {
      renderView();
      await flushQueries();
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
      await flushQueries();
    });

    expect(apiMocks.mockApiDelete).toHaveBeenCalledWith('/receipts/scan-1');
    expect(apiMocks.mockApiDelete).not.toHaveBeenCalledWith('/statements/scan-1');
  });
});
