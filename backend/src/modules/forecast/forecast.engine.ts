/**
 * Cash-flow forecast as a pure function over dated money events, so it can be
 * tested with fixed inputs and reasoned about without a database.
 *
 * Three layers, each one a step less certain than the last:
 * 1. committed events — bills, subscriptions, invoices, planned goal
 *    contributions, each on its day;
 * 2. recurring income — paydays detected from history;
 * 3. the everyday averages — what history says leaves the account between
 *    the known items, and what comes in besides the paydays (one-off
 *    clients, refunds), each spread evenly over the days. Both directions
 *    are averaged alike, so the projection leans neither way.
 *
 * A dated item from a counterparty that is also in an average (a tax bill
 * when tax payments are in the spending history) stands in for that much of
 * the counterparty's share, so the same money is never counted twice.
 *
 * "Safe to spend" uses layers 1 and 2 only: the everyday average is exactly
 * the money the person is about to spend, so it must not be subtracted from
 * what they may spend.
 */

export type ForecastEventKind =
  | 'payable'
  | 'subscription'
  | 'invoice'
  | 'goal'
  | 'income'
  | 'scenario';

export interface ForecastEvent {
  /** YYYY-MM-DD */
  date: string;
  label: string;
  /** Positive = money in, negative = money out. Workspace currency. */
  amount: number;
  kind: ForecastEventKind;
  /** The row behind the event; `exclude` in a scenario names these. */
  sourceId: string;
  isOverdue?: boolean;
}

export interface ForecastScenario {
  /** Source ids to leave out ("what if I cancel X"). */
  exclude?: string[];
  /** Multiplier on every inflow (0.8 = income down 20%). */
  incomeFactor?: number;
  /** Multiplier on every outflow and on the everyday average. */
  expenseFactor?: number;
  /** One-off events the person adds by hand ("a 2,000 repair on the 15th"). */
  extraEvents?: Array<Pick<ForecastEvent, 'date' | 'label' | 'amount'>>;
}

export interface AveragedParty {
  /** Counterparty name as history has it. */
  party: string;
  /** Its share of the average per month, positive. Workspace currency. */
  monthly: number;
}

export interface ForecastInput {
  /** YYYY-MM-DD, day zero of the projection. */
  today: string;
  horizonDays: number;
  openingBalance: number;
  /** Dated items; give a year of them, the runway reads a year ahead whatever the horizon. */
  events: ForecastEvent[];
  /** Everyday spending per month, from history, net of the committed items. */
  everydayMonthly: number;
  /** Income per month from history beyond the detected paydays. */
  irregularIncomeMonthly?: number;
  /** Who the two averages are made of, so a dated item can stand in for its party's share. */
  averagedParties?: { expense: AveragedParty[]; income: AveragedParty[] };
  scenario?: ForecastScenario;
}

export interface ForecastDay {
  date: string;
  inflow: number;
  outflow: number;
  everyday: number;
  irregularIncome: number;
  balance: number;
}

export interface ForecastResult {
  horizonDays: number;
  openingBalance: number;
  closingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  totalEveryday: number;
  totalIrregularIncome: number;
  days: ForecastDay[];
  events: ForecastEvent[];
  lowestBalance: number;
  lowestBalanceDate: string;
  /** First day the projected balance goes negative, or null. */
  shortfallDate: string | null;
  /** Committed items and paydays only, until the next payday (or the horizon). */
  safeToSpend: { amount: number; untilDate: string; nextIncomeDate: string | null };
  /** Months the opening balance lasts at the pace of the year ahead; null when not burning. */
  runwayMonths: number | null;
}

const DAYS_PER_MONTH = 365.25 / 12;
/** Always projected this far; a shorter horizon shows the start of the same line. */
const PROJECTION_DAYS = 365;

export function computeForecast(input: ForecastInput): ForecastResult {
  const horizonDays = Math.max(1, Math.trunc(input.horizonDays));
  const projectionDays = Math.max(horizonDays, PROJECTION_DAYS);
  const scenario = input.scenario ?? {};
  const excluded = new Set(scenario.exclude ?? []);
  const incomeFactor = factor(scenario.incomeFactor);
  const expenseFactor = factor(scenario.expenseFactor);
  const horizonEnd = addDays(input.today, horizonDays - 1);
  const projectionEnd = addDays(input.today, projectionDays - 1);
  const inProjection = (event: Pick<ForecastEvent, 'date'>) =>
    event.date >= input.today && event.date <= projectionEnd;

  const projected: ForecastEvent[] = [
    ...input.events.filter(event => !excluded.has(event.sourceId)),
    ...(scenario.extraEvents ?? []).map((event, index) => ({
      ...event,
      kind: 'scenario' as const,
      sourceId: `scenario:${index}`,
    })),
  ]
    .filter(inProjection)
    .map(event => ({
      ...event,
      amount: round(event.amount * (event.amount > 0 ? incomeFactor : expenseFactor)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const events = projected.filter(event => event.date <= horizonEnd);

  const inflowByDate = new Map<string, number>();
  const outflowByDate = new Map<string, number>();
  for (const event of projected) {
    const bucket = event.amount > 0 ? inflowByDate : outflowByDate;
    bucket.set(event.date, (bucket.get(event.date) ?? 0) + Math.abs(event.amount));
  }

  // Unticked items still stand in for their share: "without this bill" must
  // move the curve by the whole bill, not hand it back to the average.
  const dated = input.events.filter(inProjection);
  const parties = input.averagedParties ?? { expense: [], income: [] };
  const spending = averageLayer(input.everydayMonthly, parties.expense, dated, 'payable', -1);
  const extraIncome = averageLayer(
    input.irregularIncomeMonthly ?? 0,
    parties.income,
    dated,
    'invoice',
    1,
  );

  const days: ForecastDay[] = [];
  let balance = input.openingBalance;
  let closingBalance = balance;
  let totalInflow = 0;
  let totalOutflow = 0;
  let totalEveryday = 0;
  let totalIrregularIncome = 0;
  let lowestBalance = input.openingBalance;
  let lowestBalanceDate = input.today;
  let shortfallDate: string | null = null;

  for (let offset = 0; offset < projectionDays; offset += 1) {
    const date = addDays(input.today, offset);
    const inflow = inflowByDate.get(date) ?? 0;
    const outflow = outflowByDate.get(date) ?? 0;
    const everyday = spending.next() * expenseFactor;
    const irregularIncome = extraIncome.next() * incomeFactor;
    balance += inflow - outflow - everyday + irregularIncome;
    if (offset >= horizonDays) continue;

    closingBalance = balance;
    totalInflow += inflow;
    totalOutflow += outflow;
    totalEveryday += everyday;
    totalIrregularIncome += irregularIncome;
    const rounded = round(balance);
    if (rounded < lowestBalance) {
      lowestBalance = rounded;
      lowestBalanceDate = date;
    }
    if (shortfallDate === null && rounded < 0) {
      shortfallDate = date;
    }
    days.push({
      date,
      inflow: round(inflow),
      outflow: round(outflow),
      everyday: round(everyday),
      irregularIncome: round(irregularIncome),
      balance: rounded,
    });
  }

  return {
    horizonDays,
    openingBalance: round(input.openingBalance),
    closingBalance: round(closingBalance),
    totalInflow: round(totalInflow),
    totalOutflow: round(totalOutflow),
    totalEveryday: round(totalEveryday),
    totalIrregularIncome: round(totalIrregularIncome),
    days,
    events,
    lowestBalance: round(lowestBalance),
    lowestBalanceDate,
    shortfallDate,
    safeToSpend: safeToSpend(input.today, horizonEnd, input.openingBalance, events),
    runwayMonths: runwayMonths(input.openingBalance, balance, projectionDays),
  };
}

/**
 * One of the everyday averages, day by day. A dated item from a party that
 * is part of the average pauses that party's share until the item's amount
 * is used up: a 4,000 tax bill against 120 a day of tax in the history
 * takes the tax out of the average for the next ~33 days.
 */
function averageLayer(
  monthly: number,
  parties: AveragedParty[],
  events: ForecastEvent[],
  kind: 'payable' | 'invoice',
  sign: 1 | -1,
): { next(): number } {
  const daily = Math.max(0, monthly) / DAYS_PER_MONTH;
  const shares = parties
    .filter(party => party.monthly > 0)
    .map(party => ({ ...party, daily: party.monthly / DAYS_PER_MONTH, standIn: 0 }));
  for (const event of events) {
    if (event.kind !== kind || Math.sign(event.amount) !== sign) continue;
    const share = shares.find(candidate => sameParty(candidate.party, event.label));
    if (share) share.standIn += Math.abs(event.amount);
  }
  return {
    next() {
      let covered = 0;
      for (const share of shares) {
        const today = Math.min(share.daily, share.standIn);
        share.standIn -= today;
        covered += today;
      }
      return Math.max(0, daily - covered);
    },
  };
}

/**
 * Whether two counterparty names mean the same payer or payee: the shorter
 * one's words open the longer one ("WeWork" / "WeWork Kurfürstendamm"),
 * ignoring case, accents and punctuation.
 */
export function sameParty(a: string, b: string): boolean {
  const left = partyWords(a);
  const right = partyWords(b);
  if (left.length === 0 || right.length === 0) return false;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.every((word, index) => long[index] === word);
}

function partyWords(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Cash now, minus every committed outflow before the next payday, plus any
 * committed inflow that lands first. Never below zero: "nothing" is the
 * honest answer, a negative number is not.
 */
function safeToSpend(
  today: string,
  horizonEnd: string,
  openingBalance: number,
  events: ForecastEvent[],
): ForecastResult['safeToSpend'] {
  const nextIncome = events.find(event => event.kind === 'income' && event.date > today);
  const untilDate = nextIncome ? addDays(nextIncome.date, -1) : horizonEnd;
  let balance = openingBalance;
  let lowest = openingBalance;
  for (const event of events) {
    if (event.date > untilDate) break;
    balance += event.amount;
    lowest = Math.min(lowest, balance);
  }
  return {
    amount: round(Math.max(0, lowest)),
    untilDate,
    nextIncomeDate: nextIncome?.date ?? null,
  };
}

/**
 * How many months the balance lasts at the pace the projection falls over a
 * year — the line the chart draws, read over a year whatever the horizon, so
 * one tax bill in the next 30 days does not halve the runway. Null when the
 * projection does not fall; zero when it falls from nothing, so an empty
 * account never reads as a growing one.
 */
function runwayMonths(openingBalance: number, closingBalance: number, days: number): number | null {
  const monthlyDecline = (openingBalance - closingBalance) / (days / DAYS_PER_MONTH);
  if (!(monthlyDecline > 0)) return null;
  if (openingBalance <= 0) return 0;
  return round(openingBalance / monthlyDecline);
}

function factor(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 1;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day + days);
  return formatDateOnly(result);
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------------------ */
/* Recurring income                                                           */
/* ------------------------------------------------------------------------ */

export interface IncomeRow {
  counterpartyName: string | null;
  amount: number;
  /** YYYY-MM-DD or Date */
  transactionDate: string | Date;
}

export interface RecurringIncome {
  label: string;
  /** What the latest paydays brought (median of the last three), so a raise shows. */
  amount: number;
  intervalDays: number;
  /** Monthly payers are paid on a day of the month, not every N days; null otherwise. */
  dayOfMonth: number | null;
  lastDate: string;
  /** Before `today` when the payday is late but still expected. */
  nextDate: string;
  occurrences: number;
}

/** Amount of the latest paydays that the next one is expected to bring. */
const RECENT_PAYDAYS = 3;

/**
 * Paydays from history: one payer, at least three deposits, roughly regular
 * (weekly, fortnightly or monthly), amounts within 25% of their median.
 *
 * The next payday follows the last one. A payday a few days late (within
 * the payer's usual wobble) is still expected and lands on today; one missed
 * by more is skipped; a payer silent for over two paydays has stopped and is
 * not projected at all.
 */
export function detectRecurringIncome(rows: IncomeRow[], today: string): RecurringIncome[] {
  const groups = new Map<string, IncomeRow[]>();
  for (const row of rows) {
    const key = (row.counterpartyName ?? '').trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const result: RecurringIncome[] = [];
  for (const group of groups.values()) {
    const sorted = group
      .map(row => ({ ...row, date: toDateOnly(row.transactionDate) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 3) continue;
    const intervals = sorted.slice(1).map((row, i) => daysBetween(sorted[i].date, row.date));
    const interval = median(intervals);
    if (interval < 6 || interval > 35) continue;
    const wobble = Math.max(3, interval * 0.25);
    if (intervals.some(value => Math.abs(value - interval) > wobble)) continue;
    const amounts = sorted.map(row => Math.abs(Number(row.amount)));
    const typical = median(amounts);
    if (amounts.some(value => Math.abs(value - typical) > typical * 0.25)) continue;
    const last = sorted[sorted.length - 1];
    if (daysBetween(last.date, today) > 2 * interval + wobble) continue;
    const income = {
      intervalDays: Math.round(interval),
      dayOfMonth: interval >= 27 && interval <= 33 ? Number(last.date.slice(8, 10)) : null,
    };
    let next = nextPayday(income, last.date);
    while (daysBetween(next, today) > wobble) {
      next = nextPayday(income, next);
    }
    result.push({
      label: (last.counterpartyName ?? '').trim(),
      amount: round(median(amounts.slice(-RECENT_PAYDAYS))),
      ...income,
      lastDate: last.date,
      nextDate: next,
      occurrences: sorted.length,
    });
  }
  return result;
}

/** Every payday of `income` inside [today, horizonEnd] as inflow events; a late one lands on today. */
export function projectIncome(
  income: RecurringIncome,
  sourceId: string,
  today: string,
  horizonEnd: string,
): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  let date = income.nextDate;
  let guard = 0;
  while (date <= horizonEnd && guard < 400) {
    const isLate = date < today;
    events.push({
      date: isLate ? today : date,
      label: income.label,
      amount: income.amount,
      kind: 'income',
      sourceId,
      ...(isLate ? { isOverdue: true } : {}),
    });
    date = nextPayday(income, date);
    guard += 1;
  }
  return events;
}

/** The payday after `date`: same day next month for a monthly payer, else `intervalDays` on. */
function nextPayday(
  income: Pick<RecurringIncome, 'intervalDays' | 'dayOfMonth'>,
  date: string,
): string {
  if (income.dayOfMonth === null) return addDays(date, income.intervalDays);
  const [year, month] = date.split('-').map(Number);
  const daysInNextMonth = new Date(year, month + 1, 0).getDate();
  return formatDateOnly(new Date(year, month, Math.min(income.dayOfMonth, daysInNextMonth)));
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return formatDateOnly(value);
  return value.slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
