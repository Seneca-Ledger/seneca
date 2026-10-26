import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type {
  NetWorthAssetLine,
  NetWorthAttribution,
  NetWorthBreakdownItem,
  NetWorthClassificationItem,
  NetWorthDenominated,
  NetWorthPoint,
  NetWorthResponse,
} from '../../contracts';
import {
  BalanceAccount,
  BalanceAccountKind,
  BalanceAccountType,
  BalanceSnapshot,
  RiskLevel,
  Transaction,
  Workspace,
} from '../../entities';
import type { InvestmentMetal } from '../../entities/investment-holding.entity';
import { BalanceService, CASH_ACCOUNT_CODE } from '../balance/balance.service';
import { balanceAccountName } from '../balance/balance-account-name';
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
import { InvestmentFlowsService } from '../investments/investment-flows.service';
import { InvestmentsService } from '../investments/investments.service';
import type { NetWorthRange } from './dto/net-worth-query.dto';
import { buildAttribution, buildSavings } from './net-worth-attribution';
import { round2, round4, toNumber } from './net-worth-math';

export type {
  NetWorthAssetLine,
  NetWorthAttribution,
  NetWorthBreakdownItem,
  NetWorthClassificationItem,
  NetWorthDenominated,
  NetWorthPoint,
  NetWorthResponse,
};

/** The window to chart: a preset, or dates the user picked. */
export interface NetWorthWindow {
  range?: NetWorthRange;
  from?: string;
  to?: string;
  /** Account ids to leave out of every figure on the page. */
  exclude?: readonly string[];
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
    @Optional()
    private readonly investmentFlowsService?: InvestmentFlowsService,
  ) {}

  async getNetWorth(
    workspaceId: string,
    query: NetWorthWindow = {},
    locale?: string,
    denominate?: InvestmentMetal,
  ): Promise<NetWorthResponse> {
    await this.balanceService.seedDefaultAccounts(workspaceId);

    const range = query.range ?? '90d';
    const today = isoDate(new Date());
    // A window the user picked wins over the preset; it never runs past today,
    // because there is nothing to the right of today to chart. A `to` alone is
    // net worth as it stood at the end of that past day.
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

    const attribution = buildAttribution({
      contributions: this.investmentFlowsService
        ? await this.investmentFlowsService.contributionsBetween(workspaceId, windowFrom, to)
        : new Map<string, Map<string, number>>(),
      leaves,
      nativeAt,
      converter,
      from: windowFrom,
      to,
      change,
      locale,
    });

    const savings = await buildSavings({
      transactionRepository: this.transactionRepository,
      workspaceId,
      converter,
      from: windowFrom,
      to,
      kept: attribution.byKind.find(row => row.kind === 'money')?.amount ?? 0,
    });

    // The high is a property of the whole history, not of the window shown.
    const allTimeHigh = highestPoint(daily);
    // The split by asset class prices holdings as they are now, which says
    // nothing true about a past day; it is left out rather than made up.
    const byAssetClass =
      to === today
        ? await this.buildAssetClasses(workspaceId, leaves, valueAt, to, assetsTotal, excluded)
        : [];

    const assetLines = leaves
      .filter(leaf => leaf.accountType === BalanceAccountType.ASSET)
      .map(leaf => ({
        id: leaf.id,
        code: leaf.code,
        name: balanceAccountName(leaf, locale),
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
      if (!(quote && quote.rate > 0)) continue;
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
    for (const [assetClass, amount] of holdings) {
      add(assetClass, amount);
    }
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
      if (leaf.accountType !== BalanceAccountType.ASSET) continue;
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
      name: balanceAccountName(section.account, locale),
      amount: section.amount,
      percent: assetsTotal > 0 ? round2((section.amount / assetsTotal) * 100) : 0,
    }));
  }

  private async resolveCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
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
    if (!best || point.value > best.value) best = point;
  }
  return best && best.value > 0 ? { value: best.value, date: best.date } : null;
}
