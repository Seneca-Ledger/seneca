// @vitest-environment jsdom
import { categoryItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/app/components/dashboard/test-setup';

const apiGet = vi.hoisted(() => vi.fn());
const authUser = vi.hoisted(() => ({ id: 'user-1' }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
  },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    title: 'Categories',
    subtitle: 'Subtitle',
    add: 'Add',
    enabled: 'Enabled',
    more: 'More',
    searchPlaceholder: 'Find category',
    type: {
      label: { value: 'Type' },
      income: 'Income',
      expense: 'Expense',
    },
    toasts: {
      loadFailed: { value: 'Failed to load categories' },
      updated: { value: 'Updated' },
      created: { value: 'Created' },
      saveFailed: { value: 'Failed to save category' },
      iconUploaded: { value: 'Icon uploaded' },
      iconUploadFailed: { value: 'Icon upload failed' },
    },
    dialog: {
      editTitle: 'Edit category',
      createTitle: 'Create category',
      nameLabel: { value: 'Name' },
      placeholderName: { value: 'Category name' },
      chooseIcon: 'Choose icon',
      uploadedIcon: 'Uploaded icon',
      uploadIcon: 'Upload icon',
      chooseColor: 'Choose color',
      preview: 'Preview',
      cancel: 'Cancel',
      save: 'Save',
      uploading: 'Uploading',
    },
    sourceBadges: {
      parsing: { value: 'Parsing data' },
      system: { value: 'System' },
    },
    manage: {
      disableHint: 'Disabling a category will hide it from statements and reports.',
      selectedCount: { value: '{count} selected' },
      enable: 'Enable',
      disable: 'Disable',
      deleteCustom: 'Delete Custom',
      selectAll: { value: 'Select all categories' },
      usedIn: { value: 'Used in {count} transactions' },
      notUsed: 'Not used yet',
      editAria: { value: 'Edit {name}' },
      toggleAria: { value: '{name} enabled' },
      confirmBulkDelete: { value: 'Delete selected custom categories?' },
      toasts: {
        enabled: { value: 'Categories enabled' },
        disabled: { value: 'Categories disabled' },
        deleted: { value: 'Categories deleted' },
        deleteFailed: { value: 'Failed to delete some categories' },
      },
      disableDialog: {
        title: 'Disable category?',
        usedIn: { value: 'Category {name} is already used in:' },
        transactionsOne: { value: '{count} transaction' },
        transactionsMany: { value: '{count} transactions' },
        statementsOne: { value: '{count} statement' },
        statementsMany: { value: '{count} statements' },
        warning: 'Existing items will show a warning until a new category is selected.',
      },
    },
  }),
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));

describe('WorkspaceCategoriesView', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({
          data: [
            categoryItem({
              id: 'cat-parsing',
              name: 'Kaspi Delivery',
              type: 'expense',
              isSystem: false,
              isEnabled: true,
              source: 'parsing',
            }),
            categoryItem({
              id: 'cat-system',
              name: 'Taxes',
              type: 'expense',
              isSystem: true,
              isEnabled: true,
              source: 'system',
            }),
          ],
        });
      }

      if (url === '/categories/usage/counts') {
        return Promise.resolve({ data: {} });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  it('renders parsing categories with parsing badge instead of system', async () => {
    const { default: WorkspaceCategoriesView } = await import('./WorkspaceCategoriesView');

    renderWithQuery(<WorkspaceCategoriesView />);

    await waitFor(() => {
      expect(screen.getByText('Kaspi Delivery')).toBeInTheDocument();
    });

    expect(screen.getByText('Parsing data')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.queryAllByText('System')).toHaveLength(1);
  });

  it('localizes system categories but keeps parsing category names raw', async () => {
    const { default: WorkspaceCategoriesView } = await import('./WorkspaceCategoriesView');

    apiGet.mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({
          data: [
            categoryItem({
              id: 'cat-system',
              name: 'Аренда',
              type: 'expense',
              isSystem: true,
              isEnabled: true,
              source: 'system',
            }),
            categoryItem({
              id: 'cat-parsing',
              name: 'Зарплаты сотрудникам',
              type: 'expense',
              isSystem: false,
              isEnabled: true,
              source: 'parsing',
            }),
          ],
        });
      }

      if (url === '/categories/usage/counts') {
        return Promise.resolve({ data: {} });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    renderWithQuery(<WorkspaceCategoriesView />);

    await waitFor(() => {
      expect(screen.getByText('Rent')).toBeInTheDocument();
    });

    expect(screen.getByText('Зарплаты сотрудникам')).toBeInTheDocument();
    expect(screen.queryByText('Аренда')).not.toBeInTheDocument();
    // The selection checkbox is named the way the row reads.
    expect(screen.getByRole('checkbox', { name: 'Rent' })).toBeInTheDocument();
    expect(screen.queryByText('Payroll expenses')).not.toBeInTheDocument();
  });

  it('uses dark-safe surfaces instead of white category rows', async () => {
    const { default: WorkspaceCategoriesView } = await import('./WorkspaceCategoriesView');

    const { container } = renderWithQuery(<WorkspaceCategoriesView />);

    await waitFor(() => {
      expect(screen.getByText('Kaspi Delivery')).toBeInTheDocument();
    });

    expect(container.innerHTML).not.toContain('bg-white');
    expect(container.innerHTML).not.toContain('bg-slate-50');
  });

  it('renders category enabled controls as switches', async () => {
    const { default: WorkspaceCategoriesView } = await import('./WorkspaceCategoriesView');

    renderWithQuery(<WorkspaceCategoriesView />);

    await waitFor(() => {
      expect(screen.getByText('Kaspi Delivery')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('switch', { name: /enabled/i })).toHaveLength(2);
  });

  it('does not render ripple feedback for category enabled switches', async () => {
    const { default: WorkspaceCategoriesView } = await import('./WorkspaceCategoriesView');

    const { container } = renderWithQuery(<WorkspaceCategoriesView />);

    await waitFor(() => {
      expect(screen.getByText('Kaspi Delivery')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getAllByRole('switch', { name: /enabled/i })[0]);

    expect(container.querySelector('.MuiTouchRipple-root')).toBeNull();
  });
});
