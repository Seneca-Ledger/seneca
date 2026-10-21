// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { renderHookWithQuery } from '@/app/test/query-wrapper';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => 'toast-1'),
  dismiss: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: toastMocks }));

import { closeCommandPalette } from '@/app/components/command-palette/command-palette-store';
import { usePaletteExtras } from '@/app/components/command-palette/page-commands-store';
import type { StatementsStatement } from './statementsViewTypes';
import { type DocumentSelectionView, useDocumentSelectionCommands } from './useDocumentSelectionCommands';

const GROCERIES = { id: 'cat-groceries', name: 'Groceries' };

function row(overrides: Partial<StatementsStatement> & { id: string }): StatementsStatement {
  return {
    fileName: 'ACME Bank - March',
    status: 'completed',
    totalTransactions: 3,
    createdAt: '2026-03-31T00:00:00.000Z',
    bankName: 'acme',
    fileType: 'pdf',
    ...overrides,
  };
}

const BANK = row({ id: 'stmt-1', source: 'statement', category: GROCERIES });
const SCAN = row({ id: 'receipt-1', source: 'scan', statementId: 'stmt-of-scan', category: GROCERIES });
const UNLINKED_SCAN = row({ id: 'receipt-2', source: 'scan', statementId: null });

function view(overrides: Partial<DocumentSelectionView> = {}): DocumentSelectionView {
  return {
    paginatedDisplayStatements: [BANK, SCAN, UNLINKED_SCAN],
    selectedStatementIds: [],
    setSelectedStatementIds: vi.fn(),
    selectedCount: 0,
    hasSelectedDuplicates: false,
    duplicateStatementIds: [],
    handleToggleSelectAll: vi.fn(),
    handleExportSelected: vi.fn(),
    handleDeleteSelected: vi.fn(),
    handleMarkSelectedAsDuplicate: vi.fn(),
    handleDismissSelectedDuplicates: vi.fn(),
    handleSelectDetectedDuplicates: vi.fn(),
    handleMergeSelectedDuplicates: vi.fn(),
    ...overrides,
  };
}

const allSelected = (): Partial<DocumentSelectionView> => ({
  selectedStatementIds: [BANK.id, SCAN.id, UNLINKED_SCAN.id],
  selectedCount: 3,
});

function mount(v: DocumentSelectionView, push = vi.fn()) {
  const hook = renderHookWithQuery(() => {
    useDocumentSelectionCommands(v, push);
    return usePaletteExtras();
  });
  return { ...hook, push };
}

function press(init: KeyboardEventInit, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function tableItem(id: string, name: string, filters: Record<string, unknown>) {
  return {
    id,
    name,
    description: null,
    source: 'manual',
    categoryId: null,
    category: null,
    viewSettings: null,
    sourceBinding: { kind: 'transactions', filters, syncedAt: null },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  for (const mock of [...Object.values(apiMocks), ...Object.values(toastMocks)]) {
    mock.mockReset();
  }
  toastMocks.loading.mockReturnValue('toast-1');
  closeCommandPalette();
});

describe('useDocumentSelectionCommands', () => {
  it('selects every document on the page with Ctrl+A and keeps the text unselected', () => {
    const v = view();
    mount(v);
    const event = press({ key: 'a', code: 'KeyA', ctrlKey: true });
    expect(v.handleToggleSelectAll).toHaveBeenCalledWith(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('clears the selection on Escape, and leaves Escape alone when nothing is selected', () => {
    const empty = view();
    const first = mount(empty);
    expect(press({ key: 'Escape', code: 'Escape' }).defaultPrevented).toBe(false);
    expect(empty.setSelectedStatementIds).not.toHaveBeenCalled();
    first.unmount();

    const some = view(allSelected());
    mount(some);
    press({ key: 'Escape', code: 'Escape' });
    expect(some.setSelectedStatementIds).toHaveBeenCalledWith([]);
  });

  it('leaves keys pressed inside a dialog to the dialog', () => {
    const v = view(allSelected());
    mount(v);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    document.body.append(dialog);
    press({ key: 'Escape', code: 'Escape' }, button);
    expect(v.setSelectedStatementIds).not.toHaveBeenCalled();
    dialog.remove();
  });

  it('offers the categories on the page with counts and selects the picked one', () => {
    const v = view();
    const { result } = mount(v);
    press({ key: 's', code: 'KeyS' });
    press({ key: 'c', code: 'KeyC' });

    const picker = result.current.picker;
    expect(picker?.items.map(item => [item.label, item.hint])).toEqual([
      ['Groceries', '2'],
      ['No category', '1'],
    ]);
    picker?.onPick(GROCERIES.id);
    expect(v.setSelectedStatementIds).toHaveBeenCalledWith([BANK.id, SCAN.id]);
  });

  it('lends the palette its commands under the selection count', () => {
    const { result } = mount(view(allSelected()));
    expect(result.current.page?.title).toBe('3 selected');
    expect(result.current.page?.commands.map(command => command.id)).toContain(
      'documents.createTable',
    );
  });

  it('builds a table from the statements behind the selection and opens it', async () => {
    apiMocks.post.mockResolvedValue(
      apiResponse({ tableId: 'table-1', columnsCreated: 8, rowsCreated: 4 }),
    );
    const { push } = mount(view(allSelected()));
    press({ key: 't', code: 'KeyT' });
    press({ key: 'n', code: 'KeyN' });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/custom-tables/table-1'));
    expect(apiMocks.post).toHaveBeenCalledWith(
      '/custom-tables/from-source',
      expect.objectContaining({
        kind: 'transactions',
        filters: { statementIds: [BANK.id, 'stmt-of-scan'] },
      }),
    );
  });

  it('adds the selection only to tables built from documents', async () => {
    apiMocks.get.mockResolvedValue(
      apiResponse({
        items: [
          tableItem('table-docs', 'March documents', { statementIds: ['stmt-9'] }),
          tableItem('table-range', 'Since September', { dateFrom: '2026-09-01' }),
        ],
      }),
    );
    apiMocks.post.mockResolvedValue(
      apiResponse({
        tableId: 'table-docs',
        inserted: 4,
        updated: 0,
        unchanged: 2,
        total: 6,
        syncedAt: '2026-10-20T00:00:00.000Z',
      }),
    );
    const { result } = mount(view(allSelected()));
    press({ key: 't', code: 'KeyT' });
    press({ key: 'a', code: 'KeyA' });

    await waitFor(() => expect(result.current.picker).not.toBeNull());
    expect(result.current.picker?.items.map(item => item.label)).toEqual(['March documents']);
    act(() => result.current.picker?.onPick('table-docs'));

    await waitFor(() =>
      expect(toastMocks.success).toHaveBeenCalledWith('Added to “March documents”: 4'),
    );
    expect(apiMocks.post).toHaveBeenCalledWith('/custom-tables/table-docs/source-statements', {
      statementIds: [BANK.id, 'stmt-of-scan'],
    });
  });

  it('refuses a table when only scans without a statement are selected', () => {
    mount(view({ selectedStatementIds: [UNLINKED_SCAN.id], selectedCount: 1 }));
    press({ key: 't', code: 'KeyT' });
    press({ key: 'n', code: 'KeyN' });
    expect(apiMocks.post).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      'The selected documents have no transactions for a table',
    );
  });
});
