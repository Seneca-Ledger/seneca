import { forecastCaveats } from '@/modules/forecast/forecast-caveats';

describe('forecastCaveats', () => {
  it('has nothing to say about a full history, real spending and an account', () => {
    expect(forecastCaveats(false, 900, true)).toEqual([]);
  });

  it('flags averages built on fewer months than the window', () => {
    expect(forecastCaveats(true, 900, true)).toEqual(['shortHistory']);
  });

  it('flags a history whose spending the subscriptions used up', () => {
    expect(forecastCaveats(false, 0, true)).toEqual(['noEverydaySpending']);
  });

  it('flags a balance summed from rows when no account holds one', () => {
    expect(forecastCaveats(false, 900, false)).toEqual(['derivedBalance']);
  });

  it('lists every reason at once, in a fixed order', () => {
    expect(forecastCaveats(true, 0, false)).toEqual([
      'shortHistory',
      'noEverydaySpending',
      'derivedBalance',
    ]);
  });
});
