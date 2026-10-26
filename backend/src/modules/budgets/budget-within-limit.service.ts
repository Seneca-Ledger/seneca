import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { flowsSql } from '../../common/utils/counted-transactions.util';
import { Budget, BudgetRolloverMode } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import {
  clampToWindow,
  computePeriodRange,
  localDay,
  overlapsWindow,
  parseDateOnly,
} from './budget-period.util';
import { resolveAvailable } from './budget-rollover.util';
import {
  allocateWithinLimit,
  type WithinLimitAmount,
  type WithinLimitBudget,
  type WithinLimitRow,
} from './budget-within-limit.util';
import { BudgetsService } from './budgets.service';

/** The dashboard's "budgeted" share: which spending fell within a budget's limit. */
@Injectable()
export class BudgetWithinLimitService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly budgets: BudgetsService,
    @Optional()
    @InjectRepository(Category)
    private readonly categoryRepository?: Repository<Category>,
  ) {}

  /**
   * The expense rows between two days that fell within a budget's limit (the part of each one a
   * budget still had room for), in each row's own currency: the "budgeted" share of the
   * dashboard's daily spending. Room left from before `since` in a running period counts.
   */
  async withinLimitSpending(
    workspaceId: string,
    since: Date,
    endDate: Date,
  ): Promise<WithinLimitAmount[]> {
    const from = parseDateOnly(since);
    const to = parseDateOnly(endDate);
    const budgets = (await this.budgetRepository.find({ where: { workspaceId } })).filter(budget =>
      overlapsWindow({ start: from, end: to }, budget),
    );
    if (budgets.length === 0) {
      return [];
    }

    const dayBefore = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
    const planned = await Promise.all(
      budgets.map(async budget => {
        const categoryIds = await this.budgets.categoryIdsFor(workspaceId, budget.categoryId);
        const periods: WithinLimitBudget['periods'] = [];
        let range = computePeriodRange(budget.periodType, from);
        while (range.start.getTime() <= to.getTime()) {
          const period = clampToWindow(range, budget);
          if (period) {
            const previousSpent =
              budget.rolloverMode && budget.rolloverMode !== BudgetRolloverMode.NONE
                ? await this.budgets.previousPeriodsSpent(budget, categoryIds, range.start)
                : [];
            const { availableAmount } = resolveAvailable(
              Number(budget.limitAmount),
              budget.rolloverMode,
              previousSpent,
            );
            const spentBefore =
              period.start.getTime() < from.getTime()
                ? (await this.budgets.computeSpending(budget, categoryIds, period.start, dayBefore))
                    .spent
                : 0;
            periods.push({
              start: localDay(period.start),
              end: localDay(period.end),
              remaining: availableAmount - spentBefore,
            });
          }
          range = computePeriodRange(
            budget.periodType,
            new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1),
          );
        }
        return {
          budget,
          entry: { id: budget.id, categoryId: budget.categoryId, categoryIds, periods },
        };
      }),
    );

    const categoryIds = [...new Set(planned.flatMap(({ entry }) => entry.categoryIds))];
    const [rows, categories] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('t')
        .select('t.id', 'id')
        .addSelect("TO_CHAR(t.transaction_date, 'YYYY-MM-DD')", 'date')
        .addSelect('t.category_id', 'categoryId')
        .addSelect('t.currency', 'currency')
        .addSelect('ABS(t.amount)', 'amount')
        .where('t.workspace_id = :workspaceId', { workspaceId })
        .andWhere('t.category_id IN (:...categoryIds)', { categoryIds })
        .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
        .andWhere('t.transaction_date >= :start', { start: from })
        .andWhere('t.transaction_date <= :end', { end: to })
        .andWhere('t.is_duplicate = false')
        .andWhere('t.transfer_pair_id IS NULL')
        .andWhere(flowsSql('t'))
        .orderBy('t.transaction_date', 'ASC')
        .addOrderBy('t.id', 'ASC')
        .getRawMany<{
          id: string;
          date: string;
          categoryId: string;
          currency: string | null;
          amount: string;
        }>(),
      this.categoryRepository
        ? this.categoryRepository.find({
            where: { workspaceId },
            select: { id: true, parentId: true },
          })
        : Promise.resolve([] as Category[]),
    ]);

    const rates = new Map<string, Promise<number | null>>();
    const rate = (fromCurrency: string, toCurrency: string, day: string) => {
      const key = `${fromCurrency}>${toCurrency}@${day}`;
      if (!rates.has(key)) {
        rates.set(
          key,
          this.budgets.rateOrNull(fromCurrency, toCurrency, parseDateOnly(day), workspaceId),
        );
      }
      return rates.get(key) as Promise<number | null>;
    };
    const withinRows: WithinLimitRow[] = await Promise.all(
      rows.map(async row => {
        const amount = Number.parseFloat(row.amount);
        const inBudgetCurrency = new Map<string, number | null>();
        for (const { budget } of planned) {
          const currency = (row.currency || budget.currency).toUpperCase();
          const factor = await rate(currency, budget.currency.toUpperCase(), row.date);
          inBudgetCurrency.set(budget.id, factor === null ? null : amount * factor);
        }
        return {
          transactionId: row.id,
          date: row.date,
          categoryId: row.categoryId,
          currency: row.currency || '',
          amount,
          inBudgetCurrency,
        };
      }),
    );

    return allocateWithinLimit(
      planned.map(({ entry }) => entry),
      withinRows,
      new Map(categories.map(category => [category.id, category.parentId ?? null])),
    );
  }
}
