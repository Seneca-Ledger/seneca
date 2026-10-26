/**
 * Return arithmetic for the returns page, kept free of the database so every
 * figure on that page can be checked by hand.
 *
 * Sign convention, from the portfolio's side: a flow is positive when money
 * goes into the portfolio (a contribution) and negative when it leaves (a
 * withdrawal, or a dividend paid out to the bank).
 */

export interface CashFlow {
  date: string;
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/**
 * Gain over a window and the Modified Dietz return on it: the gain divided by
 * the money that was at work on average, each flow weighted by the share of
 * the window it was in the portfolio.
 *
 * The gain is what the market did, not what was paid in: end value, less the
 * start value, less net money in. Money paid out counts as earned.
 *
 * Chosen over a time-weighted return because that needs the value on the day
 * of every flow, and most lines here have a value only on the days someone
 * entered one.
 */
export function modifiedDietz(input: {
  startValue: number;
  endValue: number;
  from: string;
  to: string;
  flows: CashFlow[];
}): { gain: number; percent: number | null } {
  const netIn = input.flows.reduce((sum, flow) => sum + flow.amount, 0);
  const gain = round2(input.endValue - input.startValue - netIn);

  const length = daysBetween(input.from, input.to);
  if (length <= 0) {
    return { gain, percent: null };
  }

  let atWork = input.startValue;
  for (const flow of input.flows) {
    const weight = (length - daysBetween(input.from, flow.date)) / length;
    atWork += Math.min(1, Math.max(0, weight)) * flow.amount;
  }

  return { gain, percent: atWork > 0 ? (gain / atWork) * 100 : null };
}

/**
 * Annual rate at which the flows' present value is zero — the money-weighted
 * return. Flows here are from the investor's side: money put in is negative,
 * money taken out (and the value still held, as one last flow) is positive.
 *
 * Newton's method from 10%, then bisection when Newton wanders off; null when
 * the money only went one way or no rate makes the sum zero.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (!(flows.some(flow => flow.amount > 0) && flows.some(flow => flow.amount < 0))) {
    return null;
  }

  const start = flows.reduce(
    (earliest, flow) => (flow.date < earliest ? flow.date : earliest),
    flows[0].date,
  );
  const terms = flows.map(flow => ({
    years: daysBetween(start, flow.date) / 365,
    amount: flow.amount,
  }));
  const value = (rate: number) =>
    terms.reduce((sum, term) => sum + term.amount / (1 + rate) ** term.years, 0);
  const slope = (rate: number) =>
    terms.reduce(
      (sum, term) => sum - (term.years * term.amount) / (1 + rate) ** (term.years + 1),
      0,
    );

  let rate = 0.1;
  for (let step = 0; step < 100; step += 1) {
    const current = value(rate);
    if (Math.abs(current) < 1e-7) {
      return rate;
    }
    const derivative = slope(rate);
    if (!Number.isFinite(derivative) || derivative === 0) {
      break;
    }
    const next = rate - current / derivative;
    if (!Number.isFinite(next) || next <= -1) {
      break;
    }
    rate = next;
  }

  return bisect(value, -0.9999, 100);
}

function bisect(value: (rate: number) => number, low: number, high: number): number | null {
  let lowValue = value(low);
  if (Math.sign(lowValue) === Math.sign(value(high))) {
    return null;
  }
  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2;
    const middleValue = value(middle);
    if (Math.abs(middleValue) < 1e-7 || high - low < 1e-10) {
      return middle;
    }
    if (Math.sign(middleValue) === Math.sign(lowValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/**
 * Net money in up to and including each of `dates` (sorted ascending): the
 * line the value is drawn against, so the gap between the two is the gain.
 */
export function cumulativeNet(dates: string[], flows: CashFlow[]): number[] {
  const sorted = [...flows].sort((left, right) => left.date.localeCompare(right.date));
  const totals: number[] = [];
  let index = 0;
  let running = 0;
  for (const date of dates) {
    while (index < sorted.length && sorted[index].date <= date) {
      running += sorted[index].amount;
      index += 1;
    }
    totals.push(round2(running));
  }
  return totals;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
