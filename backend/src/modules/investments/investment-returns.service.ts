import { Injectable } from '@nestjs/common';
import { InvestmentPriceSource } from '../../entities/investment-holding.entity';
import { BalanceService } from '../balance/balance.service';
import {
  decimate,
  everyDay,
  isoDate,
  latestOnOrBefore,
  presetWindowStart,
  shiftDays,
} from '../balance/snapshot-series';
import { CryptoHoldingsService } from '../crypto/crypto-holdings.service';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { ReturnsRange } from './dto/returns-query.dto';
import { InvestmentsService, type ValuedInvestmentFlow } from './investments.service';
import { MetalsService } from './metals.service';
import { type CashFlow, cumulativeNet, modifiedDietz, xirr } from './returns-math';

export type ReturnsFlagCode =
  | 'stale_price'
  | 'manual_price'
  | 'missing_fx'
  | 'metal_cost_missing'
  | 'opening_value_unknown'
  | 'no_contributions'
  | 'crypto_not_in_return'
  | 'crypto_basis_incomplete'
  | 'crypto_unpriced'
  | 'xirr_no_solution';

export interface ReturnsFlag {
  code: ReturnsFlagCode;
  sourceId?: string;
  /** A holding name, a lot name or a currency code: what the user has to fix. */
  detail?: string;
}

export interface ReturnsSource {
  kind: 'account' | 'metals' | 'crypto';
  id: string;
  name: string;
  /** Period rows cover the window; crypto's covers its whole history. */
  scope: 'period' | 'all_time';
  startValue: number;
  endValue: number;
  contributions: number;
  withdrawals: number;
  income: number;
  gain: number;
  returnPercent: number | null;
  includedInReturn: boolean;
  flags: ReturnsFlagCode[];
}

export interface ReturnsPoint {
  date: string;
  value: number;
  /** Money put in less money taken out, all time, up to this day. */
  netContributed: number;
}

export interface ReturnsResponse {
  range: ReturnsRange;
  from: string;
  to: string;
  days: number;
  currency: string;
  summary: {
    startValue: number;
    endValue: number;
    contributions: number;
    withdrawals: number;
    income: number;
    gain: number;
    /** Net money in over the whole history of the sources in the return. */
    netInvested: number;
    returnPercent: number | null;
    method: 'modified_dietz';
    /** Only for a window of a year or more: a shorter one would be extrapolated. */
    annualizedPercent: number | null;
    annualizedMethod: 'xirr' | null;
  };
  series: ReturnsPoint[];
  sources: ReturnsSource[];
  flags: ReturnsFlag[];
}

interface HistoryPoint {
  accountId: string;
  snapshotDate: string;
  date: string;
  amount: number;
  currency: string;
}

/** A line of the balance sheet with a value history and dated flows behind it. */
interface TrackedSource {
  kind: 'account' | 'metals';
  id: string;
  name: string;
  accountId: string | null;
  liveValue: number;
  flows: Array<Pick<ValuedInvestmentFlow, 'date' | 'value' | 'kind'>>;
  /** Flags that keep the source out of the return. */
  blockers: ReturnsFlagCode[];
  /** Flags worth saying that leave the figures standing. */
  notes: ReturnsFlagCode[];
}

/** An automatic quote older than this is stale: the free sources quote daily. */
const STALE_AUTO_PRICE_DAYS = 3;
/** A price typed in by hand is worth a reminder once it is a month old. */
const STALE_MANUAL_PRICE_DAYS = 30;
const MAX_SERIES_POINTS = 200;
const YEAR_DAYS = 365;

/**
 * What the investments made over a window: value at both ends, the money
 * that moved in and out between them, and the return on it.
 *
 * Every line the return is computed over has to answer three questions
 * honestly — what was it worth at the start, what went in and out and when,
 * what is it worth now. A line that cannot is still listed with its value,
 * but left out of the return and flagged with what is missing.
 */
@Injectable()
export class InvestmentReturnsService {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly metalsService: MetalsService,
    private readonly cryptoHoldingsService: CryptoHoldingsService,
    private readonly balanceService: BalanceService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getReturns(workspaceId: string, range: ReturnsRange): Promise<ReturnsResponse> {
    const currency = await this.investmentsService.workspaceCurrency(workspaceId);
    const to = isoDate(new Date());
    const flags: ReturnsFlag[] = [];

    const tracked = await this.loadTracked(workspaceId, currency, to, flags);
    const crypto = await this.loadCrypto(workspaceId, currency);

    const histories = new Map<string, HistoryPoint[]>();
    for (const source of tracked) {
      if (!source.accountId) continue;
      const points = await this.balanceService.getAccountHistory(workspaceId, source.accountId);
      histories.set(
        source.id,
        points.map(point => ({
          accountId: source.id,
          snapshotDate: point.date,
          date: point.date,
          amount: point.amount,
          currency: normalizeCurrencyCode(point.currency) || currency,
        })),
      );
    }

    const from =
      range === 'all' ? this.historyStart(tracked, histories, to) : presetWindowStart(range, to);
    const days = everyDay(from, to);
    const converter = await CurrencyConverter.loadRange(
      this.exchangeRatesService,
      currency,
      [...histories.values()].flat().map(point => point.currency),
      days,
      workspaceId,
    );
    const valueAt = (source: TrackedSource, date: string): number => {
      if (date === to) return source.liveValue;
      const point = latestOnOrBefore(histories.get(source.id), date);
      return point ? converter.convert(point.amount, point.currency, date) : 0;
    };

    const sources: ReturnsSource[] = [];
    const included: Array<{ source: TrackedSource; startValue: number }> = [];
    for (const source of tracked) {
      const opening = this.openingValue(source, range, from, histories, valueAt);
      const blockers =
        opening === null ? [...source.blockers, 'opening_value_unknown' as const] : source.blockers;
      const row = periodRow(source, opening ?? 0, from, to);
      const includedInReturn = blockers.length === 0;
      sources.push({
        ...row,
        // A line left out has no return to show: its figures are not whole.
        returnPercent: includedInReturn ? row.returnPercent : null,
        includedInReturn,
        flags: [...blockers, ...source.notes],
      });
      if (opening === null) flags.push({ code: 'opening_value_unknown', sourceId: source.id });
      if (includedInReturn) included.push({ source, startValue: opening ?? 0 });
    }
    if (crypto) {
      sources.push(crypto.row);
      flags.push(...crypto.flags);
    }
    for (const code of converter.missing) {
      flags.push({ code: 'missing_fx', detail: code });
    }

    const summary = this.summarize(included, from, to, flags);
    const series = this.buildSeries(
      included.map(entry => entry.source),
      days,
      valueAt,
    );

    return {
      range,
      from,
      to,
      days: days.length - 1,
      currency,
      summary,
      series,
      sources,
      flags: dedupe(flags),
    };
  }

  /** Investment accounts and the metals line, with their flows valued and checked. */
  private async loadTracked(
    workspaceId: string,
    currency: string,
    today: string,
    flags: ReturnsFlag[],
  ): Promise<TrackedSource[]> {
    const accounts = await this.investmentsService.listAccounts(workspaceId);
    const { flows, missing } = await this.investmentsService.valueFlows(
      workspaceId,
      await this.investmentsService.loadFlows(
        workspaceId,
        accounts.map(account => account.id),
      ),
      currency,
    );
    for (const code of missing) flags.push({ code: 'missing_fx', detail: code });

    const tracked: TrackedSource[] = accounts.map(account => {
      const own = flows.filter(flow => flow.accountId === account.id);
      const blockers: ReturnsFlagCode[] = [];
      if (account.value > 0 && !own.some(flow => flow.kind === 'contribution')) {
        blockers.push('no_contributions');
        flags.push({ code: 'no_contributions', sourceId: account.id });
      }
      const notes = priceNotes(account.holdings, account.id, today, flags);
      return {
        kind: 'account',
        id: account.id,
        name: account.name,
        accountId: account.id,
        liveValue: account.value,
        flows: own,
        blockers,
        notes,
      };
    });

    const metals = await this.loadMetals(workspaceId, today, flags);
    if (metals) tracked.push(metals);
    return tracked;
  }

  /**
   * The metals line. A lot's cost went in on the day it was bought, and so
   * did the cost of every piece since sold; a sale's proceeds came out.
   */
  private async loadMetals(
    workspaceId: string,
    today: string,
    flags: ReturnsFlag[],
  ): Promise<TrackedSource | null> {
    const metals = await this.metalsService.getSummary(workspaceId);
    if (metals.lots.length === 0 && metals.sales.length === 0) return null;
    const id = metals.accountId ?? 'metals';
    const metalFlows: TrackedSource['flows'] = [];
    const missingCost: string[] = [];
    for (const lot of metals.lots) {
      if (lot.cost === null || !lot.acquiredOn) {
        missingCost.push(lot.name);
      } else {
        metalFlows.push({ date: lot.acquiredOn, value: lot.cost, kind: 'contribution' });
      }
    }
    for (const sale of metals.sales) {
      // The pieces sold were bought once too: their cost went in when they did.
      if (sale.costBasis === null || !sale.acquiredOn) {
        missingCost.push(sale.lotName);
      } else {
        metalFlows.push({ date: sale.acquiredOn, value: sale.costBasis, kind: 'contribution' });
      }
      metalFlows.push({ date: sale.soldOn, value: sale.proceeds, kind: 'withdrawal' });
    }
    const blockers: ReturnsFlagCode[] = [];
    if (missingCost.length > 0) {
      blockers.push('metal_cost_missing');
      flags.push({
        code: 'metal_cost_missing',
        sourceId: id,
        detail: [...new Set(missingCost)].join(', '),
      });
    }
    return {
      kind: 'metals',
      id,
      name: 'metals',
      accountId: metals.accountId,
      liveValue: metals.value,
      flows: metalFlows,
      blockers,
      notes: priceNotes(metals.lots, id, today, flags),
    };
  }

  /**
   * The crypto line, measured over its whole history and kept out of the
   * return: staking rewards, airdrops and coins from wallets Lumio does not
   * see arrive as purchases, so the dated flows a period return needs are not
   * trustworthy, while the cost basis of what is held still is.
   */
  private async loadCrypto(
    workspaceId: string,
    currency: string,
  ): Promise<{ row: ReturnsSource; flags: ReturnsFlag[] } | null> {
    const { holdings, unpriced } = await this.cryptoHoldingsService.getHoldings(
      workspaceId,
      currency,
    );
    if (holdings.length === 0 && unpriced.length === 0) return null;

    const value = round2(holdings.reduce((sum, holding) => sum + holding.value, 0));
    const costHeld = holdings.reduce((sum, holding) => sum + (holding.cost ?? 0), 0);
    const realized = holdings.reduce((sum, holding) => sum + holding.realized, 0);
    const netInvested = round2(costHeld - realized);

    const codes: ReturnsFlagCode[] = ['crypto_not_in_return'];
    if (holdings.some(holding => holding.basisIncomplete || holding.cost === null)) {
      codes.push('crypto_basis_incomplete');
    }
    if (unpriced.length > 0) codes.push('crypto_unpriced');

    return {
      row: {
        kind: 'crypto',
        id: 'crypto',
        name: 'crypto',
        scope: 'all_time',
        startValue: 0,
        endValue: value,
        contributions: netInvested,
        withdrawals: 0,
        income: 0,
        gain: round2(value - netInvested),
        returnPercent: null,
        includedInReturn: false,
        flags: codes,
      },
      flags: codes.map(code => ({
        code,
        sourceId: 'crypto',
        detail:
          code === 'crypto_unpriced' ? unpriced.map(entry => entry.asset).join(', ') : undefined,
      })),
    };
  }

  /**
   * The day before the first value or flow of any line: the whole history then
   * opens at zero and every flow falls inside it. A year back when there is
   * nothing yet, so the page has a window to draw.
   */
  private historyStart(
    tracked: TrackedSource[],
    histories: Map<string, Array<{ date: string }>>,
    to: string,
  ): string {
    const dates = tracked.flatMap(source => [
      ...source.flows.map(flow => flow.date),
      ...(histories.get(source.id) ?? []).map(point => point.date),
    ]);
    if (dates.length === 0) return shiftDays(to, -YEAR_DAYS);
    return shiftDays(dates.sort()[0], -1);
  }

  /**
   * What the line was worth at the end of the window's first day. Unknown —
   * null — when nothing was entered by then although money had already gone
   * in: zero would turn everything held into a gain made inside the window.
   */
  private openingValue(
    source: TrackedSource,
    range: ReturnsRange,
    from: string,
    histories: Map<string, Array<{ date: string }>>,
    valueAt: (source: TrackedSource, date: string) => number,
  ): number | null {
    if (range === 'all') return 0;
    const entered = (histories.get(source.id) ?? []).some(point => point.date <= from);
    if (entered) return valueAt(source, from);
    const movedBefore = source.flows.some(flow => flow.kind !== 'income' && flow.date <= from);
    return movedBefore ? null : 0;
  }

  private summarize(
    included: Array<{ source: TrackedSource; startValue: number }>,
    from: string,
    to: string,
    flags: ReturnsFlag[],
  ): ReturnsResponse['summary'] {
    const startValue = included.reduce((sum, entry) => sum + entry.startValue, 0);
    const endValue = included.reduce((sum, entry) => sum + entry.source.liveValue, 0);
    const all = included.flatMap(entry => entry.source.flows);
    const inWindow = all.filter(flow => flow.date > from && flow.date <= to);
    const total = (kind: ValuedInvestmentFlow['kind']) =>
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
      if (rate === null) flags.push({ code: 'xirr_no_solution' });
      else annualizedPercent = round2(rate * 100);
    }

    return {
      startValue: round2(startValue),
      endValue: round2(endValue),
      contributions: round2(total('contribution')),
      withdrawals: round2(total('withdrawal')),
      income: round2(total('income')),
      gain,
      netInvested: round2(
        all.reduce(
          (sum, flow) => sum + (flow.kind === 'income' ? 0 : portfolioFlow(flow).amount),
          0,
        ),
      ),
      returnPercent: percent === null ? null : round2(percent),
      method: 'modified_dietz',
      annualizedPercent,
      annualizedMethod: annualizedPercent === null ? null : 'xirr',
    };
  }

  /** The included lines' value against their net money in, day by day. */
  private buildSeries(
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
}

/** A flow from the portfolio's side: money in positive, money out negative. */
function portfolioFlow(flow: Pick<ValuedInvestmentFlow, 'date' | 'value' | 'kind'>): CashFlow {
  return { date: flow.date, amount: flow.kind === 'contribution' ? flow.value : -flow.value };
}

function periodRow(
  source: TrackedSource,
  startValue: number,
  from: string,
  to: string,
): Omit<ReturnsSource, 'includedInReturn' | 'flags'> {
  const inWindow = source.flows.filter(flow => flow.date > from && flow.date <= to);
  const total = (kind: ValuedInvestmentFlow['kind']) =>
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

/** Prices the figures stand on that may no longer be true. */
function priceNotes(
  holdings: Array<{ name: string; priceSource: InvestmentPriceSource; pricedAt: Date | null }>,
  sourceId: string,
  today: string,
  flags: ReturnsFlag[],
): ReturnsFlagCode[] {
  const codes = new Set<ReturnsFlagCode>();
  for (const holding of holdings) {
    const priced = holding.pricedAt ? isoDate(new Date(holding.pricedAt)) : null;
    const auto = holding.priceSource === InvestmentPriceSource.AUTO;
    const limit = shiftDays(today, -(auto ? STALE_AUTO_PRICE_DAYS : STALE_MANUAL_PRICE_DAYS));
    if (priced && priced >= limit) continue;
    const code = auto ? 'stale_price' : 'manual_price';
    codes.add(code);
    flags.push({ code, sourceId, detail: holding.name });
  }
  return [...codes];
}

function dedupe(flags: ReturnsFlag[]): ReturnsFlag[] {
  const seen = new Set<string>();
  return flags.filter(flag => {
    const key = `${flag.code}|${flag.sourceId ?? ''}|${flag.detail ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
