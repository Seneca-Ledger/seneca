import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categoryItem,
  categoryRef,
  receiptRecord,
  transactionItem,
} from '@/app/test/fixtures/contracts';
import EditStatementPage from './page';

const apiGet = vi.hoisted(() => vi.fn());
const apiPatch = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());
const offerAction = vi.hoisted(() => vi.fn());
// Rows a test adds after the statement's one categorised row.
const extraRows = vi.hoisted(() => ({ value: [] as unknown[] }));

const push = vi.hoisted(() => vi.fn());
const back = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const authUser = vi.hoisted(() => ({ id: 'user-1' }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
    patch: apiPatch,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('@/app/hooks/useAutoSave', () => ({
  useAutoSave: () => undefined,
}));

vi.mock('@/app/i18n', () => {
  const token = (value: string) => ({ value });

  const content = {
    // Read by the shared Spinner (uiShell dictionary); the mock serves every key.
    loading: token('Loading'),
    errors: {
      loadData: token('Failed to load'),
      saveTransaction: token('Failed to save'),
      deleteTransaction: token('Failed to delete'),
      updateTransactions: token('Failed to update'),
      deleteTransactions: token('Failed to delete'),
      assignCategory: token('Failed to assign'),
    },
    labels: {
      back: 'Back',
      alsoFiledPayeeRows: token('Filed {count} more rows of {payee} the same way'),
      undo: token('Undo'),
      keep: token('Keep'),
      disabledSuffix: token(' (disabled)'),
      exportDescription: token('Exported statement'),
      requireCategory: token('Category required'),
      selectCategoryHint: token('Select a category'),
      statementNamePrefix: token('Statement'),
      transactionsCount: token('transactions'),
      parsingDetails: token('Parsing details'),
      exportButton: token('Export to table'),
      exportConfirmTitle: token('Confirm export'),
      exportConfirmBody: token('Confirm export body'),
      exportConfirmConfirm: token('Export'),
      cancel: token('Cancel'),
      categoryButton: token('Category'),
      categoryDrawerTitle: token('Category'),
      categorySearchPlaceholder: token('Search'),
      categoryAllOption: token('All'),
      categoryNoResults: token('No categories found'),
      notSelected: 'Not selected',
      balanceStart: token('Opening balance'),
      balanceEnd: token('Closing balance'),
      period: token('Period'),
      expenses: token('Expenses'),
      income: token('Income'),
      startDate: token('Start date'),
      endDate: token('End date'),
      notSpecified: token('Not specified'),
      openingBalance: token('Opening balance'),
      enterOpeningBalance: token('Enter opening balance'),
      selectedTransactions: token('Selected: {count} transactions'),
      save: token('Save'),
      delete: token('Delete'),
      assignCategory: token('Assign category'),
      assignCategoryForTransactions: token('Assign category for {count} transactions'),
      apply: token('Apply'),
      noCategoryOption: token('No category'),
      submitForApproval: token('Submit'),
      submitBlockedTooltip: token('Assign categories to all transactions before submitting'),
      alertReviewTitle: token('Review statement before submit'),
      alertParsingWarnings: token(
        '{count} parsing warnings found. It is recommended to review flagged rows.',
      ),
      confirmDeleteOne: token('Delete transaction?'),
      confirmDeleteMany: token('Delete {count} transactions?'),
      changesSaved: 'Changes saved successfully!',
      exportLoading: token('Exporting to table...'),
      exportFailure: token('Failed to export to table'),
      exportSuccess: token('Table created successfully'),
      categoryUpdated: token('Statement category updated'),
      categoryUpdateFailed: token('Failed to update statement category'),
      alertNeedsFixTitle: token('Fix required before submit'),
      alertReadyTitle: token('Statement is ready to submit'),
      alertStatementCategoryMissing: token('Statement category is not selected.'),
      alertStatementCategoryDisabled: token(
        'Selected statement category is disabled. Choose an active category.',
      ),
      alertTransactionsCategoryMissing: token(
        '{count} transactions require a category. Assign categories for all rows.',
      ),
      alertParsingErrors: token(
        '{count} parsing errors found. Review parsing details and statement data.',
      ),
      alertNoTransactions: token(
        'No transactions found in this statement. Check file or import settings.',
      ),
      bankDetectedBy: token('Detected by'),
      otherBankMentions: token('Other bank mentions'),
      warnings: token('Warnings'),
      processedLines: token('Lines processed'),
      unapprove: token('Unapprove'),
      pay: token('Pay'),
      rollbackToApprove: token('Return to approve'),
      submitSuccess: token('Statement submitted for approval'),
      unapproveSuccess: token('Statement moved back to submit'),
      paySuccess: token('Statement moved to pay'),
      rollbackToApproveSuccess: token('Statement moved back to approve'),
      alertReadyBody: token('All required categories are assigned. The data looks good and ready to submit.'),
      balanceReviewActual: token('Reported'),
      balanceReviewConfirm: token('Confirm discrepancy'),
      balanceReviewConfirmFailed: token('Failed to confirm the discrepancy'),
      balanceReviewDescription: token('This statement stays out of analytics until you confirm the discrepancy. The usual cause is the parser dropping or misreading rows.'),
      balanceReviewDifference: token('Difference'),
      balanceReviewExpected: token('Expected'),
      balanceReviewTitle: token('Balance does not reconcile'),
      bank: token('Bank'),
      chooseCategory: token('Choose category'),
      closingBalance: token('Closing balance'),
      closingBankSays: token('Bank statement says {amount}'),
      closingMatches: token('Matches the bank statement'),
      confirmAll: token('Confirm all'),
      confirmAllDone: token('Confirmed {count} rows'),
      confirmAllFailed: token('Could not confirm the rows'),
      confirmAllUncategorized: token('{count} rows still need a category'),
      createdTransactions: token('Transactions created'),
      enterManuallyHint: token('Enter manually if it was not detected'),
      errors: token('Errors'),
      extractedMetadata: token('Extracted metadata'),
      fixDroppedRow: token('Fix'),
      format: token('Format'),
      foundTransactions: token('Transactions found'),
      fromFilePrefix: token('From file: '),
    },
    columns: {
      date: token('Date'),
      counterparty: token('Counterparty'),
      paymentPurposeShort: token('Payment purpose'),
      expense: token('Expense'),
      income: token('Income'),
      category: token('Category'),
      actions: token('Actions'),
    },
  };

  return {
    useIntlayer: () => content,
    useLocale: () => ({ locale: 'en' }),
  };
});

// The page reads the custom-tables dictionary for export column titles only.
vi.mock('@/app/(main)/custom-tables/labels', () => ({
  buildSourceColumnTitles: () => ({}),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'statement-1' }),
  useRouter: () => ({ push, back, replace }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/app/components/payees/offer-action-toast', () => ({ offerAction }));

vi.mock('./components/StatementDetailsFields', () => ({
  StatementDetailsFields: () => <div data-testid="statement-tags" />,
}));

vi.mock('@/app/components/notes/NotesPanel', () => ({
  NotesPanel: () => <div data-testid="statement-notes" />,
}));

vi.mock('./ParsingWarningsPanel', () => ({
  ParsingWarningsPanel: ({
    onResolveWarning,
  }: {
    onResolveWarning?: (payload: { warning: string; index: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onResolveWarning?.({
          warning: 'Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)',
          index: 0,
        })
      }
    >
      Resolve balance warning
    </button>
  ),
  formatDroppedSample: (value: unknown) => String(value),
}));

// A stand-in that lists the categories while open, enough to pick one.
vi.mock('./StatementCategoryDrawer', () => ({
  default: ({
    open,
    categories,
    onSelect,
  }: {
    open: boolean;
    categories: { id: string; name: string }[];
    onSelect: (categoryId: string) => void;
  }) =>
    open
      ? categories.map(category => (
          <button
            key={category.id}
            type="button"
            className="seneca-cat-drawer__option"
            onClick={() => onSelect(category.id)}
          >
            {category.name}
          </button>
        ))
      : null,
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const courier = { id: 'payee-2', name: 'Example Courier' };

/** A row of `GET /transactions`: the list item plus what only the list adds. */
function listedRow(overrides: Parameters<typeof transactionItem>[0]) {
  return {
    ...transactionItem(overrides),
    reimbursementOf: null,
    payee: { id: 'payee-1', name: overrides.counterpartyName ?? 'Test counterparty' },
  };
}

/** Two rows of one payee the import left uncategorised. */
function courierRows() {
  return ['tx-2', 'tx-3'].map(id => ({
    ...listedRow({
      id,
      transactionDate: '2026-03-10',
      counterpartyName: courier.name,
      paymentPurpose: 'Delivery',
      debit: '10.00',
      amount: '-10.00',
      currency: 'KZT',
      createdAt: '2026-03-10T08:00:00.000Z',
      updatedAt: '2026-03-10T08:00:00.000Z',
    }),
    payee: courier,
  }));
}

describe('EditStatementPage locale', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    extraRows.value = [];
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();

    apiGet.mockReset();
    apiPatch.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
    push.mockReset();
    back.mockReset();
    replace.mockReset();

    apiGet.mockImplementation((url: string) => {
      if (url === '/statements/statement-1') {
        return Promise.resolve({
          // The wire format (packages/contracts StatementDetail).
          data: {
            id: 'statement-1',
            fileName: 'statement.pdf',
            fileType: 'pdf',
            bankName: 'kaspi',
            status: 'completed',
            stage: 'submit',
            totalTransactions: 1,
            currency: 'KZT',
            categoryId: 'cat-1',
            walletId: null,
            statementDateFrom: '2026-03-01',
            statementDateTo: '2026-03-17',
            balanceStart: '100.00',
            balanceEnd: '200.00',
            createdAt: '2026-03-17T09:00:00.000Z',
            parsingDetails: {
              warnings: ['Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)'],
              errors: [],
            },
          },
        });
      }

      if (url === '/transactions?statement_id=statement-1&limit=1000') {
        return Promise.resolve({
          // The wire format (packages/contracts ListedTransaction): decimals
          // as strings, `date` columns as YYYY-MM-DD, absent values as null.
          data: [
            listedRow({
              id: 'tx-1',
              transactionDate: '2026-03-17',
              counterpartyName: 'Test counterparty',
              paymentPurpose: 'Payment for services',
              debit: '125.00',
              amount: '-125.00',
              currency: 'KZT',
              categoryId: 'cat-1',
              category: categoryRef({ id: 'cat-1', name: 'Services' }),
              createdAt: '2026-03-17T08:00:00.000Z',
              updatedAt: '2026-03-17T08:00:00.000Z',
            }),
            ...extraRows.value,
          ],
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [categoryItem({ id: 'cat-1', name: 'Services' })] });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('sends a scan’s statement on to its receipt instead of opening the editor', async () => {
    const base = apiGet.getMockImplementation() as (url: string) => Promise<unknown>;
    apiGet.mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === '/statements/statement-1') {
        const response = (await base(url)) as { data: Record<string, unknown> };
        return { data: { ...response.data, parsingDetails: { detectedBy: 'receipt-scan' } } };
      }
      if (url === '/receipts') {
        expect(config?.params).toEqual({ statementId: 'statement-1', limit: 1 });
        return {
          data: {
            data: [receiptRecord({ id: 'rc-1', statementId: 'statement-1' })],
            total: 1,
            page: 1,
            limit: 1,
          },
        };
      }
      return base(url);
    });

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });
    await act(async () => {
      await flushPromises();
    });

    expect(replace).toHaveBeenCalledWith('/storage/receipts/rc-1');
    // The editor itself never shows.
    expect(container.textContent).not.toContain('Counterparty');
  });

  it('renders transaction table headers in English when locale is en', async () => {

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Date');
    expect(container.textContent).toContain('Counterparty');
    expect(container.textContent).toContain('Payment purpose');
    expect(container.textContent).toContain('Expense');
    expect(container.textContent).toContain('Income');
    expect(container.textContent).toContain('Category');
    expect(container.textContent).toContain('Actions');

    expect(/[\u0400-\u04FF]/.test(container.textContent || '')).toBe(false);
  });

  it('shows the editor skeleton while statement details are loading', async () => {

    apiGet.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the page in loading state for this test.
        }),
    );

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
      await Promise.resolve();
    });

    // Вместо центрированного спиннера — скелет страницы (EditStatementSkeleton).
    const loadingContainer = container.querySelector('[data-testid="statement-edit-loading"]');

    expect(loadingContainer).toBeTruthy();
    expect(loadingContainer?.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Counterparty');
  });

  it('colours the parsing details link and the summary line from theme variables', async () => {

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    // dark:-классы ушли вместе с Tailwind (99a50b55): цвета — CSS-переменные темы,
    // которые сами переключаются в тёмной теме.
    const parsingSummary = container.querySelector(
      '.MuiAccordionSummary-root .MuiTypography-root',
    ) as HTMLElement | null;
    const summaryLine = container.querySelector(
      '[data-testid="statement-transactions-chip"]',
    ) as HTMLElement | null;

    expect(parsingSummary?.textContent).toBe('Parsing details');
    expect(getComputedStyle(parsingSummary as HTMLElement).color).toBe('var(--primary)');
    expect(summaryLine?.textContent).toContain('1 transactions · KZT');
    expect(getComputedStyle(summaryLine as HTMLElement).color).toBe('var(--text-muted)');
  });

  it('has no statement-wide category: no header button, nothing to fix for it', async () => {
    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    const headerLabels = Array.from(container.querySelectorAll('button')).map(button =>
      button.textContent?.trim(),
    );
    expect(headerLabels).not.toContain('Category');
    expect(headerLabels).not.toContain('Choose category');
    expect(container.textContent).not.toContain('Statement category is not selected.');
  });

  it('sets a row category from a click on it, with no pencil and no edit mode', async () => {
    apiPut.mockResolvedValue({ data: {} });

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });
    await act(async () => {
      await flushPromises();
    });

    const chip = Array.from(container.querySelectorAll('table button')).find(
      button => button.textContent?.trim() === 'Services',
    ) as HTMLButtonElement | undefined;
    expect(chip).toBeTruthy();
    expect(container.querySelector('table input[type="text"], table textarea')).toBeNull();
    await act(async () => {
      chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const option = Array.from(document.querySelectorAll('.seneca-cat-drawer__option')).find(
      button => button.textContent?.includes('Services'),
    ) as HTMLButtonElement | undefined;
    expect(option).toBeTruthy();
    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(apiPut).toHaveBeenCalledWith('/transactions/tx-1', { categoryId: 'cat-1' });
  });

  it('focuses closing balance input when resolving balance mismatch warning', async () => {

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    const resolveButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Resolve balance warning'),
    ) as HTMLButtonElement | undefined;

    expect(resolveButton).toBeTruthy();

    await act(async () => {
      resolveButton?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      await flushPromises();
    });

    const closingBalanceInput = Array.from(container.querySelectorAll('input')).find(input =>
      (input.value || '').includes('200'),
    ) as HTMLInputElement | undefined;

    expect(closingBalanceInput).toBeTruthy();
    expect(document.activeElement).toBe(closingBalanceInput);
  });

  it('renders start and end date fields in the same metadata shell as balance fields', async () => {

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    const metadataShells = Array.from(
      container.querySelectorAll('[data-testid^="statement-metadata-field-"]'),
    );

    expect(
      container.querySelector('[data-testid="statement-metadata-field-start-date"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="statement-metadata-field-end-date"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="statement-metadata-field-opening-balance"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="statement-metadata-field-closing-balance"]'),
    ).toBeTruthy();
    expect(metadataShells).toHaveLength(4);

    // Все четыре поля — MUI-поля одного (small) размера с меткой внутри поля.
    for (const shell of metadataShells) {
      expect(shell.querySelector('.MuiInputLabel-sizeSmall')).toBeTruthy();
    }
  });

  it('uses shared detail action buttons for statement header actions', async () => {

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    const actionLabels = ['Export to table'];

    for (const label of actionLabels) {
      const actionButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(label),
      ) as HTMLButtonElement | undefined;

      expect(actionButton).toBeTruthy();
      expect(actionButton?.className).toContain('MuiButton-outlined');
      expect(actionButton?.className).toContain('MuiButton-sizeSmall');
    }
  });

  it('offers no review-stage moves: what is left to check lives in Review', async () => {

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });
    await act(async () => {
      await flushPromises();
    });

    const labels = Array.from(container.querySelectorAll('button')).map(button =>
      button.textContent?.trim(),
    );
    for (const stageLabel of ['Submit', 'Unapprove', 'Pay', 'Return to approve']) {
      expect(labels).not.toContain(stageLabel);
    }
  });

  it('confirms every categorised row of the statement in one go', async () => {
    apiPost.mockResolvedValue({ data: { approved: 1, uncategorized: 0 } });

    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });
    await act(async () => {
      await flushPromises();
    });
    const loadsBefore = apiGet.mock.calls.length;

    const confirmButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Confirm all',
    ) as HTMLButtonElement | undefined;
    expect(confirmButton?.disabled).toBe(false);
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(apiPost).toHaveBeenCalledWith('/review-inbox/statements/statement-1/approve');
    expect(apiGet.mock.calls.length).toBeGreaterThan(loadsBefore);
  });

  const renderPage = async () => {
    await act(async () => {
      root.render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <EditStatementPage />
        </LocalizationProvider>,
      );
    });
    await act(async () => {
      await flushPromises();
    });
  };
  const click = async (element: Element | undefined) => {
    expect(element).toBeTruthy();
    await act(async () => {
      element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });
  };
  const pickCategory = (name: string) =>
    click(
      Array.from(document.querySelectorAll('.seneca-cat-drawer__option')).find(
        button => button.textContent?.includes(name),
      ),
    );

  it('opens on payees while rows wait, and one pick files all of a payee’s rows', async () => {
    extraRows.value = courierRows();
    apiPost.mockResolvedValue({ data: {} });
    await renderPage();

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const payeesTab = tabs.find(tab => tab.textContent?.startsWith('By payee'));
    expect(payeesTab?.getAttribute('aria-selected')).toBe('true');
    expect(payeesTab?.textContent).toBe('By payee · 1');

    const courierGroup = Array.from(container.querySelectorAll('table tbody tr')).find(row =>
      row.textContent?.includes(courier.name),
    );
    expect(courierGroup?.textContent).toContain('2');
    await click(courierGroup);
    await pickCategory('Services');

    expect(apiPost).toHaveBeenCalledWith('/transactions/bulk-update', {
      items: [
        { id: 'tx-2', updates: { categoryId: 'cat-1' } },
        { id: 'tx-3', updates: { categoryId: 'cat-1' } },
      ],
    });
    expect(offerAction).not.toHaveBeenCalled();
  });

  it('files a payee’s waiting rows along with the one picked, and offers to undo them', async () => {
    extraRows.value = courierRows();
    apiPost.mockResolvedValue({ data: {} });
    await renderPage();

    await click(
      Array.from(container.querySelectorAll('[role="tab"]')).find(
        tab => tab.textContent === 'Rows',
      ),
    );
    const courierChip = Array.from(container.querySelectorAll('table tbody tr'))
      .find(row => row.textContent?.includes(courier.name))
      ?.querySelector('.seneca-stmt-edit-table__category');
    await click(courierChip ?? undefined);
    await pickCategory('Services');

    expect(apiPost).toHaveBeenCalledWith('/transactions/bulk-update', {
      items: [
        { id: 'tx-2', updates: { categoryId: 'cat-1' } },
        { id: 'tx-3', updates: { categoryId: 'cat-1' } },
      ],
    });
    expect(offerAction).toHaveBeenCalledTimes(1);
    const offer = offerAction.mock.calls[0]?.[0] as { message: string; onApply: () => void };
    expect(offer.message).toBe(`Filed 1 more rows of ${courier.name} the same way`);

    apiPost.mockClear();
    await act(async () => {
      offer.onApply();
      await flushPromises();
    });
    expect(apiPut).toHaveBeenCalledWith('/transactions/tx-3', { categoryId: null });
  });

  it('files every row still waiting with one pick from the tail line', async () => {
    extraRows.value = courierRows();
    apiPost.mockResolvedValue({ data: {} });
    await renderPage();

    expect(container.textContent).toContain('2 rows still without a category');
    await click(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'File them all at once',
      ),
    );
    await pickCategory('Services');

    expect(apiPost).toHaveBeenCalledWith('/transactions/bulk-update', {
      items: [
        { id: 'tx-2', updates: { categoryId: 'cat-1' } },
        { id: 'tx-3', updates: { categoryId: 'cat-1' } },
      ],
    });
  });

  it('asks once for suggestions while rows wait, and reloads the rows when some came', async () => {
    extraRows.value = courierRows();
    const url = '/classification/statements/statement-1/suggestions';
    apiPost.mockImplementation(async (target: string) =>
      target === url ? { data: { suggested: 2, unchanged: 0 } } : { data: {} },
    );
    await renderPage();
    await act(async () => {
      await flushPromises();
    });

    const asked = apiPost.mock.calls.filter(([target]) => target === url);
    expect(asked).toHaveLength(1);
    const rowLoads = apiGet.mock.calls.filter(([target]) =>
      String(target).startsWith('/transactions?statement_id=statement-1'),
    );
    expect(rowLoads.length).toBeGreaterThan(1);
  });

  it('does not ask for suggestions when every row has a category', async () => {
    await renderPage();

    expect(
      apiPost.mock.calls.some(([target]) => String(target).includes('/suggestions')),
    ).toBe(false);
  });
});
