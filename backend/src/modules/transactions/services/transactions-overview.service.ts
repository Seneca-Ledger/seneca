import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { countedSql, onlyFlows } from '../../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../../common/utils/currency.util';
import { applyOwnerFilter, type OwnerFilter } from '../../../common/utils/transaction-owner.util';
import { PRIVATE_PLACEHOLDER } from '../../../common/utils/transaction-privacy.util';
import type { TransactionsOverview } from '../../../contracts';
import { Transaction } from '../../../entities/transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';

/** Slice keys the page names itself: a row with no category, or with no wallet. */
export const UNCATEGORIZED_SLICE = '__uncategorized__';
export const NO_ACCOUNT_SLICE = '__no_account__';

const MONTHS_LISTED = 12;

/** The other leg's wallet of a transfer; a self-paired investment row has none. */
const PAIR_WALLET_SQL = `(SELECT pair.wallet_id FROM transactions pair
  WHERE pair.workspace_id = transaction.workspace_id
    AND pair.transfer_pair_id = transaction.transfer_pair_id
    AND pair.id <> transaction.id
  LIMIT 1)`;

interface FlowGroup {
  type: 'income' | 'expense';
  transfer: boolean;
  categoryId: string | null;
  categoryName: string | null;
  walletId: string | null;
  pairWalletId: string | null;
  party: string | null;
  currency: string;
  total: string;
}

interface Filters {
  dateFrom?: Date;
  dateTo?: Date;
  convertTo?: string;
  owner: OwnerFilter;
}

/**
 * The All transactions page beyond the list itself: the three pies, the
 * month counts beside the table and each row's running wallet balance.
 *
 * Who is on each side of a row: an expense leaves its wallet for the
 * counterparty, income arrives from the counterparty into its wallet, and a
 * transfer's counterparty is the other leg's wallet.
 */
@Injectable()
export class TransactionsOverviewService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getOverview(
    workspaceId: string,
    filters: Filters,
    viewerMemberId: string | null,
  ): Promise<TransactionsOverview> {
    const currency = currencyCodeOrDefault(filters.convertTo);
    const [groups, months] = await Promise.all([
      this.flowGroups(workspaceId, filters, viewerMemberId),
      this.monthCounts(workspaceId, filters),
    ]);
    const walletNames = await this.walletNames(
      workspaceId,
      groups.flatMap(group => [group.walletId, group.pairWalletId]),
    );
    const rateDay = filters.dateTo ?? new Date();
    const rates = new Map<string, number>();
    for (const code of new Set(groups.map(group => currencyCodeOrDefault(group.currency)))) {
      const { rate } = await this.exchangeRatesService.convert(
        1,
        code,
        currency,
        rateDay,
        workspaceId,
      );
      rates.set(code, rate);
    }

    const categories = new Slices();
    const sources = new Slices();
    const destinations = new Slices();
    for (const group of groups) {
      // Both legs of a transfer are one movement: the outgoing leg tells it.
      if (group.transfer && group.type === 'income') {
        continue;
      }
      const value = Number(group.total) * (rates.get(currencyCodeOrDefault(group.currency)) ?? 1);
      if (!group.transfer) {
        categories.add(group.categoryId ?? UNCATEGORIZED_SLICE, group.categoryName ?? '', value);
      }
      const own = walletSide(group.walletId, walletNames);
      const other =
        group.transfer && group.pairWalletId
          ? walletSide(group.pairWalletId, walletNames)
          : partySide(group.party);
      const [from, to] = group.type === 'expense' ? [own, other] : [other, own];
      sources.add(from.key, from.name, value);
      destinations.add(to.key, to.name, value);
    }

    return {
      currency,
      categories: categories.list(),
      sources: sources.list(),
      destinations: destinations.list(),
      months,
    };
  }

  /**
   * Adds each row's wallet balance right after it and a transfer's other
   * wallet. The balance runs over every counted row of the wallet in the order
   * the list shows them (date, then creation), from its opening balance.
   */
  async withLedger<T extends Transaction>(
    workspaceId: string,
    rows: T[],
  ): Promise<
    Array<
      T & { runningBalance: string | null; transferPairWallet: { id: string; name: string } | null }
    >
  > {
    const walletIds = [...new Set(rows.map(row => row.walletId).filter(isPresent))];
    const balances = new Map<string, string>();
    if (walletIds.length > 0) {
      const found: Array<{ id: string; running: string }> = await this.transactionRepository.query(
        `SELECT ledger.id, ledger.running FROM (
           SELECT t.id,
             w.initial_balance + SUM(COALESCE(t.credit, 0) - COALESCE(t.debit, 0))
               OVER (PARTITION BY t.wallet_id ORDER BY t.transaction_date, t.created_at, t.id) AS running
           FROM transactions t
           JOIN wallets w ON w.id = t.wallet_id AND w.workspace_id = t.workspace_id
           WHERE t.workspace_id = $1 AND t.wallet_id = ANY($2) AND ${countedSql('t')}
         ) ledger WHERE ledger.id = ANY($3)`,
        [workspaceId, walletIds, rows.map(row => row.id)],
      );
      for (const row of found) {
        balances.set(row.id, Number(row.running).toFixed(2));
      }
    }

    const pairIds = rows.map(row => row.transferPairId).filter(isPresent);
    const pairLegs =
      pairIds.length > 0
        ? await this.transactionRepository.find({
            where: { workspaceId, transferPairId: In(pairIds) },
            select: {
              id: true,
              transferPairId: true,
              walletId: true,
            },
          })
        : [];
    const walletNames = await this.walletNames(
      workspaceId,
      pairLegs.map(leg => leg.walletId),
    );

    return rows.map(row => {
      const pair = pairLegs.find(
        leg => leg.transferPairId === row.transferPairId && leg.id !== row.id,
      );
      const pairName = pair?.walletId ? walletNames.get(pair.walletId) : undefined;
      return Object.assign(row, {
        runningBalance: balances.get(row.id) ?? null,
        transferPairWallet:
          pair?.walletId && pairName ? { id: pair.walletId, name: pairName } : null,
      });
    });
  }

  private flowGroups(
    workspaceId: string,
    filters: Filters,
    viewerMemberId: string | null,
  ): Promise<FlowGroup[]> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select('transaction.transactionType', 'type')
      .addSelect('transaction.transferPairId IS NOT NULL', 'transfer')
      .addSelect('transaction.categoryId', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('transaction.walletId', 'walletId')
      .addSelect(PAIR_WALLET_SQL, 'pairWalletId')
      // Someone else's private row keeps its amount, not its merchant.
      .addSelect(
        `CASE WHEN transaction.isPrivate = true AND transaction.ownerMemberId IS DISTINCT FROM :viewer
           THEN :placeholder ELSE transaction.counterpartyName END`,
        'party',
      )
      .addSelect('transaction.currency', 'currency')
      .addSelect(
        'SUM(ABS(COALESCE(transaction.amount, COALESCE(transaction.credit, 0) - COALESCE(transaction.debit, 0))))',
        'total',
      )
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .setParameters({ viewer: viewerMemberId, placeholder: PRIVATE_PLACEHOLDER });
    onlyFlows(query, 'transaction');
    applyOwnerFilter(query, 'transaction', filters.owner);
    this.applyPeriod(query, filters);
    // By position: an output name such as "type" would bind to a joined column first.
    return query.groupBy('1, 2, 3, 4, 5, 6, 7, 8').getRawMany<FlowGroup>();
  }

  /** Rows per month, counted the way the list counts them, for the twelve months to the period's end. */
  private async monthCounts(
    workspaceId: string,
    filters: Filters,
  ): Promise<Array<{ month: string; count: number }>> {
    const end = filters.dateTo ?? new Date();
    const months: string[] = [];
    for (let back = 0; back < MONTHS_LISTED; back += 1) {
      const day = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1));
      months.push(day.toISOString().slice(0, 7));
    }
    const first = `${months[months.length - 1]}-01`;
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.statement', 'statement')
      .select(`to_char(transaction.transactionDate, 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .andWhere('transaction.transactionDate >= :first', { first })
      .andWhere('transaction.transactionDate <= :end', { end });
    applyOwnerFilter(query, 'transaction', filters.owner);
    const rows = await query.groupBy('1').getRawMany<{ month: string; count: string }>();
    const counts = new Map(rows.map(row => [row.month, Number(row.count)]));
    return months.map(month => ({ month, count: counts.get(month) ?? 0 }));
  }

  private applyPeriod(
    query: { andWhere(where: string, parameters?: object): unknown },
    filters: Filters,
  ): void {
    if (filters.dateFrom) {
      query.andWhere('transaction.transactionDate >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      query.andWhere('transaction.transactionDate <= :dateTo', { dateTo: filters.dateTo });
    }
  }

  private async walletNames(
    workspaceId: string,
    ids: Array<string | null>,
  ): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter(isPresent))];
    if (wanted.length === 0) {
      return new Map();
    }
    const wallets = await this.walletRepository.find({
      where: { workspaceId, id: In(wanted) },
      select: {
        id: true,
        name: true,
      },
    });
    return new Map(wallets.map(wallet => [wallet.id, wallet.name]));
  }
}

/** Sums by key, largest first; the name of the first row seen for a key wins. */
class Slices {
  private readonly byKey = new Map<string, { key: string; name: string; value: number }>();

  add(key: string, name: string, value: number): void {
    const slice = this.byKey.get(key);
    if (slice) {
      slice.value += value;
    } else {
      this.byKey.set(key, { key, name, value });
    }
  }

  list(): Array<{ key: string; name: string; value: number }> {
    return [...this.byKey.values()]
      .map(slice => ({ ...slice, value: Math.round(slice.value * 100) / 100 }))
      .filter(slice => slice.value > 0)
      .sort((a, b) => b.value - a.value);
  }
}

function walletSide(walletId: string | null, names: Map<string, string>) {
  const name = walletId ? names.get(walletId) : undefined;
  return walletId && name
    ? { key: `wallet:${walletId}`, name }
    : { key: NO_ACCOUNT_SLICE, name: '' };
}

function partySide(party: string | null) {
  const name = party?.trim() ?? '';
  return name ? { key: `party:${name.toLowerCase()}`, name } : { key: NO_ACCOUNT_SLICE, name: '' };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
