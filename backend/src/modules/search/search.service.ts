import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { Payable, PayableDirection } from '../../entities/payable.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { type DocumentFile, documentFile, documentHref, findScanReceipts } from './document-href';

export type SearchResultKind = 'transaction' | 'statement' | 'payable' | 'receivable' | 'category';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  /** What holding Space over the result previews; null when there is no file to show. */
  document: DocumentFile | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

/** Per-kind cap, so one noisy source can't crowd out the others. */
const PER_KIND_LIMIT = 5;
/** Shorter needles match nearly everything and make the query pointless. */
const MIN_QUERY_LENGTH = 2;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepo: Repository<Statement>,
    @InjectRepository(Payable)
    private readonly payableRepo: Repository<Payable>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
  ) {}

  async search(
    workspaceId: string,
    rawQuery: string,
    viewerMemberId: string | null = null,
  ): Promise<SearchResponse> {
    const query = (rawQuery ?? '').trim();
    if (query.length < MIN_QUERY_LENGTH) {
      return { query, results: [] };
    }

    const needle = `%${query.toLowerCase()}%`;

    const [transactions, statements, payables, categories] = await Promise.all([
      this.searchTransactions(workspaceId, needle, viewerMemberId),
      this.searchStatements(workspaceId, needle),
      this.searchPayables(workspaceId, needle),
      this.searchCategories(workspaceId, needle),
    ]);

    return { query, results: [...transactions, ...statements, ...payables, ...categories] };
  }

  private async searchTransactions(
    workspaceId: string,
    needle: string,
    viewerMemberId: string | null,
  ): Promise<SearchResult[]> {
    const rows = await this.transactionRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.statement', 's')
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('s.deletedAt IS NULL')
      .andWhere(
        '(LOWER(t.counterpartyName) LIKE :needle OR LOWER(t.paymentPurpose) LIKE :needle)',
        { needle },
      )
      // Someone else's private row would be found by the very merchant it hides,
      // so it is left out here rather than redacted after the match.
      .andWhere(
        viewerMemberId === null
          ? 't.isPrivate = false'
          : '(t.isPrivate = false OR t.ownerMemberId = :viewerMemberId)',
        { viewerMemberId },
      )
      .orderBy('t.transactionDate', 'DESC')
      .take(PER_KIND_LIMIT)
      .getMany();

    // The inner join drops rows without a statement; this only tells the compiler.
    const hits = rows.flatMap(row => (row.statement ? [{ row, statement: row.statement }] : []));
    const receipts = await findScanReceipts(
      this.receiptRepo,
      workspaceId,
      hits.map(hit => hit.statement),
    );
    return hits.map(({ row, statement }) => ({
      kind: 'transaction' as const,
      id: row.id,
      title: row.counterpartyName,
      subtitle: row.paymentPurpose || null,
      // A row lives in its document; there is no separate transactions list.
      href: documentHref(statement, receipts),
      document: documentFile(statement, receipts),
    }));
  }

  private async searchStatements(workspaceId: string, needle: string): Promise<SearchResult[]> {
    const rows = await this.statementRepo
      .createQueryBuilder('s')
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('s.deletedAt IS NULL')
      .andWhere('LOWER(s.fileName) LIKE :needle', { needle })
      .orderBy('s.createdAt', 'DESC')
      .take(PER_KIND_LIMIT)
      .getMany();

    return this.toStatementResults(workspaceId, rows);
  }

  /** Latest uploads, newest first — what the search panel shows before anything is typed. */
  async recent(workspaceId: string): Promise<SearchResponse> {
    const rows = await this.statementRepo
      .createQueryBuilder('s')
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('s.deletedAt IS NULL')
      .orderBy('s.createdAt', 'DESC')
      .take(PER_KIND_LIMIT)
      .getMany();

    return { query: '', results: await this.toStatementResults(workspaceId, rows) };
  }

  private async toStatementResults(
    workspaceId: string,
    rows: Statement[],
  ): Promise<SearchResult[]> {
    const receipts = await findScanReceipts(this.receiptRepo, workspaceId, rows);
    return rows.map(row => ({
      kind: 'statement' as const,
      id: row.id,
      title: row.fileName,
      subtitle: row.bankName ?? null,
      href: documentHref(row, receipts),
      document: documentFile(row, receipts),
    }));
  }

  private async searchPayables(workspaceId: string, needle: string): Promise<SearchResult[]> {
    const rows = await this.payableRepo
      .createQueryBuilder('p')
      .where('p.workspaceId = :workspaceId', { workspaceId })
      .andWhere('p.deletedAt IS NULL')
      .andWhere("(LOWER(p.vendor) LIKE :needle OR LOWER(COALESCE(p.comment, '')) LIKE :needle)", {
        needle,
      })
      .orderBy('p.dueDate', 'ASC', 'NULLS LAST')
      .take(PER_KIND_LIMIT)
      .getMany();

    return rows.map(row => {
      const isReceivable = row.direction === PayableDirection.RECEIVABLE;
      return {
        kind: (isReceivable ? 'receivable' : 'payable') as SearchResultKind,
        id: row.id,
        title: row.vendor,
        subtitle: row.comment ?? null,
        href: isReceivable ? '/statements/receive' : '/statements/pay',
        document: null,
      };
    });
  }

  private async searchCategories(workspaceId: string, needle: string): Promise<SearchResult[]> {
    const rows = await this.categoryRepo
      .createQueryBuilder('c')
      .where('c.workspaceId = :workspaceId', { workspaceId })
      .andWhere('LOWER(c.name) LIKE :needle', { needle })
      .orderBy('c.name', 'ASC')
      .take(PER_KIND_LIMIT)
      .getMany();

    return rows.map(row => ({
      kind: 'category' as const,
      id: row.id,
      title: row.name,
      subtitle: null,
      href: '/categories',
      document: null,
    }));
  }
}
