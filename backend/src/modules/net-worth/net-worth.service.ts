import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import {
  BalanceAccount,
  BalanceAccountKind,
  BalanceAccountType,
  BalanceSnapshot,
  CapitalRole,
  RiskLevel,
  Transaction,
  Workspace,
} from '../../entities';
import type { InvestmentMetal } from '../../entities/investment-holding.entity';
import { BalanceService, CASH_ACCOUNT_CODE } from '../balance/balance.service';
import {
  decimate,
  everyDay,
  groupSnapshots,
  isoDate,
  latestOnOrBefore,
  maxDate,
  minDate,
  presetWindowStart,
  shiftDays,
} from '../balance/snapshot-series';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { InvestmentsService } from '../investments/investments.service';
import type { NetWorthRange } from './dto/net-worth-query.dto';

/** The window to chart: a preset, or dates the user picked. */
export interface NetWorthQuery {
  range?: NetWorthRange;
  from?: string;
  to?: string;
  /** Account ids to leave out of every figure on the page. */
  exclude?: string[];
}

export interface NetWorthPoint {
  date: string;
  value: number;
  /** The two sides of the day, so the chart can show what the net hides. */
  assets: number;
  liabilities: number;
}

export interface NetWorthBreakdownItem {
  code: string;
  name: string;
  amount: number;
  percent: number;
}

/** One bucket of a classification split. `key` is null for what is unlabelled. */
export interface NetWorthClassificationItem {
  key: string | null;
  amount: number;
  percent: number;
}

/** An asset line the user can classify, with what it is currently worth. */
export interface NetWorthAssetLine {
  id: string;
  code: string;
  name: string;
  amount: number;
  capitalRole: CapitalRole | null;
  riskLevel: RiskLevel | null;
  /** False for cash, whose risk is fixed rather than chosen. */
  isClassifiable: boolean;
}

/** What one line, or the rates, did to the number over the window. */
export interface NetWorthAttributionRow {
  id: string;
  code: string;
  name: string;
  amount: number;
}

/**
 * Where the change over the window came from. Both lists add up to `change`
 * exactly: one answers "which of my things moved", the other "was it me or
 * was it the market".
 */
export interface NetWorthAttribution {
  byAccount: NetWorthAttributionRow[];
  byKind: Array<{ kind: 'money' | 'revaluation' | 'fx'; amount: number }>;
}

/**
 * The same net worth measured in troy ounces of a metal. People who hold metal
 * ask what their capital is worth in ounces, because that is the unit their
 * savings are in; it is the money figures divided by the spot price of the day
 * each point belongs to, never by today's.
 */
export interface NetWorthDenominated {
  metal: InvestmentMetal;
  unit: 'ozt';
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  series: NetWorthPoint[];
}

export interface NetWorthResponse {
  range: NetWorthRange;
  /** The window actually charted, which a custom `from`/`to` decides. */
  from: string;
  to: string;
  currency: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  assetsTotal: number;
  liabilitiesTotal: number;
  series: NetWorthPoint[];
  breakdown: NetWorthBreakdownItem[];
  byRisk: NetWorthClassificationItem[];
  byRole: NetWorthClassificationItem[];
  /** Share of assets sitting in medium or high risk. */
  riskyPercent: number;
  assetLines: NetWorthAssetLine[];
  /** Currencies left out of the figures because no rate to `currency` was found. */
  missingRates: string[];
  /** The account ids left out, echoed back so the page can show what is hidden. */
  excluded: string[];
  /** What made the change over the window, by line and by cause. */
  attribution: NetWorthAttribution;
  /**
   * What came in over the window and what share of it was kept. `rate` is
   * null when nothing came in — a share of nothing is not zero, it is
   * nothing to say.
   */
  savings: { income: number; kept: number; rate: number | null };
  /** Present only when the caller asked to see the figures in metal. */
  denominated?: NetWorthDenominated | null;
  /** The highest sampled net worth over the whole history, and when. */
  allTimeHigh: { value: number; date: string } | null;
  /** Investment holdings by asset class; cash and the other sheet lines keep their own buckets. */
  byAssetClass: NetWorthClassificationItem[];
}

/**
 * How many points a series carries at most. The value is computed for every
 * single day and only thinned down for the wire, so the cap bounds the
 * payload, not the truth: see `decimate`.
 */
const MAX_SERIES_POINTS = 200;

/**
 * How far back the daily walk may start. A workspace with a longer history
 * still gets its whole window charted — only the all-time high is then taken
 * over the last 25 years rather than over everything.
 */
const MAX_HISTORY_DAYS = 365 * 25;

/** Nothing to chart yet: `all` on an empty workspace falls back to a year. */
const EMPTY_WORKSPACE_DAYS = 365;

/**
 * Net worth over time — what the workspace owns minus what it owes.
 *
 * Reads the balance sheet's own data (balance_accounts + balance_snapshots)
 * rather than introducing a parallel notion of assets: a value entered on the
 * balance sheet shows up here, and vice versa. Equity accounts are excluded on
 * purpose — equity is the balancing side of the sheet, not a debt, and
 * subtracting it would net the number to roughly zero.
 */
@Injectable()
export class NetWorthService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly balanceAccountRepository: Repository<BalanceAccount>,
    @InjectRepository(BalanceSnapshot)
    private readonly balanceSnapshotRepository: Repository<BalanceSnapshot>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly balanceService: BalanceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    @Optional()
    private readonly investmentsService?: InvestmentsService,
  ) {}

  async getNetWorth(
    workspaceId: string,
    query: NetWorthQuery = {},
    locale?: string,
    denominate?: InvestmentMetal,
  ): Promise<NetWorthResponse> {
    await this.balanceService.seedDefaultAccounts(workspaceId);

    const range = query.range ?? '90d';
    const today = isoDate(new Date());
    // A window the user picked wins over the preset; it never runs past today,
    // because there is nothing to the right of today to chart.
    const to = query.to && query.to < today ? isoDate(new Date(query.to)) : today;
    const windowFrom = query.from
      ? isoDate(new Date(query.from))
      : await this.resolveFrom(workspaceId, range, to);
    // The walk starts at whichever is earlier, the window or the first day the
    // workspace has data: the window is what the user asked to see, the history
    // is what the all-time high has to be taken over.
    const historyFrom = await this.resolveFrom(workspaceId, 'all', to);
    const dates = everyDay(
      maxDate(minDate(windowFrom, historyFrom), shiftDays(to, -MAX_HISTORY_DAYS)),
      to,
    );

    const [accounts, snapshots, cashByDate, currency] = await Promise.all([
      this.balanceAccountRepository.find({ where: { workspaceId } }),
      this.loadSnapshots(workspaceId, to),
      this.balanceService.getCashSeries(workspaceId, dates),
      this.resolveCurrency(workspaceId),
    ]);

    // A line left out is left out of everything — the curve, the totals, the
    // allocation — or the page would contradict itself.
    const excluded = new Set(query.exclude ?? []);
    const leaves = findLeaves(accounts).filter(leaf => !excluded.has(leaf.id));
    const snapshotsByAccount = groupSnapshots(snapshots);

    // Each day is converted at the rate of that day, read off one curve per
    // currency — a lookup per day would be thousands of round trips.
    const currencies = [
      ...snapshots.map(snapshot => normalizeCurrencyCode(snapshot.currency || currency)),
      ...[...cashByDate.values()].flatMap(amounts => [...amounts.keys()]),
    ];
    const converter = await CurrencyConverter.loadRange(
      this.exchangeRatesService,
      currency,
      currencies,
      dates,
      workspaceId,
    );

    const valueAt = (accountId: string, code: string, date: string): number => {
      if (code === CASH_ACCOUNT_CODE) {
        return converter.convertAll(cashByDate.get(date) ?? new Map(), date);
      }
      const snapshot = latestOnOrBefore(snapshotsByAccount.get(accountId), date);
      return snapshot
        ? converter.convert(
            toNumber(snapshot.amount),
            normalizeCurrencyCode(snapshot.currency || currency),
            date,
          )
        : 0;
    };

    /** What the line holds on a day, in the currency it is held in. */
    const nativeAt = (leaf: BalanceAccount, date: string): Map<string, number> => {
      if (leaf.code === CASH_ACCOUNT_CODE) {
        return cashByDate.get(date) ?? new Map();
      }
      const snapshot = latestOnOrBefore(snapshotsByAccount.get(leaf.id), date);
      return snapshot
        ? new Map([
            [normalizeCurrencyCode(snapshot.currency || currency), toNumber(snapshot.amount)],
          ])
        : new Map();
    };

    const daily = dates.map(date => {
      let assets = 0;
      let liabilities = 0;
      for (const leaf of leaves) {
        if (leaf.accountType === BalanceAccountType.ASSET) {
          assets += valueAt(leaf.id, leaf.code, date);
        } else if (leaf.accountType === BalanceAccountType.LIABILITY) {
          liabilities += valueAt(leaf.id, leaf.code, date);
        }
      }
      return {
        date,
        value: round2(assets - liabilities),
        assets: round2(assets),
        liabilities: round2(liabilities),
      };
    });

    const window = daily.filter(point => point.date >= windowFrom);
    const series = decimate(window, MAX_SERIES_POINTS);

    const assetsTotal = round2(
      leaves
        .filter(leaf => leaf.accountType === BalanceAccountType.ASSET)
        .reduce((sum, leaf) => sum + valueAt(leaf.id, leaf.code, to), 0),
    );
    const liabilitiesTotal = round2(
      leaves
        .filter(leaf => leaf.accountType === BalanceAccountType.LIABILITY)
        .reduce((sum, leaf) => sum + valueAt(leaf.id, leaf.code, to), 0),
    );

    const current = window[window.length - 1]?.value ?? 0;
    const previous = window[0]?.value ?? 0;
    const change = round2(current - previous);

    const attribution = await this.buildAttribution({
      workspaceId,
      leaves,
      nativeAt,
      converter,
      from: windowFrom,
      to,
      change,
      locale,
    });

    const savings = await this.buildSavings({
      workspaceId,
      converter,
      from: windowFrom,
      to,
      kept: attribution.byKind.find(row => row.kind === 'money')?.amount ?? 0,
    });

    // The high is a property of the whole history, not of the window shown.
    const allTimeHigh = highestPoint(daily);
    const byAssetClass = await this.buildAssetClasses(
      workspaceId,
      leaves,
      valueAt,
      to,
      assetsTotal,
      excluded,
    );

    const assetLines = leaves
      .filter(leaf => leaf.accountType === BalanceAccountType.ASSET)
      .map(leaf => ({
        id: leaf.id,
        code: leaf.code,
        name: resolveName(leaf, locale),
        amount: round2(valueAt(leaf.id, leaf.code, to)),
        // Cash answers for itself: always low risk, never the user's call.
        capitalRole: leaf.capitalRole,
        riskLevel: leaf.code === CASH_ACCOUNT_CODE ? RiskLevel.LOW : leaf.riskLevel,
        isClassifiable: leaf.code !== CASH_ACCOUNT_CODE,
      }))
      .sort((a, b) => b.amount - a.amount);

    const byRisk = groupBy(assetLines, line => line.riskLevel, assetsTotal);
    const byRole = groupBy(assetLines, line => line.capitalRole, assetsTotal);

    return {
      range,
      from: windowFrom,
      to,
      currency,
      current,
      previous,
      change,
      // A percentage of zero says nothing, and a percentage of a negative
      // starting point says something misleading — omit it in both cases.
      changePercent: previous > 0 ? round2((change / previous) * 100) : null,
      assetsTotal,
      liabilitiesTotal,
      series,
      breakdown: this.buildBreakdown(accounts, leaves, valueAt, to, assetsTotal, locale),
      byRisk,
      byRole,
      // Deliberately a share of *all* assets, not just the classified ones:
      // counting unlabelled capital as risky would raise alarms about data
      // nobody has looked at yet. The figure can only understate the risk,
      // which is the safe direction for it to be wrong in.
      riskyPercent: round2(
        byRisk
          .filter(item => item.key === RiskLevel.MEDIUM || item.key === RiskLevel.HIGH)
          .reduce((sum, item) => sum + item.percent, 0),
      ),
      assetLines,
      missingRates: converter.missing,
      excluded: [...excluded],
      attribution,
      savings,
      denominated: denominate
        ? await this.denominate(workspaceId, denominate, currency, series)
        : null,
      allTimeHigh,
      byAssetClass,
    };
  }

  /**
   * The series in troy ounces of a metal, each point at the spot price of its
   * own day. A day without a quote has no honest answer, so it is left out
   * rather than filled with today's price; with no quotes at all there is no
   * denominated view.
   */
  private async denominate(
    workspaceId: string,
    metal: InvestmentMetal,
    currency: string,
    series: NetWorthPoint[],
  ): Promise<NetWorthDenominated | null> {
    const points: NetWorthPoint[] = [];
    for (const point of series) {
      const quote = await this.exchangeRatesService.getRateQuote(metal, currency, point.date, {
        workspaceId,
      });
      if (!quote || !(quote.rate > 0)) continue;
      points.push({
        date: point.date,
        value: round4(point.value / quote.rate),
        assets: round4(point.assets / quote.rate),
        liabilities: round4(point.liabilities / quote.rate),
      });
    }
    if (points.length === 0) return null;
    const current = points[points.length - 1]?.value ?? 0;
    const previous = points[0]?.value ?? 0;
    const change = round4(current - previous);
    return {
      metal,
      unit: 'ozt',
      current,
      previous,
      change,
      changePercent: previous > 0 ? round2((change / previous) * 100) : null,
      series: points,
    };
  }

  /**
   * Assets by class: investment holdings by their own class, the crypto account
   * as crypto, the cash line as cash, everything else on the sheet as "other".
   * The investment accounts' own snapshot lines are left out so their holdings
   * are not counted twice.
   */
  private async buildAssetClasses(
    workspaceId: string,
    leaves: BalanceAccount[],
    valueAt: (accountId: string, code: string, date: string) => number,
    to: string,
    assetsTotal: number,
    excluded: Set<string>,
  ): Promise<NetWorthClassificationItem[]> {
    const totals = new Map<string, number>();
    const add = (key: string, amount: number) => totals.set(key, (totals.get(key) ?? 0) + amount);
    const holdings = this.investmentsService
      ? await this.investmentsService.valueByAssetClass(workspaceId, excluded)
      : new Map<string, number>();
    for (const [assetClass, amount] of holdings) add(assetClass, amount);
    for (const leaf of leaves) {
      if (leaf.accountType !== BalanceAccountType.ASSET) continue;
      // The crypto line is one account holding many coins; its class is known
      // without asking the investments table, which no longer keeps crypto.
      if (leaf.accountKind === BalanceAccountKind.CRYPTO) {
        add('crypto', valueAt(leaf.id, leaf.code, to));
        continue;
      }
      if (leaf.accountKind) continue;
      const amount = valueAt(leaf.id, leaf.code, to);
      if (amount === 0) continue;
      add(leaf.code === CASH_ACCOUNT_CODE ? 'cash' : 'other', amount);
    }
    return [...totals.entries()]
      .map(([key, amount]) => ({
        key,
        amount: round2(amount),
        percent: assetsTotal > 0 ? round2((amount / assetsTotal) * 100) : 0,
      }))
      .filter(item => item.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Where the change over the window came from.
   *
   * For a line worth `A` in its own currency at a rate `R`, the move splits
   * without a remainder into what the line itself did, valued at the rate it
   * started the window on, and what the rate did to what the line ended with:
   *
   *     A₁R₁ − A₀R₀ = (A₁ − A₀)·R₀ + A₁·(R₁ − R₀)
   *
   * The first term is the line's own doing, the second is the currency's. For
   * cash the first term is money that came in or went out; for an investment
   * account it is what was paid in plus what the market did, and the paid-in
   * part is known from the contributions linked to it. Everything else only
   * ever moves when someone types a new value, so that is all revaluation.
   *
   * Money moved between the user's own accounts cancels: it leaves cash and
   * arrives as a contribution, so `money` is what came in from outside.
   */
  private async buildAttribution(input: {
    workspaceId: string;
    leaves: BalanceAccount[];
    nativeAt: (leaf: BalanceAccount, date: string) => Map<string, number>;
    converter: CurrencyConverter;
    from: string;
    to: string;
    change: number;
    locale?: string;
  }): Promise<NetWorthAttribution> {
    const { workspaceId, leaves, nativeAt, converter, from, to, change, locale } = input;
    const contributions = this.investmentsService
      ? await this.investmentsService.contributionsBetween(workspaceId, from, to)
      : new Map<string, Map<string, number>>();

    const rate = (code: string, date: string): number => converter.convert(1, code, date);
    const byAccount: NetWorthAttributionRow[] = [];
    let money = 0;
    let revaluation = 0;

    for (const leaf of leaves) {
      const sign =
        leaf.accountType === BalanceAccountType.ASSET
          ? 1
          : leaf.accountType === BalanceAccountType.LIABILITY
            ? -1
            : 0;
      if (sign === 0) {
        continue;
      }

      const opening = nativeAt(leaf, from);
      const closing = nativeAt(leaf, to);
      const paidIn = contributions.get(leaf.id) ?? new Map<string, number>();
      let own = 0;
      let rates = 0;
      let contributed = 0;

      for (const code of new Set([...opening.keys(), ...closing.keys(), ...paidIn.keys()])) {
        const before = opening.get(code) ?? 0;
        const after = closing.get(code) ?? 0;
        const opened = rate(code, from);
        const closed = rate(code, to);

        if (opened > 0 && closed > 0) {
          own += (after - before) * opened;
          rates += after * (closed - opened);
        } else {
          // No rate at one end of the window: there is no rate *move* to speak
          // of, and calling the whole thing a currency effect would be a lie.
          // The line simply was not valuable here before, or is not now.
          own += after * closed - before * opened;
        }
        contributed += (paidIn.get(code) ?? 0) * (opened > 0 ? opened : closed);
      }

      const moved = leaf.code === CASH_ACCOUNT_CODE ? own : contributed;
      money += sign * moved;
      revaluation += sign * (own - moved);

      byAccount.push({
        id: leaf.id,
        code: leaf.code,
        name: resolveName(leaf, locale),
        amount: sign * (own + rates),
      });
    }

    const rows = byAccount
      .map(row => ({ ...row, amount: round2(row.amount) }))
      .filter(row => row.amount !== 0)
      .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));

    // A table that does not add up to the figure above it is worse than no
    // table: the pennies lost to rounding go to the largest line, and the last
    // kind absorbs them the same way.
    const residual = round2(change - rows.reduce((sum, row) => sum + row.amount, 0));
    if (residual !== 0 && rows.length > 0) {
      rows[0] = { ...rows[0], amount: round2(rows[0].amount + residual) };
    }

    const movedTotal = round2(money);
    const revaluedTotal = round2(revaluation);
    const byKind = [
      { kind: 'money' as const, amount: movedTotal },
      { kind: 'revaluation' as const, amount: revaluedTotal },
      { kind: 'fx' as const, amount: round2(change - movedTotal - revaluedTotal) },
    ].filter(row => row.amount !== 0);

    return { byAccount: rows, byKind };
  }

  /**
   * What came in over the window, and the share of it still there at the end.
   *
   * `kept` is the money the attribution already found: everything that came
   * in from outside minus everything that went out, with moves between the
   * user's own accounts cancelling. Against income that is the savings rate,
   * the one number the whole early-retirement literature is about.
   *
   * Income is counted on the day it arrived, at that day's rate, and a leg of
   * a transfer or a reimbursement is not income however it is booked.
   */
  private async buildSavings(input: {
    workspaceId: string;
    converter: CurrencyConverter;
    from: string;
    to: string;
    kept: number;
  }): Promise<NetWorthResponse['savings']> {
    const { workspaceId, converter, from, to, kept } = input;
    // Income a person confirmed, the same rows the cash line counts.
    const rows = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.statement', 'statement')
        .select('transaction.transactionDate', 'date')
        .addSelect('transaction.currency', 'currency')
        .addSelect('COALESCE(SUM(transaction.credit), 0)', 'credit')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.transactionDate > :from', { from })
      .andWhere('transaction.transactionDate <= :to', { to })
      .andWhere('transaction.transferPairId IS NULL')
      .groupBy('transaction.transactionDate')
      .addGroupBy('transaction.currency')
      .getRawMany<{ date: string; currency: string; credit: string }>();

    let income = 0;
    for (const row of rows) {
      income += converter.convert(
        toNumber(row.credit),
        normalizeCurrencyCode(row.currency || converter.target),
        isoDate(new Date(row.date)),
      );
    }

    const rounded = round2(income);
    return {
      income: rounded,
      kept,
      rate: rounded > 0 ? round2((kept / rounded) * 100) : null,
    };
  }

  /** Asset totals grouped under the top-level section each leaf belongs to. */
  private buildBreakdown(
    accounts: BalanceAccount[],
    leaves: BalanceAccount[],
    valueAt: (accountId: string, code: string, date: string) => number,
    date: string,
    assetsTotal: number,
    locale?: string,
  ): NetWorthBreakdownItem[] {
    const byId = new Map(accounts.map(account => [account.id, account]));
    const totals = new Map<string, number>();

    for (const leaf of leaves) {
      if (leaf.accountType !== BalanceAccountType.ASSET) {
        continue;
      }
      const root = findRoot(leaf, byId);
      totals.set(root.id, (totals.get(root.id) ?? 0) + valueAt(leaf.id, leaf.code, date));
    }

    const sections = [...totals.entries()]
      .map(([accountId, amount]) => ({
        account: byId.get(accountId) as BalanceAccount,
        amount: round2(amount),
      }))
      .filter(section => section.amount !== 0)
      .sort((a, b) => b.amount - a.amount || a.account.position - b.account.position);

    return sections.map(section => ({
      code: section.account.code,
      name: resolveName(section.account, locale),
      amount: section.amount,
      percent: assetsTotal > 0 ? round2((section.amount / assetsTotal) * 100) : 0,
    }));
  }

  private async resolveCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    return currencyCodeOrDefault(workspace?.currency);
  }

  /**
   * Start of the window. For `all` that is the first day the workspace has any
   * data at all, so the chart opens on the real beginning of the history
   * rather than on an arbitrary number of days.
   */
  private async resolveFrom(
    workspaceId: string,
    range: NetWorthRange,
    to: string,
  ): Promise<string> {
    if (range !== 'all') {
      return presetWindowStart(range, to);
    }

    const [snapshot, transaction] = await Promise.all([
      this.balanceSnapshotRepository
        .createQueryBuilder('snapshot')
        .select('MIN(snapshot.snapshotDate)', 'earliest')
        .where('snapshot.workspaceId = :workspaceId', { workspaceId })
        .getRawOne<{ earliest: string | null }>(),
      // The chart starts at the first confirmed row: unconfirmed ones are not on it.
      onlyCounted(
        this.transactionRepository
          .createQueryBuilder('transaction')
          .select('MIN(transaction.transactionDate)', 'earliest')
          .where('transaction.workspaceId = :workspaceId', { workspaceId }),
        'transaction',
      ).getRawOne<{ earliest: string | null }>(),
    ]);

    const candidates = [snapshot?.earliest, transaction?.earliest]
      .filter((value): value is string => Boolean(value))
      .map(value => isoDate(new Date(value)));

    if (candidates.length === 0) {
      return shiftDays(to, -EMPTY_WORKSPACE_DAYS);
    }

    return candidates.sort()[0];
  }

  private async loadSnapshots(workspaceId: string, to: string): Promise<BalanceSnapshot[]> {
    return this.balanceSnapshotRepository
      .createQueryBuilder('snapshot')
      .select([
        'snapshot.accountId',
        'snapshot.snapshotDate',
        'snapshot.amount',
        'snapshot.currency',
      ])
      .where('snapshot.workspaceId = :workspaceId', { workspaceId })
      .andWhere('snapshot.snapshotDate <= :to', { to })
      .orderBy('snapshot.snapshotDate', 'ASC')
      .addOrderBy('snapshot.updatedAt', 'ASC')
      .getMany();
  }
}

/**
 * Totals per classification bucket, with unlabelled lines kept as their own
 * `null` bucket rather than dropped — how much is still unclassified is worth
 * seeing, not hiding.
 */
function groupBy(
  lines: NetWorthAssetLine[],
  pick: (line: NetWorthAssetLine) => string | null,
  total: number,
): NetWorthClassificationItem[] {
  const totals = new Map<string | null, number>();
  for (const line of lines) {
    const key = pick(line);
    totals.set(key, (totals.get(key) ?? 0) + line.amount);
  }

  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      amount: round2(amount),
      percent: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .filter(item => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

function findLeaves(accounts: BalanceAccount[]): BalanceAccount[] {
  const parentIds = new Set(
    accounts.map(account => account.parentId).filter((id): id is string => Boolean(id)),
  );
  return accounts.filter(account => !parentIds.has(account.id));
}

function findRoot(account: BalanceAccount, byId: Map<string, BalanceAccount>): BalanceAccount {
  let current = account;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) {
      break;
    }
    current = parent;
  }
  return current;
}

/** The peak of a series, or null when it never rose above zero. */
function highestPoint(points: NetWorthPoint[]): { value: number; date: string } | null {
  let best: NetWorthPoint | null = null;
  for (const point of points) {
    if (!best || point.value > best.value) {
      best = point;
    }
  }
  return best && best.value > 0 ? { value: best.value, date: best.date } : null;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Ounces are small numbers: two decimals would round a silver stack to noise. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveName(account: BalanceAccount, locale?: string): string {
  if (locale === 'en' && account.nameEn) {
    return account.nameEn;
  }
  if (locale === 'kk' && account.nameKk) {
    return account.nameKk;
  }
  return account.name;
}
