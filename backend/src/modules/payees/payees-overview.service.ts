import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import type {
  PayeeDuplicateGroups,
  PayeePeers,
  PayeeSummary,
  PayeesOverview,
  PayeesOverviewQuery,
} from '../../contracts';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { ClassificationService } from '../classification/services/classification.service';
import {
  addAmount,
  type CurrencyAmounts,
  CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { groupLikelyDuplicates } from './payee-duplicates';
import { UNDECIDED_CATEGORY_SOURCES } from './payee-undecided';

const DEFAULT_LIMIT = 50;
/** Other payees drawn against this one: enough to compare, few enough to read. */
const PEERS_SHOWN = 5;
const MONTHS_LISTED = 12;

/** The money of a row, whichever side it is on. */
const AMOUNT_SQL =
  'ABS(COALESCE(transaction.amount, COALESCE(transaction.credit, 0) - COALESCE(transaction.debit, 0)))';

const round2 = (value: number) => Math.round(value * 100) / 100;
const toDateOnly = (value: string | Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

/** The twelve `YYYY-MM` months ending with `end`'s, newest first. */
function monthsTo(end: Date): string[] {
  return Array.from({ length: MONTHS_LISTED }, (_, back) =>
    new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1)).toISOString().slice(0, 7),
  );
}

function lastDayOf(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
}

/**
 * What went to each payee and came from it: the Payees page and the payee
 * card. Counted like every income and spending figure (`onlyFlows`, no
 * transfers between own accounts), and without another member's private rows,
 * the same rule the payee list follows: a total would tie the merchant to them.
 */
@Injectable()
export class PayeesOverviewService {
  constructor(
    @InjectRepository(Payee)
    private readonly payeeRepository: Repository<Payee>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly classificationService: ClassificationService,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  /** Rows of payees that count, for the viewer. */
  private flows(workspaceId: string, viewerMemberId: string | null) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.payeeId IS NOT NULL')
      .andWhere('transaction.transferPairId IS NULL')
      .andWhere(readablePrivateSql('transaction'), { [PRIVACY_VIEWER_PARAM]: viewerMemberId });
    return onlyFlows(query, 'transaction');
  }

  async overview(
    workspaceId: string,
    query: PayeesOverviewQuery,
    viewerMemberId: string | null,
  ): Promise<PayeesOverview> {
    const direction =
      query.direction === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE;
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const search = query.search?.trim() ?? '';
    const end = query.month ? lastDayOf(query.month) : new Date().toISOString().slice(0, 10);
    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));

    const grouped = this.flows(workspaceId, viewerMemberId)
      .innerJoin(Payee, 'payee', 'payee.id = transaction.payeeId')
      .select('transaction.payeeId', 'payeeId')
      .addSelect('transaction.currency', 'currency')
      .addSelect('COUNT(*)', 'count')
      .addSelect(`SUM(${AMOUNT_SQL})`, 'amount')
      .addSelect('MAX(transaction.transactionDate)', 'lastSeen')
      .andWhere('transaction.transactionType = :direction', { direction });
    if (query.month) {
      grouped
        .andWhere('transaction.transactionDate >= :from', { from: `${query.month}-01` })
        .andWhere('transaction.transactionDate <= :end', { end });
    }
    if (search) {
      grouped.andWhere("payee.name ILIKE :pattern ESCAPE '\\'", {
        pattern: `%${search.replace(/[\\%_]/g, char => `\\${char}`)}%`,
      });
    }

    const monthQuery = this.flows(workspaceId, viewerMemberId)
      .select(`to_char(transaction.transactionDate, 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'count')
      .andWhere('transaction.transactionType = :direction', { direction })
      .andWhere('transaction.transactionDate >= :first', {
        first: `${monthsTo(new Date(end)).at(-1)}-01`,
      })
      .andWhere('transaction.transactionDate <= :end', { end });

    const [rows, monthRows] = await Promise.all([
      grouped.groupBy('transaction.payeeId').addGroupBy('transaction.currency').getRawMany<{
        payeeId: string;
        currency: string;
        count: string;
        amount: string;
        lastSeen: string | Date;
      }>(),
      monthQuery.groupBy('1').getRawMany<{ month: string; count: string }>(),
    ]);

    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      [...new Set(rows.map(row => normalizeCurrencyCode(row.currency)))].map(currency => ({
        currency,
        date: end,
      })),
      workspaceId,
    );

    const byPayee = new Map<string, { count: number; amount: number; lastSeen: string | null }>();
    for (const row of rows) {
      const entry = byPayee.get(row.payeeId) ?? { count: 0, amount: 0, lastSeen: null };
      entry.count += Number(row.count);
      entry.amount += converter.convert(
        Number(row.amount),
        normalizeCurrencyCode(row.currency),
        end,
      );
      const seen = toDateOnly(row.lastSeen);
      if (seen && (!entry.lastSeen || seen > entry.lastSeen)) {
        entry.lastSeen = seen;
      }
      byPayee.set(row.payeeId, entry);
    }

    const ranked = [...byPayee].sort(([, a], [, b]) => b.amount - a.amount || b.count - a.count);
    const pageIds = ranked.slice((page - 1) * limit, page * limit).map(([id]) => id);
    const [payees, defaults] = await Promise.all([
      pageIds.length
        ? this.payeeRepository.find({ where: { id: In(pageIds), workspaceId } })
        : Promise.resolve([] as Payee[]),
      this.classificationService.categoriesForPayees(workspaceId, pageIds),
    ]);
    const categoryNames = await this.categoryNames(
      workspaceId,
      [...defaults.values()].map(match => match.categoryId),
    );
    const payeeById = new Map(payees.map(payee => [payee.id, payee]));
    const counts = new Map(monthRows.map(row => [row.month, Number(row.count)]));

    return {
      currency: target,
      rows: pageIds.flatMap(id => {
        const payee = payeeById.get(id);
        const totals = byPayee.get(id);
        if (!(payee && totals)) {
          return [];
        }
        const categoryId = defaults.get(id)?.categoryId;
        return [
          {
            id,
            name: payee.name,
            mode: payee.mode,
            category:
              categoryId && categoryNames.has(categoryId)
                ? { id: categoryId, name: categoryNames.get(categoryId) as string }
                : null,
            count: totals.count,
            amount: round2(totals.amount),
            lastSeen: totals.lastSeen,
          },
        ];
      }),
      totalPayees: byPayee.size,
      totalAmount: round2(ranked.reduce((sum, [, totals]) => sum + totals.amount, 0)),
      months: monthsTo(new Date(end)).map(month => ({ month, count: counts.get(month) ?? 0 })),
      missingRates: converter.missing,
    };
  }

  async summary(
    workspaceId: string,
    payeeId: string,
    viewerMemberId: string | null,
  ): Promise<PayeeSummary> {
    const payee = await this.payeeRepository.findOne({ where: { id: payeeId, workspaceId } });
    if (!payee) {
      throw new NotFoundException('Payee not found');
    }
    const today = new Date().toISOString().slice(0, 10);
    const months = monthsTo(new Date(today)).reverse();
    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));

    const [byMonth, span, aliases, subscriptions, undecided] = await Promise.all([
      this.flows(workspaceId, viewerMemberId)
        .select(`to_char(transaction.transactionDate, 'YYYY-MM')`, 'month')
        .addSelect('transaction.transactionType', 'type')
        .addSelect('transaction.currency', 'currency')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`SUM(${AMOUNT_SQL})`, 'amount')
        .andWhere('transaction.payeeId = :payeeId', { payeeId })
        .andWhere('transaction.transactionDate >= :first', { first: `${months[0]}-01` })
        .groupBy('1')
        .addGroupBy('2')
        .addGroupBy('3')
        .getRawMany<{
          month: string;
          type: TransactionType;
          currency: string;
          count: string;
          amount: string;
        }>(),
      this.flows(workspaceId, viewerMemberId)
        .select('COUNT(*)', 'count')
        .addSelect('MIN(transaction.transactionDate)', 'firstSeen')
        .addSelect('MAX(transaction.transactionDate)', 'lastSeen')
        .andWhere('transaction.payeeId = :payeeId', { payeeId })
        .getRawOne<{ count: string; firstSeen: string | null; lastSeen: string | null }>(),
      // The latest name each alias was seen under, from a row the viewer may read.
      this.transactionRepository.query(
        `SELECT alias.payee_key AS key,
           (SELECT t.counterparty_name FROM transactions t
             WHERE t.workspace_id = alias.workspace_id AND t.payee_key = alias.payee_key
               AND ${readablePrivateSql('t', '$3')}
             ORDER BY t.transaction_date DESC LIMIT 1) AS example
         FROM payee_aliases alias
         WHERE alias.workspace_id = $1 AND alias.payee_id = $2
         ORDER BY alias.payee_key`,
        [workspaceId, payeeId, viewerMemberId],
      ) as Promise<Array<{ key: string; example: string | null }>>,
      this.transactionRepository.query(
        `SELECT s.id, s.vendor_name AS name FROM subscription_payees link
           JOIN subscriptions s ON s.id = link.subscription_id AND s.workspace_id = link.workspace_id
         WHERE link.workspace_id = $1 AND link.payee_id = $2
         ORDER BY s.vendor_name`,
        [workspaceId, payeeId],
      ) as Promise<Array<{ id: string; name: string }>>,
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.payeeId = :payeeId', { payeeId })
        .andWhere('transaction.isDuplicate = false')
        .andWhere('transaction.taxLocked = false')
        .andWhere(
          '(transaction.categoryId IS NULL OR transaction.categorySource IN (:...undecided))',
          { undecided: UNDECIDED_CATEGORY_SOURCES },
        )
        .getCount(),
    ]);

    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      byMonth.map(row => ({
        currency: normalizeCurrencyCode(row.currency),
        date: lastDayOf(row.month),
      })),
      workspaceId,
    );
    const spent: CurrencyAmounts = new Map();
    const received: CurrencyAmounts = new Map();
    let spentCount = 0;
    for (const row of byMonth) {
      const value = converter.convert(
        Number(row.amount),
        normalizeCurrencyCode(row.currency),
        lastDayOf(row.month),
      );
      if (row.type === TransactionType.EXPENSE) {
        addAmount(spent, row.month, value);
        spentCount += Number(row.count);
      } else {
        addAmount(received, row.month, value);
      }
    }
    const spentLastYear = [...spent.values()].reduce((sum, value) => sum + value, 0);

    return {
      currency: target,
      months: months.map(month => ({
        month,
        spent: round2(spent.get(month) ?? 0),
        received: round2(received.get(month) ?? 0),
      })),
      spentLastYear: round2(spentLastYear),
      receivedLastYear: round2([...received.values()].reduce((sum, value) => sum + value, 0)),
      count: Number(span?.count ?? 0),
      averageSpent: spentCount > 0 ? round2(spentLastYear / spentCount) : null,
      firstSeen: toDateOnly(span?.firstSeen ?? null),
      lastSeen: toDateOnly(span?.lastSeen ?? null),
      aliases,
      subscriptions,
      undecidedCount: undecided,
      missingRates: converter.missing,
    };
  }

  /**
   * The payee month by month against the biggest other payees of its category
   * over the same twelve months. The payee itself counts all its rows (as its
   * bars do); the others count their rows in the category.
   */
  async peers(
    workspaceId: string,
    payeeId: string,
    viewerMemberId: string | null,
  ): Promise<PayeePeers> {
    const payee = await this.payeeRepository.findOne({ where: { id: payeeId, workspaceId } });
    if (!payee) {
      throw new NotFoundException('Payee not found');
    }
    const months = monthsTo(new Date()).reverse();
    const first = `${months[0]}-01`;
    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));

    const ownRows = await this.flows(workspaceId, viewerMemberId)
      .select('transaction.transactionType', 'type')
      .addSelect('transaction.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .andWhere('transaction.payeeId = :payeeId', { payeeId })
      .andWhere('transaction.transactionDate >= :first', { first })
      .groupBy('1')
      .addGroupBy('2')
      .getRawMany<{ type: TransactionType; categoryId: string | null; count: string }>();
    // Spending, unless the payee only ever paid us.
    const direction = ownRows.some(row => row.type === TransactionType.EXPENSE)
      ? TransactionType.EXPENSE
      : ownRows.length > 0
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;
    const usual = ownRows
      .filter(row => row.type === direction && row.categoryId)
      .sort((a, b) => Number(b.count) - Number(a.count))[0]?.categoryId;
    const categoryId =
      (await this.classificationService.categoriesForPayees(workspaceId, [payeeId])).get(payeeId)
        ?.categoryId ??
      usual ??
      null;

    const monthly = (scope: 'self' | 'peers') => {
      const query = this.flows(workspaceId, viewerMemberId)
        .select('transaction.payeeId', 'payeeId')
        .addSelect(`to_char(transaction.transactionDate, 'YYYY-MM')`, 'month')
        .addSelect('transaction.currency', 'currency')
        .addSelect(`SUM(${AMOUNT_SQL})`, 'amount')
        .andWhere('transaction.transactionType = :direction', { direction })
        .andWhere('transaction.transactionDate >= :first', { first });
      if (scope === 'self') {
        query.andWhere('transaction.payeeId = :payeeId', { payeeId });
      } else {
        query
          .andWhere('transaction.payeeId <> :payeeId', { payeeId })
          .andWhere('transaction.categoryId = :categoryId', { categoryId });
      }
      return query
        .groupBy('1')
        .addGroupBy('2')
        .addGroupBy('3')
        .getRawMany<{ payeeId: string; month: string; currency: string; amount: string }>();
    };
    const [own, others] = await Promise.all([
      monthly('self'),
      categoryId ? monthly('peers') : Promise.resolve([]),
    ]);

    const rows = [...own, ...others];
    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      rows.map(row => ({
        currency: normalizeCurrencyCode(row.currency),
        date: lastDayOf(row.month),
      })),
      workspaceId,
    );
    const valuesOf = new Map<string, number[]>();
    for (const row of rows) {
      const index = months.indexOf(row.month);
      if (index < 0) {
        continue;
      }
      const values = valuesOf.get(row.payeeId) ?? months.map(() => 0);
      values[index] += converter.convert(
        Number(row.amount),
        normalizeCurrencyCode(row.currency),
        lastDayOf(row.month),
      );
      valuesOf.set(row.payeeId, values);
    }
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    const peerIds = [...valuesOf.keys()]
      .filter(id => id !== payeeId)
      .sort((a, b) => sum(valuesOf.get(b) ?? []) - sum(valuesOf.get(a) ?? []))
      .slice(0, PEERS_SHOWN);

    const [names, categoryNames] = await Promise.all([
      peerIds.length
        ? this.payeeRepository.find({
            where: { id: In(peerIds), workspaceId },
            select: ['id', 'name'],
          })
        : Promise.resolve([] as Payee[]),
      this.categoryNames(workspaceId, categoryId ? [categoryId] : []),
    ]);
    const nameOf = new Map(names.map(peer => [peer.id, peer.name]));
    const round = (values: number[] | undefined) =>
      (values ?? months.map(() => 0)).map(value => round2(value));

    return {
      currency: target,
      direction,
      category:
        categoryId && categoryNames.has(categoryId)
          ? { id: categoryId, name: categoryNames.get(categoryId) as string }
          : null,
      months,
      series: [
        { payeeId, name: payee.name, values: round(valuesOf.get(payeeId)), isSelf: true },
        ...peerIds.flatMap(id =>
          nameOf.has(id)
            ? [
                {
                  payeeId: id,
                  name: nameOf.get(id) as string,
                  values: round(valuesOf.get(id)),
                  isSelf: false,
                },
              ]
            : [],
        ),
      ],
      missingRates: converter.missing,
    };
  }

  /** Groups of payees that look like one business, each with how many rows it holds. */
  async duplicates(
    workspaceId: string,
    viewerMemberId: string | null,
  ): Promise<PayeeDuplicateGroups> {
    const payees: Array<{ id: string; name: string; count: string }> = await this.payeeRepository
      .createQueryBuilder('payee')
      .leftJoin(
        Transaction,
        'transaction',
        `transaction.payeeId = payee.id AND transaction.workspaceId = payee.workspaceId AND ${readablePrivateSql('transaction')}`,
        { [PRIVACY_VIEWER_PARAM]: viewerMemberId },
      )
      .select('payee.id', 'id')
      .addSelect('payee.name', 'name')
      .addSelect('COUNT(transaction.id)', 'count')
      .where('payee.workspaceId = :workspaceId', { workspaceId })
      .groupBy('payee.id')
      .getRawMany();
    return groupLikelyDuplicates(
      payees.map(payee => ({ id: payee.id, name: payee.name, count: Number(payee.count) })),
    ).map(group => ({ payees: group.sort((a, b) => b.count - a.count) }));
  }

  private async categoryNames(workspaceId: string, ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const categories = await this.categoryRepository.find({
      where: { id: In(unique), workspaceId },
      select: ['id', 'name'],
    });
    return new Map(categories.map(category => [category.id, category.name]));
  }
}
