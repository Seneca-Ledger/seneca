import type { AuditEvent } from '@/lib/api/audit';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const fetchAuditEvents = vi.hoisted(() => vi.fn());
const i18nContent = vi.hoisted(() => ({
  title: 'Admin panel',
  tabs: {
    statementsLog: 'Statements log',
    users: 'User management',
    audit: 'Audit log',
  },
  errors: {
    loadStatements: { value: 'Failed to load statements' },
    loadAudit: { value: 'Failed to load audit log' },
    reprocess: { value: 'Failed to reprocess' },
    delete: { value: 'Failed to delete statement' },
  },
  confirmDelete: { value: 'Are you sure you want to delete this statement?' },
  status: {
    completed: { value: 'Completed' },
    processing: { value: 'Processing' },
    error: { value: 'Error' },
  },
  search: 'Search',
  refresh: 'Refresh',
  table: {
    file: 'File',
    type: 'Type',
    bank: 'Bank',
    status: 'Status',
    transactions: 'Transactions',
    uploadedAt: 'Upload date',
    processedAt: 'Processed at',
    actions: 'Actions',
  },
  usersTab: {
    hint: 'Go to the user management page to configure access permissions.',
    button: 'Manage users',
  },
  auditTab: {
    empty: 'No entries yet',
    title: 'Audit log',
    helper: 'Track workspace activity and rollbacks.',
    action: 'Action',
    description: 'Description',
    user: 'User',
    date: 'Date',
    loading: 'Loading audit events...',
    filters: {
      title: 'Filters',
      all: 'All',
      entityType: 'Entity Type',
      user: 'User',
      action: 'Action',
      entityId: 'Entity ID',
      severity: 'Severity',
      dateFrom: 'Date From',
      dateTo: 'Date To',
    },
  },
  errorDialog: {
    title: 'Error details',
    close: 'Close',
  },
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api/audit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/audit')>()),
  fetchAuditEvents,
}));

vi.mock('next-intlayer', () => ({
  useIntlayer: () => i18nContent,
  useLocale: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

const auditEvent: AuditEvent = {
  id: 'event-1',
  workspaceId: 'workspace-1',
  createdAt: '2026-02-01T12:00:00.000Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'Sam C',
  entityType: 'transaction',
  entityId: 'txn-123',
  action: 'update',
  description: 'Изменена сумма транзакции',
  diff: {
    before: { amount: 10 },
    after: { amount: 20 },
  },
  meta: null,
  batchId: null,
  severity: 'warn',
  isUndoable: true,
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('AdminPage audit tab', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiGet.mockReset();
    fetchAuditEvents.mockReset();
  });

  it('renders audit filters and table columns on audit tab', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } });
    fetchAuditEvents.mockResolvedValue({
      data: [auditEvent],
      total: 1,
      page: 1,
      limit: 50,
    });

    const { default: AdminPage } = await import('./page');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<AdminPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    const auditTab = tabs[2];

    expect(auditTab).toBeTruthy();

    await act(async () => {
      auditTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Entity Type');
    expect(container.textContent).toContain('User');
    expect(container.textContent).toContain('Action');
    expect(container.textContent).toContain('Severity');
    expect(container.textContent).toContain('Date From');
    expect(container.textContent).toContain('Date To');

    const headers = Array.from(container.querySelectorAll('th')).map(header =>
      header.textContent?.trim(),
    );

    expect(headers).toEqual(['Action', 'Object', 'Description', 'User', 'Date', 'Severity']);
  }, 10000);
});
