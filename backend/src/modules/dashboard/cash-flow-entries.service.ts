import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { canReadPrivate, PRIVATE_PLACEHOLDER } from '../../common/utils/transaction-privacy.util';
import type { DashboardCashFlowEntriesResponse, DashboardCashFlowEntry } from '../../contracts';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { BudgetWithinLimitService } from '../budgets/budget-within-limit.service';
import type { WithinLimitAmount } from '../budgets/budget-within-limit.util';
import { DashboardService, round2 } from './dashboard.service';
import { parseMonthWindow } from './dashboard-window.util';

/** The rows behind the dashboard cash flow card's day tooltip. */
@Injectable()
export class CashFlowEntriesService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dashboard: DashboardService,
    @Inject(forwardRef(() => BudgetWithinLimitService))
    private readonly withinLimit: BudgetWithinLimitService,
  ) {}

  /**
   * The rows behind one month's daily cash flow, named, for the card's day tooltip. Same filters
   * and sides as `sumCashFlowByBucket`, so the names add up to the bar they sit on.
   */
  async getCashFlowEntries(
    workspaceId: string,
    month: string,
    viewerMemberId: string | null,
  ): Promise<DashboardCashFlowEntriesResponse> {
    const window = parseMonthWindow(month);
    if (!window) {
      return { entries: [] };
    }
    const currency = await this.dashboard.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.dashboard.applyActiveStatementTransactionFilters(
      query,
      workspaceId,
      window.since,
      window.endDate,
    );

    const [rows, withinLimit] = await Promise.all([
      query
        .select('t.id', 'id')
        .addSelect("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')", 'date')
        .addSelect('t.counterpartyName', 'counterpartyName')
        .addSelect('s.fileName', 'fileName')
        .addSelect('t.transactionType', 'transactionType')
        .addSelect('t.debit', 'debit')
        .addSelect('t.credit', 'credit')
        .addSelect('t.currency', 'currency')
        .addSelect('t.isPrivate', 'isPrivate')
        .addSelect('t.ownerMemberId', 'ownerMemberId')
        .andWhere('t.transactionType IN (:...sides)', {
          sides: [TransactionType.INCOME, TransactionType.EXPENSE],
        })
        .getRawMany<{
          id: string;
          date: string;
          counterpartyName: string | null;
          fileName: string | null;
          transactionType: TransactionType;
          debit: string | null;
          credit: string | null;
          currency: string;
          isPrivate: boolean;
          ownerMemberId: string | null;
        }>(),
      this.withinLimit.withinLimitSpending(workspaceId, window.since, window.endDate),
    ]);
    const budgetedById = new Map(withinLimit.map(row => [row.transactionId, row]));

    const entries: DashboardCashFlowEntry[] = [];
    for (const row of rows) {
      const kind = row.transactionType === TransactionType.INCOME ? 'income' : 'expense';
      const raw = kind === 'income' ? row.credit : row.debit;
      const amount = round2(
        await this.dashboard.convertDashboardAmount(
          raw ?? '0',
          row.currency,
          currency,
          workspaceId,
        ),
      );
      if (amount <= 0) {
        continue;
      }
      const name = this.cashFlowEntryName(row, viewerMemberId);
      const within = kind === 'expense' ? budgetedById.get(row.id) : undefined;
      const budgeted = within ? await this.budgetedPart(amount, within, currency, workspaceId) : 0;
      entries.push({ date: row.date, name, kind, amount, budgeted });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    return { entries };
  }

  /** Who a day-tooltip row is for: the counterparty, else the file, hidden when it is private. */
  private cashFlowEntryName(
    row: {
      counterpartyName: string | null;
      fileName: string | null;
      isPrivate: boolean;
      ownerMemberId: string | null;
    },
    viewerMemberId: string | null,
  ): string {
    if (!canReadPrivate(row, viewerMemberId)) {
      return PRIVATE_PLACEHOLDER;
    }
    return row.counterpartyName?.trim() || row.fileName?.trim() || PRIVATE_PLACEHOLDER;
  }

  /** The within-limit part of an expense, in the workspace currency and never above it. */
  private async budgetedPart(
    amount: number,
    within: WithinLimitAmount,
    currency: string,
    workspaceId: string,
  ): Promise<number> {
    const converted = await this.dashboard.convertDashboardAmount(
      within.amount,
      within.currency,
      currency,
      workspaceId,
    );
    return Math.min(amount, round2(converted));
  }
}
