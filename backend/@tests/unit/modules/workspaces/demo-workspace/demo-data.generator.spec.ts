import {
  DEMO_MONTHS,
  type DemoTransaction,
  fingerprintKey,
  generateDemoData,
} from '@/modules/workspaces/demo-workspace/demo-data.generator';

const ANCHOR = '2026-09-28';
const rowsOf = (anchor: string): DemoTransaction[] =>
  generateDemoData(anchor).statements.flatMap(statement => statement.transactions);

describe('generateDemoData', () => {
  it('gives the same data for the same anchor', () => {
    expect(JSON.stringify(generateDemoData(ANCHOR))).toBe(JSON.stringify(generateDemoData(ANCHOR)));
  });

  it('dates everything in the twelve months that end on the anchor, nothing later', () => {
    const rows = rowsOf(ANCHOR);
    expect(rows.every(row => row.date >= '2025-10-01' && row.date <= ANCHOR)).toBe(true);
    expect(new Set(rows.map(row => row.date.slice(0, 7))).size).toBe(DEMO_MONTHS);
    expect(rows.some(row => row.date === ANCHOR)).toBe(true);
  });

  it('moves with the anchor: a later anchor shifts the months and keeps the amounts', () => {
    const now = rowsOf(ANCHOR);
    const later = rowsOf('2027-03-28');
    expect(later[0].date.slice(0, 7)).toBe('2026-04');
    expect(later.every(row => row.date <= '2027-03-28')).toBe(true);
    expect(later.map(row => row.cents).slice(0, 20)).toEqual(now.map(row => row.cents).slice(0, 20));
  });

  it('works on the first day of a month', () => {
    const rows = rowsOf('2026-10-01');
    const anchorMonth = rows.filter(row => row.date.startsWith('2026-10'));
    expect(anchorMonth.length).toBeGreaterThan(0);
    expect(anchorMonth.every(row => row.date === '2026-10-01')).toBe(true);
  });

  it('leaves a few of the anchor month’s rows unconfirmed, one of them uncategorised', () => {
    const unconfirmed = rowsOf(ANCHOR).filter(row => !row.confirmed);
    expect(unconfirmed).toHaveLength(5);
    expect(unconfirmed.every(row => row.date.startsWith('2026-09'))).toBe(true);
    expect(unconfirmed.filter(row => row.category === null)).toHaveLength(1);
    expect(unconfirmed.every(row => row.transferKey === null)).toBe(true);
  });

  it('pairs every card payment with its leg on the other account, for the same amount', () => {
    const legs = rowsOf(ANCHOR).filter(row => row.transferKey !== null);
    const byKey = new Map<string, DemoTransaction[]>();
    for (const leg of legs) {
      byKey.set(leg.transferKey as string, [...(byKey.get(leg.transferKey as string) ?? []), leg]);
    }
    expect(byKey.size).toBe(DEMO_MONTHS - 1);
    for (const [first, second] of byKey.values()) {
      expect(first.cents).toBe(second.cents);
      expect(new Set([first.type, second.type])).toEqual(new Set(['income', 'expense']));
      expect(first.account).not.toBe(second.account);
    }
  });

  it('never repeats a fingerprint, which an import would refuse', () => {
    const keys = rowsOf(ANCHOR).map(fingerprintKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('chains statement balances month to month', () => {
    const { statements, accounts } = generateDemoData(ANCHOR);
    for (const account of accounts) {
      const own = statements.filter(statement => statement.account === account.key);
      expect(own).toHaveLength(DEMO_MONTHS);
      expect(own[0].openingCents).toBe(account.openingCents);
      own.forEach((statement, index) => {
        const moved = statement.transactions.reduce(
          (sum, row) => sum + (row.type === 'income' ? row.cents : -row.cents),
          0,
        );
        expect(statement.closingCents).toBe(statement.openingCents + moved);
        if (index > 0) expect(statement.openingCents).toBe(own[index - 1].closingCents);
      });
    }
  });

  it('puts the meals budget over its limit in the anchor month, counting confirmed rows only', () => {
    const { budgets } = generateDemoData(ANCHOR);
    const meals = budgets.find(budget => budget.category === 'Meals and entertainment');
    const spent = rowsOf(ANCHOR)
      .filter(
        row =>
          row.confirmed && row.category === 'Meals and entertainment' && row.date.startsWith('2026-09'),
      )
      .reduce((sum, row) => sum + row.cents, 0);
    expect(spent).toBeGreaterThan(meals?.limitCents ?? Number.POSITIVE_INFINITY);
  });

  it('saves a larger share of income in the anchor month than the month before', () => {
    // Read like the savings-rate advice: confirmed income and spending, no moves between accounts.
    const rateOf = (month: string) => {
      const rows = rowsOf(ANCHOR).filter(
        row => row.date.startsWith(month) && row.confirmed && row.transferKey === null,
      );
      const total = (type: DemoTransaction['type']) =>
        rows.filter(row => row.type === type).reduce((sum, row) => sum + row.cents, 0);
      return ((total('income') - total('expense')) / total('income')) * 100;
    };
    // The advice speaks from a difference of five points.
    expect(rateOf('2026-09') - rateOf('2026-08')).toBeGreaterThan(5);
  });

  it('names real charges for each subscription and a next charge after the last', () => {
    const data = generateDemoData(ANCHOR);
    const refs = new Set(rowsOf(ANCHOR).map(row => row.ref));
    expect(data.subscriptions.length).toBeGreaterThanOrEqual(6);
    for (const subscription of data.subscriptions) {
      expect(subscription.chargeRefs.length).toBeGreaterThan(0);
      expect(subscription.chargeRefs.every(ref => refs.has(ref))).toBe(true);
      expect(subscription.nextChargeDate > subscription.lastChargeDate).toBe(true);
      expect(subscription.lastChargeDate <= ANCHOR).toBe(true);
    }
  });

  it('gives each goal a contribution in the anchor month, for the dashboard', () => {
    for (const goal of generateDemoData(ANCHOR).goals) {
      expect(goal.contributions.some(contribution => contribution.date.startsWith('2026-09'))).toBe(
        true,
      );
      expect(goal.contributions.every(contribution => contribution.date <= ANCHOR)).toBe(true);
    }
  });
});
