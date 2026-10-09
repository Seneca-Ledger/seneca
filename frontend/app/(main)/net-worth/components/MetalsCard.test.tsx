import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { LotDetailsInput, Metal, MetalsSummary, SellLotInput } from '../hooks/useMetals';
import { MetalsCard } from './MetalsCard';

const hookMock = vi.hoisted(() => ({
  summary: null as MetalsSummary | null,
  addLot: vi.fn(async () => undefined),
  deleteLot: vi.fn(async () => undefined),
  sellLot: vi.fn(async (_id: string, _input: SellLotInput) => undefined),
  updateLot: vi.fn(async (_id: string, _input: LotDetailsInput) => undefined),
  uploadPhoto: vi.fn(async (_id: string, _file: File) => undefined),
  removePhoto: vi.fn(async (_id: string) => undefined),
  setDealerDiscount: vi.fn(async (_metal: Metal, _percent: number) => undefined),
  refreshPrices: vi.fn(async () => undefined),
}));

vi.mock('@/app/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => 'workspace-1',
}));

vi.mock('../hooks/useMetals', async importOriginal => ({
  ...(await importOriginal<typeof import('../hooks/useMetals')>()),
  useMetals: () => ({
    summary: hookMock.summary,
    isPending: false,
    saving: false,
    addLot: hookMock.addLot,
    deleteLot: hookMock.deleteLot,
    sellLot: hookMock.sellLot,
    updateLot: hookMock.updateLot,
    uploadPhoto: hookMock.uploadPhoto,
    removePhoto: hookMock.removePhoto,
    setDealerDiscount: hookMock.setDealerDiscount,
    refreshPrices: hookMock.refreshPrices,
  }),
}));

const summary: MetalsSummary = {
  currency: 'EUR',
  value: 33745.1,
  cost: 30000,
  gain: 3745.1,
  dealerValue: 32057.85,
  realized: 0,
  sales: [],
  dealerDiscount: { XAU: 5, XAG: 0, XPT: 0, XPD: 0 },
  insured: 0,
  accountId: 'acc-1',
  jurisdiction: null,
  byMetal: [
    {
      metal: 'XAU',
      fineOunces: 9.167,
      price: 3681.15,
      pricedAt: '2026-10-04T00:00:00.000Z',
      value: 33745.1,
      cost: 30000,
      gain: 3745.1,
      costPerOunce: 3272.72,
      dealerValue: 32057.85,
      dealerDiscount: 5,
      realized: 0,
    },
  ],
  lots: [
    {
      id: 'lot-1',
      metal: 'XAU',
      name: 'Krugerrand',
      quantity: 10,
      unitWeight: 1,
      weightUnit: 'ozt',
      purity: 0.9167,
      fineOunces: 9.167,
      price: 3681.15,
      priceCurrency: 'EUR',
      priceSource: 'auto',
      pricedAt: '2026-10-04T00:00:00.000Z',
      value: 33745.1,
      acquiredOn: '2026-03-14',
      counterparty: 'Degussa',
      costTotal: 30000,
      costCurrency: 'EUR',
      cost: 30000,
      gain: 3745.1,
      costPerOunce: 3272.72,
      premium: 2499,
      premiumPercent: 9.09,
      dealerValue: 32057.85,
      roi: 6.86,
      taxFreeFrom: '2027-03-14',
      photoUrl: null,
      storageLocation: null,
      insuredValue: null,
      insuredCurrency: null,
      insured: null,
      receipt: null,
      ownerUserId: null,
    },
  ],
};

describe('MetalsCard', () => {
  beforeEach(() => {
    hookMock.summary = null;
    hookMock.addLot.mockClear();
    hookMock.refreshPrices.mockClear();
    hookMock.sellLot.mockClear();
    hookMock.setDealerDiscount.mockClear();
    hookMock.updateLot.mockClear();
    hookMock.uploadPhoto.mockClear();
  });

  it('says there is no metal and hides the price refresh until there is', () => {
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    expect(screen.getByText('No metal yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh prices' })).not.toBeInTheDocument();
  });

  it('shows the fine weight, not the gross weight, and the date the price is from', () => {
    hookMock.summary = summary;
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    // Ten one-ounce coins of 22 carat gold hold 9.167 ounces of gold.
    expect(screen.getAllByText('9.167 ozt').length).toBeGreaterThan(0);
    expect(screen.getByText('price from 2026-10-04')).toBeInTheDocument();
    expect(screen.getByText('Krugerrand')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh prices' }));
    expect(hookMock.refreshPrices).toHaveBeenCalledTimes(1);
  });

  it('adds a lot as pieces, weight and fineness', () => {
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Krugerrand' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Weight of one'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Purity'), { target: { value: '0.9167' } });
    fireEvent.change(screen.getByLabelText('Paid (EUR)'), { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add lot' }));

    expect(hookMock.addLot).toHaveBeenCalledWith({
      metal: 'XAU',
      name: 'Krugerrand',
      quantity: 10,
      unitWeight: 1,
      weightUnit: 'ozt',
      purity: 0.9167,
      costTotal: 30000,
      costCurrency: 'EUR',
      acquiredOn: undefined,
      counterparty: undefined,
    });
  });

  it('shows what a dealer would pay and the ROI measured against it', () => {
    hookMock.summary = summary;
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    // Melt is €33,745.10; a 5% dealer discount leaves €32,057.85.
    expect(screen.getAllByText('€32,057.85').length).toBeGreaterThan(0);
    expect(screen.getByText('+6.86%')).toBeInTheDocument();
    expect(screen.getByText(/\+€2,499\.00 \(9\.09%\)/)).toBeInTheDocument();
  });

  it('states the German holding period only for a workspace that files there', () => {
    hookMock.summary = { ...summary, jurisdiction: 'DE' };
    const { unmount } = renderWithQuery(<MetalsCard currency="EUR" locale="en" />);
    expect(screen.getByText('tax-free from 2027-03-14')).toBeInTheDocument();
    unmount();

    hookMock.summary = { ...summary, jurisdiction: 'ES' };
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);
    expect(screen.queryByText('tax-free from 2027-03-14')).not.toBeInTheDocument();
  });

  it('sells pieces out of a lot, starting from what the dealer pays', async () => {
    hookMock.summary = summary;
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
    // The add-lot form has its own Quantity: ask the dialog, not the page.
    const dialog = within(await screen.findByRole('dialog'));
    const proceeds = dialog.getByLabelText('Proceeds (EUR)') as HTMLInputElement;
    expect(proceeds.value).toBe('32057.85');

    fireEvent.change(dialog.getByLabelText('Quantity'), { target: { value: '4' } });
    fireEvent.change(proceeds, { target: { value: '15000' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Sell' }));

    await waitFor(() => expect(hookMock.sellLot).toHaveBeenCalled());
    expect(hookMock.sellLot.mock.calls[0]?.[0]).toBe('lot-1');
    expect(hookMock.sellLot.mock.calls[0]?.[1]).toMatchObject({ quantity: 4, proceeds: 15000 });
  });

  it('shows no weight or result for a count the lot cannot cover', async () => {
    hookMock.summary = summary;
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Quantity'), { target: { value: '40' } });

    // Ten coins cannot yield forty: the dialog says the range instead of a lie.
    expect(dialog.getByText('Quantity: 1…10')).toBeInTheDocument();
    expect(dialog.queryByText(/Realized/)).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Sell' })).toBeDisabled();
  });

  it('saves a dealer discount when the field loses focus', () => {
    hookMock.summary = summary;
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    const field = screen.getByLabelText('Dealer discount, %');
    fireEvent.change(field, { target: { value: '7' } });
    fireEvent.blur(field);
    expect(hookMock.setDealerDiscount).toHaveBeenCalledWith('XAU', 7);
  });

  it('opens the lot details from its name and saves where it is kept', async () => {
    hookMock.summary = summary;
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Krugerrand' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Where it is kept'), {
      target: { value: 'Bank vault 12' },
    });
    fireEvent.change(dialog.getByLabelText('Insured for (EUR)'), { target: { value: '45000' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(hookMock.updateLot).toHaveBeenCalled());
    expect(hookMock.updateLot.mock.calls[0]?.[1]).toMatchObject({
      storageLocation: 'Bank vault 12',
      insuredValue: 45000,
      receiptId: null,
    });
  });

  it('shows the photo of a lot that has one', async () => {
    hookMock.summary = {
      ...summary,
      lots: [{ ...summary.lots[0], photoUrl: '/uploads/metal-photos/abc.jpg' }],
    };
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Krugerrand' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByAltText('Photo: Krugerrand')).toHaveAttribute(
      'src',
      '/uploads/metal-photos/abc.jpg',
    );
  });

  it('lists the sales with what they realized', () => {
    hookMock.summary = {
      ...summary,
      realized: 3000,
      sales: [
        {
          id: 'sale-1',
          metal: 'XAU',
          lotName: 'Krugerrand',
          quantity: 4,
          fineOunces: 3.6668,
          proceeds: 15000,
          proceedsCurrency: 'EUR',
          costBasis: 12000,
          realized: 3000,
          soldOn: '2026-10-01',
          acquiredOn: '2026-03-14',
          counterparty: 'Degussa',
          ownerUserId: null,
        },
      ],
    };
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    expect(screen.getByTestId('metal-sales')).toBeInTheDocument();
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();
    expect(screen.getAllByText('+€3,000.00').length).toBeGreaterThan(0);
  });

  it('refuses a fineness entered as 999 instead of 0.999', () => {
    renderWithQuery(<MetalsCard currency="EUR" locale="en" />);

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Weight of one'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Purity'), { target: { value: '999' } });

    expect(screen.getByRole('button', { name: 'Add lot' })).toBeDisabled();
  });
});
