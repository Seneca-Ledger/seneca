import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  BalanceAccount,
  BalanceAccountType,
  BalanceSnapshot,
  CapitalRole,
  RiskLevel,
  Transaction,
  Workspace,
} from '../../entities';
import { BalanceService, CASH_ACCOUNT_CODE } from '../balance/balance.service';
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
  /** The highest sampled net worth over the whole history, and when. */
  allTimeHigh: { value: number; date: string } | null;
  /** Investment holdings by asset class; cash and the other sheet lines keep their own buckets. */
  byAssetClass: NetWorthClassificationItem[];
}

/** Days back from today for each range. `all` and `ytd` come from elsewhere. */
const RANGE_DAYS: Record<Exclude<NetWorthRange, 'all' | 'ytd'>, number> = {
  '1d': 1,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1y': 365,
  '3y': 365 * 3,
  '5y': 365 * 5,
};

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
      allTimeHigh,
      byAssetClass,
    };
  }

  /**
   * Assets by class: investment holdings by their own class, the cash line as
   * cash, everything else on the sheet as "other". The investment accounts'
   * own snapshot lines are left out so their holdings are not counted twice.
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
        own += (after - before) * rate(code, from);
        rates += after * (rate(code, to) - rate(code, from));
        contributed += (paidIn.get(code) ?? 0) * rate(code, from);
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
    const rows = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.statement', 'statement')
      .select('transaction.transactionDate', 'date')
      .addSelect('transaction.currency', 'currency')
      .addSelect('COALESCE(SUM(transaction.credit), 0)', 'credit')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.transactionDate > :from', { from })
      .andWhere('transaction.transactionDate <= :to', { to })
      .andWhere('transaction.transferPairId IS NULL')
      .andWhere('transaction.isDuplicate = false')
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
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
    const normalized = String(workspace?.currency || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
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
    if (range === 'ytd') {
      return `${to.slice(0, 4)}-01-01`;
    }
    if (range !== 'all') {
      return shiftDays(to, -RANGE_DAYS[range]);
    }

    const [snapshot, transaction] = await Promise.all([
      this.balanceSnapshotRepository
        .createQueryBuilder('snapshot')
        .select('MIN(snapshot.snapshotDate)', 'earliest')
        .where('snapshot.workspaceId = :workspaceId', { workspaceId })
        .getRawOne<{ earliest: string | null }>(),
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('MIN(transaction.transactionDate)', 'earliest')
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .getRawOne<{ earliest: string | null }>(),
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

function groupSnapshots(snapshots: BalanceSnapshot[]): Map<string, BalanceSnapshot[]> {
  const byAccount = new Map<string, BalanceSnapshot[]>();
  for (const snapshot of snapshots) {
    const bucket = byAccount.get(snapshot.accountId);
    if (bucket) {
      bucket.push(snapshot);
    } else {
      byAccount.set(snapshot.accountId, [snapshot]);
    }
  }
  return byAccount;
}

/**
 * Forward fill: an account holds its last entered value until the next one.
 * Binary search rather than a scan — this runs once per account per day.
 */
function latestOnOrBefore(
  snapshots: BalanceSnapshot[] | undefined,
  date: string,
): BalanceSnapshot | null {
  if (!snapshots || snapshots.length === 0) {
    return null;
  }
  let low = 0;
  let high = snapshots.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (isoDate(new Date(snapshots[middle].snapshotDate)) <= date) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found >= 0 ? snapshots[found] : null;
}

/** Every day from `from` to `to`, inclusive of both ends. */
function everyDay(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = shiftDays(date, 1)) {
    dates.push(date);
  }
  return dates.length > 0 ? dates : [to];
}

/**
 * At most `limit` of the daily points, keeping both ends and, inside each
 * bucket in between, the lowest and the highest day.
 *
 * Even sampling is exactly what hides a one-day crash on a ten-year chart: it
 * only ever shows the days it happens to land on. Keeping the extremes of
 * each bucket means a spike survives at every zoom level, which is the whole
 * reason to look at the chart.
 */
function decimate(points: NetWorthPoint[], limit: number): NetWorthPoint[] {
  if (points.length <= limit) {
    return points;
  }

  const inner = points.slice(1, -1);
  const buckets = Math.max(1, Math.floor((limit - 2) / 2));
  const size = inner.length / buckets;
  const kept: NetWorthPoint[] = [points[0]];

  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const slice = inner.slice(Math.floor(bucket * size), Math.floor((bucket + 1) * size));
    for (const point of extremes(slice)) {
      if (kept[kept.length - 1].date !== point.date) {
        kept.push(point);
      }
    }
  }

  kept.push(points[points.length - 1]);
  return kept;
}

/** The lowest and the highest point of a slice, in the order they happened. */
function extremes(points: NetWorthPoint[]): NetWorthPoint[] {
  if (points.length === 0) {
    return [];
  }
  let lowest = points[0];
  let highest = points[0];
  for (const point of points) {
    if (point.value < lowest.value) {
      lowest = point;
    }
    if (point.value > highest.value) {
      highest = point;
    }
  }
  return lowest.date <= highest.date ? [lowest, highest] : [highest, lowest];
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

function minDate(left: string, right: string): string {
  return left <= right ? left : right;
}

function maxDate(left: string, right: string): string {
  return left >= right ? left : right;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function shiftDays(date: string, days: number): string {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return isoDate(shifted);
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
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
