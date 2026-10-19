import { filingInfoFor } from '@/modules/income-tax/filing-info';

/** The dates the 2026-10-10 research pass worked out by hand for tax year 2026. */
const RESEARCHED_2026: Record<string, string> = {
  DE: 'standard 2027-08-02, adviser 2028-02-29',
  AT: 'paper 2027-04-30, online 2027-06-30, adviser 2028-03-31',
  PL: 'opens 2027-02-15, standard 2027-04-30',
  CZ: 'standard 2027-04-01, online 2027-05-03, adviser 2027-07-01',
  SK: 'standard 2027-03-31, with_extension 2027-06-30, with_extension 2027-09-30',
  HU: 'standard 2027-05-20',
  SI: 'standard 2027-03-31',
  HR: 'standard 2027-03-01',
  PT: 'opens 2027-04-01, standard 2027-06-30',
  // 31 October is a Sunday and 1 November a holiday.
  IT: 'online 2027-11-02',
  NL: 'standard 2027-05-01, with_extension 2027-09-01',
  IE: 'standard 2027-10-31',
  MT: 'standard 2027-06-30',
  CY: 'standard 2027-07-31',
  GR: 'opens 2027-03-15, standard 2027-07-15',
  SE: 'standard 2027-05-03',
  DK: 'standard 2027-07-01',
  FI: 'standard 2027-04-01',
  EE: 'opens 2027-02-15, standard 2027-04-30',
  // The higher-rate window the research described but could not encode.
  LV: 'opens 2027-03-01, standard 2027-06-01, higher_rate_income 2027-07-01',
  LT: 'standard 2027-05-03',
  RO: 'standard 2027-05-25',
  BG: 'opens 2027-01-10, standard 2027-04-30',
  KZ: 'standard 2027-03-31',
};

const HOLIDAYS: Record<string, string[]> = { IT: ['2027-11-01'] };

function summary(country: string, taxYear: number, holidays: string[] = []): string | null {
  const info = filingInfoFor(country, taxYear, 'self_employed', {}, new Set(holidays));
  if (!info) {
    return null;
  }
  return [
    ...(info.filingOpens ? [`opens ${info.filingOpens}`] : []),
    ...info.deadlines.map(deadline => `${deadline.kind} ${deadline.date}`),
  ].join(', ');
}

describe('filing calendar worked out from the statute', () => {
  it.each(Object.entries(RESEARCHED_2026))('gives %s the researched dates for 2026', (country, dates) => {
    expect(summary(country, 2026, HOLIDAYS[country])).toBe(dates);
  });

  it('labels a computed year as statute-based, and the published year as published', () => {
    expect(filingInfoFor('DE', 2026, 'self_employed', {})).toMatchObject({
      basis: 'statute',
      checkedAt: '2026-10-10',
    });
    expect(filingInfoFor('DE', 2025, 'self_employed', {})).toMatchObject({ basis: 'published' });
  });

  it('needs nothing new for later years', () => {
    // 31.07.2028 is a Monday; February 2030 has 28 days.
    expect(summary('DE', 2027)).toBe('standard 2028-07-31, adviser 2029-02-28');
    // 2 May 2028 is a Tuesday.
    expect(summary('SE', 2027)).toBe('standard 2028-05-02');
    expect(filingInfoFor('NL', 2027, 'self_employed', {})?.formName).toBe(
      'Aangifte inkomstenbelasting 2027',
    );
  });

  it('moves a deadline off a holiday only where the law says so', () => {
    // 1 May 2028 is a Monday and a holiday in Lithuania.
    expect(summary('LT', 2027, ['2028-05-01'])).toBe('standard 2028-05-02');
    // Poland's rule is not confirmed to move, so a holiday changes nothing.
    expect(summary('PL', 2026, ['2027-04-30'])).toBe('opens 2027-02-15, standard 2027-04-30');
    // Without the holiday calendar only the weekend is skipped: a day early, never late.
    expect(summary('IT', 2026)).toBe('online 2027-11-01');
  });

  it('moves an opening day where only the opening is said to move', () => {
    // 15 February 2031 is a Saturday.
    expect(filingInfoFor('EE', 2030, 'self_employed', {})?.filingOpens).toBe('2031-02-17');
  });

  it('does not carry a 2025 per-type date into a computed year', () => {
    // The 730's dates were only checked for 2025.
    expect(filingInfoFor('IT', 2026, 'employee', {})).toMatchObject({
      formName: '730 precompilato',
      deadlines: [],
      filingOpens: null,
    });
    expect(filingInfoFor('DK', 2026, 'employee', {})?.deadlines).toEqual([]);
  });

  it('moves the German deadline off a Saturday and keeps the adviser deadline', () => {
    const info = filingInfoFor('DE', 2026, 'self_employed', {});
    expect(info?.deadlines).toEqual([
      { kind: 'standard', date: '2027-08-02' },
      { kind: 'adviser', date: '2028-02-29' },
    ]);
    expect(info?.portal).toBe('ELSTER');
  });

  it('runs a retention rule given in years one year later', () => {
    const info = filingInfoFor('DE', 2026, 'self_employed', {});
    expect(info?.retention?.periods.map(period => period.until)).toEqual([
      '2034-12-31',
      '2036-12-31',
      '2032-12-31',
    ]);
  });

  it('keeps the 2025 per-type logic: no retention duty for an employee in Germany', () => {
    expect(filingInfoFor('DE', 2026, 'employee', {})?.retention).toBeNull();
  });

  it('keeps the Polish form choice by regime', () => {
    expect(filingInfoFor('PL', 2026, 'self_employed', { regime: 'liniowy' })?.formName).toBe('PIT-36L');
    expect(filingInfoFor('PL', 2026, 'self_employed', {})?.deadlines).toEqual([
      { kind: 'standard', date: '2027-04-30' },
    ]);
  });

  it('covers a country new in 2026', () => {
    expect(filingInfoFor('KZ', 2026, 'self_employed', {})?.deadlines[0]).toEqual({
      kind: 'standard',
      date: '2027-03-31',
    });
  });

  it('says nothing for a country whose calendar is set anew each year', () => {
    expect(filingInfoFor('ES', 2026, 'self_employed', {})).toBeNull();
    expect(filingInfoFor('FR', 2026, 'self_employed', {})).toBeNull();
    expect(filingInfoFor('BE', 2027, 'self_employed', {})).toBeNull();
  });

  it('has no retention rule where 2025 gave only a date', () => {
    // Italy's 2025 rule is a date (31.12.2031), which does not carry over.
    expect(filingInfoFor('IT', 2026, 'self_employed', {})?.retention).toBeNull();
  });
});
