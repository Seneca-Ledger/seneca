import { Injectable } from '@nestjs/common';
import type {
  ReturnsFlag,
  ReturnsFlagCode,
  ReturnsRange,
  ReturnsResponse,
  ReturnsSource,
} from '../../contracts';
import { BalanceHistoryService } from '../balance/balance-history.service';
import { everyDay, isoDate, latestOnOrBefore, presetWindowStart } from '../balance/snapshot-series';
import { CryptoHoldingsService } from '../crypto/crypto-holdings.service';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { InvestmentFlowsService } from './investment-flows.service';
import { InvestmentsService } from './investments.service';
import { MetalsService } from './metals.service';
import {
  cryptoSource,
  dedupe,
  metalsSource,
  priceNotes,
  type TrackedSource,
} from './returns-sources';
import { buildSeries, historyStart, openingValue, periodRow, summarize } from './returns-summary';

interface HistoryPoint {
  accountId: string;
  snapshotDate: string;
  date: string;
  amount: number;
  currency: string;
}

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
    private readonly flowsService: InvestmentFlowsService,
    private readonly metalsService: MetalsService,
    private readonly cryptoHoldingsService: CryptoHoldingsService,
    private readonly historyService: BalanceHistoryService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getReturns(workspaceId: string, range: ReturnsRange): Promise<ReturnsResponse> {
    const currency = await this.investmentsService.workspaceCurrency(workspaceId);
    const to = isoDate(new Date());
    const flags: ReturnsFlag[] = [];

    const tracked = await this.loadTracked(workspaceId, currency, to, flags);
    const crypto = cryptoSource(
      await this.cryptoHoldingsService.getHoldings(workspaceId, currency),
    );

    const histories = new Map<string, HistoryPoint[]>();
    for (const source of tracked) {
      if (!source.accountId) {
        continue;
      }
      const points = await this.historyService.getAccountHistory(workspaceId, source.accountId);
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
      range === 'all' ? historyStart(tracked, histories, to) : presetWindowStart(range, to);
    const days = everyDay(from, to);
    const converter = await CurrencyConverter.loadRange(
      this.exchangeRatesService,
      currency,
      [...histories.values()].flat().map(point => point.currency),
      days,
      workspaceId,
    );
    const valueAt = (source: TrackedSource, date: string): number => {
      if (date === to) {
        return source.liveValue;
      }
      const point = latestOnOrBefore(histories.get(source.id), date);
      return point ? converter.convert(point.amount, point.currency, date) : 0;
    };

    const sources: ReturnsSource[] = [];
    const included: Array<{ source: TrackedSource; startValue: number }> = [];
    for (const source of tracked) {
      const opening = openingValue(source, range, from, histories, valueAt);
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
      if (opening === null) {
        flags.push({ code: 'opening_value_unknown', sourceId: source.id });
      }
      if (includedInReturn) {
        included.push({ source, startValue: opening ?? 0 });
      }
    }
    if (crypto) {
      sources.push(crypto.row);
      flags.push(...crypto.flags);
    }
    for (const code of converter.missing) {
      flags.push({ code: 'missing_fx', detail: code });
    }

    const summary = summarize(included, from, to, flags);
    const series = buildSeries(
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
    const { flows, missing } = await this.flowsService.valueFlows(
      workspaceId,
      await this.flowsService.loadFlows(
        workspaceId,
        accounts.map(account => account.id),
      ),
      currency,
    );
    for (const code of missing) {
      flags.push({ code: 'missing_fx', detail: code });
    }

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

    const metals = metalsSource(await this.metalsService.getSummary(workspaceId), today, flags);
    if (metals) {
      tracked.push(metals);
    }
    return tracked;
  }
}
