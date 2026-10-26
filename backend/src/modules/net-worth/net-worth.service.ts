import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type {
  NetWorthAssetLine,
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
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { InvestmentsService } from '../investments/investments.service';
import type { NetWorthRange } from './dto/net-worth-query.dto';

export type {
  NetWorthAssetLine,
  NetWorthBreakdownItem,
  NetWorthClassificationItem,
  NetWorthDenominated,
  NetWorthPoint,
  NetWorthResponse,
};

/** Days back from today for each range. `all` and `ytd` come from elsewhere. */
const RANGE_DAYS: Record<Exclude<NetWorthRange, 'all' | 'ytd'>, number> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1y': 365,
  '3y': 365 * 3,
  '5y': 365 * 5,
};

/** Points sampled over the whole history to find the all-time high. */
const ALL_TIME_HIGH_POINTS = 37;

/**
 * How many points a series carries. Net worth moves when a snapshot is
 * entered or money moves — not continuously — so a readable line needs far
 * fewer points than it needs days, and every extra point costs a walk over
 * the snapshot history.
 */
const SERIES_POINTS = 13;

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
    range: NetWorthRange = '90d',
    locale?: string,
    denominate?: InvestmentMetal,
    asOf?: string,
  ): Promise<NetWorthResponse> {
    await this.balanceService.seedDefaultAccounts(workspaceId);

    const today = isoDate(new Date());
    // Net worth as it stood at the end of a past day; nothing is known about later ones.
    const to = asOf && asOf < today ? asOf : today;
    const from = await this.resolveFrom(workspaceId, range, to);
    const dates = samplePoints(from, to, SERIES_POINTS);

    const [accounts, snapshots, cashByDate, currency] = await Promise.all([
      this.balanceAccountRepository.find({ where: { workspaceId } }),
      this.loadSnapshots(workspaceId, to),
      this.balanceService.getCashSeries(workspaceId, dates),
      this.resolveCurrency(workspaceId),
    ]);

    const leaves = findLeaves(accounts);
    const snapshotsByAccount = groupSnapshots(snapshots);

    // Each point is converted at the rate of its own day.
    const snapshotCurrencies = [
      ...new Set(snapshots.map(snapshot => normalizeCurrencyCode(snapshot.currency || currency))),
    ];
    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      dates.flatMap(date =>
        [...(cashByDate.get(date)?.keys() ?? []), ...snapshotCurrencies].map(code => ({
          currency: code,
          date,
        })),
      ),
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

    const series = dates.map(date => {
      let assets = 0;
      let liabilities = 0;
      for (const leaf of leaves) {
        if (leaf.accountType === BalanceAccountType.ASSET) {
          assets += valueAt(leaf.id, leaf.code, date);
        } else if (leaf.accountType === BalanceAccountType.LIABILITY) {
          liabilities += valueAt(leaf.id, leaf.code, date);
        }
      }
      return { date, value: round2(assets - liabilities) };
    });

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

    const current = series[series.length - 1]?.value ?? 0;
    const previous = series[0]?.value ?? 0;
    const change = round2(current - previous);

    // The high is a property of the whole history, not of the window shown.
    const allTimeHigh = await this.findAllTimeHigh(
      workspaceId,
      to,
      range === 'all' ? series : null,
      leaves,
      snapshotsByAccount,
      currency,
    );
    // The split by asset class prices holdings as they are now, which says
    // nothing true about a past day; it is left out rather than made up.
    const byAssetClass =
      to === today
        ? await this.buildAssetClasses(workspaceId, leaves, valueAt, to, assetsTotal)
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
      denominated: denominate
        ? await this.denominate(workspaceId, denominate, currency, series)
        : null,
      allTimeHigh,
      byAssetClass,
    };
  }

  /** Samples the whole history (unless the `all` series is already at hand) and keeps the peak. */
  private async findAllTimeHigh(
    workspaceId: string,
    to: string,
    allSeries: NetWorthPoint[] | null,
    leaves: BalanceAccount[],
    snapshotsByAccount: Map<string, BalanceSnapshot[]>,
    currency: string,
  ): Promise<NetWorthResponse['allTimeHigh']> {
    let series = allSeries;
    if (!series) {
      const from = await this.resolveFrom(workspaceId, 'all', to);
      const dates = samplePoints(from, to, ALL_TIME_HIGH_POINTS);
      const cashByDate = await this.balanceService.getCashSeries(workspaceId, dates);
      const snapshotCurrencies = [
        ...new Set(
          [...snapshotsByAccount.values()]
            .flat()
            .map(snapshot => normalizeCurrencyCode(snapshot.currency || currency)),
        ),
      ];
      const converter = await CurrencyConverter.load(
        this.exchangeRatesService,
        currency,
        dates.flatMap(date =>
          [...(cashByDate.get(date)?.keys() ?? []), ...snapshotCurrencies].map(code => ({
            currency: code,
            date,
          })),
        ),
        workspaceId,
      );
      series = dates.map(date => {
        let value = 0;
        for (const leaf of leaves) {
          const sign =
            leaf.accountType === BalanceAccountType.ASSET
              ? 1
              : leaf.accountType === BalanceAccountType.LIABILITY
                ? -1
                : 0;
          if (sign === 0) continue;
          if (leaf.code === CASH_ACCOUNT_CODE) {
            value += sign * converter.convertAll(cashByDate.get(date) ?? new Map(), date);
            continue;
          }
          const snapshot = latestOnOrBefore(snapshotsByAccount.get(leaf.id), date);
          if (snapshot) {
            value +=
              sign *
              converter.convert(
                toNumber(snapshot.amount),
                normalizeCurrencyCode(snapshot.currency || currency),
                date,
              );
          }
        }
        return { date, value: round2(value) };
      });
    }
    let best: NetWorthPoint | null = null;
    for (const point of series) {
      if (!best || point.value > best.value) best = point;
    }
    return best && best.value > 0 ? { value: best.value, date: best.date } : null;
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
      points.push({ date: point.date, value: round4(point.value / quote.rate) });
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
  ): Promise<NetWorthClassificationItem[]> {
    const totals = new Map<string, number>();
    const add = (key: string, amount: number) => totals.set(key, (totals.get(key) ?? 0) + amount);
    const holdings = this.investmentsService
      ? await this.investmentsService.valueByAssetClass(workspaceId)
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

/** Forward fill: an account holds its last entered value until the next one. */
function latestOnOrBefore(
  snapshots: BalanceSnapshot[] | undefined,
  date: string,
): BalanceSnapshot | null {
  let latest: BalanceSnapshot | null = null;
  for (const snapshot of snapshots ?? []) {
    if (isoDate(new Date(snapshot.snapshotDate)) > date) {
      break;
    }
    latest = snapshot;
  }
  return latest;
}

/** `count` evenly spaced dates from `from` to `to`, inclusive of both ends. */
function samplePoints(from: string, to: string, count: number): string[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!(end > start)) {
    return [to];
  }

  const step = (end - start) / (count - 1);
  const dates = Array.from({ length: count }, (_, index) =>
    isoDate(new Date(start + step * index)),
  );

  // Even spacing can land twice on the same day on very short histories.
  return [...new Set(dates)];
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

/** Ounces are small numbers: two decimals would round a silver stack to noise. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
