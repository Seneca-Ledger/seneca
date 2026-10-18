import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionEmbedding } from '../../entities';
import { EMBEDDING_MODEL_ID, TextEmbeddingService } from './text-embedding.service';

export interface SearchHit {
  transactionId: string;
  counterpartyName: string;
  paymentPurpose: string;
  transactionDate: string;
  amount: number | null;
  currency: string;
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  /** True when the candidate cap was reached and older rows were not scored. */
  truncated: boolean;
  /** Transactions in this workspace with no vector yet. */
  pendingEmbeddings: number;
}

export interface BackfillResult {
  embedded: number;
  remaining: number;
}

/**
 * Brute-force vector search, deliberately without pgvector.
 *
 * The deployment runs postgres:14-alpine with no vector extension, and a
 * personal-finance workspace holds thousands of transactions, not millions.
 * Scoring them in memory avoids an extension and a base-image change. The cap
 * below is where that trade-off stops holding.
 */
const MAX_CANDIDATES = 20000;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;
const BACKFILL_BATCH = 200;

@Injectable()
export class TransactionSearchService {
  private readonly logger = new Logger(TransactionSearchService.name);

  constructor(
    @InjectRepository(TransactionEmbedding)
    private readonly embeddings: Repository<TransactionEmbedding>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    private readonly embedder: TextEmbeddingService,
  ) {}

  /** Text a transaction is indexed and matched by. */
  private searchableText(transaction: Transaction): string {
    return [transaction.counterpartyName, transaction.paymentPurpose].filter(Boolean).join(' — ');
  }

  async search(workspaceId: string, query: string, limit = DEFAULT_LIMIT): Promise<SearchResult> {
    const capped = Math.min(Math.max(1, limit), MAX_LIMIT);
    const pendingEmbeddings = await this.countPending(workspaceId);

    const rows = await this.embeddings.find({
      where: { workspaceId, modelId: EMBEDDING_MODEL_ID },
      take: MAX_CANDIDATES + 1,
    });

    const truncated = rows.length > MAX_CANDIDATES;
    if (truncated) {
      rows.length = MAX_CANDIDATES;
      this.logger.warn({
        type: 'transaction_search_truncated',
        workspaceId,
        cap: MAX_CANDIDATES,
      });
    }

    if (rows.length === 0) {
      return { hits: [], truncated, pendingEmbeddings };
    }

    const [queryVector] = await this.embedder.embed([query]);

    const scored = rows
      .map(row => ({ transactionId: row.transactionId, score: dot(queryVector, row.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, capped);

    return { hits: await this.hydrate(workspaceId, scored), truncated, pendingEmbeddings };
  }

  /**
   * Embeds a batch of not-yet-indexed transactions. Returns how many are left so
   * a caller can loop without this method deciding how long to run.
   */
  async backfill(workspaceId: string, batchSize = BACKFILL_BATCH): Promise<BackfillResult> {
    const pending = await this.findPending(workspaceId, batchSize);

    if (pending.length === 0) {
      return { embedded: 0, remaining: 0 };
    }

    const vectors = await this.embedder.embed(pending.map(row => this.searchableText(row)));

    await this.embeddings.save(
      pending.map((transaction, index) =>
        this.embeddings.create({
          transactionId: transaction.id,
          workspaceId,
          vector: Array.from(vectors[index]),
          modelId: EMBEDDING_MODEL_ID,
        }),
      ),
    );

    return { embedded: pending.length, remaining: await this.countPending(workspaceId) };
  }

  private async hydrate(
    workspaceId: string,
    scored: Array<{ transactionId: string; score: number }>,
  ): Promise<SearchHit[]> {
    if (scored.length === 0) {
      return [];
    }

    const rows = await this.transactions.find({
      where: scored.map(item => ({ id: item.transactionId, workspaceId })),
    });
    const byId = new Map(rows.map(row => [row.id, row]));

    return scored.flatMap(item => {
      const transaction = byId.get(item.transactionId);
      if (!transaction) {
        return [];
      }

      return [
        {
          transactionId: transaction.id,
          counterpartyName: transaction.counterpartyName,
          paymentPurpose: transaction.paymentPurpose,
          transactionDate: String(transaction.transactionDate),
          amount: transaction.debit ?? transaction.credit ?? null,
          currency: transaction.currency,
          score: item.score,
        },
      ];
    });
  }

  private pendingQuery(workspaceId: string) {
    return this.transactions
      .createQueryBuilder('transaction')
      .leftJoin(
        TransactionEmbedding,
        'embedding',
        'embedding.transaction_id = transaction.id AND embedding.model_id = :modelId',
        { modelId: EMBEDDING_MODEL_ID },
      )
      .where('transaction.workspace_id = :workspaceId', { workspaceId })
      .andWhere('embedding.id IS NULL');
  }

  private async findPending(workspaceId: string, take: number): Promise<Transaction[]> {
    return (
      this.pendingQuery(workspaceId)
        // The property, not the column: with take() and a join TypeORM resolves it by metadata.
        .orderBy('transaction.transactionDate', 'DESC')
        .take(take)
        .getMany()
    );
  }

  private async countPending(workspaceId: string): Promise<number> {
    return this.pendingQuery(workspaceId).getCount();
  }
}

/** Both vectors are L2-normalised, so the dot product is the cosine. */
export function dot(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    sum += a[index] * b[index];
  }

  return sum;
}
