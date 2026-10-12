import { TaxFilingPeriod } from '@/entities/tax-jurisdiction.entity';
import {
  dueDateUnder,
  periodContaining,
  previousPeriod,
  type VatDeadlineRule,
} from '@/modules/tax/vat-deadlines';

const rule = (over: Partial<VatDeadlineRule> = {}): VatDeadlineRule => ({
  returnName: 'Test return',
  frequencies: {},
  shiftsToNextBusinessDay: false,
  extension: null,
  sourceUrl: 'https://example.test',
  ...over,
});

describe('VAT filing periods', () => {
  it.each([
    ['2026-10-10', TaxFilingPeriod.MONTHLY, '2026-10-01', '2026-10-31'],
    ['2026-02-15', TaxFilingPeriod.MONTHLY, '2026-02-01', '2026-02-28'],
    ['2026-08-31', TaxFilingPeriod.QUARTERLY, '2026-07-01', '2026-09-30'],
    ['2026-12-31', TaxFilingPeriod.QUARTERLY, '2026-10-01', '2026-12-31'],
    ['2026-06-01', TaxFilingPeriod.ANNUAL, '2026-01-01', '2026-12-31'],
  ])('%s falls in the %s period %s – %s', (day, frequency, start, end) => {
    expect(periodContaining(day, frequency)).toEqual({ start, end });
  });

  it('steps back across a year boundary', () => {
    const q1 = periodContaining('2026-02-01', TaxFilingPeriod.QUARTERLY);
    expect(previousPeriod(q1, TaxFilingPeriod.QUARTERLY)).toEqual({
      start: '2025-10-01',
      end: '2025-12-31',
    });
    const jan = periodContaining('2026-01-20', TaxFilingPeriod.MONTHLY);
    expect(previousPeriod(jan, TaxFilingPeriod.MONTHLY)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });
});

describe('dueDateUnder', () => {
  const tenth = rule({
    frequencies: { [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 10, plusDays: null } },
  });

  it('is the given day of the month after the period', () => {
    expect(dueDateUnder(tenth, TaxFilingPeriod.MONTHLY, '2026-09-30')).toBe('2026-10-10');
    expect(dueDateUnder(tenth, TaxFilingPeriod.MONTHLY, '2026-12-31')).toBe('2027-01-10');
  });

  it('has nothing to say for a frequency the rule does not cover', () => {
    expect(dueDateUnder(tenth, TaxFilingPeriod.QUARTERLY, '2026-09-30')).toBeNull();
  });

  it('moves a weekend deadline to the Monday when the law says so', () => {
    const shifting = rule({ ...tenth, shiftsToNextBusinessDay: true });
    // 10 January 2027 is a Sunday.
    expect(dueDateUnder(shifting, TaxFilingPeriod.MONTHLY, '2026-12-31')).toBe('2027-01-11');
    // 10 October 2026 is a Saturday.
    expect(dueDateUnder(shifting, TaxFilingPeriod.MONTHLY, '2026-09-30')).toBe('2026-10-12');
  });

  it('adds a standing extension only when it is held', () => {
    const extended = rule({ ...tenth, extension: { months: 1, name: 'Dauerfristverlängerung' } });
    expect(dueDateUnder(extended, TaxFilingPeriod.MONTHLY, '2026-09-30', true)).toBe('2026-11-10');
    expect(dueDateUnder(extended, TaxFilingPeriod.MONTHLY, '2026-09-30', false)).toBe('2026-10-10');
  });

  it('counts days after the end of a month (UK: one month and seven days)', () => {
    const uk = rule({
      frequencies: { [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: null, plusDays: 7 } },
    });
    expect(dueDateUnder(uk, TaxFilingPeriod.QUARTERLY, '2026-03-31')).toBe('2026-05-07');
    expect(dueDateUnder(uk, TaxFilingPeriod.QUARTERLY, '2026-12-31')).toBe('2027-02-07');
  });

  it('counts days straight from the period end (UAE: 28 days)', () => {
    const ae = rule({
      frequencies: { [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 0, day: null, plusDays: 28 } },
    });
    expect(dueDateUnder(ae, TaxFilingPeriod.QUARTERLY, '2026-03-31')).toBe('2026-04-28');
  });

  it('applies a month-specific exception (Spain: the fourth quarter on 30 January)', () => {
    const es = rule({
      frequencies: {
        [TaxFilingPeriod.QUARTERLY]: {
          monthsAfterPeriodEnd: 1,
          day: 20,
          plusDays: null,
          exceptions: [{ periodEndMonth: 12, monthsAfterPeriodEnd: 1, day: 30 }],
        },
      },
    });
    expect(dueDateUnder(es, TaxFilingPeriod.QUARTERLY, '2026-09-30')).toBe('2026-10-20');
    expect(dueDateUnder(es, TaxFilingPeriod.QUARTERLY, '2026-12-31')).toBe('2027-01-30');
  });

  it('clamps a day past the end of a short month', () => {
    const late = rule({
      frequencies: { [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 31, plusDays: null } },
    });
    expect(dueDateUnder(late, TaxFilingPeriod.MONTHLY, '2026-01-31')).toBe('2026-02-28');
  });

  it('can fall on the last day of the month, moved past a weekend (Croatia)', () => {
    const hr = rule({
      shiftsToNextBusinessDay: true,
      frequencies: { [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 'last', plusDays: null } },
    });
    expect(dueDateUnder(hr, TaxFilingPeriod.MONTHLY, '2026-09-30')).toBe('2026-11-02');
    // 31 January 2027 is a Sunday.
    expect(dueDateUnder(hr, TaxFilingPeriod.MONTHLY, '2026-12-31')).toBe('2027-02-01');
  });

  it('can fall on the last working day of the month', () => {
    const lastWorking = rule({
      frequencies: {
        [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 'lastBusinessDay', plusDays: null },
      },
    });
    // 31 October 2026 is a Saturday.
    expect(dueDateUnder(lastWorking, TaxFilingPeriod.MONTHLY, '2026-09-30')).toBe('2026-10-30');
  });
});
