import {
  computeBasis,
  computeBasisWithDisposals,
  disposalsByOwner,
  type LotEvent,
} from '../../../../src/modules/crypto/crypto-lots';

const buy = (date: string, amount: number, value: number): LotEvent => ({
  asset: 'ETH',
  date,
  direction: 'in',
  amount,
  value,
});
const sell = (date: string, amount: number, value: number): LotEvent => ({
  asset: 'ETH',
  date,
  direction: 'out',
  amount,
  value,
});

describe('computeBasis', () => {
  it('averages what the remaining coins cost', () => {
    const basis = computeBasis([buy('2026-01-01', 1, 1000), buy('2026-02-01', 1, 3000)]).get('ETH');

    expect(basis).toMatchObject({ quantity: 2, cost: 4000, realized: 0, incomplete: false });
    expect(basis?.avgCost).toBe(2000);
  });

  it('takes the oldest lot first, and prices the rest at what is left', () => {
    const basis = computeBasis([
      buy('2026-01-01', 1, 1000),
      buy('2026-02-01', 1, 3000),
      sell('2026-03-01', 1, 2500),
    ]).get('ETH');

    // Sold the 1 000 lot for 2 500: 1 500 taken. What is left cost 3 000.
    expect(basis).toMatchObject({ quantity: 1, cost: 3000, realized: 1500 });
    expect(basis?.avgCost).toBe(3000);
  });

  it('books a loss as a loss', () => {
    const basis = computeBasis([buy('2026-01-01', 2, 6000), sell('2026-02-01', 1, 1000)]).get('ETH');

    expect(basis?.realized).toBe(-2000);
  });

  it('does not invent a gain for coins it never saw bought', () => {
    const basis = computeBasis([sell('2026-02-01', 1, 2500)]).get('ETH');

    expect(basis).toMatchObject({ quantity: 0, cost: 0, realized: 0, incomplete: true });
    expect(basis?.avgCost).toBeNull();
  });

  it('sorts events by date rather than trusting the order they arrive in', () => {
    const late = computeBasis([
      sell('2026-03-01', 1, 2500),
      buy('2026-02-01', 1, 3000),
      buy('2026-01-01', 1, 1000),
    ]).get('ETH');

    expect(late).toMatchObject({ realized: 1500, incomplete: false });
  });

  it('keeps each asset’s lots to itself', () => {
    const basis = computeBasis([
      buy('2026-01-01', 1, 1000),
      { asset: 'BTC', date: '2026-01-02', direction: 'out', amount: 1, value: 50000 },
    ]);

    expect(basis.get('ETH')?.quantity).toBe(1);
    expect(basis.get('BTC')).toMatchObject({ incomplete: true, realized: 0 });
  });

  it('ignores a zero-amount event instead of dividing by it', () => {
    expect(computeBasis([{ ...buy('2026-01-01', 0, 0) }]).size).toBe(0);
  });
});

describe('disposalsByOwner', () => {
  it('matches each person against their own purchases, not a colleague one', () => {
    const byOwner = disposalsByOwner([
      { asset: 'ETH', date: '2026-01-01', direction: 'in', amount: 1, value: 1000, owner: 'anna' },
      { asset: 'ETH', date: '2026-02-01', direction: 'in', amount: 1, value: 3000, owner: 'bob' },
      // Anna sells hers: FIFO across the workspace would have taken her 1 000
      // first anyway, so the giveaway is Bob selling his at a 3 000 basis.
      { asset: 'ETH', date: '2026-03-01', direction: 'out', amount: 1, value: 2500, owner: 'bob' },
    ]);

    expect(byOwner.get('bob')?.[0]).toMatchObject({ cost: 3000, gain: -500 });
    expect(byOwner.get('anna') ?? []).toEqual([]);
  });

  it('keeps events nobody owns in a group of their own', () => {
    const byOwner = disposalsByOwner([
      { asset: 'BTC', date: '2026-01-01', direction: 'in', amount: 1, value: 20000 },
      { asset: 'BTC', date: '2026-04-01', direction: 'out', amount: 1, value: 30000 },
    ]);

    expect(byOwner.get(null)?.[0]).toMatchObject({ gain: 10000 });
  });
});

describe('computeBasisWithDisposals', () => {
  it('states each sale against the purchase it consumed', () => {
    const { disposals } = computeBasisWithDisposals([
      buy('2026-01-01', 1, 1000),
      buy('2026-02-01', 1, 3000),
      sell('2026-03-01', 1, 2500),
    ]);

    expect(disposals).toEqual([
      {
        id: 'ETH-2026-03-01-1',
        asset: 'ETH',
        date: '2026-03-01',
        amount: 1,
        proceeds: 2500,
        cost: 1000,
        gain: 1500,
        acquiredOn: '2026-01-01',
        heldDays: 59,
        uncoveredAmount: 0,
        uncoveredProceeds: 0,
        costIncomplete: false,
      },
    ]);
  });

  it('dates a sale that ate two purchases from the older one', () => {
    const [disposal] = computeBasisWithDisposals([
      buy('2026-01-01', 1, 1000),
      buy('2026-02-01', 1, 3000),
      sell('2026-03-01', 2, 8000),
    ]).disposals;

    expect(disposal).toMatchObject({ amount: 2, cost: 4000, gain: 4000, acquiredOn: '2026-01-01' });
  });

  it('counts only the part a purchase backs, and says how much it could not', () => {
    const [disposal] = computeBasisWithDisposals([
      buy('2026-01-01', 1, 1000),
      sell('2026-03-01', 3, 9000),
    ]).disposals;

    // Three sold at 3 000 each, one of them with a cost: the rest is not a gain
    // this can measure. The row says so instead of passing 2 000 off as the whole.
    expect(disposal).toMatchObject({
      amount: 1,
      proceeds: 3000,
      cost: 1000,
      gain: 2000,
      uncoveredAmount: 2,
      uncoveredProceeds: 6000,
      costIncomplete: true,
    });
  });

  it('numbers two identical sales on one day apart', () => {
    const { disposals } = computeBasisWithDisposals([
      buy('2026-01-01', 2, 2000),
      sell('2026-03-01', 1, 1200),
      sell('2026-03-01', 1, 1200),
    ]);

    // Same coin, same day, same size — two sales, and the report must keep both.
    expect(disposals).toHaveLength(2);
    expect(new Set(disposals.map(disposal => disposal.id)).size).toBe(2);
  });

  it('reports a sale with no purchase behind it instead of dropping it', () => {
    // It used to record nothing, which hid the sale from a report built on
    // these rows. The gain stays at zero — there is no cost to measure one
    // against — but the row says what left and what it fetched.
    const [disposal] = computeBasisWithDisposals([sell('2026-03-01', 1, 2500)]).disposals;
    expect(disposal).toMatchObject({
      amount: 0,
      gain: 0,
      acquiredOn: null,
      heldDays: null,
      uncoveredAmount: 1,
      uncoveredProceeds: 2500,
      costIncomplete: true,
    });
  });
});
