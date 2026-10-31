import { findDayRangePeriod } from '@/modules/parsing/helpers/statement-header-period.helper';

const day = (m: number, d: number) => new Date(Date.UTC(2022, m, d));

describe('findDayRangePeriod', () => {
  it('reads a day range in one month', () => {
    expect(findDayRangePeriod('01 -30 Sep 2022')).toEqual({ from: day(8, 1), to: day(8, 30) });
    expect(findDayRangePeriod('1 - 30 September 2022')).toEqual({ from: day(8, 1), to: day(8, 30) });
  });

  it('only counts the first range', () => {
    expect(findDayRangePeriod('01 -30 Sep 2022\n5 -10 Jan 2022')?.from).toEqual(day(8, 1));
  });

  it.each([
    ['no range', 'Statement of account'],
    ['days reversed', '30 -01 Sep 2022'],
    ['unknown month', '12-15 Foo 2022'],
    ['a day that is not in the month', '29-31 Feb 2022'],
  ])('is null for %s', (_name, text) => {
    expect(findDayRangePeriod(text)).toBeNull();
  });
});
