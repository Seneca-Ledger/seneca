// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const saveBlob = vi.hoisted(() => vi.fn());
const appLocale = vi.hoisted(() => ({ current: 'en-US' }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: appLocale.current }),
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key), toString: () => String(key) }) }),
}));
vi.mock('./tax-return.helpers', async importOriginal => ({
  ...(await importOriginal<typeof import('./tax-return.helpers')>()),
  saveBlob,
}));

import { TaxYearView } from './TaxYearView';
import { categoryItem } from '@/app/test/fixtures/contracts';

const YEAR = new Date().getFullYear();

const REPORT = {
  year: YEAR,
  currency: 'EUR',
  categories: [
    { categoryId: 'cat-med', name: 'Medical', type: 'expense', count: 2, total: 300, documentCount: 1 },
  ],
  rows: [
    {
      id: 'tx-1',
      date: `${YEAR}-02-01`,
      counterparty: 'Dr. Weber',
      categoryId: 'cat-med',
      categoryName: 'Medical',
      type: 'expense',
      amount: 200,
      currency: 'EUR',
      converted: 200,
      documentCount: 1,
      markedOnRow: false,
    },
    {
      id: 'tx-2',
      date: `${YEAR}-03-01`,
      counterparty: 'Apotheke',
      categoryId: 'cat-med',
      categoryName: 'Medical',
      type: 'expense',
      amount: 100,
      currency: 'EUR',
      converted: 100,
      documentCount: 0,
      markedOnRow: true,
    },
  ],
  total: { income: 0, expense: 300 },
  missingRateCurrencies: [],
};

const CATEGORIES = [
  categoryItem({ id: 'cat-med', name: 'Medical', taxRelevant: true }),
  categoryItem({ id: 'cat-food', name: 'Groceries' }),
  categoryItem({ id: 'cat-sub', name: 'Dentist', parentId: 'cat-med' }),
];

function mockApi({
  reserve = null as unknown,
  report = REPORT as unknown,
  categories = CATEGORIES as unknown,
} = {}) {
  api.get.mockImplementation((url: string) => {
    if (url.startsWith('/tax/year-report')) return Promise.resolve({ data: report });
    if (url === '/tax/settings/reserve/amount')
      return Promise.resolve({
        data: reserve ?? {
          currency: 'EUR',
          year: YEAR,
          asOf: `${YEAR}-06-30`,
          vat: null,
          incomeTax: null,
          payments: { categoryId: null, amount: 0, count: 0 },
          total: 0,
          missingRateCurrencies: [],
        },
      });
    if (url === '/categories')
      return Promise.resolve({ data: categories });
    if (url.startsWith('/tax/pack')) return Promise.resolve({ data: new Blob(['zip']) });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe('TaxYearView', () => {
  beforeEach(() => {
    appLocale.current = 'en-US';
    vi.clearAllMocks();
    api.put.mockResolvedValue({ data: {} });
  });

  it('points to the settings when no reserve is set up', async () => {
    mockApi();
    renderWithQuery(<TaxYearView />);
    expect(await screen.findByText('reserveSetUp')).toBeInTheDocument();
  });

  it('shows what to hold back and how it is made up', async () => {
    mockApi({
      reserve: {
        currency: 'EUR',
        year: YEAR,
        asOf: `${YEAR}-06-30`,
        vat: { net: 950, outputTax: 1900, inputTax: 950 },
        incomeTax: { percent: 30, earnings: 10000, amount: 3000 },
        payments: { categoryId: 'cat-tax', amount: 1000, count: 2 },
        total: 2950,
        missingRateCurrencies: [],
      },
    });
    renderWithQuery(<TaxYearView />);

    expect(await screen.findByText('reserveTotal')).toBeInTheDocument();
    // One format: symbol first, no cents on whole amounts, a typographic minus.
    expect(screen.getByText('€2,950')).toBeInTheDocument();
    expect(screen.getByText('reserveVat')).toBeInTheDocument();
    expect(screen.getByText('−€1,000')).toBeInTheDocument();
  });

  it('calls negative VAT money to reclaim, and puts no minus on a zero', async () => {
    mockApi({
      reserve: {
        currency: 'USD',
        year: YEAR,
        vat: { net: -20.04, outputTax: 0, inputTax: 20.04 },
        incomeTax: null,
        payments: { categoryId: null, amount: 0, count: 0 },
        total: 0,
        missingRateCurrencies: [],
      },
    });
    renderWithQuery(<TaxYearView />);

    expect(await screen.findByText('reserveVatReclaim')).toBeInTheDocument();
    expect(screen.getByText('$20.04')).toBeInTheDocument();
    expect(screen.getAllByText('$0')).toHaveLength(2);
  });

  it('offers top-level categories and toggles their tax-relevant mark', async () => {
    mockApi();
    renderWithQuery(<TaxYearView />);
    const group = await screen.findByRole('group', { name: 'groupExpenses' });

    expect(within(group).queryByText('Dentist')).not.toBeInTheDocument();
    fireEvent.click(await within(group).findByText('Groceries'));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/categories/cat-food', { taxRelevant: true }),
    );

    fireEvent.click(within(group).getByText('Medical'));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/categories/cat-med', { taxRelevant: false }),
    );
  });

  it('names system categories in the reader\'s language in the picker and the table', async () => {
    appLocale.current = 'ru';
    mockApi({
      categories: [categoryItem({ id: 'cat-ads', name: 'Advertising', isSystem: true, source: 'system' })],
      report: {
        ...REPORT,
        categories: [{ ...REPORT.categories[0], categoryId: 'cat-ads', name: 'Advertising' }],
        rows: REPORT.rows.map(row => ({ ...row, categoryId: 'cat-ads', categoryName: 'Advertising' })),
      },
    });
    renderWithQuery(<TaxYearView />);

    const group = await screen.findByRole('group', { name: 'groupExpenses' });
    fireEvent.click(await within(group).findByText('Реклама'));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/categories/cat-ads', { taxRelevant: true }),
    );

    const table = await screen.findByRole('table', { name: 'tableLabel' });
    fireEvent.click(within(table).getByRole('button', { name: 'Реклама' }));
    expect(await screen.findAllByTestId('tax-year-row')).toHaveLength(2);
    expect(screen.queryByText('Advertising')).not.toBeInTheDocument();
  });

  it('opts a row out, or hands a hand-marked row back to its category', async () => {
    mockApi();
    renderWithQuery(<TaxYearView />);

    const table = await screen.findByRole('table', { name: 'tableLabel' });
    fireEvent.click(within(table).getByRole('button', { name: 'Medical' }));
    const rows = await screen.findAllByTestId('tax-year-row');
    expect(rows).toHaveLength(2);

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'excludeRow' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/transactions/tx-1', { taxRelevant: false }),
    );

    fireEvent.click(within(rows[1]).getByRole('button', { name: 'excludeRow' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/transactions/tx-2', { taxRelevant: null }),
    );
  });

  it('downloads the tax pack for the year, relevant rows or everything', async () => {
    mockApi();
    renderWithQuery(<TaxYearView />);

    fireEvent.click(await screen.findByRole('button', { name: 'downloadRelevant' }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        `/tax/pack?from=${YEAR}-01-01&to=${YEAR}-12-31&scope=relevant`,
        { responseType: 'blob' },
      ),
    );
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), `tax-pack_${YEAR}.zip`));

    fireEvent.click(screen.getByRole('button', { name: 'downloadAll' }));
    await waitFor(() =>
      expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), `tax-pack_${YEAR}_all.zip`),
    );
  });

  it('counts the chosen categories by the title, and says when they hold nothing this year', async () => {
    mockApi({ report: { ...REPORT, categories: [], rows: [] } });
    renderWithQuery(<TaxYearView />);
    expect(await screen.findByText('selectedCount')).toBeInTheDocument();
    expect(await screen.findByText('emptySelected')).toBeInTheDocument();
  });
});
