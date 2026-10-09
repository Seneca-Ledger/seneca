import {
  InvestmentAssetClass,
  InvestmentMetal,
  InvestmentPriceSource,
  MetalWeightUnit,
} from '@/entities/investment-holding.entity';
import { MetalsService } from '@/modules/investments/metals.service';

const WORKSPACE = 'ws-1';
const USER = 'user-1';
const SPOT_EUR = 3681.15;

type Lot = Record<string, unknown>;

function build(
  options: {
    lots?: Lot[];
    quote?: unknown;
    rate?: number | null;
    sales?: Lot[];
    discounts?: Record<string, number>;
    jurisdiction?: string | null;
    quoteByDate?: Record<string, number>;
    receipts?: Lot[];
    members?: Lot[];
    /** FX rate to the workspace currency, by the day asked for. */
    ratesByDate?: Record<string, number>;
  } = {},
) {
  const saved: Lot[] = [];
  const savedSales: Lot[] = [];
  const accountRepository = {
    findOne: jest.fn(async () => ({ id: 'acc-1', workspaceId: WORKSPACE })),
    findOneByOrFail: jest.fn(async () => ({ id: 'acc-1', workspaceId: WORKSPACE })),
    update: jest.fn(async () => undefined),
  };
  const holdingRepository = {
    create: jest.fn((lot: Lot) => ({ ...lot, id: 'lot-1' })),
    save: jest.fn(async (lot: Lot) => {
      saved.push(lot);
      return lot;
    }),
    find: jest.fn(async () => options.lots ?? []),
    findOne: jest.fn(async () => (options.lots ?? [])[0] ?? null),
    remove: jest.fn(async () => undefined),
  };
  const workspaceRepository = {
    findOne: jest.fn(async () => ({
      id: WORKSPACE,
      currency: 'EUR',
      taxJurisdiction:
        options.jurisdiction === undefined ? null : { code: options.jurisdiction },
    })),
  };
  const saleRepository = {
    create: jest.fn((sale: Lot) => ({ ...sale, id: 'sale-1', createdAt: new Date() })),
    save: jest.fn(async (sale: Lot) => {
      savedSales.push(sale);
      return sale;
    }),
    find: jest.fn(async () => options.sales ?? []),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  // Stateful on purpose: saving settings re-reads them, and a mock that forgets
  // the write would pass a service that never persisted anything.
  let settingsRow: Lot | null = options.discounts
    ? { config: { dealerDiscount: { ...options.discounts } } }
    : null;
  const memberRepository = {
    findOne: jest.fn(async () => (options.members ?? [])[0] ?? null),
  };
  const receiptRepository = {
    find: jest.fn(async () => options.receipts ?? []),
    findOne: jest.fn(async () => (options.receipts ?? [])[0] ?? null),
  };
  const settingsRepository = {
    findOne: jest.fn(async () => settingsRow),
    create: jest.fn((row: Lot) => row),
    save: jest.fn(async (row: Lot) => {
      settingsRow = row;
      return row;
    }),
  };
  const balanceService = { seedDefaultAccounts: jest.fn(async () => undefined) };
  const exchangeRatesService = {
    getRateQuote: jest.fn(async (_from: string, _to: string, date?: string) => {
      if (date && options.quoteByDate) {
        const rate = options.quoteByDate[date];
        return rate === undefined ? null : { rate, rateDate: date, stale: false };
      }
      return options.quote ?? { rate: SPOT_EUR, rateDate: '2026-10-04', stale: false };
    }),
    getRateOrNull: jest.fn(async (_from: string, _to: string, date?: string) => {
      if (options.ratesByDate) {
        return options.ratesByDate[date ?? 'today'] ?? null;
      }
      return options.rate === undefined ? 1 : options.rate;
    }),
  };
  const investmentsService = { writeSnapshot: jest.fn(async () => undefined) };
  const service = new MetalsService(
    accountRepository as never,
    holdingRepository as never,
    workspaceRepository as never,
    saleRepository as never,
    receiptRepository as never,
    settingsRepository as never,
    memberRepository as never,
    balanceService as never,
    exchangeRatesService as never,
    investmentsService as never,
  );
  return {
    service,
    holdingRepository,
    saleRepository,
    receiptRepository,
    settingsRepository,
    memberRepository,
    exchangeRatesService,
    investmentsService,
    saved,
    savedSales,
  };
}

function krugerrands(overrides: Lot = {}): Lot {
  return {
    id: 'lot-1',
    workspaceId: WORKSPACE,
    accountId: 'acc-1',
    name: 'Krugerrand',
    assetClass: InvestmentAssetClass.METAL,
    metal: InvestmentMetal.GOLD,
    quantity: '10',
    unitWeight: '1',
    weightUnit: MetalWeightUnit.TROY_OUNCE,
    purity: '0.9167',
    price: String(SPOT_EUR),
    priceCurrency: 'EUR',
    priceSource: InvestmentPriceSource.AUTO,
    pricedAt: new Date('2026-10-04T00:00:00.000Z'),
    acquiredOn: '2026-03-14',
    costTotal: '30000',
    costCurrency: 'EUR',
    counterparty: 'Degussa',
    ...overrides,
  };
}

describe('MetalsService', () => {
  it('values a new lot on its fine weight at the fetched spot price', async () => {
    const { service, exchangeRatesService, investmentsService } = build();

    const lot = await service.addLot(USER, WORKSPACE, {
      metal: InvestmentMetal.GOLD,
      quantity: 10,
      unitWeight: 1,
      weightUnit: MetalWeightUnit.TROY_OUNCE,
      purity: 0.9167,
      costTotal: 30000,
    });

    expect(exchangeRatesService.getRateQuote).toHaveBeenCalledWith('XAU', 'EUR', undefined, {
      workspaceId: WORKSPACE,
    });
    expect(lot.fineOunces).toBeCloseTo(9.167, 6);
    expect(lot.price).toBe(SPOT_EUR);
    expect(lot.priceSource).toBe(InvestmentPriceSource.AUTO);
    // Ten gross ounces of 22 carat gold, not ten ounces of gold.
    expect(lot.value).toBe(Math.round(9.167 * SPOT_EUR * 100) / 100);
    expect(lot.cost).toBe(30000);
    expect(lot.gain).toBe(Math.round((9.167 * SPOT_EUR - 30000) * 100) / 100);
    expect(investmentsService.writeSnapshot).toHaveBeenCalledWith(USER, WORKSPACE, 'acc-1');
  });

  it('names a lot after its metal and weight when no name is given', async () => {
    const { service } = build();
    const lot = await service.addLot(USER, WORKSPACE, {
      metal: InvestmentMetal.SILVER,
      quantity: 1,
      unitWeight: 1,
      weightUnit: MetalWeightUnit.KILOGRAM,
    });
    expect(lot.name).toBe('1 × 1 kg XAG');
  });

  it('keeps a hand-entered price and never asks for a quote', async () => {
    const { service, exchangeRatesService } = build();
    const lot = await service.addLot(USER, WORKSPACE, {
      metal: InvestmentMetal.GOLD,
      unitWeight: 1,
      price: 4000,
    });
    expect(exchangeRatesService.getRateQuote).not.toHaveBeenCalled();
    expect(lot.price).toBe(4000);
    expect(lot.priceSource).toBe(InvestmentPriceSource.MANUAL);
  });

  it('refuses a lot without a metal or a weight', async () => {
    const { service } = build();
    await expect(
      service.addLot(USER, WORKSPACE, { unitWeight: 1 } as never),
    ).rejects.toThrow('A lot needs a metal');
    await expect(
      service.addLot(USER, WORKSPACE, { metal: InvestmentMetal.GOLD }),
    ).rejects.toThrow('A lot needs the weight of one piece');
  });

  it('sums the lots per metal and reports the stalest quote as the total price date', async () => {
    const stale = krugerrands({
      id: 'lot-2',
      quantity: '1',
      purity: '0.9999',
      costTotal: '3500',
      pricedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    const { service } = build({ lots: [krugerrands(), stale] });

    const summary = await service.getSummary(WORKSPACE);

    expect(summary.currency).toBe('EUR');
    expect(summary.byMetal).toHaveLength(1);
    const gold = summary.byMetal[0];
    expect(gold.metal).toBe(InvestmentMetal.GOLD);
    expect(gold.fineOunces).toBeCloseTo(10.1669, 4);
    expect(gold.cost).toBe(33500);
    expect(gold.value).toBe(summary.value);
    expect(summary.gain).toBe(Math.round((summary.value - 33500) * 100) / 100);
    expect(gold.pricedAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
  });

  it('leaves a hand-priced lot alone when refreshing prices', async () => {
    const manual = krugerrands({
      priceSource: InvestmentPriceSource.MANUAL,
      price: '4000',
    });
    const { service, holdingRepository } = build({ lots: [manual] });

    await expect(service.refreshPrices(USER, WORKSPACE)).resolves.toBe(0);
    expect(holdingRepository.save).not.toHaveBeenCalled();
  });

  it('re-quotes an automatically priced lot', async () => {
    const { service, saved, investmentsService } = build({
      lots: [krugerrands({ price: '0', pricedAt: null })],
      quote: { rate: 4000, rateDate: '2026-10-04', stale: false },
    });

    await expect(service.refreshPrices(USER, WORKSPACE)).resolves.toBe(1);
    expect(saved[0].price).toBe(4000);
    expect(investmentsService.writeSnapshot).toHaveBeenCalledWith(USER, WORKSPACE, 'acc-1');
  });

  it('splits the cost with the pieces that leave and keeps the rest unchanged', async () => {
    const { service, saved, savedSales } = build({ lots: [krugerrands()] });

    const result = await service.sellLot(USER, WORKSPACE, 'lot-1', {
      quantity: 4,
      proceeds: 15000,
      soldOn: '2026-10-01',
      counterparty: 'Degussa',
    });

    // Four of ten pieces take four tenths of the cost with them.
    expect(result.sale).toMatchObject({
      quantity: 4,
      proceeds: 15000,
      costBasis: 12000,
      realized: 3000,
      soldOn: '2026-10-01',
      counterparty: 'Degussa',
    });
    expect(result.sale.fineOunces).toBeCloseTo(3.6668, 6);
    expect(savedSales[0]).toMatchObject({ lotId: 'lot-1', metal: 'XAU', lotName: 'Krugerrand' });

    // What stays behind keeps the same cost per ounce: 18 000 over 6 pieces.
    expect(result.lot).not.toBeNull();
    expect(saved[0]).toMatchObject({ quantity: 6, costTotal: 18000 });
    expect(result.lot?.costPerOunce).toBe(
      Math.round((18000 / (6 * 0.9167)) * 100) / 100,
    );
  });

  it('removes the lot when the last piece is sold and keeps the sale', async () => {
    const { service, holdingRepository, savedSales } = build({ lots: [krugerrands()] });

    const result = await service.sellLot(USER, WORKSPACE, 'lot-1', { proceeds: 40000 });

    expect(result.lot).toBeNull();
    expect(holdingRepository.remove).toHaveBeenCalledTimes(1);
    expect(savedSales[0]).toMatchObject({ quantity: 10, costBasis: 30000 });
  });

  it('records a gift as metal that left for nothing', async () => {
    const { service } = build({ lots: [krugerrands()] });

    const result = await service.sellLot(USER, WORKSPACE, 'lot-1', { quantity: 1, proceeds: 0 });

    expect(result.sale).toMatchObject({ proceeds: 0, costBasis: 3000, realized: -3000 });
  });

  it('refuses to sell more pieces than the lot holds', async () => {
    const { service } = build({ lots: [krugerrands()] });
    await expect(
      service.sellLot(USER, WORKSPACE, 'lot-1', { quantity: 11 }),
    ).rejects.toThrow('The lot does not hold that many pieces');
    await expect(
      service.sellLot(USER, WORKSPACE, 'lot-1', { quantity: 0 }),
    ).rejects.toThrow('A sale needs at least one piece');
  });

  it('measures the premium against the spot price of the day it was bought', async () => {
    const { service } = build({
      lots: [krugerrands()],
      // 9.167 ozt at 3 000 is a melt value of 27 501; 30 000 paid is 2 499 over.
      quoteByDate: { '2026-03-14': 3000 },
    });

    const summary = await service.getSummary(WORKSPACE);
    const [lot] = summary.lots;
    expect(lot.premium).toBe(2499);
    expect(lot.premiumPercent).toBeCloseTo(9.09, 1);
    expect(lot.costPerOunce).toBe(Math.round((30000 / 9.167) * 100) / 100);
  });

  it('says nothing about the premium when the purchase day has no rate', async () => {
    const { service } = build({ lots: [krugerrands()], quoteByDate: {} });
    const [lot] = (await service.getSummary(WORKSPACE)).lots;
    expect(lot.premium).toBeNull();
    expect(lot.premiumPercent).toBeNull();
  });

  it('prices a sale at what the dealer pays and reports ROI against it', async () => {
    const { service } = build({ lots: [krugerrands()], discounts: { XAU: 5 } });

    const summary = await service.getSummary(WORKSPACE);
    const [lot] = summary.lots;
    const melt = Math.round(9.167 * SPOT_EUR * 100) / 100;
    expect(lot.dealerValue).toBe(Math.round(melt * 0.95 * 100) / 100);
    expect(lot.roi).toBe(Math.round((lot.dealerValue / 30000 - 1) * 10000) / 100);
    expect(summary.byMetal[0]).toMatchObject({ dealerDiscount: 5 });
    expect(summary.dealerValue).toBe(lot.dealerValue);
  });

  it('shows the German holding period only to a workspace that files in Germany', async () => {
    const de = build({ lots: [krugerrands()], jurisdiction: 'DE' });
    expect((await de.service.getSummary(WORKSPACE)).lots[0].taxFreeFrom).toBe('2027-03-14');

    const es = build({ lots: [krugerrands()], jurisdiction: 'ES' });
    expect((await es.service.getSummary(WORKSPACE)).lots[0].taxFreeFrom).toBeNull();

    const none = build({ lots: [krugerrands()] });
    expect((await none.service.getSummary(WORKSPACE)).lots[0].taxFreeFrom).toBeNull();
  });

  it('adds up what the sales already realized, per metal and in total', async () => {
    const { service } = build({
      lots: [krugerrands()],
      sales: [
        {
          id: 'sale-1',
          workspaceId: WORKSPACE,
          metal: InvestmentMetal.GOLD,
          lotName: 'Krugerrand',
          quantity: '2',
          fineOunces: '1.8334',
          proceeds: '8000',
          proceedsCurrency: 'EUR',
          costBasis: '6000',
          costCurrency: 'EUR',
          soldOn: '2026-09-30',
          counterparty: null,
        },
      ],
    });

    const summary = await service.getSummary(WORKSPACE);
    expect(summary.realized).toBe(2000);
    expect(summary.byMetal[0].realized).toBe(2000);
    expect(summary.sales[0]).toMatchObject({ realized: 2000, soldOn: '2026-09-30' });
  });

  it('keeps the dealer discount per metal and clamps what it stores', async () => {
    const { service, settingsRepository } = build({ discounts: { XAU: 2 } });

    const saved = await service.saveSettings(USER, WORKSPACE, {
      dealerDiscount: { XAG: 8, XPT: -3 as number },
    });

    expect(saved).toMatchObject({ XAU: 2, XAG: 8, XPT: 0, XPD: 0 });
    expect(settingsRepository.save).toHaveBeenCalled();
  });

  it('serves the photo from the uploads path and removes the one it replaces', async () => {
    const unlink = jest.spyOn(require('node:fs').promises, 'unlink').mockResolvedValue(undefined);
    const { service } = build({ lots: [krugerrands({ photoFile: 'old.jpg' })] });

    const lot = await service.setPhoto(WORKSPACE, 'lot-1', 'new.webp');

    expect(lot.photoUrl).toBe('/uploads/metal-photos/new.webp');
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('metal-photos/old.jpg'));
    unlink.mockRestore();
  });

  it('carries the purchase day and the owner onto the sale', async () => {
    // The lot is deleted when its last piece goes; a holding period cannot be
    // read off a row that no longer exists.
    const { service, savedSales } = build({
      lots: [krugerrands({ acquiredOn: '2026-03-14', ownerUserId: 'anna' })],
    });

    const result = await service.sellLot(USER, WORKSPACE, 'lot-1', { proceeds: 40000 });

    expect(savedSales[0]).toMatchObject({ acquiredOn: '2026-03-14', ownerUserId: 'anna' });
    expect(result.sale).toMatchObject({ acquiredOn: '2026-03-14', ownerUserId: 'anna' });
  });

  it('gives a new lot an owner, and only accepts a member as one', async () => {
    const created = build({ members: [{ id: 'member-1' }] });
    const lot = await created.service.addLot(USER, WORKSPACE, {
      metal: InvestmentMetal.GOLD,
      unitWeight: 1,
    });
    expect(lot.ownerUserId).toBe(USER);

    const stranger = build({ lots: [krugerrands()], members: [] });
    await expect(
      stranger.service.updateLot(USER, WORKSPACE, 'lot-1', { ownerUserId: 'outsider' }),
    ).rejects.toThrow('Workspace member not found');
  });

  it('gives past sales of the lot the owner it just got, if they had none', async () => {
    const { service, saleRepository } = build({
      lots: [krugerrands({ ownerUserId: null })],
      members: [{ id: 'member-1' }],
    });

    await service.updateLot(USER, WORKSPACE, 'lot-1', { ownerUserId: 'anna' });

    // Only the sales that never had an owner; one already attributed keeps its own.
    expect(saleRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ lotId: 'lot-1' }),
      { ownerUserId: 'anna' },
    );
  });

  it('converts what was paid at the rate of the day it was paid', async () => {
    // Bought for 40 000 USD when a dollar was worth 0.9 EUR, sold when it was
    // worth 0.8: the cost is a March amount, not today's.
    const { service } = build({
      lots: [
        krugerrands({
          costTotal: '40000',
          costCurrency: 'USD',
          priceCurrency: 'EUR',
          acquiredOn: '2026-03-14',
        }),
      ],
      sales: [
        {
          id: 'sale-1',
          workspaceId: WORKSPACE,
          metal: InvestmentMetal.GOLD,
          lotName: 'Krugerrand',
          quantity: '4',
          fineOunces: '3.6668',
          proceeds: '20000',
          proceedsCurrency: 'USD',
          costBasis: '16000',
          costCurrency: 'USD',
          acquiredOn: '2026-03-14',
          soldOn: '2026-09-30',
          counterparty: null,
          ownerUserId: 'anna',
        },
      ],
      ratesByDate: { '2026-03-14': 0.9, '2026-09-30': 0.8 },
    });

    const summary = await service.getSummary(WORKSPACE);
    expect(summary.lots[0].cost).toBe(36000);
    // Proceeds at the September rate, the cost it carried away at the March one.
    expect(summary.sales[0]).toMatchObject({ proceeds: 16000, costBasis: 14400, realized: 1600 });
  });

  it('takes the photo with the lot, whether it is deleted or sold out', async () => {
    const unlink = jest.spyOn(require('node:fs').promises, 'unlink').mockResolvedValue(undefined);

    const deleted = build({ lots: [krugerrands({ photoFile: 'gone.jpg' })] });
    await deleted.service.deleteLot(USER, WORKSPACE, 'lot-1');
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('metal-photos/gone.jpg'));

    unlink.mockClear();
    const soldOut = build({ lots: [krugerrands({ photoFile: 'sold.jpg' })] });
    await soldOut.service.sellLot(USER, WORKSPACE, 'lot-1', { proceeds: 1 });
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('metal-photos/sold.jpg'));

    // A lot that only loses some pieces keeps its photo.
    unlink.mockClear();
    const partial = build({ lots: [krugerrands({ photoFile: 'kept.jpg' })] });
    await partial.service.sellLot(USER, WORKSPACE, 'lot-1', { quantity: 1, proceeds: 1 });
    expect(unlink).not.toHaveBeenCalled();
    unlink.mockRestore();
  });

  it('keeps where the lot is kept and what it is insured for', async () => {
    const { service, saved } = build({ lots: [krugerrands()] });

    const lot = await service.updateLot(USER, WORKSPACE, 'lot-1', {
      storageLocation: 'Bank vault 12',
      insuredValue: 45000,
    });

    expect(saved[0]).toMatchObject({
      storageLocation: 'Bank vault 12',
      insuredValue: 45000,
      insuredCurrency: 'EUR',
    });
    expect(lot).toMatchObject({ storageLocation: 'Bank vault 12', insured: 45000 });
  });

  it('attaches only a receipt of the same workspace', async () => {
    const receipt = {
      id: 'rec-1',
      workspaceId: WORKSPACE,
      subject: 'Degussa invoice',
      receivedAt: new Date('2026-03-14T10:00:00.000Z'),
      parsedData: { vendor: 'Degussa', amount: 41000, currency: 'EUR', date: '2026-03-14' },
    };
    const linked = build({ lots: [krugerrands({ receiptId: 'rec-1' })], receipts: [receipt] });
    const summary = await linked.service.getSummary(WORKSPACE);
    expect(summary.lots[0].receipt).toMatchObject({
      id: 'rec-1',
      vendor: 'Degussa',
      amount: 41000,
      date: '2026-03-14',
    });

    // A receipt the workspace does not own is not found, so it cannot be linked.
    const foreign = build({ lots: [krugerrands()] });
    await expect(
      foreign.service.updateLot(USER, WORKSPACE, 'lot-1', { receiptId: 'rec-9' }),
    ).rejects.toThrow('Receipt not found');
  });

  it('adds up what the lots are insured for', async () => {
    const { service } = build({
      lots: [
        krugerrands({ insuredValue: '45000', insuredCurrency: 'EUR' }),
        krugerrands({ id: 'lot-2', insuredValue: '5000', insuredCurrency: 'EUR' }),
      ],
    });
    expect((await service.getSummary(WORKSPACE)).insured).toBe(50000);
  });

  it('values a lot at nothing rather than guessing when no rate converts it', async () => {
    const { service } = build({
      lots: [krugerrands({ priceCurrency: 'USD' })],
      rate: null,
    });
    const summary = await service.getSummary(WORKSPACE);
    expect(summary.value).toBe(0);
  });
});
