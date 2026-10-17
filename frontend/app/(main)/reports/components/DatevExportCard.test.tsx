// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const saveBlob = vi.hoisted(() => vi.fn());
const appLocale = vi.hoisted(() => ({ current: 'en' }));
// A key's text is the key itself unless a test gives it a template.
const templates = vi.hoisted(() => ({ current: {} as Record<string, string> }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: appLocale.current }),
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          const text = templates.current[String(key)] ?? String(key);
          return { value: text, toString: () => text };
        },
      },
    ),
}));
vi.mock('./tax-return.helpers', async importOriginal => ({
  ...(await importOriginal<typeof import('./tax-return.helpers')>()),
  saveBlob,
}));

import { DatevExportCard } from './DatevExportCard';

const SETTINGS = {
  available: true,
  chart: '03',
  consultantNumber: 29098,
  clientNumber: 55003,
  bankAccount: '1200',
  accounts: { 'cat-rent': '4210' },
  bankAccounts: {},
};

const CATEGORIES = [
  {
    categoryId: 'cat-office',
    name: 'Office supplies',
    type: 'expense',
    transactionCount: 4,
    account: null,
    suggestion: { concept: 'office_supplies', account: '4930', name: 'Bürobedarf' },
  },
  {
    categoryId: 'cat-rent',
    name: 'Rent',
    type: 'expense',
    transactionCount: 2,
    account: '4210',
    suggestion: { concept: 'rent', account: '4210', name: 'Miete' },
  },
  { categoryId: 'cat-travel', name: 'Travel', type: 'expense', transactionCount: 1, account: null, suggestion: null },
];

const MAPPING = {
  categories: CATEGORIES,
  bankAccounts: [{ accountNumber: 'DE02120300000000202051', transactionCount: 3, account: null }],
};

const PREVIEW = {
  bookings: 2,
  skipped: { uncategorized: 0, unmapped: [{ categoryId: 'cat-office', name: 'Office supplies', count: 4 }], foreignCurrency: 0 },
  converted: 1,
  issues: [],
  missingSettings: [],
};

function mockApi(settings: unknown = SETTINGS, preview: unknown = PREVIEW) {
  api.get.mockImplementation((url: string) => {
    if (url === '/tax/datev/settings') return Promise.resolve({ data: settings });
    if (url.startsWith('/tax/datev/mapping')) return Promise.resolve({ data: MAPPING });
    if (url.startsWith('/tax/datev/preview')) return Promise.resolve({ data: preview });
    if (url.startsWith('/tax/datev/export')) return Promise.resolve({ data: new Blob(['x']) });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe('DatevExportCard', () => {
  beforeEach(() => {
    appLocale.current = 'en';
    templates.current = {};
    vi.clearAllMocks();
    api.put.mockImplementation((_url: string, body: unknown) => Promise.resolve({ data: body }));
  });

  it('is not offered outside Germany and Austria', async () => {
    mockApi({ ...SETTINGS, available: false });
    const { container } = renderWithQuery(<DatevExportCard year={2026} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tax/datev/settings', expect.anything()));
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the categories with their account, a suggestion, or the advice to ask', async () => {
    mockApi();
    renderWithQuery(<DatevExportCard year={2026} />);
    const mapping = await screen.findByTestId('datev-mapping');

    const inputs = await within(mapping).findAllByRole('textbox');
    await waitFor(() => expect((inputs[1] as HTMLInputElement).value).toBe('4210'));
    expect((inputs[0] as HTMLInputElement).placeholder).toBe('4930');
    expect(within(mapping).getByText('noSuggestion')).toBeInTheDocument();
  });

  it('takes the suggested accounts only on request, keeping what was set', async () => {
    mockApi();
    renderWithQuery(<DatevExportCard year={2026} />);

    fireEvent.click(await screen.findByRole('button', { name: 'acceptSuggestions' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/datev/settings', {
        chart: '03',
        consultantNumber: 29098,
        clientNumber: 55003,
        bankAccount: '1200',
        accounts: { 'cat-rent': '4210', 'cat-office': '4930' },
        bankAccounts: {},
      }),
    );
  });

  it('drops the mapping when the chart changes', async () => {
    mockApi();
    renderWithQuery(<DatevExportCard year={2026} />);
    await screen.findByTestId('datev-mapping');

    const { selectOption } = await import('@/app/test/select');
    selectOption(screen.getAllByRole('combobox')[0], 'SKR 04');
    expect(await screen.findByText('chartSwitchWarning')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/tax/datev/settings',
        expect.objectContaining({ chart: '04', accounts: {} }),
      ),
    );
  });

  it('shows what the file leaves out and downloads it for the year', async () => {
    mockApi();
    renderWithQuery(<DatevExportCard year={2026} />);

    const preview = await screen.findByTestId('datev-preview');
    expect(within(preview).getByText('bookings')).toBeInTheDocument();
    expect(within(preview).getByText('unmapped')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'download' }));
    await waitFor(() =>
      expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'EXTF_Buchungsstapel_20260101_20261231.csv'),
    );
  });

  it('names system categories in the reader\'s language and still maps them by id', async () => {
    appLocale.current = 'ru';
    templates.current = { accountFor: 'Account for {{name}}', unmapped: 'Unmapped: {{categories}}' };
    api.get.mockImplementation((url: string) => {
      if (url === '/tax/datev/settings') return Promise.resolve({ data: SETTINGS });
      if (url.startsWith('/tax/datev/mapping'))
        return Promise.resolve({
          data: {
            ...MAPPING,
            categories: [
              { categoryId: 'cat-ads', name: 'Advertising', type: 'expense', transactionCount: 4, account: null, suggestion: null },
            ],
          },
        });
      if (url.startsWith('/tax/datev/preview'))
        return Promise.resolve({
          data: {
            ...PREVIEW,
            skipped: { ...PREVIEW.skipped, unmapped: [{ categoryId: 'cat-ads', name: 'Advertising', count: 4 }] },
          },
        });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    renderWithQuery(<DatevExportCard year={2026} />);

    const mapping = await screen.findByTestId('datev-mapping');
    expect(await within(mapping).findByText(/^Реклама/)).toBeInTheDocument();
    fireEvent.change(within(mapping).getByRole('textbox', { name: 'Account for Реклама' }), {
      target: { value: '4600' },
    });
    expect(await screen.findByText('Unmapped: Реклама (4)')).toBeInTheDocument();
    expect(screen.queryByText(/Advertising/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/tax/datev/settings',
        expect.objectContaining({ accounts: { 'cat-rent': '4210', 'cat-ads': '4600' } }),
      ),
    );
  });

  it('will not download before the adviser and client numbers are in', async () => {
    mockApi({ ...SETTINGS, consultantNumber: null }, { ...PREVIEW, missingSettings: ['consultantNumber'] });
    renderWithQuery(<DatevExportCard year={2026} />);

    expect(await screen.findByText('numbersMissing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'download' })).toBeDisabled();
  });

  it('books a second bank account to its own DATEV account', async () => {
    mockApi();
    renderWithQuery(<DatevExportCard year={2026} />);
    const banks = await screen.findByTestId('datev-banks');

    fireEvent.change(within(banks).getByRole('textbox'), { target: { value: '1210' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/tax/datev/settings',
        expect.objectContaining({ bankAccounts: { DE02120300000000202051: '1210' } }),
      ),
    );
    expect(screen.getByText('converted')).toBeInTheDocument();
  });
});
