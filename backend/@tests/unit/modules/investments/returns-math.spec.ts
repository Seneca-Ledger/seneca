import { cumulativeNet, modifiedDietz, xirr } from '@/modules/investments/returns-math';

describe('modifiedDietz', () => {
  it('is the plain return when no money moved', () => {
    const result = modifiedDietz({
      startValue: 1000,
      endValue: 1100,
      from: '2026-01-01',
      to: '2026-12-31',
      flows: [],
    });

    expect(result.gain).toBe(100);
    expect(result.percent).toBeCloseTo(10, 10);
  });

  it('does not count money paid in as a gain', () => {
    // 1000 at the start, 500 more half way through, worth 1600 at the end:
    // 100 was earned on an average of 1250 at work.
    const result = modifiedDietz({
      startValue: 1000,
      endValue: 1600,
      from: '2026-01-01',
      to: '2026-01-31',
      flows: [{ date: '2026-01-16', amount: 500 }],
    });

    expect(result.gain).toBe(100);
    expect(result.percent).toBeCloseTo((100 / 1250) * 100, 10);
  });

  it('counts a payout as part of the return, not as a loss', () => {
    // A 50 dividend paid out to the bank: the account is still worth 1000.
    const result = modifiedDietz({
      startValue: 1000,
      endValue: 1000,
      from: '2026-01-01',
      to: '2026-12-31',
      flows: [{ date: '2026-12-31', amount: -50 }],
    });

    expect(result.gain).toBe(50);
    expect(result.percent).toBeCloseTo(5, 10);
  });

  it('weighs money paid in on the first day in full and on the last day not at all', () => {
    const first = modifiedDietz({
      startValue: 0,
      endValue: 1100,
      from: '2026-01-01',
      to: '2026-12-31',
      flows: [{ date: '2026-01-01', amount: 1000 }],
    });
    expect(first.percent).toBeCloseTo(10, 10);

    const last = modifiedDietz({
      startValue: 1000,
      endValue: 2100,
      from: '2026-01-01',
      to: '2026-12-31',
      flows: [{ date: '2026-12-31', amount: 1000 }],
    });
    expect(last.gain).toBe(100);
    expect(last.percent).toBeCloseTo(10, 10);
  });

  it('has no percentage when nothing was at work', () => {
    const result = modifiedDietz({
      startValue: 0,
      endValue: 0,
      from: '2026-01-01',
      to: '2026-12-31',
      flows: [],
    });

    expect(result.gain).toBe(0);
    expect(result.percent).toBeNull();
  });

  it('has no percentage for a window with no length', () => {
    const result = modifiedDietz({
      startValue: 1000,
      endValue: 1100,
      from: '2026-01-01',
      to: '2026-01-01',
      flows: [],
    });

    expect(result.percent).toBeNull();
  });
});

describe('xirr', () => {
  it('matches the worked example in the spreadsheet documentation', () => {
    const rate = xirr([
      { date: '2008-01-01', amount: -10000 },
      { date: '2008-03-01', amount: 2750 },
      { date: '2008-10-30', amount: 4250 },
      { date: '2009-02-15', amount: 3250 },
      { date: '2009-04-01', amount: 2750 },
    ]);

    expect(rate).not.toBeNull();
    expect((rate as number) * 100).toBeCloseTo(37.34, 2);
  });

  it('finds a loss as readily as a gain', () => {
    const rate = xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 800 },
    ]);

    expect(rate).toBeCloseTo(-0.2, 3);
  });

  it('has no answer when money only went one way', () => {
    expect(
      xirr([
        { date: '2025-01-01', amount: -1000 },
        { date: '2026-01-01', amount: -500 },
      ]),
    ).toBeNull();
    expect(xirr([])).toBeNull();
  });
});

describe('cumulativeNet', () => {
  it('carries the running total of money in, less money out, to every day', () => {
    const points = cumulativeNet(
      ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'],
      [
        { date: '2026-01-02', amount: 100 },
        { date: '2025-12-15', amount: 50 },
        { date: '2026-01-04', amount: -30 },
      ],
    );

    expect(points).toEqual([50, 150, 150, 120]);
  });
});
