import {
  addMissingRates,
  buildRateMap,
  convertWith,
} from '@/modules/goals/goal-money.util';

/** UAH has a rate to USD; XYZ has none anywhere. */
const rates = {
  getRateOrNull: vi.fn(async (from: string) => (from === 'UAH' ? 0.024 : null)),
} as never;

describe('goal money helpers', () => {
  it('converts at the rate and keeps the target currency as it is', async () => {
    const map = await buildRateMap(rates, ['UAH', 'USD'], 'USD', 'ws-1');

    expect(convertWith(map, 500, 'UAH')).toBeCloseTo(12);
    expect(convertWith(map, 20, 'USD')).toBe(20);
  });

  it('counts an amount with no rate as nothing, never one to one', async () => {
    const map = await buildRateMap(rates, ['XYZ'], 'USD', 'ws-1');

    expect(convertWith(map, 900, 'XYZ')).toBe(0);
  });

  it('adds rates for currencies read after the map was built', async () => {
    const map = await buildRateMap(rates, ['USD'], 'USD', 'ws-1');
    expect(convertWith(map, 500, 'UAH')).toBe(0);

    await addMissingRates(rates, map, ['UAH'], 'USD', 'ws-1');

    expect(convertWith(map, 500, 'UAH')).toBeCloseTo(12);
  });
});
