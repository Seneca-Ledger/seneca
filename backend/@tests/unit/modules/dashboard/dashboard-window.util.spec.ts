import {
  daysInMonth,
  getCashFlowRangeBounds,
  getMonthWindowBounds,
  getWindowBounds,
  getYearWindowBounds,
  parseMonthWindow,
} from '../../../../src/modules/dashboard/dashboard-window.util';

describe('parseMonthWindow', () => {
  it('turns YYYY-MM into that calendar month', () => {
    const window = parseMonthWindow('2026-02');

    expect(window?.since.toISOString()).toBe(new Date('2026-02-01T00:00:00').toISOString());
    expect(window?.endDate.toISOString()).toBe(new Date('2026-02-28T23:59:59.999').toISOString());
  });

  it('rejects anything that is not a real YYYY-MM', () => {
    expect(parseMonthWindow(undefined)).toBeNull();
    expect(parseMonthWindow('2026-13')).toBeNull();
    expect(parseMonthWindow('2026-2')).toBeNull();
    expect(parseMonthWindow('2026-02-01')).toBeNull();
  });
});

describe('getYearWindowBounds', () => {
  it('spans January 1 to the last millisecond of December 31', () => {
    const { since, endDate } = getYearWindowBounds(2025);

    expect(since.toISOString()).toBe(new Date('2025-01-01T00:00:00').toISOString());
    expect(endDate.toISOString()).toBe(new Date('2025-12-31T23:59:59.999').toISOString());
  });
});

describe('getCashFlowRangeBounds', () => {
  const now = new Date('2026-03-15T12:00:00');
  const endOfMarch = new Date('2026-03-31T23:59:59.999').toISOString();

  it('12m spans the current month and the 11 before it', () => {
    const bounds = getCashFlowRangeBounds('12m', now, null);

    expect(bounds?.since.toISOString()).toBe(new Date('2025-04-01T00:00:00').toISOString());
    expect(bounds?.endDate.toISOString()).toBe(endOfMarch);
  });

  it('this_year starts on January 1 of the current year', () => {
    const bounds = getCashFlowRangeBounds('this_year', now, null);

    expect(bounds?.since.toISOString()).toBe(new Date('2026-01-01T00:00:00').toISOString());
    expect(bounds?.endDate.toISOString()).toBe(endOfMarch);
  });

  it('5y spans 60 whole months', () => {
    const bounds = getCashFlowRangeBounds('5y', now, null);

    expect(bounds?.since.toISOString()).toBe(new Date('2021-04-01T00:00:00').toISOString());
  });

  it('all starts at the month of the earliest transaction', () => {
    const bounds = getCashFlowRangeBounds('all', now, new Date('2019-11-20T08:00:00'));

    expect(bounds?.since.toISOString()).toBe(new Date('2019-11-01T00:00:00').toISOString());
    expect(bounds?.endDate.toISOString()).toBe(endOfMarch);
  });

  it('all is null when there are no transactions', () => {
    expect(getCashFlowRangeBounds('all', now, null)).toBeNull();
  });

  it('ends every range at a picked past month', () => {
    const july2025 = new Date('2025-07-01T00:00:00');
    const endOfJuly = new Date('2025-07-31T23:59:59.999').toISOString();

    const twelve = getCashFlowRangeBounds('12m', july2025, null);
    expect(twelve?.since.toISOString()).toBe(new Date('2024-08-01T00:00:00').toISOString());
    expect(twelve?.endDate.toISOString()).toBe(endOfJuly);

    const thisYear = getCashFlowRangeBounds('this_year', july2025, null);
    expect(thisYear?.since.toISOString()).toBe(new Date('2025-01-01T00:00:00').toISOString());
    expect(thisYear?.endDate.toISOString()).toBe(endOfJuly);
  });

  it('all is null when the first transaction is after the picked month', () => {
    expect(
      getCashFlowRangeBounds('all', new Date('2025-07-01T00:00:00'), new Date('2025-09-02T00:00:00')),
    ).toBeNull();
  });

  it('crosses the year boundary in January', () => {
    const bounds = getCashFlowRangeBounds('12m', new Date('2026-01-05T00:00:00'), null);

    expect(bounds?.since.toISOString()).toBe(new Date('2025-02-01T00:00:00').toISOString());
    expect(bounds?.endDate.toISOString()).toBe(
      new Date('2026-01-31T23:59:59.999').toISOString(),
    );
  });
});

describe('getWindowBounds', () => {
  it('spans the requested number of days ending at the target date', () => {
    const { since, endDate } = getWindowBounds(30, new Date('2026-03-15T12:00:00'));

    expect(endDate.toISOString()).toBe(new Date('2026-03-15T23:59:59.999').toISOString());
    expect(since.toISOString()).toBe(new Date('2026-02-13T00:00:00.000').toISOString());
  });
});

describe('getMonthWindowBounds', () => {
  it('spans the full calendar month for a mid-month anchor', () => {
    const { since, endDate } = getMonthWindowBounds(new Date('2026-03-15T12:00:00'));

    expect(since.toISOString()).toBe(new Date('2026-03-01T00:00:00.000').toISOString());
    expect(endDate.toISOString()).toBe(new Date('2026-03-31T23:59:59.999').toISOString());
  });

  it('handles the first day of the month as the anchor', () => {
    const { since, endDate } = getMonthWindowBounds(new Date('2026-03-01T00:00:00'));

    expect(since.toISOString()).toBe(new Date('2026-03-01T00:00:00.000').toISOString());
    expect(endDate.toISOString()).toBe(new Date('2026-03-31T23:59:59.999').toISOString());
  });

  it('handles the last day of the month as the anchor', () => {
    const { since, endDate } = getMonthWindowBounds(new Date('2026-03-31T23:00:00'));

    expect(since.toISOString()).toBe(new Date('2026-03-01T00:00:00.000').toISOString());
    expect(endDate.toISOString()).toBe(new Date('2026-03-31T23:59:59.999').toISOString());
  });

  it('handles February in a leap year', () => {
    const { since, endDate } = getMonthWindowBounds(new Date('2028-02-10T00:00:00'));

    expect(since.toISOString()).toBe(new Date('2028-02-01T00:00:00.000').toISOString());
    expect(endDate.toISOString()).toBe(new Date('2028-02-29T23:59:59.999').toISOString());
  });

  it('handles February in a non-leap year', () => {
    const { endDate } = getMonthWindowBounds(new Date('2026-02-10T00:00:00'));

    expect(endDate.toISOString()).toBe(new Date('2026-02-28T23:59:59.999').toISOString());
  });

  it('rolls over the year boundary for December', () => {
    const { since, endDate } = getMonthWindowBounds(new Date('2025-12-25T00:00:00'));

    expect(since.toISOString()).toBe(new Date('2025-12-01T00:00:00.000').toISOString());
    expect(endDate.toISOString()).toBe(new Date('2025-12-31T23:59:59.999').toISOString());
  });
});

describe('daysInMonth', () => {
  it('returns 31 for a 31-day month', () => {
    expect(daysInMonth(new Date('2026-03-15'))).toBe(31);
  });

  it('returns 30 for a 30-day month', () => {
    expect(daysInMonth(new Date('2026-04-15'))).toBe(30);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(new Date('2028-02-15'))).toBe(29);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(new Date('2026-02-15'))).toBe(28);
  });
});
