import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { PayeePeers } from '../../contracts';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { ClassificationService } from '../classification/services/classification.service';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import {
  AMOUNT_SQL,
  categoryNamesOf,
  lastDayOf,
  monthsTo,
  payeeFlows,
  round2,
} from './payee-flows';

/** Other payees drawn against this one: enough to compare, few enough to read. */
const PEERS_SHOWN = 5;

/** The payee card's comparison: the payee against the others of its category. */
@Injectable()
export class PayeePeersService {
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
      throw new NotFoundException(appError('PAYEE_NOT_FOUND'));
    }
    const months = monthsTo(new Date()).reverse();
    const first = `${months[0]}-01`;
    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));

    const ownRows = await payeeFlows(this.transactionRepository, workspaceId, viewerMemberId)
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
      const query = payeeFlows(this.transactionRepository, workspaceId, viewerMemberId)
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
            select: { id: true, name: true },
          })
        : Promise.resolve([] as Payee[]),
      categoryNamesOf(this.categoryRepository, workspaceId, categoryId ? [categoryId] : []),
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
}
