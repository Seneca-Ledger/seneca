// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryItem, CategoryUsageCounts } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { categoryItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import '@/app/components/dashboard/test-setup';
import CategoriesPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));

const parsingCategory = categoryItem({
  id: 'cat-parsing',
  name: 'ACME Delivery',
  source: 'parsing',
});
const systemCategory = categoryItem({
  id: 'cat-system',
  name: 'Аренда',
  isSystem: true,
  source: 'system',
});
const customCategory = categoryItem({ id: 'cat-custom', name: 'Garden Supplies' });

function serve(categories: CategoryItem[], usage: CategoryUsageCounts = {}) {
  api.get.mockImplementation((url: string) => {
    if (url === '/categories') return Promise.resolve(apiResponse(categories));
    if (url === '/categories/usage/counts') return Promise.resolve(apiResponse(usage));
    const usageOne = /^\/categories\/(.+)\/usage-count$/.exec(url);
    if (usageOne) {
      return Promise.resolve(
        apiResponse(usage[usageOne[1]] ?? { transactions: 0, statements: 0, total: 0 }),
      );
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

async function openMenu(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions: ${name}` }));
}

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.put.mockResolvedValue(apiResponse({}));
    api.delete.mockResolvedValue(apiResponse({}));
  });

  it('marks parsing categories as parsing and system ones with a lock', async () => {
    serve([parsingCategory, systemCategory]);
    renderWithQuery(<CategoriesPage />);

    expect(await screen.findByText(parsingCategory.name)).toBeInTheDocument();
    expect(screen.getByText('Parsing data')).toBeInTheDocument();
    expect(screen.getAllByLabelText('System')).toHaveLength(1);
  });

  it('localizes system category names but keeps parsed names as they came', async () => {
    const parsedName = 'Зарплаты сотрудникам';
    serve([systemCategory, categoryItem({ id: 'cat-raw', name: parsedName, source: 'parsing' })]);
    renderWithQuery(<CategoriesPage />);

    expect(await screen.findByText('Rent')).toBeInTheDocument();
    expect(screen.getByText(parsedName)).toBeInTheDocument();
    expect(screen.queryByText(systemCategory.name)).not.toBeInTheDocument();
  });

  it('uses theme surfaces, not white or slate rows', async () => {
    serve([parsingCategory]);
    const { container } = renderWithQuery(<CategoriesPage />);

    await screen.findByText(parsingCategory.name);
    expect(container.innerHTML).not.toContain('bg-white');
    expect(container.innerHTML).not.toContain('bg-slate-50');
  });

  it('shows the last activity and how often a category was used', async () => {
    serve([customCategory, parsingCategory], {
      [customCategory.id]: { transactions: 3, statements: 0, total: 3, lastUsedAt: '2026-03-14' },
    });
    renderWithQuery(<CategoriesPage />);

    expect(await screen.findByText('3 uses')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('filters the list by the search in the name header', async () => {
    serve([parsingCategory, customCategory]);
    renderWithQuery(<CategoriesPage />);

    await screen.findByText(customCategory.name);
    fireEvent.change(screen.getByLabelText('Find category'), { target: { value: 'garden' } });

    expect(screen.getByText(customCategory.name)).toBeInTheDocument();
    expect(screen.queryByText(parsingCategory.name)).not.toBeInTheDocument();
  });

  it('offers delete only for custom categories', async () => {
    serve([systemCategory, customCategory]);
    renderWithQuery(<CategoriesPage />);

    await openMenu('Аренда');
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    await openMenu(customCategory.name);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('deletes a custom category after the confirmation', async () => {
    serve([customCategory]);
    renderWithQuery(<CategoriesPage />);

    await openMenu(customCategory.name);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(await screen.findByText('Delete category?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/categories/${customCategory.id}`));
  });

  it('asks before disabling a category that is in use', async () => {
    serve([customCategory], {
      [customCategory.id]: { transactions: 2, statements: 1, total: 3 },
    });
    renderWithQuery(<CategoriesPage />);

    await openMenu(customCategory.name);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disable' }));

    expect(await screen.findByText('2 transactions')).toBeInTheDocument();
    expect(screen.getByText('1 statement')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(`/categories/${customCategory.id}`, {
        isEnabled: false,
      }),
    );
  });

  it('disables an unused category straight away', async () => {
    serve([customCategory]);
    renderWithQuery(<CategoriesPage />);

    await openMenu(customCategory.name);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disable' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(`/categories/${customCategory.id}`, {
        isEnabled: false,
      }),
    );
  });

  it('shows an empty state with a create button when there are no categories', async () => {
    serve([]);
    renderWithQuery(<CategoriesPage />);

    expect(await screen.findByText('Create a category to group your transactions.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create a new category' }).length).toBeGreaterThan(0);
  });
});
