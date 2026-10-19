// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));

import { TaxReturnView } from './TaxReturnView';
import { APP_NAME } from '@/app/lib/brand';

const TOTALS = {
  outputTax: 1200,
  inputTax: 500,
  netPayable: 700,
  currency: 'KZT',
  lines: [
    {
      transactionId: 'a',
      date: '2026-02-10',
      counterparty: 'Magnum',
      direction: 'input' as const,
      currency: 'KZT',
      taxAmount: 500,
      netAmount: 4500,
      exchangeRate: 1,
      taxAmountConverted: 500,
    },
    {
      transactionId: 'b',
      date: '2026-02-11',
      counterparty: 'Polish supplier',
      direction: 'reverse_charge' as const,
      currency: 'EUR',
      taxAmount: 190,
      netAmount: 1000,
      exchangeRate: 500,
      taxAmountConverted: 95000,
    },
  ],
};

function mockApi({
  status = 'draft',
  totals = TOTALS,
  threshold = null as unknown,
  filing = null as unknown,
  deadlines = [] as unknown[],
} = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/tax/settings/vat-filing') {
      return { data: filing };
    }
    if (url === '/tax/deadlines') {
      return { data: deadlines };
    }
    if (url.startsWith('/tax/returns/period')) {
      return { data: { id: 'ret-1', status, currency: 'KZT' } };
    }
    if (url.startsWith('/tax/returns/preview')) {
      return { data: totals };
    }
    if (url === '/tax/settings/threshold') {
      return { data: threshold };
    }
    throw new Error(`unexpected ${url}`);
  });
}

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));

describe('TaxReturnView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: {} });
    put.mockResolvedValue({ data: [] });
  });

  it('shows the three headline figures', async () => {
    mockApi();
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText('Output tax')).toBeInTheDocument();
    expect(screen.getByText('Input tax')).toBeInTheDocument();
    expect(screen.getByText('Payable')).toBeInTheDocument();
  });

  it('labels a negative net as reclaimable rather than owed', async () => {
    mockApi({ totals: { ...TOTALS, netPayable: -300 } });
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText('Reclaimable')).toBeInTheDocument();
    expect(screen.queryByText('Payable')).not.toBeInTheDocument();
  });

  it('lists the transactions behind the figures', async () => {
    mockApi();
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText('Magnum')).toBeInTheDocument();
    // A reverse-charge line is named as such, since it appears on both sides.
    expect(screen.getByText('Reverse charge')).toBeInTheDocument();
  });

  it('files the period and reloads', async () => {
    mockApi();
    renderWithQuery(<TaxReturnView />);

    await userEvent.click(await screen.findByRole('button', { name: 'File and lock' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/tax/returns/file', {
        periodStart: expect.any(String),
        periodEnd: expect.any(String),
      }),
    );
  });

  it('offers reopening once filed, and says the rows are locked', async () => {
    mockApi({ status: 'filed' });
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByRole('button', { name: 'Reopen period' })).toBeInTheDocument();
    expect(screen.getByText(/transactions behind it are locked/)).toBeInTheDocument();
  });

  it('reopens the period', async () => {
    mockApi({ status: 'filed' });
    renderWithQuery(<TaxReturnView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Reopen period' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/tax/returns/reopen', expect.any(Object)),
    );
  });

  it('points at the missing setup step when the return cannot be built', async () => {
    get.mockRejectedValue(new Error('no jurisdiction'));
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText(/tax jurisdiction/)).toBeInTheDocument();
  });

  it('shows the threshold gauge only when there is a threshold', async () => {
    mockApi({
      threshold: {
        threshold: 90000,
        turnover: 72000,
        currency: 'GBP',
        percentUsed: 80,
        periodStart: '2025-06-16',
        periodEnd: '2026-06-15',
      },
    });
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText('Registration threshold')).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it('omits the gauge when the jurisdiction publishes none', async () => {
    mockApi({ threshold: { threshold: null, turnover: 0, currency: 'KZT', percentUsed: 0 } });
    renderWithQuery(<TaxReturnView />);

    await screen.findByText('Output tax');
    expect(screen.queryByText('Registration threshold')).not.toBeInTheDocument();
  });

  it('says so when nothing in the period was taxed', async () => {
    mockApi({ totals: { ...TOTALS, lines: [] } });
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText(/No taxed transactions/)).toBeInTheDocument();
  });

  it('warns when rows were left out for want of an exchange rate', async () => {
    mockApi({
      totals: {
        ...TOTALS,
        missingRates: [
          { transactionId: 'c', date: '2026-02-12', currency: 'USD' },
          { transactionId: 'd', date: '2026-02-13', currency: 'USD' },
        ],
      } as typeof TOTALS,
    });
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText(/without an exchange rate for their date: 2 \(USD\)/)).toBeInTheDocument();
  });

  it("shows the server's reason when filing is refused", async () => {
    mockApi();
    post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: {
            code: 'TAX_RETURN_MISSING_RATES',
            message: '2 transactions in USD have no exchange rate for their date. Add the rates before filing.',
            params: { count: 2, currencies: 'USD' },
          },
        },
      },
    });
    renderWithQuery(<TaxReturnView />);

    await userEvent.click(await screen.findByRole('button', { name: /File and lock/i }));

    expect(await screen.findByText(/Add the rates before filing/)).toBeInTheDocument();
  });

  it('offers months to a monthly filer', async () => {
    mockApi({ filing: { frequency: 'monthly', isDefault: false, extension: false } });
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByRole('button', { name: 'Last month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Last quarter' })).not.toBeInTheDocument();
  });

  it('shows the return that is due and opens its period', async () => {
    mockApi({
      deadlines: [
        {
          kind: 'vat_return',
          periodStart: '2026-07-01',
          periodEnd: '2026-09-30',
          dueDate: '2026-10-12',
          daysLeft: 2,
          done: false,
          filedElsewhere: false,
          returnName: 'Umsatzsteuer-Voranmeldung',
          basis: 'statute',
          checkedAt: '2026-10-10',
        },
        {
          kind: 'vat_return',
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30',
          dueDate: '2026-07-10',
          daysLeft: -92,
          done: false,
          filedElsewhere: false,
          returnName: 'Umsatzsteuer-Voranmeldung',
        },
      ],
    });
    renderWithQuery(<TaxReturnView />);

    const banners = await screen.findByTestId('vat-deadlines');
    // A return missed long ago drops off instead of nagging forever.
    expect(banners).toHaveTextContent('2026-10-12');
    expect(banners).not.toHaveTextContent('2026-07-10');
    // Where the date comes from, and when that was read.
    expect(banners).toHaveTextContent('2026-10-10');

    await userEvent.click(screen.getByRole('button', { name: `Filed outside ${APP_NAME}` }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/tax/deadlines/filed-elsewhere', {
        kind: 'vat_return',
        periodEnd: '2026-09-30',
        filed: true,
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        expect.stringContaining('periodStart=2026-07-01&periodEnd=2026-09-30'),
        expect.anything(),
      ),
    );
  });

  it('always carries the advice disclaimer', async () => {
    mockApi();
    renderWithQuery(<TaxReturnView />);

    expect(await screen.findByText(/not a substitute for advice/)).toBeInTheDocument();
  });

  describe('export', () => {
    beforeEach(() => {
      // jsdom implements neither, and both are needed to hand a blob over.
      URL.createObjectURL = vi.fn(() => 'blob:fake');
      URL.revokeObjectURL = vi.fn();
    });

    it.each(['pdf', 'xlsx', 'csv'] as const)('downloads the return as %s', async format => {
      mockApi();
      get.mockImplementation(async (url: string) => {
        if (url.startsWith('/tax/returns/export')) return { data: new Blob(['x']) };
        if (url.startsWith('/tax/returns/period')) {
          return { data: { id: 'ret-1', status: 'draft', currency: 'KZT' } };
        }
        if (url.startsWith('/tax/returns/preview')) return { data: TOTALS };
        return { data: null };
      });
      renderWithQuery(<TaxReturnView />);

      await userEvent.click(await screen.findByRole('button', { name: format.toUpperCase() }));

      await waitFor(() =>
        expect(get).toHaveBeenCalledWith(
          expect.stringContaining(`format=${format}`),
          expect.objectContaining({ responseType: 'blob' }),
        ),
      );
    });

    it('reports a failed export instead of downloading nothing', async () => {
      mockApi();
      get.mockImplementation(async (url: string) => {
        if (url.startsWith('/tax/returns/export')) throw new Error('boom');
        if (url.startsWith('/tax/returns/period')) {
          return { data: { id: 'ret-1', status: 'draft', currency: 'KZT' } };
        }
        if (url.startsWith('/tax/returns/preview')) return { data: TOTALS };
        return { data: null };
      });
      renderWithQuery(<TaxReturnView />);

      await userEvent.click(await screen.findByRole('button', { name: 'PDF' }));

      expect(await screen.findByText(/Could not export the return as PDF/)).toBeInTheDocument();
    });

    it('releases the object URL so the blob is not held for the page lifetime', async () => {
      mockApi();
      get.mockImplementation(async (url: string) => {
        if (url.startsWith('/tax/returns/export')) return { data: new Blob(['x']) };
        if (url.startsWith('/tax/returns/period')) {
          return { data: { id: 'ret-1', status: 'draft', currency: 'KZT' } };
        }
        if (url.startsWith('/tax/returns/preview')) return { data: TOTALS };
        return { data: null };
      });
      renderWithQuery(<TaxReturnView />);

      await userEvent.click(await screen.findByRole('button', { name: 'XLSX' }));

      await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
    });
  });
});
