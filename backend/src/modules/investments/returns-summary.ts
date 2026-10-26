import type {
  ReturnsFlag,
  ReturnsPoint,
  ReturnsRange,
  ReturnsSource,
  ReturnsSummary,
} from '../../contracts';
import { decimate, everyDay, shiftDays } from '../balance/snapshot-series';
import type { ValuedInvestmentFlow } from './investment-flows.service';
import { type CashFlow, cumulativeNet, modifiedDietz, xirr } from './returns-math';
import { round2, type TrackedSource } from './returns-sources';

const MAX_SERIES_POINTS = 200;
const YEAR_DAYS = 365;

type Flow = Pick<ValuedInvestmentFlow, 'date' | 'value' | 'kind'>;

/** A flow from the portfolio's side: money in positive, money out negative. */
function portfolioFlow(flow: Flow): CashFlow {
  return { date: flow.date, amount: flow.kind === 'contribution' ? flow.value : -flow.value };
}

/**
 * The day before the first value or flow of any line: the whole history then
 * opens at zero and every flow falls inside it. A year back when there is
 * nothing yet, so the page has a window to draw.
 */
export function historyStart(
  tracked: TrackedSource[],
  histories: Map<string, Array<{ date: string }>>,
  to: string,
): string {
  const dates = tracked.flatMap(source => [
    ...source.flows.map(flow => flow.date),
    ...(histories.get(source.id) ?? []).map(point => point.date),
  ]);
  if (dates.length === 0) {
    return shiftDays(to, -YEAR_DAYS);
  }
  return shiftDays(dates.sort()[0], -1);
}

/**
 * What the line was worth at the end of the window's first day. Unknown —
 * null — when nothing was entered by then although money had already gone
 * in: zero would turn everything held into a gain made inside the window.
 */
export function openingValue(
  source: TrackedSource,
  range: ReturnsRange,
  from: string,
  histories: Map<string, Array<{ date: string }>>,
  valueAt: (source: TrackedSource, date: string) => number,
): number | null {
  if (range === 'all') {
    return 0;
  }
  const entered = (histories.get(source.id) ?? []).some(point => point.date <= from);
  if (entered) {
    return valueAt(source, from);
  }
  const movedBefore = source.flows.some(flow => flow.kind !== 'income' && flow.date <= from);
  return movedBefore ? null : 0;
}

export function periodRow(
  source: TrackedSource,
  startValue: number,
  from: string,
  to: string,
): Omit<ReturnsSource, 'includedInReturn' | 'flags'> {
  const inWindow = source.flows.filter(flow => flow.date > from && flow.date <= to);
  const total = (kind: Flow['kind']) =>
    round2(inWindow.filter(flow => flow.kind === kind).reduce((sum, flow) => sum + flow.value, 0));
  const { gain, percent } = modifiedDietz({
    startValue,
    endValue: source.liveValue,
    from,
    to,
    flows: inWindow.map(portfolioFlow),
  });
  return {
    kind: source.kind,
    id: source.id,
    name: source.name,
    scope: 'period',
    startValue: round2(startValue),
    endValue: round2(source.liveValue),
    contributions: total('contribution'),
    withdrawals: total('withdrawal'),
    income: total('income'),
    gain,
    returnPercent: percent === null ? null : round2(percent),
  };
}

export function summarize(
  included: Array<{ source: TrackedSource; startValue: number }>,
  from: string,
  to: string,
  flags: ReturnsFlag[],
): ReturnsSummary {
  const startValue = included.reduce((sum, entry) => sum + entry.startValue, 0);
  const endValue = included.reduce((sum, entry) => sum + entry.source.liveValue, 0);
  const all = included.flatMap(entry => entry.source.flows);
  const inWindow = all.filter(flow => flow.date > from && flow.date <= to);
  const total = (kind: Flow['kind']) =>
    inWindow.filter(flow => flow.kind === kind).reduce((sum, flow) => sum + flow.value, 0);

  const { gain, percent } = modifiedDietz({
    startValue,
    endValue,
    from,
    to,
    flows: inWindow.map(portfolioFlow),
  });

  let annualizedPercent: number | null = null;
  const length = everyDay(from, to).length - 1;
  if (length >= YEAR_DAYS && (endValue > 0 || inWindow.length > 0)) {
    // The investor's side: what they put in is negative, what they hold or got back positive.
    const investorFlows: CashFlow[] = [
      ...(startValue > 0 ? [{ date: from, amount: -startValue }] : []),
      ...inWindow.map(flow => ({ date: flow.date, amount: -portfolioFlow(flow).amount })),
      { date: to, amount: endValue },
    ];
    const rate = xirr(investorFlows);
    if (rate === null) {
      flags.push({ code: 'xirr_no_solution' });
    } else {
      annualizedPercent = round2(rate * 100);
    }
  }

  return {
    startValue: round2(startValue),
    endValue: round2(endValue),
    contributions: round2(total('contribution')),
    withdrawals: round2(total('withdrawal')),
    income: round2(total('income')),
    gain,
    netInvested: round2(
      all.reduce((sum, flow) => sum + (flow.kind === 'income' ? 0 : portfolioFlow(flow).amount), 0),
    ),
    returnPercent: percent === null ? null : round2(percent),
    method: 'modified_dietz',
    annualizedPercent,
    annualizedMethod: annualizedPercent === null ? null : 'xirr',
  };
}

/** The included lines' value against their net money in, day by day. */
export function buildSeries(
  included: TrackedSource[],
  days: string[],
  valueAt: (source: TrackedSource, date: string) => number,
): ReturnsPoint[] {
  const net = cumulativeNet(
    days,
    included.flatMap(source =>
      source.flows.filter(flow => flow.kind !== 'income').map(portfolioFlow),
    ),
  );
  const points = days.map((date, index) => ({
    date,
    value: round2(included.reduce((sum, source) => sum + valueAt(source, date), 0)),
    netContributed: net[index],
  }));
  return decimate(points, MAX_SERIES_POINTS);
}
