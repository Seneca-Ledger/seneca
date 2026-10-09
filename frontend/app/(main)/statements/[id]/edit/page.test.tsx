import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPatch = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());

const push = vi.hoisted(() => vi.fn());
const back = vi.hoisted(() => vi.fn());
const authUser = vi.hoisted(() => ({ id: 'user-1' }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
    patch: apiPatch,
    post: apiPost,
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
  useRouter: () => ({ push, back }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('./ParsingWarningsPanel', () => ({
  ParsingWarningsPanel: ({
    onResolveWarning,
  }: {
    onResolveWarning?: (warning: string, index: number) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onResolveWarning?.('Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)', 0)
      }
    >
      Resolve balance warning
    </button>
  ),
  formatDroppedSample: (value: unknown) => String(value),
}));

vi.mock('./StatementCategoryDrawer', () => ({
  default: () => null,
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('EditStatementPage locale', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
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

    apiGet.mockImplementation((url: string) => {
      if (url === '/statements/statement-1') {
        return Promise.resolve({
          data: {
            id: 'statement-1',
            fileName: 'statement.pdf',
            status: 'completed',
            totalTransactions: 1,
            categoryId: 'cat-1',
            category: { id: 'cat-1', name: 'Services', isEnabled: true },
            statementDateFrom: '2026-03-01',
            statementDateTo: '2026-03-17',
            balanceStart: 100,
            balanceEnd: 200,
            parsingDetails: {
              warnings: ['Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)'],
              errors: [],
            },
          },
        });
      }

      if (url === '/transactions?statement_id=statement-1&limit=1000') {
        return Promise.resolve({
          data: [
            {
              id: 'tx-1',
              transactionDate: '2026-03-17T00:00:00.000Z',
              counterpartyName: 'Test counterparty',
              paymentPurpose: 'Payment for services',
              debit: 125,
              credit: 0,
              transactionType: 'expense',
              isVerified: false,
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Services', isEnabled: true },
            },
          ],
        });
      }

      if (url === '/categories') {
        return Promise.resolve({
          data: [{ id: 'cat-1', name: 'Services', isEnabled: true }],
        });
      }

      if (url === '/branches' || url === '/wallets') {
        return Promise.resolve({ data: [] });
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

  it('renders transaction table headers in English when locale is en', async () => {
    const { default: EditStatementPage } = await import('./page');

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

  it('centers the loading spinner while statement details are loading', async () => {
    const { default: EditStatementPage } = await import('./page');

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

    const loadingContainer = container.querySelector('[data-testid="statement-edit-loading"]');
    const spinner = container.querySelector('[role="status"]');

    expect(spinner).toBeTruthy();
    expect(loadingContainer).toBeTruthy();
    expect(loadingContainer?.className).toContain('flex');
    expect(loadingContainer?.className).toContain('items-center');
    expect(loadingContainer?.className).toContain('justify-center');
    expect(loadingContainer?.className).toContain('min-h-[60vh]');
  });

  it('uses dark surfaces for parsing details and transactions headers', async () => {
    const { default: EditStatementPage } = await import('./page');

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

    const parsingSummary = container.querySelector('.MuiAccordionSummary-root');
    const tableHeaderRow = container.querySelector('.MuiTableHead-root tr');

    expect(parsingSummary?.className).toContain('dark:bg-[#18222d]');
    expect(tableHeaderRow?.className).toContain('dark:bg-[#18222d]');
  });

  it('uses dark theme styling for the transactions chip and statement category button', async () => {
    const { default: EditStatementPage } = await import('./page');

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

    const transactionsChip = container.querySelector('[data-testid="statement-transactions-chip"]');
    const categoryButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Services'),
    ) as HTMLButtonElement | undefined;

    expect(transactionsChip?.className).toContain('dark:border-slate-700/60');
    expect(transactionsChip?.className).toContain('dark:bg-[#111827]');
    expect(transactionsChip?.className).toContain('dark:text-slate-300');
    expect(categoryButton?.className).toContain('detail-action-button');
    expect(categoryButton?.className).toContain('dark:border-slate-700/60');
    expect(categoryButton?.className).toContain('dark:bg-slate-900');
    expect(categoryButton?.className).toContain('dark:text-slate-200');
    expect(categoryButton?.className).toContain('dark:hover:bg-slate-800');
  });

  it('focuses closing balance input when resolving balance mismatch warning', async () => {
    const { default: EditStatementPage } = await import('./page');

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
    const { default: EditStatementPage } = await import('./page');

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

    const startDateWrapper = container.querySelector(
      '[data-testid="statement-metadata-field-start-date"] [data-slot="input-wrapper"]',
    );
    const endDateWrapper = container.querySelector(
      '[data-testid="statement-metadata-field-end-date"] [data-slot="input-wrapper"]',
    );
    const startDateLabel = container.querySelector(
      '[data-testid="statement-metadata-field-start-date"] [data-slot="label"]',
    );

    expect(startDateWrapper?.className).toContain('min-h-[40px]');
    expect(startDateWrapper?.className).not.toContain('h-14');
    expect(endDateWrapper?.className).toContain('min-h-[40px]');
    expect(endDateWrapper?.className).not.toContain('h-14');
    expect(startDateLabel).toBeNull();
  });

  it('uses shared detail action buttons for statement header actions', async () => {
    const { default: EditStatementPage } = await import('./page');

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
      expect(actionButton?.className).toContain('detail-action-button');
      expect(actionButton?.className).toContain('rounded-lg');
      expect(actionButton?.className).not.toContain('rounded-full');
    }
  });

  it('offers no review-stage moves: what is left to check lives in Review', async () => {
    const { default: EditStatementPage } = await import('./page');

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
    const { default: EditStatementPage } = await import('./page');
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
});
