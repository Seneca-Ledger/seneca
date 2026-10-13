import { HoldingsSnapshotReport } from '../../../../src/modules/reports/holdings-snapshot.report';
import { renderTemplateLabels } from '../../../../src/modules/reports/report-template.translations';

const NOW = new Date('2026-10-13T09:00:00.000Z');
const text = renderTemplateLabels('en');

function holding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    symbol: 'VWCE',
    name: 'All-World',
    assetClass: 'etf',
    quantity: 10,
    price: 100,
    priceCurrency: 'EUR',
    priceSource: 'manual',
    pricedAt: '2026-10-12T00:00:00.000Z',
    value: 1000,
    ...overrides,
  };
}

function lot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    metal: 'XAU',
    name: 'Bar',
    quantity: 1,
    unitWeight: 1,
    weightUnit: 'ozt',
    purity: 0.9999,
    fineOunces: 1,
    price: 2000,
    priceCurrency: 'USD',
    pricedAt: '2026-10-13T00:00:00.000Z',
    cost: 1500,
    storageLocation: 'Safe',
    ...overrides,
  };
}

function build({
  accounts = [] as unknown[],
  lots = [] as unknown[],
  crypto = { holdings: [] as unknown[], unpriced: [] as unknown[] },
  rate = (_from: string): number | null => 2,
} = {}) {
  const report = new HoldingsSnapshotReport(
    { listAccounts: jest.fn(async () => accounts) } as never,
    { getSummary: jest.fn(async () => ({ currency: 'EUR', lots })) } as never,
    { getHoldings: jest.fn(async () => ({ currency: 'USD', ...crypto })) } as never,
    { getRateOrNull: jest.fn(async (from: string) => rate(from)) } as never,
  );
  return report.build('ws1', text, 'EUR', NOW);
}

describe('HoldingsSnapshotReport', () => {
  it('values securities, metals and crypto in the workspace currency, with one total', async () => {
    const { document, missingRates } = await build({
      accounts: [
        {
          id: 'a1',
          name: 'Broker',
          contributed: 800,
          holdings: [holding(), holding({ id: 'h2', symbol: 'AAPL', priceCurrency: 'USD', quantity: 1, price: 50 })],
        },
      ],
      lots: [lot()],
      crypto: {
        holdings: [
          {
            asset: 'BTC',
            amount: '0.5',
            price: 60000,
            value: 30000,
            avgCost: 40000,
            cost: 20000,
            basisIncomplete: false,
          },
        ],
        unpriced: [],
      },
    });

    const [securities, accounts, metals, crypto] = document.sections;
    // 10 × 100 EUR, and 1 × 50 USD at 2.
    expect(securities.rows.map(line => line.at(-1))).toEqual([1000, 100]);
    expect(securities.total?.at(-1)).toBe(1100);
    expect(accounts.rows).toEqual([['Broker', 1100, 800, 300]]);
    // One fine ounce at 2000 USD, cost 1500 already in EUR.
    expect(metals.rows[0].slice(5, 8)).toEqual([4000, 1500, 2500]);
    expect(crypto.rows[0].slice(2, 7)).toEqual([120000, 60000, 80000, 40000, 20000]);
    expect(document.footer).toEqual([['TOTAL PORTFOLIO', 1100 + 4000 + 60000]]);
    expect(document.notes).toBeUndefined();
    expect(missingRates).toEqual([]);
  });

  it('leaves out a holding whose currency has no rate instead of counting it 1:1', async () => {
    const { document, missingRates } = await build({
      accounts: [{ id: 'a1', name: 'Broker', contributed: 0, holdings: [holding({ priceCurrency: 'XYZ' })] }],
      rate: () => null,
    });

    expect(document.sections[0].total?.at(-1)).toBe(0);
    expect(missingRates).toEqual(['XYZ']);
  });

  it('says when prices are stale and when a coin has no price', async () => {
    const { document } = await build({
      accounts: [
        {
          id: 'a1',
          name: 'Broker',
          contributed: 0,
          holdings: [holding({ pricedAt: '2026-09-01T00:00:00.000Z' })],
        },
      ],
      crypto: { holdings: [], unpriced: [{ asset: 'PEPE2', amount: '1000' }] },
    });

    expect(document.notes).toEqual([
      'Prices older than 7 days: 1. Those values may be out of date.',
      'No price for 1000 PEPE2: not included in the total.',
    ]);
  });

  it('leaves out the kinds of asset the workspace does not hold', async () => {
    const { document } = await build();

    expect(document.sections).toEqual([]);
    expect(document.footer).toEqual([['TOTAL PORTFOLIO', 0]]);
  });
});
