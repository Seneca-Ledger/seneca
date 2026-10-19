import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import {
  Transaction,
  TransactionType,
  TransferPairKind,
  TransferPairSource,
} from '../../../entities/transaction.entity';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import {
  absAmount,
  accountKey,
  daysBetween,
  matchTransferPairs,
  type RateLookup,
  TRANSFER_DATE_WINDOW_DAYS,
  type TransferPair,
} from './transfer-pairing.matcher';

/** The manual picker looks further than the matcher: a fee or a slow bank is exactly what it is for. */
const CANDIDATE_WINDOW_DAYS = 7;
/** Expense reports get paid back weeks later. */
const REIMBURSEMENT_WINDOW_DAYS = 45;
const CANDIDATE_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TransferPairingResult {
  /** Pairs the matcher proposed. */
  found: number;
  /** Pairs actually written; lower than `found` only when another run got there first. */
  paired: number;
}

@Injectable()
export class TransferPairingService {
  private readonly logger = new Logger(TransferPairingService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  private lookupRateIn(workspaceId: string): RateLookup {
    return (from, to, date) => this.exchangeRatesService.getRateOrNull(from, to, date, workspaceId);
  }

  /**
   * Rows that may still take part in a pair, with the account their statement
   * came from. Rows the user unlinked stay out of automatic runs but remain
   * available to the manual picker: that is the one place they belong.
   */
  private unpairedQuery(workspaceId: string, options: { includeRejected?: boolean } = {}) {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .addSelect(['s.id', 's.accountNumber'])
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.splitGroupId IS NULL')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('t.reimbursementOfId IS NULL')
      .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)');
    if (!options.includeRejected) {
      query.andWhere('(t.transferPairSource IS NULL OR t.transferPairSource != :rejected)', {
        rejected: TransferPairSource.REJECTED,
      });
    }
    return query;
  }

  /**
   * Proposes pairs for the workspace, or only for the rows of one statement
   * (the import hook), against every unpaired row in the surrounding window.
   */
  async detect(workspaceId: string, statementId?: string): Promise<TransferPair<Transaction>[]> {
    const toCheckQuery = this.unpairedQuery(workspaceId);
    if (statementId) {
      toCheckQuery.andWhere('t.statementId = :statementId', { statementId });
    }
    const toCheck = await toCheckQuery.getMany();
    if (toCheck.length === 0) {
      return [];
    }

    const times = toCheck.map(row => new Date(row.transactionDate).getTime());
    const since = new Date(Math.min(...times) - TRANSFER_DATE_WINDOW_DAYS * DAY_MS);
    const until = new Date(Math.max(...times) + TRANSFER_DATE_WINDOW_DAYS * DAY_MS);
    const pool = await this.unpairedQuery(workspaceId)
      .andWhere('t.transactionDate BETWEEN :since AND :until', { since, until })
      .getMany();

    return matchTransferPairs(toCheck, pool, this.lookupRateIn(workspaceId));
  }

  /**
   * Writes the pairs. Each one only lands if both legs are still unpaired, so
   * two overlapping runs (an import and a manual detect) cannot cross-link rows.
   */
  async apply(
    pairs: Array<{ outgoing: { id: string }; incoming: { id: string } }>,
    source: TransferPairSource = TransferPairSource.AUTO,
  ): Promise<number> {
    let applied = 0;
    for (const pair of pairs) {
      const transferPairId = randomUUID();
      const result = await this.transactionRepository.update(
        { id: In([pair.outgoing.id, pair.incoming.id]), transferPairId: IsNull() },
        { transferPairId, transferPairSource: source },
      );
      if (result.affected === 2) {
        applied += 1;
        continue;
      }
      // Lost the race on one leg: a half-written pair would hide a single row.
      await this.transactionRepository.update(
        { transferPairId },
        { transferPairId: null, transferPairSource: null },
      );
    }
    return applied;
  }

  async detectAndApply(workspaceId: string, statementId?: string): Promise<TransferPairingResult> {
    const pairs = await this.detect(workspaceId, statementId);
    const paired = pairs.length > 0 ? await this.apply(pairs) : 0;
    if (pairs.length > 0) {
      this.logger.log(
        `Transfer pairing in workspace ${workspaceId}: ${paired}/${pairs.length} pairs written`,
      );
    }
    return { found: pairs.length, paired };
  }

  /**
   * Counterparts the user can pick by hand: opposite direction, another
   * account, up to a week apart, closest amount first. No "exactly one" rule
   * here — this list exists for the cases the matcher refused.
   */
  async candidates(workspaceId: string, transactionId: string): Promise<Transaction[]> {
    const row = await this.findOwned(workspaceId, transactionId);
    const opposite =
      row.transactionType === TransactionType.EXPENSE
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;
    const at = new Date(row.transactionDate).getTime();
    const since = new Date(at - CANDIDATE_WINDOW_DAYS * DAY_MS);
    const until = new Date(at + CANDIDATE_WINDOW_DAYS * DAY_MS);

    const rows = await this.unpairedQuery(workspaceId, { includeRejected: true })
      .andWhere('t.id != :id', { id: row.id })
      .andWhere('t.transactionType = :opposite', { opposite })
      .andWhere('t.transactionDate BETWEEN :since AND :until', { since, until })
      .getMany();

    const ownKey = accountKey(row);
    const amount = absAmount(row);
    return rows
      .filter(candidate => ownKey === null || accountKey(candidate) !== ownKey)
      .sort(
        (a, b) =>
          Math.abs(absAmount(a) - amount) - Math.abs(absAmount(b) - amount) ||
          daysBetween(a.transactionDate, row.transactionDate) -
            daysBetween(b.transactionDate, row.transactionDate),
      )
      .slice(0, CANDIDATE_LIMIT);
  }

  /** Links two rows by hand. Amounts may differ (a fee), directions may not. */
  async link(workspaceId: string, id: string, otherId: string): Promise<string> {
    if (id === otherId) {
      throw new BadRequestException('A transfer needs two different transactions');
    }
    const [a, b] = await Promise.all([
      this.findOwned(workspaceId, id),
      this.findOwned(workspaceId, otherId),
    ]);
    if (a.transactionType === b.transactionType) {
      throw new BadRequestException('The two legs of a transfer must go in opposite directions');
    }
    for (const leg of [a, b]) {
      if (leg.isDuplicate) {
        throw new BadRequestException(`Transaction ${leg.id} is marked as a duplicate`);
      }
      if (leg.splitGroupId) {
        throw new BadRequestException(`Transaction ${leg.id} is part of a split`);
      }
      if (leg.transferPairId) {
        throw new ConflictException(`Transaction ${leg.id} is already part of a transfer`);
      }
    }

    const transferPairId = randomUUID();
    const result = await this.transactionRepository.update(
      { id: In([a.id, b.id]), workspaceId, transferPairId: IsNull() },
      { transferPairId, transferPairSource: TransferPairSource.MANUAL },
    );
    if (result.affected !== 2) {
      await this.transactionRepository.update(
        { transferPairId },
        { transferPairId: null, transferPairSource: null },
      );
      throw new ConflictException('One of the transactions was paired in the meantime');
    }
    return transferPairId;
  }

  /** Separates both legs and remembers the choice so auto-pairing does not redo it. */
  async unlink(workspaceId: string, id: string): Promise<void> {
    const row = await this.findOwned(workspaceId, id);
    if (!row.transferPairId) {
      throw new BadRequestException('Transaction is not part of a transfer');
    }
    await this.transactionRepository.update(
      { workspaceId, transferPairId: row.transferPairId },
      {
        transferPairId: null,
        transferPairSource: TransferPairSource.REJECTED,
        transferPairKind: null,
        reimbursementOfId: null,
      },
    );
  }

  /**
   * Expenses an incoming row may be paying back: either way round in time
   * (an advance is repaid later, a refund follows the charge), closest amount
   * first. Any account qualifies — the employer pays into whichever one.
   */
  async reimbursementCandidates(workspaceId: string, incomeId: string): Promise<Transaction[]> {
    const income = await this.findOwned(workspaceId, incomeId);
    if (income.transactionType !== TransactionType.INCOME) {
      throw new BadRequestException('Only an incoming transaction can be a reimbursement');
    }
    const at = new Date(income.transactionDate).getTime();
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.id != :id', { id: income.id })
      .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.splitGroupId IS NULL')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('t.transactionDate BETWEEN :since AND :until', {
        since: new Date(at - REIMBURSEMENT_WINDOW_DAYS * DAY_MS),
        until: new Date(at + REIMBURSEMENT_WINDOW_DAYS * DAY_MS),
      })
      .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)')
      .getMany();

    const amount = absAmount(income);
    return rows
      .sort(
        (a, b) =>
          Math.abs(absAmount(a) - amount) - Math.abs(absAmount(b) - amount) ||
          daysBetween(a.transactionDate, income.transactionDate) -
            daysBetween(b.transactionDate, income.transactionDate),
      )
      .slice(0, CANDIDATE_LIMIT);
  }

  /**
   * Records that `incomeId` pays back `expenseId`. When it pays it back in
   * full (same currency, same money) the two rows also become a
   * `reimbursement` pair and drop out of every spend and income aggregate;
   * a partial repayment keeps only the link and both rows still count gross.
   */
  async linkReimbursement(
    workspaceId: string,
    incomeId: string,
    expenseId: string,
  ): Promise<{ full: boolean; transferPairId: string | null }> {
    if (incomeId === expenseId) {
      throw new BadRequestException('A reimbursement needs two different transactions');
    }
    const [income, expense] = await Promise.all([
      this.findOwned(workspaceId, incomeId),
      this.findOwned(workspaceId, expenseId),
    ]);
    if (income.transactionType !== TransactionType.INCOME) {
      throw new BadRequestException('The reimbursement must be an incoming transaction');
    }
    if (expense.transactionType !== TransactionType.EXPENSE) {
      throw new BadRequestException('A reimbursement can only pay back an expense');
    }
    for (const leg of [income, expense]) {
      if (leg.isDuplicate) {
        throw new BadRequestException(`Transaction ${leg.id} is marked as a duplicate`);
      }
      if (leg.splitGroupId) {
        throw new BadRequestException(`Transaction ${leg.id} is part of a split`);
      }
      if (leg.transferPairId) {
        throw new ConflictException(`Transaction ${leg.id} is already part of a transfer`);
      }
    }
    if (income.reimbursementOfId) {
      throw new ConflictException('This transaction already reimburses another one');
    }

    const sameCurrency =
      (income.currency || '').trim().toUpperCase() ===
      (expense.currency || '').trim().toUpperCase();
    const full = sameCurrency && Math.abs(absAmount(income) - absAmount(expense)) < 0.005;

    let transferPairId: string | null = null;
    if (full) {
      transferPairId = randomUUID();
      const result = await this.transactionRepository.update(
        { id: In([income.id, expense.id]), workspaceId, transferPairId: IsNull() },
        {
          transferPairId,
          transferPairSource: TransferPairSource.MANUAL,
          transferPairKind: TransferPairKind.REIMBURSEMENT,
        },
      );
      if (result.affected !== 2) {
        await this.transactionRepository.update(
          { transferPairId },
          { transferPairId: null, transferPairSource: null, transferPairKind: null },
        );
        throw new ConflictException('One of the transactions was paired in the meantime');
      }
    }
    await this.transactionRepository.update(
      { id: income.id, workspaceId },
      { reimbursementOfId: expense.id },
    );
    return { full, transferPairId };
  }

  async unlinkReimbursement(workspaceId: string, incomeId: string): Promise<void> {
    const income = await this.findOwned(workspaceId, incomeId);
    if (!income.reimbursementOfId) {
      throw new BadRequestException('Transaction is not a reimbursement');
    }
    if (income.transferPairId && income.transferPairKind === TransferPairKind.REIMBURSEMENT) {
      await this.transactionRepository.update(
        { workspaceId, transferPairId: income.transferPairId },
        { transferPairId: null, transferPairSource: null, transferPairKind: null },
      );
    }
    await this.transactionRepository.update(
      { id: income.id, workspaceId },
      { reimbursementOfId: null },
    );
  }

  private async findOwned(workspaceId: string, id: string): Promise<Transaction> {
    const row = await this.transactionRepository.findOne({
      where: { id, workspaceId },
      relations: ['statement'],
    });
    if (!row) {
      throw new NotFoundException('Transaction not found');
    }
    return row;
  }
}
