import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { Receipt } from '../../../entities/receipt.entity';
import { Transaction } from '../../../entities/transaction.entity';
import {
  type MatchCandidate,
  matchReceiptToTransactions,
  RECEIPT_MULTI_DATE_WINDOW_DAYS,
  type ReceiptMatchInput,
  type ReceiptTransactionMatch,
  type ScoredCandidate,
  scoreCandidates,
} from './receipt-transaction-match';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The manual picker looks further and loosens the amount: a tip or a fee is what it is for. */
const PICKER_WINDOW_DAYS = 7;
const PICKER_LIMIT = 10;

/**
 * Finds the bank row a parsed receipt documents, so approving the receipt
 * attaches it to that row instead of booking the same expense twice. Rows
 * already documented by another receipt are never offered.
 */
@Injectable()
export class ReceiptMatchService {
  private readonly logger = new Logger(ReceiptMatchService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  private inputOf(receipt: Receipt): ReceiptMatchInput | null {
    const amount = Number(receipt.parsedData?.amount);
    const date = receipt.parsedData?.date;
    if (!Number.isFinite(amount) || amount <= 0 || !date || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return null;
    }
    return {
      amount,
      currency: receipt.parsedData?.currency ?? null,
      date: date.slice(0, 10),
      vendor: receipt.parsedData?.vendor ?? null,
      transactionType: receipt.parsedData?.transactionType,
    };
  }

  /** Unlinked, non-duplicate, non-transfer rows of the workspace around the receipt's date. */
  private async loadCandidates(
    receipt: Receipt,
    input: ReceiptMatchInput,
    windowDays: number,
  ): Promise<MatchCandidate[]> {
    const at = new Date(input.date as string).getTime();
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .where('t.workspaceId = :workspaceId', { workspaceId: receipt.workspaceId })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('t.splitGroupId IS NULL')
      .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)')
      .andWhere('t.transactionDate BETWEEN :since AND :until', {
        since: new Date(at - windowDays * DAY_MS),
        until: new Date(at + windowDays * DAY_MS),
      })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM receipts r WHERE r.transaction_id = t.id AND r.id != :receiptId)',
        { receiptId: receipt.id },
      )
      .getMany();
    return rows.map(row => ({
      id: row.id,
      transactionDate: row.transactionDate,
      amount: Math.abs(Number(row.amount) || Number(row.debit) || Number(row.credit) || 0),
      currency: row.currency,
      counterpartyName: row.counterpartyName,
      vendorNormalized: row.vendorNormalized,
      transactionType: row.transactionType,
    }));
  }

  /** Computes the suggestion and stores it on the receipt's metadata (null when nothing fits). */
  async suggest(receipt: Receipt): Promise<ReceiptTransactionMatch | null> {
    const input = this.inputOf(receipt);
    let match: ReceiptTransactionMatch | null = null;
    if (input) {
      try {
        const candidates = await this.loadCandidates(
          receipt,
          input,
          RECEIPT_MULTI_DATE_WINDOW_DAYS,
        );
        match = matchReceiptToTransactions(input, candidates);
      } catch (error) {
        this.logger.warn(
          `Receipt match failed for ${receipt.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    receipt.metadata = {
      ...(receipt.metadata ?? {}),
      transactionMatch: match ? { ...match, computedAt: new Date().toISOString() } : null,
    };
    return match;
  }

  /** Candidates for the manual picker, best first. */
  async candidates(
    receipt: Receipt,
  ): Promise<Array<ScoredCandidate & { candidate: MatchCandidate }>> {
    const input = this.inputOf(receipt);
    if (!input) return [];
    const rows = await this.loadCandidates(receipt, input, PICKER_WINDOW_DAYS);
    const scored = scoreCandidates(input, rows, PICKER_WINDOW_DAYS);
    const seen = new Set(scored.map(entry => entry.candidate.id));
    // Amount mismatches (a tip, a fee) still deserve a place at the bottom of the list.
    const loose = rows
      .filter(row => !seen.has(row.id))
      .map(row => ({
        candidate: row,
        score: 0,
        daysApart:
          Math.abs(
            new Date(row.transactionDate).getTime() - new Date(input.date as string).getTime(),
          ) / DAY_MS,
        vendorSimilarity: 0,
      }))
      .sort(
        (a, b) =>
          Math.abs(a.candidate.amount - input.amount) - Math.abs(b.candidate.amount - input.amount),
      );
    return [...scored, ...loose].slice(0, PICKER_LIMIT);
  }

  /** Re-runs the suggestion for one receipt and persists it. */
  async refresh(receiptId: string, workspaceId: string): Promise<Receipt | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id: receiptId, workspaceId } });
    if (!receipt) return null;
    await this.suggest(receipt);
    return this.receiptRepository.save(receipt);
  }
}
