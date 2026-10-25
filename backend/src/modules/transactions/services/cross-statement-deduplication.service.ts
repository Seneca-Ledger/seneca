import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type FindOptionsWhere, In, Repository } from 'typeorm';
import { taxLockedConflict } from '../../../common/utils/tax-lock.util';
import { redactPrivateRows } from '../../../common/utils/transaction-privacy.util';
import { Statement } from '../../../entities/statement.entity';
import { Transaction } from '../../../entities/transaction.entity';

export interface DuplicateCandidate {
  transaction: Transaction;
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'hybrid';
  matchedFields: string[];
}

export interface DuplicateGroup {
  master: Transaction;
  duplicates: DuplicateCandidate[];
  confidence: number;
}

export interface CrossStatementDeduplicationResult {
  totalTransactions: number;
  duplicateGroups: DuplicateGroup[];
  markedAsDuplicate: number;
}

@Injectable()
export class CrossStatementDeduplicationService {
  private readonly logger = new Logger(CrossStatementDeduplicationService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Find duplicate transactions across statements within a workspace
   * @param workspaceId Workspace ID
   * @param statementId Optional: limit to specific statement
   * @param threshold Similarity threshold (default: 0.85)
   * @param viewerMemberId When given, rows are compared as this member may see
   *   them: another member's private row matches on date and amount only, so a
   *   group (or its `matchedFields`) cannot tell what that row was.
   */
  async findDuplicates(
    workspaceId: string,
    statementId?: string,
    threshold = 0.85,
    viewerMemberId?: string | null,
  ): Promise<DuplicateGroup[]> {
    this.logger.log(
      `Finding duplicates in workspace ${workspaceId}${statementId ? ` for statement ${statementId}` : ''}`,
    );

    // Get transactions to check
    const transactionsToCheck = (await this.getTransactionsToCheck(workspaceId, statementId)) ?? [];

    if (transactionsToCheck.length === 0) {
      return [];
    }

    // Get date range for potential duplicates (±7 days)
    const minDate = this.getMinDate(transactionsToCheck);
    const maxDate = this.getMaxDate(transactionsToCheck);
    const dateRangeStart = new Date(minDate);
    dateRangeStart.setDate(dateRangeStart.getDate() - 7);
    const dateRangeEnd = new Date(maxDate);
    dateRangeEnd.setDate(dateRangeEnd.getDate() + 7);

    // Get all potentially duplicate transactions in date range
    const potentialDuplicates = await this.transactionRepository.find({
      where: {
        workspaceId,
        transactionDate: Between(dateRangeStart, dateRangeEnd),
        isDuplicate: false, // Only check non-duplicates
      },
      order: {
        transactionDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (viewerMemberId !== undefined) {
      redactPrivateRows(transactionsToCheck, viewerMemberId);
      redactPrivateRows(potentialDuplicates, viewerMemberId);
    }

    const accountByStatement = await this.loadAccountNumbers([
      ...transactionsToCheck,
      ...potentialDuplicates,
    ]);

    const duplicateGroups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();

    for (const transaction of transactionsToCheck) {
      if (processedIds.has(transaction.id)) {
        continue;
      }

      const candidates = potentialDuplicates
        .filter(
          t =>
            t.id !== transaction.id &&
            !processedIds.has(t.id) &&
            !t.isDuplicate &&
            !this.isSameSplitGroup(transaction, t) &&
            !this.isDifferentAccount(transaction, t, accountByStatement),
        )
        .map(candidate => ({
          candidate,
          ...this.calculateSimilarity(transaction, candidate),
        }))
        .filter(result => result.similarity >= threshold);

      if (candidates.length > 0) {
        const master = transaction; // First occurrence is master
        const duplicates: DuplicateCandidate[] = candidates.map(c => ({
          transaction: c.candidate,
          similarity: c.similarity,
          matchType: c.matchType,
          matchedFields: c.matchedFields,
        }));

        const avgConfidence =
          duplicates.reduce((sum, d) => sum + d.similarity, 0) / duplicates.length;

        duplicateGroups.push({
          master,
          duplicates,
          confidence: avgConfidence,
        });

        processedIds.add(master.id);
        for (const d of duplicates) {
          processedIds.add(d.transaction.id);
        }
      }
    }

    this.logger.log(`Found ${duplicateGroups.length} duplicate groups`);
    return duplicateGroups;
  }

  /**
   * Mark transactions as duplicates
   * @param duplicateGroups Groups of duplicates to mark
   */
  async markDuplicates(duplicateGroups: DuplicateGroup[]): Promise<number> {
    let markedCount = 0;

    for (const group of duplicateGroups) {
      for (const duplicate of group.duplicates) {
        // A row on a filed tax return stays counted: flagging it would take it
        // out of the totals that return was built from.
        if (duplicate.transaction.taxLocked) {
          continue;
        }
        await this.transactionRepository.update(duplicate.transaction.id, {
          isDuplicate: true,
          duplicateOfId: group.master.id,
          duplicateConfidence: duplicate.similarity,
          duplicateMatchType: duplicate.matchType,
        });
        markedCount++;
      }
    }

    this.logger.log(`Marked ${markedCount} transactions as duplicates`);
    return markedCount;
  }

  /**
   * Merge duplicate transactions into master
   * @param transactionIds IDs of transactions to merge (first is master)
   * @param workspaceId Workspace ID — scopes the merge to the caller's own transactions
   */
  async mergeDuplicates(transactionIds: string[], workspaceId: string): Promise<Transaction> {
    if (transactionIds.length < 2) {
      throw new BadRequestException('At least 2 transactions required for merge');
    }

    const transactions = await this.transactionRepository.findBy({
      id: In(transactionIds),
      workspaceId,
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException('One or more transactions not found');
    }

    const master = transactions.find(row => row.id === transactionIds[0]) ?? transactions[0];
    const duplicates = transactions.filter(row => row.id !== master.id);
    const locked = duplicates.filter(row => row.taxLocked).length;
    if (locked > 0) {
      throw taxLockedConflict(locked);
    }

    // Mark duplicates
    for (const duplicate of duplicates) {
      await this.transactionRepository.update(duplicate.id, {
        isDuplicate: true,
        duplicateOfId: master.id,
        duplicateConfidence: 1.0,
        duplicateMatchType: 'manual',
      });
    }

    return master;
  }

  /**
   * Unmark transaction as duplicate
   * @param workspaceId Workspace ID — scopes the update to the caller's own transaction
   */
  async unmarkDuplicate(transactionId: string, workspaceId: string): Promise<Transaction> {
    const existing = await this.transactionRepository.findOneBy({ id: transactionId, workspaceId });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    await this.transactionRepository.update(transactionId, {
      isDuplicate: false,
      duplicateOfId: null,
      duplicateConfidence: null,
      duplicateMatchType: null,
    });

    const transaction = await this.transactionRepository.findOneBy({ id: transactionId });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Get transactions to check for duplicates
   */
  private async getTransactionsToCheck(
    workspaceId: string,
    statementId?: string,
  ): Promise<Transaction[]> {
    const where: FindOptionsWhere<Transaction> = {
      workspaceId,
      isDuplicate: false,
    };

    if (statementId) {
      where.statementId = statementId;
    }

    return this.transactionRepository.find({
      where,
      order: {
        transactionDate: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Two cards charged the same coffee on the same day are two coffees. A row
   * can only duplicate a row from the same account (an overlapping re-import)
   * or from an account we cannot name. The wallet is not used: classification
   * puts the default wallet on every row, so it would merge all accounts.
   */
  private isDifferentAccount(
    t1: Transaction,
    t2: Transaction,
    accountByStatement: Map<string, string>,
  ): boolean {
    const key = (t: Transaction): string | null => {
      if (t.cryptoWalletId) return `crypto:${t.cryptoWalletId}`;
      const account = t.statementId ? accountByStatement.get(t.statementId) : undefined;
      return account ? `account:${account}` : null;
    };
    const key1 = key(t1);
    const key2 = key(t2);
    return key1 !== null && key2 !== null && key1 !== key2;
  }

  /** statementId → account number, for the statements the rows came from. */
  private async loadAccountNumbers(transactions: Transaction[]): Promise<Map<string, string>> {
    const ids = [...new Set(transactions.map(t => t.statementId).filter(Boolean))] as string[];
    const result = new Map<string, string>();
    const manager = this.transactionRepository.manager;
    // Unit tests hand in a bare repository mock without a manager; without
    // account numbers every row simply counts as "unknown account".
    if (ids.length === 0 || typeof manager?.getRepository !== 'function') {
      return result;
    }
    const statements = await manager.getRepository(Statement).find({
      where: { id: In(ids) },
      select: {
        id: true,
        accountNumber: true,
      },
    });
    for (const statement of statements) {
      const account = statement.accountNumber?.trim();
      if (account) {
        result.set(statement.id, account);
      }
    }
    return result;
  }

  /**
   * Parts of the same split share date, counterparty and purpose by construction,
   * and an even split makes them identical — an exact 1.0 match. They are never
   * duplicates of each other, but they stay comparable against unrelated rows.
   */
  private isSameSplitGroup(t1: Transaction, t2: Transaction): boolean {
    return Boolean(t1.splitGroupId) && t1.splitGroupId === t2.splitGroupId;
  }

  /**
   * A charge and its own refund/reversal (or two unrelated payments that
   * merely net to the same figure) can land within the same date/amount
   * tolerance window without being the same transaction. Direction and
   * currency are the two signals that distinguish them, so a mismatch on
   * either rules out a duplicate regardless of how similar everything else
   * scores.
   */
  private hasDirectionOrCurrencyMismatch(t1: Transaction, t2: Transaction): boolean {
    const direction1 =
      t1.debit && t1.debit > 0 ? 'debit' : t1.credit && t1.credit > 0 ? 'credit' : null;
    const direction2 =
      t2.debit && t2.debit > 0 ? 'debit' : t2.credit && t2.credit > 0 ? 'credit' : null;
    if (direction1 && direction2 && direction1 !== direction2) {
      return true;
    }

    const currency1 = t1.currency?.trim().toUpperCase();
    const currency2 = t2.currency?.trim().toUpperCase();
    return Boolean(currency1 && currency2 && currency1 !== currency2);
  }

  /**
   * Calculate similarity between two transactions
   */
  private calculateSimilarity(
    t1: Transaction,
    t2: Transaction,
  ): {
    similarity: number;
    matchType: 'exact' | 'fuzzy' | 'semantic' | 'hybrid';
    matchedFields: string[];
  } {
    if (this.hasDirectionOrCurrencyMismatch(t1, t2)) {
      return { similarity: 0, matchType: 'fuzzy', matchedFields: [] };
    }

    const scores: Record<string, number> = {};
    const matchedFields: string[] = [];

    // Date similarity (±1 day = 1.0, ±7 days = linear decrease)
    const dateDiff = Math.abs(
      new Date(t1.transactionDate).getTime() - new Date(t2.transactionDate).getTime(),
    );
    const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
    scores.date = Math.max(0, 1 - daysDiff / 7);
    if (scores.date > 0.8) {
      matchedFields.push('date');
    }

    // Amount similarity (exact match or ±2%)
    const amount1 = t1.debit || t1.credit || t1.amount || 0;
    const amount2 = t2.debit || t2.credit || t2.amount || 0;
    if (amount1 === amount2) {
      scores.amount = 1.0;
      matchedFields.push('amount');
    } else {
      const amountDiff = Math.abs(amount1 - amount2);
      const amountAvg = (Math.abs(amount1) + Math.abs(amount2)) / 2;
      scores.amount = Math.max(0, 1 - amountDiff / (amountAvg * 0.02));
      if (scores.amount > 0.9) {
        matchedFields.push('amount');
      }
    }

    // Counterparty similarity (Levenshtein-based fuzzy match)
    scores.counterparty = this.stringSimilarity(
      t1.counterpartyName.toLowerCase(),
      t2.counterpartyName.toLowerCase(),
    );
    if (scores.counterparty > 0.8) {
      matchedFields.push('counterparty');
    }

    // Purpose similarity
    scores.purpose = this.stringSimilarity(
      t1.paymentPurpose.toLowerCase(),
      t2.paymentPurpose.toLowerCase(),
    );
    if (scores.purpose > 0.7) {
      matchedFields.push('purpose');
    }

    // Document number (if both have it)
    if (t1.documentNumber && t2.documentNumber) {
      scores.documentNumber = t1.documentNumber === t2.documentNumber ? 1.0 : 0;
      if (scores.documentNumber === 1.0) {
        matchedFields.push('documentNumber');
      }
    }

    // Calculate weighted overall similarity
    const weights = {
      date: 0.25,
      amount: 0.35,
      counterparty: 0.25,
      purpose: 0.15,
    };

    const overallSimilarity =
      scores.date * weights.date +
      scores.amount * weights.amount +
      scores.counterparty * weights.counterparty +
      scores.purpose * weights.purpose;

    // Determine match type
    let matchType: 'exact' | 'fuzzy' | 'semantic' | 'hybrid' = 'fuzzy';
    if (
      scores.date === 1.0 &&
      scores.amount === 1.0 &&
      scores.counterparty === 1.0 &&
      scores.purpose === 1.0
    ) {
      matchType = 'exact';
    } else if (overallSimilarity > 0.9) {
      matchType = 'hybrid';
    } else if (scores.purpose > 0.8 || scores.counterparty > 0.8) {
      matchType = 'semantic';
    }

    return {
      similarity: overallSimilarity,
      matchType,
      matchedFields,
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) {
      return 1.0;
    }
    if (s1.length === 0 || s2.length === 0) {
      return 0;
    }

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    const maxLength = Math.max(s1.length, s2.length);
    return 1 - matrix[s2.length][s1.length] / maxLength;
  }

  private getMinDate(transactions: Transaction[]): Date {
    return transactions.reduce(
      (min, t) => (t.transactionDate < min ? t.transactionDate : min),
      transactions[0].transactionDate,
    );
  }

  private getMaxDate(transactions: Transaction[]): Date {
    return transactions.reduce(
      (max, t) => (t.transactionDate > max ? t.transactionDate : max),
      transactions[0].transactionDate,
    );
  }
}
