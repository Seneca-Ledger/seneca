import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { generateTransactionFingerprint } from '../../../common/utils/fingerprint.util';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';

/**
 * Service for generating and managing transaction fingerprints.
 * Fingerprints are used for duplicate detection across import sessions.
 */
@Injectable()
export class TransactionFingerprintService {
  private readonly logger = new Logger(TransactionFingerprintService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Generates a stable fingerprint for a transaction.
   * Returns first 32 characters of SHA-256 hash for storage efficiency.
   *
   * @param transaction Transaction entity or partial transaction data
   * @param accountNumber Optional account number (if not in transaction)
   * @returns Fingerprint string (32 hex characters)
   */
  generateFingerprint(
    transaction: Partial<Transaction> & {
      workspaceId: string | null;
      transactionDate: Date;
      amount: number | null;
      debit?: number | null;
      credit?: number | null;
      currency: string;
      transactionType?: TransactionType;
      counterpartyName: string;
    },
    accountNumber?: string,
  ): string {
    // Determine direction from debit/credit or transactionType
    let direction: 'debit' | 'credit';
    if (transaction.debit != null && transaction.debit > 0) {
      direction = 'debit';
    } else if (transaction.credit != null && transaction.credit > 0) {
      direction = 'credit';
    } else if (transaction.transactionType === TransactionType.EXPENSE) {
      direction = 'debit';
    } else {
      direction = 'credit';
    }

    // Use the absolute amount value (debit or credit)
    const amount = transaction.debit || transaction.credit || transaction.amount || 0;

    return generateTransactionFingerprint({
      workspaceId: transaction.workspaceId || '',
      accountNumber: accountNumber || '',
      date: transaction.transactionDate,
      amount,
      currency: transaction.currency,
      direction,
      merchant: transaction.counterpartyName,
    });
  }

  /**
   * Finds a transaction by its fingerprint within a workspace.
   *
   * @param workspaceId Workspace ID to search within
   * @param fingerprint Transaction fingerprint to match
   * @returns Transaction if found, null otherwise
   */
  async findByFingerprint(workspaceId: string, fingerprint: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: {
        workspaceId,
        fingerprint,
      },
    });
  }

  /**
   * Generates fingerprints for multiple transactions in bulk.
   * Returns a map of transaction ID to fingerprint for efficient lookups.
   *
   * @param transactions Array of transactions to process
   * @param accountNumber Account number to use for all transactions
   * @returns Map of transaction ID to fingerprint string
   */
  bulkGenerateFingerprints(
    transactions: Array<
      Partial<Transaction> & {
        id?: string;
        workspaceId: string | null;
        transactionDate: Date;
        amount: number | null;
        debit?: number | null;
        credit?: number | null;
        currency: string;
        transactionType?: TransactionType;
        counterpartyName: string;
      }
    >,
    accountNumber: string,
  ): Map<string, string> {
    this.logger.debug(`Generating ${transactions.length} fingerprints in bulk`);

    const fingerprintMap = new Map<string, string>();

    for (const transaction of transactions) {
      const fingerprint = this.generateFingerprint(transaction, accountNumber);

      // Use transaction ID as key if available, otherwise use a combination of fields
      const key =
        transaction.id ||
        `${transaction.transactionDate.toISOString()}_${transaction.amount}_${transaction.counterpartyName}`;

      fingerprintMap.set(key, fingerprint);
    }

    return fingerprintMap;
  }

  /**
   * Finds all transactions matching a list of fingerprints within a workspace.
   * Useful for batch duplicate detection.
   *
   * @param workspaceId Workspace ID to search within
   * @param fingerprints Array of fingerprints to match
   * @returns Array of matching transactions
   */
  async findByFingerprints(workspaceId: string, fingerprints: string[]): Promise<Transaction[]> {
    if (fingerprints.length === 0) {
      return [];
    }

    return this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.fingerprint IN (:...fingerprints)', { fingerprints })
      .getMany();
  }

  /**
   * Finds candidate transactions within a date and amount window for fuzzy matching.
   *
   * @param workspaceId Workspace ID to search within
   * @param dateRange Date window for candidate search
   * @param amountRanges Amount ranges to include
   * @param limit Maximum number of candidates to return
   * @returns Array of candidate transactions
   */
  async findCandidatesByWindow(
    workspaceId: string,
    dateRange: { start: Date; end: Date },
    amountRanges: Array<{ min: number; max: number }>,
    limit = 1000,
  ): Promise<Transaction[]> {
    if (!workspaceId || amountRanges.length === 0) {
      return [];
    }

    return (
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.transactionDate BETWEEN :start AND :end', {
          start: dateRange.start,
          end: dateRange.end,
        })
        .andWhere(
          new Brackets(qb => {
            amountRanges.forEach((range, i) => {
              qb.orWhere(`transaction.amount BETWEEN :min${i} AND :max${i}`, {
                [`min${i}`]: range.min,
                [`max${i}`]: range.max,
              });
            });
          }),
        )
        // Deterministic order: without it, which rows survive a `take(limit)`
        // truncation is arbitrary and can vary between calls with identical input.
        .orderBy('transaction.transactionDate', 'DESC')
        .take(limit)
        .getMany()
    );
  }

  /**
   * Updates the fingerprint for an existing transaction.
   * Useful for backfilling fingerprints on legacy transactions.
   *
   * @param workspaceId Workspace ID for isolation
   * @param transactionId Transaction ID to update
   * @param fingerprint New fingerprint value
   * @returns Updated transaction
   */
  async updateFingerprint(
    workspaceId: string,
    transactionId: string,
    fingerprint: string,
  ): Promise<Transaction> {
    const result = await this.transactionRepository.update(
      { id: transactionId, workspaceId },
      { fingerprint },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    const updated = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });

    if (!updated) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    return updated;
  }

  /**
   * Generates and saves fingerprints for transactions that don't have them.
   * Useful for backfilling fingerprints on legacy data.
   *
   * @param workspaceId Workspace ID to process
   * @param accountNumber Account number to use for fingerprints
   * @param limit Maximum number of transactions to process in one batch
   * @returns Number of transactions updated
   */
  async backfillFingerprints(
    workspaceId: string,
    accountNumber: string,
    limit = 1000,
  ): Promise<number> {
    this.logger.log(`Backfilling fingerprints for workspace ${workspaceId}, limit: ${limit}`);

    const transactions = await this.transactionRepository.find({
      where: {
        workspaceId,
        fingerprint: IsNull(),
      },
      take: limit,
    });

    if (transactions.length === 0) {
      this.logger.log(
        `No transactions found requiring fingerprint backfill for workspace ${workspaceId}`,
      );
      return 0;
    }

    for (const transaction of transactions) {
      const fingerprint = this.generateFingerprint(transaction, accountNumber);
      transaction.fingerprint = fingerprint;
    }

    await this.transactionRepository.save(transactions);

    this.logger.log(
      `Backfilled ${transactions.length} transaction fingerprints for workspace ${workspaceId}`,
    );
    return transactions.length;
  }
}
