import {
  addDays,
  computeForecast,
  sameParty,
  detectRecurringIncome,
  type ForecastEvent,
  projectIncome,
} from '@/modules/forecast/forecast.engine';

const today = '2026-10-01';
const event = (date: string, amount: number, extra: Partial<ForecastEvent> = {}): ForecastEvent => ({
  date,
  amount,
  label: extra.label ?? (amount > 0 ? 'Pay' : 'Bill'),
  kind: extra.kind ?? (amount > 0 ? 'income' : 'payable'),
  sourceId: extra.sourceId ?? `${date}:${amount}`,
  ...extra,
});

describe('computeForecast', () => {
  it('drains the balance by committed items and the everyday average, and finds the low point', () => {
    const result = computeForecast({
      today,
      horizonDays: 10,
      openingBalance: 1000,
      events: [event('2026-10-03', -400), event('2026-10-08', 900)],
      everydayMonthly: 304.375, // 10 a day
    });

    expect(result.days).toHaveLength(10);
    expect(result.days[0].balance).toBe(990);
    expect(result.days[2]).toMatchObject({ date: '2026-10-03', outflow: 400, balance: 570 });
    expect(result.lowestBalance).toBe(530);
    expect(result.lowestBalanceDate).toBe('2026-10-07');
    expect(result.days[7]).toMatchObject({ inflow: 900, balance: 1420 });
    expect(result.closingBalance).toBe(1400);
    expect(result.totalOutflow).toBe(400);
    expect(result.totalInflow).toBe(900);
    expect(result.shortfallDate).toBeNull();
  });

  it('names the first day the balance goes negative', () => {
    const result = computeForecast({
      today,
      horizonDays: 5,
      openingBalance: 100,
      events: [event('2026-10-02', -80), event('2026-10-04', -50)],
      everydayMonthly: 0,
    });
    expect(result.shortfallDate).toBe('2026-10-04');
    expect(result.lowestBalance).toBe(-30);
  });

  it('keeps safe-to-spend to committed items until the next payday and never below zero', () => {
    const result = computeForecast({
      today,
      horizonDays: 30,
      openingBalance: 500,
      events: [event('2026-10-05', -200), event('2026-10-10', 2000), event('2026-10-12', -900)],
      everydayMonthly: 3000, // would eat everything, must not count
    });
    expect(result.safeToSpend).toEqual({
      amount: 300,
      untilDate: '2026-10-09',
      nextIncomeDate: '2026-10-10',
    });

    const broke = computeForecast({
      today,
      horizonDays: 30,
      openingBalance: 100,
      events: [event('2026-10-05', -200), event('2026-10-10', 2000)],
      everydayMonthly: 0,
    });
    expect(broke.safeToSpend.amount).toBe(0);
  });

  it('applies a scenario: dropped sources, income down, costs up, a one-off repair', () => {
    const result = computeForecast({
      today,
      horizonDays: 20,
      openingBalance: 1000,
      events: [
        event('2026-10-02', -100, { sourceId: 'netflix', kind: 'subscription' }),
        event('2026-10-03', -100, { sourceId: 'rent' }),
        event('2026-10-10', 1000, { sourceId: 'salary' }),
      ],
      everydayMonthly: 0,
      scenario: {
        exclude: ['netflix'],
        incomeFactor: 0.8,
        expenseFactor: 1.5,
        extraEvents: [{ date: '2026-10-15', label: 'Car repair', amount: -300 }],
      },
    });
    expect(result.events.map(item => [item.sourceId, item.amount])).toEqual([
      ['rent', -150],
      ['salary', 800],
      ['scenario:0', -450],
    ]);
    expect(result.closingBalance).toBe(1200);
  });

  it('reads the runway off the projected balance, the same line the chart draws', () => {
    // 12,000 falling by ~4,000 a month: everyday spending only, nothing scheduled.
    const burning = computeForecast({
      today,
      horizonDays: 90,
      openingBalance: 12000,
      events: [],
      everydayMonthly: 4000,
    });
    expect(burning.runwayMonths).toBe(3);

    const growing = computeForecast({
      today,
      horizonDays: 90,
      openingBalance: 12000,
      events: [],
      everydayMonthly: 1000,
      irregularIncomeMonthly: 1500,
    });
    expect(growing.runwayMonths).toBeNull();
  });

  it('reads no runway left, not a growing balance, when the money is already gone and still falling', () => {
    const empty = computeForecast({
      today,
      horizonDays: 90,
      openingBalance: 0,
      events: [],
      everydayMonthly: 20,
    });
    expect(empty.shortfallDate).toBe(today);
    expect(empty.runwayMonths).toBe(0);

    const overdrawnButRecovering = computeForecast({
      today,
      horizonDays: 90,
      openingBalance: -100,
      events: [],
      irregularIncomeMonthly: 500,
      everydayMonthly: 0,
    });
    expect(overdrawnButRecovering.runwayMonths).toBeNull();
  });

  it('reads one runway whatever the horizon, and a shorter horizon is the start of the same line', () => {
    const paydays = Array.from({ length: 12 }, (_, month) =>
      event(addMonths('2026-10-15', month), 2000, { sourceId: 'salary' }),
    );
    const input = {
      today,
      openingBalance: 20000,
      // A big bill in the first month must not halve the 30-day runway.
      events: [event('2026-10-10', -4000), ...paydays],
      everydayMonthly: 3000,
    };
    const [month, quarter, year] = [30, 90, 365].map(horizonDays =>
      computeForecast({ ...input, horizonDays }),
    );

    expect(month.runwayMonths).not.toBeNull();
    expect(quarter.runwayMonths).toBe(month.runwayMonths);
    expect(year.runwayMonths).toBe(month.runwayMonths);
    expect(month.days.map(day => day.balance)).toEqual(
      year.days.slice(0, 30).map(day => day.balance),
    );
  });

  it('never calls a falling projection growing', () => {
    // Pay of 5,127 a month against bills and everyday spending of ~8,000: the line goes down.
    const result = computeForecast({
      today,
      horizonDays: 90,
      openingBalance: 93000,
      events: Array.from({ length: 12 }, (_, month) =>
        event(addMonths('2026-10-03', month), 5127),
      ),
      everydayMonthly: 7987.5,
    });
    expect(result.closingBalance).toBeLessThan(result.openingBalance);
    expect(result.runwayMonths).not.toBeNull();
    expect(result.runwayMonths).toBeGreaterThan(30);
  });
});

describe('everyday averages', () => {
  it('averages income beyond the paydays like spending, so the line leans neither way', () => {
    const result = computeForecast({
      today,
      horizonDays: 30,
      openingBalance: 1000,
      events: [],
      everydayMonthly: 3000,
      irregularIncomeMonthly: 3000,
    });
    expect(result.closingBalance).toBe(1000);
    expect(result.totalIrregularIncome).toBeCloseTo(result.totalEveryday, 2);
  });

  it('lets a dated bill stand in for its party in the spending average instead of adding to it', () => {
    const input = {
      today,
      horizonDays: 10,
      openingBalance: 5000,
      // Spending history: 100 a day, all of it tax.
      everydayMonthly: 3043.75,
      averagedParties: {
        expense: [{ party: 'Finanzamt Charlottenburg', monthly: 3043.75 }],
        income: [],
      },
      events: [
        event('2026-10-03', -500, { label: 'Finanzamt Charlottenburg', sourceId: 'tax' }),
      ],
    };
    const result = computeForecast(input);

    // The 500 bill covers five days of tax; the average resumes on day six.
    expect(result.days.slice(0, 5).map(day => day.everyday)).toEqual([0, 0, 0, 0, 0]);
    expect(result.days[5].everyday).toBe(100);
    expect(result.closingBalance).toBe(4000);

    // Unticking the bill takes the whole bill out; its share stays covered.
    const without = computeForecast({ ...input, scenario: { exclude: ['tax'] } });
    expect(without.closingBalance).toBe(4500);
  });

  it('lets an expected payment stand in for its client in the income average', () => {
    const result = computeForecast({
      today,
      horizonDays: 10,
      openingBalance: 0,
      events: [event('2026-10-05', 300, { label: 'Nimbus Analytics', kind: 'invoice' })],
      everydayMonthly: 0,
      irregularIncomeMonthly: 3043.75,
      averagedParties: { expense: [], income: [{ party: 'Nimbus', monthly: 3043.75 }] },
    });
    expect(result.days.slice(0, 4).map(day => day.irregularIncome)).toEqual([0, 0, 0, 100]);
    expect(result.closingBalance).toBe(1000);
  });

  it('matches party names by their leading words, ignoring case and accents', () => {
    expect(sameParty('WeWork', 'WeWork Kurfürstendamm')).toBe(true);
    expect(sameParty('FINANZAMT  charlottenburg', 'Finanzamt Charlottenburg')).toBe(true);
    expect(sameParty('Café Einstein', 'Cafe Einstein Stammhaus')).toBe(true);
    expect(sameParty('Work', 'WeWork')).toBe(false);
    expect(sameParty('', 'Anything')).toBe(false);
  });
});

describe('detectRecurringIncome', () => {
  it('finds a monthly salary and projects its paydays past today', () => {
    const rows = ['2026-06-25', '2026-07-25', '2026-08-25', '2026-09-25'].map(date => ({
      counterpartyName: 'ACME GmbH',
      amount: 3000,
      transactionDate: date,
    }));
    const [salary] = detectRecurringIncome(rows, today);
    expect(salary).toMatchObject({ label: 'ACME GmbH', amount: 3000, dayOfMonth: 25 });
    expect(salary.nextDate).toBe('2026-10-25');

    // Paid on the 25th, not every 31 days: no drift over the months.
    const paydays = projectIncome(salary, 'income:0', today, '2026-12-31');
    expect(paydays.map(item => item.date)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
  });

  it('ignores one-off deposits and irregular payers', () => {
    const rows = [
      { counterpartyName: 'Refund', amount: 50, transactionDate: '2026-09-01' },
      { counterpartyName: 'Client A', amount: 1000, transactionDate: '2026-05-01' },
      { counterpartyName: 'Client A', amount: 4000, transactionDate: '2026-06-20' },
      { counterpartyName: 'Client A', amount: 1000, transactionDate: '2026-09-15' },
    ];
    expect(detectRecurringIncome(rows, today)).toEqual([]);
  });

  const monthly = (name: string, dates: string[], amounts: number[] = []) =>
    dates.map((date, index) => ({
      counterpartyName: name,
      amount: amounts[index] ?? 3200,
      transactionDate: date,
    }));

  it('still expects a payday a day late, on today', () => {
    // Paid on the 30th; the September payday is a day late on 1 October.
    const [late] = detectRecurringIncome(
      monthly('Northwind', ['2026-06-30', '2026-07-30', '2026-08-30']),
      today,
    );
    expect(late.nextDate).toBe('2026-09-30');
    const [first, second] = projectIncome(late, 'income:0', today, '2026-11-30');
    expect(first).toMatchObject({ date: today, isOverdue: true });
    expect(second.date).toBe('2026-10-30');
  });

  it('skips a payday missed by more than the usual wobble', () => {
    const [skipped] = detectRecurringIncome(
      monthly('Northwind', ['2026-06-02', '2026-07-02', '2026-08-02']),
      '2026-10-04',
    );
    // September's is a month gone; October's (3rd) is a day late.
    expect(skipped.nextDate).toBe('2026-10-02');
  });

  it('stops projecting a payer silent for more than two paydays', () => {
    const rows = monthly('Old client', ['2026-04-01', '2026-05-01', '2026-06-01']);
    expect(detectRecurringIncome(rows, today)).toEqual([]);
  });

  it('expects what the latest paydays brought, so a raise shows', () => {
    const [raised] = detectRecurringIncome(
      monthly(
        'Helix',
        ['2026-04-04', '2026-05-04', '2026-06-04', '2026-07-04', '2026-08-04', '2026-09-04'],
        [1900, 1900, 1900, 2100, 2100, 2100],
      ),
      today,
    );
    expect(raised.amount).toBe(2100);
  });
});

function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1 + months, day);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}

describe('addDays', () => {
  it('crosses month and year ends in local time', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
