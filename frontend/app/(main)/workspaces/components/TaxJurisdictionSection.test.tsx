// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaxJurisdictionItem } from '@/app/lib/contracts';

const get = vi.fn();
const put = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));

import { TaxJurisdictionSection } from './TaxJurisdictionSection';

const LABELS = {
  title: 'Tax jurisdiction',
  description: 'Choose the country this workspace files tax in.',
  none: 'Not configured',
  placeholder: 'No jurisdiction',
  ratesTitle: 'Rates that apply today',
  apply: 'Apply jurisdiction',
  applying: 'Applying...',
  switchWarning: 'Switching country closes the current rates as of today.',
  noRates: 'This country has no rates in this system yet.',
  loadError: 'Could not load tax jurisdictions.',
  saveError: 'Could not apply the jurisdiction.',
  saved: 'Jurisdiction applied.',
  disclaimer: 'Tax rates here may be out of date or wrong.',
  reportError: 'Report an error',
};

// The wire format (packages/contracts TaxJurisdictionItem, JurisdictionRateList).
const jurisdiction = (
  fields: Pick<TaxJurisdictionItem, 'id' | 'code' | 'name' | 'taxName' | 'currency' | 'scheme'>,
): TaxJurisdictionItem => ({
  isEu: false,
  filingPeriod: 'quarterly',
  registrationThreshold: null,
  thresholdPeriod: null,
  ...fields,
});

const JURISDICTIONS = [
  jurisdiction({
    id: 'j-kz',
    code: 'KZ',
    name: 'Kazakhstan',
    taxName: 'НДС',
    currency: 'KZT',
    scheme: 'vat',
  }),
  jurisdiction({
    id: 'j-de',
    code: 'DE',
    name: 'Germany',
    taxName: 'USt',
    currency: 'EUR',
    scheme: 'vat',
  }),
  jurisdiction({
    id: 'j-us',
    code: 'US',
    name: 'United States',
    taxName: 'Sales tax',
    currency: 'USD',
    scheme: 'sales_tax',
  }),
];

// The catalogue holds every version; only the current one should be shown.
const KZ_RATES = [
  {
    id: 'r-kz-12',
    code: 'KZ_STANDARD',
    name: 'НДС 12%',
    rate: '12.00',
    kind: 'standard',
    isDefault: true,
    validFrom: '1900-01-01',
    validTo: '2025-12-31',
  },
  {
    id: 'r-kz-16',
    code: 'KZ_STANDARD',
    name: 'НДС 16%',
    rate: '16.00',
    kind: 'standard',
    isDefault: true,
    validFrom: '2026-01-01',
    validTo: null,
  },
  {
    id: 'r-kz-0',
    code: 'KZ_ZERO',
    name: 'НДС 0%',
    rate: '0.00',
    kind: 'zero',
    isDefault: false,
    validFrom: '1900-01-01',
    validTo: null,
  },
];

function mockApi({ current = null as string | null, rates = KZ_RATES } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/tax/jurisdictions') {
      return { data: JURISDICTIONS };
    }
    if (url === '/tax/settings') {
      const jurisdiction = current ? JURISDICTIONS.find(j => j.code === current) : null;
      return { data: { jurisdiction: jurisdiction ?? null, vatStatus: 'not_registered' } };
    }
    if (url.startsWith('/tax/jurisdictions/')) {
      return { data: url.includes('/US/') ? [] : rates };
    }
    throw new Error(`unexpected ${url}`);
  });
}

const openSelect = async () => {
  // The section renders a spinner until both requests settle, so the picker is
  // not in the tree immediately.
  await userEvent.click(await screen.findByRole('combobox'));
  return within(await screen.findByRole('listbox'));
};

describe('TaxJurisdictionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    put.mockResolvedValue({ data: {} });
  });

  it('lists the jurisdictions the server offers', async () => {
    mockApi();
    render(<TaxJurisdictionSection labels={LABELS} />);

    const listbox = await openSelect();
    expect(listbox.getByText('Kazakhstan')).toBeInTheDocument();
    expect(listbox.getByText('Germany')).toBeInTheDocument();
    expect(listbox.getByText('United States')).toBeInTheDocument();
  });

  it('shows only the rates in force today', async () => {
    mockApi({ current: 'KZ' });
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByText(/НДС 16%/)).toBeInTheDocument());
    // The 12% version was retired at the end of 2025 and must not be offered.
    expect(screen.queryByText(/НДС 12%/)).not.toBeInTheDocument();
  });

  it('cannot be applied until something changes', async () => {
    mockApi({ current: 'KZ' });
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByText(/НДС 16%/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: LABELS.apply })).toBeDisabled();
  });

  it('warns before switching a workspace that already has a jurisdiction', async () => {
    mockApi({ current: 'KZ' });
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    const listbox = await openSelect();
    await userEvent.click(listbox.getByText('Germany'));

    expect(await screen.findByText(LABELS.switchWarning)).toBeInTheDocument();
  });

  it('does not warn on a first-time choice', async () => {
    mockApi({ current: null });
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    const listbox = await openSelect();
    await userEvent.click(listbox.getByText('Kazakhstan'));

    await waitFor(() => expect(screen.getByText(/НДС 16%/)).toBeInTheDocument());
    expect(screen.queryByText(LABELS.switchWarning)).not.toBeInTheDocument();
  });

  it('applies the chosen country', async () => {
    mockApi({ current: null });
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    const listbox = await openSelect();
    await userEvent.click(listbox.getByText('Kazakhstan'));
    await userEvent.click(screen.getByRole('button', { name: LABELS.apply }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/tax/settings/jurisdiction', { code: 'KZ' }),
    );
    expect(await screen.findByText(LABELS.saved)).toBeInTheDocument();
  });

  it('keeps the choice pending when applying fails', async () => {
    mockApi({ current: null });
    put.mockRejectedValue(new Error('network'));
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    const listbox = await openSelect();
    await userEvent.click(listbox.getByText('Kazakhstan'));
    await userEvent.click(screen.getByRole('button', { name: LABELS.apply }));

    expect(await screen.findByText(LABELS.saveError)).toBeInTheDocument();
    // Still applyable, so the user can retry rather than being told it worked.
    expect(screen.getByRole('button', { name: LABELS.apply })).toBeEnabled();
  });

  it('says so when a country has no rates modelled', async () => {
    mockApi({ current: null });
    render(<TaxJurisdictionSection labels={LABELS} />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    const listbox = await openSelect();
    await userEvent.click(listbox.getByText('United States'));

    // US is seeded rate-less because sales tax is not modelled.
    expect(await screen.findByText(LABELS.noRates)).toBeInTheDocument();
  });

  it('reports a failure to load rather than showing an empty picker', async () => {
    get.mockRejectedValue(new Error('offline'));
    render(<TaxJurisdictionSection labels={LABELS} />);

    expect(await screen.findByText(LABELS.loadError)).toBeInTheDocument();
  });

  it('always shows the accuracy disclaimer', async () => {
    mockApi({ current: 'KZ' });
    render(<TaxJurisdictionSection labels={LABELS} />);

    expect(await screen.findByText(new RegExp(LABELS.disclaimer))).toBeInTheDocument();
  });
});
