import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { assertFound } from '../../common/utils/assert-found.util';
import type { TransactionGoalLink } from '../../contracts';
import { Goal, GoalContribution } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { GoalItem, GoalItemStatus } from '../../entities/goal-item.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { normalizeCurrency, round2, toDateOnly, toNumber } from './goal-money.util';

export interface LinkedTransaction {
  id: string;
  statementId: string | null;
  receiptId: string | null;
  counterpartyName: string;
}

const NO_LINK: TransactionGoalLink = { goal: null, amount: null, itemId: null };

/**
 * Counts a transaction toward a goal by mirroring it as a contribution: income
 * adds to the goal, an expense takes from it. Progress, pace and the forecast
 * already read contributions, so they follow without knowing about the link.
 * The transaction can also pay one of the goal's cost lines.
 */
@Injectable()
export class GoalTransactionLinkService {
  private readonly logger = new Logger(GoalTransactionLinkService.name);

  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(GoalContribution)
    private readonly contributionRepository: Repository<GoalContribution>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  async get(workspaceId: string, transactionId: string): Promise<TransactionGoalLink> {
    await this.loadTransaction(workspaceId, transactionId);
    const contribution = await this.contributionRepository.findOne({
      where: { workspaceId, transactionId },
    });
    if (!contribution) {
      return NO_LINK;
    }
    // A soft-deleted goal reads as no link; its rows stay for a restore.
    const goal = await this.goalRepository.findOne({
      where: { id: contribution.goalId, workspaceId },
    });
    if (!goal) {
      return NO_LINK;
    }
    const item = await this.contributionRepository.manager
      .getRepository(GoalItem)
      .findOne({ where: { workspaceId, transactionId, goalId: goal.id } });
    return toLink(goal, toNumber(contribution.amount), item?.id ?? null);
  }

  /**
   * Links, moves or (with `null`) unlinks. Linking again to the same goal
   * recomputes the amounts, which is how an edited transaction catches up.
   * `goalItemId` left out keeps the cost line already linked, if it is still
   * one of this goal's.
   */
  async set(
    workspaceId: string,
    userId: string,
    transactionId: string,
    goalId: string | null,
    goalItemId?: string | null,
  ): Promise<TransactionGoalLink> {
    const transaction = await this.loadTransaction(workspaceId, transactionId);
    if (goalId === null) {
      const removed = await this.contributionRepository.manager.transaction(async manager => {
        await this.linkItem(manager, transaction, null, null);
        return manager.getRepository(GoalContribution).delete({ workspaceId, transactionId });
      });
      if (removed.affected) {
        await this.audit(workspaceId, userId, transactionId, null, null);
      }
      return NO_LINK;
    }

    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');
    const sign = transaction.transactionType === TransactionType.INCOME ? 1 : -1;
    const amount = sign * (await this.magnitudeIn(transaction, goal.currency));

    const itemId = await this.contributionRepository.manager.transaction(async manager => {
      // One statement, so two quick clicks cannot leave two rows for one transaction.
      await manager.query(
        `INSERT INTO goal_contributions
           (goal_id, workspace_id, amount, contribution_date, note, created_by_id, transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (transaction_id) WHERE transaction_id IS NOT NULL
         DO UPDATE SET goal_id = EXCLUDED.goal_id, amount = EXCLUDED.amount,
           contribution_date = EXCLUDED.contribution_date, note = EXCLUDED.note`,
        [
          goal.id,
          workspaceId,
          amount,
          toDateOnly(new Date(transaction.transactionDate)),
          transaction.counterpartyName?.slice(0, 200) || null,
          userId,
          transaction.id,
        ],
      );
      return this.linkItem(manager, transaction, goal, goalItemId);
    });
    await this.audit(workspaceId, userId, transactionId, goal, amount);
    return toLink(goal, amount, itemId);
  }

  /** What the goal page shows for linked movements, so it can link back to the source. */
  async describe(
    workspaceId: string,
    contributions: Array<Pick<GoalContribution, 'transactionId'>>,
  ): Promise<Map<string, LinkedTransaction>> {
    const transactionIds = contributions.flatMap(row => row.transactionId ?? []);
    if (transactionIds.length === 0) {
      return new Map();
    }
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin(Receipt, 'r', 'r.transaction_id = t.id AND r.workspace_id = t.workspace_id')
      .select('t.id', 'id')
      .addSelect('t.statement_id', 'statementId')
      .addSelect('t.counterparty_name', 'counterpartyName')
      .addSelect('MIN(r.id::text)', 'receiptId')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.id IN (:...transactionIds)', { transactionIds })
      .groupBy('t.id')
      .getRawMany<LinkedTransaction>();
    return new Map(rows.map(row => [row.id, { ...row, receiptId: row.receiptId ?? null }]));
  }

  /**
   * Points the transaction at one cost line of `goal` (marked paid at what it
   * cost), and hands a line it paid before back to the plan.
   */
  private async linkItem(
    manager: EntityManager,
    transaction: Transaction,
    goal: Goal | null,
    requestedItemId: string | null | undefined,
  ): Promise<string | null> {
    const items = manager.getRepository(GoalItem);
    const { workspaceId } = transaction;
    const previous = await items.findOne({ where: { workspaceId, transactionId: transaction.id } });
    const kept = previous && previous.goalId === goal?.id ? previous.id : null;
    const itemId = requestedItemId === undefined ? kept : requestedItemId;

    if (previous && previous.id !== itemId) {
      await items.update(
        { id: previous.id, workspaceId },
        { transactionId: null, status: GoalItemStatus.PLANNED, actualAmount: null },
      );
    }
    if (!(itemId && goal)) {
      return null;
    }
    const item = await items.findOne({ where: { id: itemId, goalId: goal.id, workspaceId } });
    assertFound(item, 'Goal item');
    await items.update(
      { id: item.id, workspaceId },
      {
        transactionId: transaction.id,
        status: GoalItemStatus.PAID,
        actualAmount: await this.magnitudeIn(transaction, item.currency),
      },
    );
    return item.id;
  }

  private async loadTransaction(workspaceId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({ where: { id, workspaceId } });
    assertFound(transaction, 'Transaction');
    return transaction;
  }

  /** Converted at the transaction's date; no rate is refused rather than read 1:1. */
  private async magnitudeIn(transaction: Transaction, currency: string): Promise<number> {
    const isIncome = transaction.transactionType === TransactionType.INCOME;
    const magnitude = Math.abs(
      toNumber(isIncome ? transaction.credit : transaction.debit) || toNumber(transaction.amount),
    );
    const from = normalizeCurrency(transaction.currency);
    const to = normalizeCurrency(currency);
    const rate =
      from === to
        ? 1
        : await this.exchangeRates.getRateOrNull(
            from,
            to,
            transaction.transactionDate,
            transaction.workspaceId,
          );
    if (rate === null) {
      throw new UnprocessableEntityException(
        appError('LEDGER_FX_RATE_MISSING', {
          from,
          to,
          date: new Date(transaction.transactionDate).toISOString().slice(0, 10),
        }),
      );
    }
    return round2(magnitude * rate);
  }

  /** The audit trail is a side record: failing to write it must not fail the link. */
  private async audit(
    workspaceId: string,
    userId: string,
    transactionId: string,
    goal: Goal | null,
    amount: number | null,
  ): Promise<void> {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.TRANSACTION,
        entityId: transactionId,
        action: AuditAction.UPDATE,
        description: goal
          ? `Counted toward goal "${goal.name}": ${amount} ${goal.currency}`
          : 'Stopped counting toward a goal',
        meta: { change: goal ? 'goal_linked' : 'goal_unlinked', goalId: goal?.id ?? null },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record goal link for transaction ${transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function toLink(goal: Goal, amount: number, itemId: string | null): TransactionGoalLink {
  return { goal: { id: goal.id, name: goal.name, currency: goal.currency }, amount, itemId };
}
