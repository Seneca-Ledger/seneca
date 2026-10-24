import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ZipArchive } from 'archiver';
import { In, Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { FileStorageService } from '../../common/services/file-storage.service';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { toCsv } from '../../common/utils/csv.util';
import { sanitizeArchiveEntryName } from '../../common/utils/filename.util';
import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../common/utils/money.util';
import { canReadPrivate } from '../../common/utils/transaction-privacy.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { Receipt } from '../../entities/receipt.entity';
import { FileType, Statement } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { TransactionAttachment } from '../../entities/transaction-attachment.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { toDateOnly } from '../tax/jurisdictions.service';

export type TaxPackScope = 'relevant' | 'all';

/** SQL for "this row matters for the tax return": its own mark, else its category's. */
const RELEVANT_SQL = '(t.taxRelevant = true OR (t.taxRelevant IS NULL AND c.taxRelevant = true))';

/** Only documents a person would hand over; bank CSV/XLSX exports are already the CSV rows. */
const DOCUMENT_FILE_TYPES: ReadonlySet<FileType> = new Set([FileType.PDF, FileType.IMAGE]);

const MAX_RANGE_DAYS = 3 * 366;

export interface TaxYearCategory {
  categoryId: string | null;
  name: string;
  type: 'income' | 'expense';
  count: number;
  total: number;
  documentCount: number;
}

export interface TaxYearRow {
  id: string;
  date: string;
  counterparty: string;
  categoryId: string | null;
  categoryName: string | null;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  /** In the workspace currency at the rate of the row's day; null without a rate. */
  converted: number | null;
  documentCount: number;
  /** Marked on the row itself rather than inherited from its category. */
  markedOnRow: boolean;
}

export interface TaxYearReport {
  year: number;
  currency: string;
  categories: TaxYearCategory[];
  rows: TaxYearRow[];
  total: { income: number; expense: number };
  missingRateCurrencies: string[];
}

interface PackDocument {
  transactionId: string | null;
  entryName: string;
  open: () => Promise<NodeJS.ReadableStream | Buffer | null>;
}

/**
 * What a user hands to their accountant or keeps for the tax office: the
 * year's tax-relevant rows (or all of them), with every receipt and invoice
 * behind them, in one archive.
 *
 * The archive is built from the same "counted" rows as every report — the
 * ones confirmed in Review, not duplicates, not in the trash — and leaves out
 * other members' private rows entirely.
 */
@Injectable()
export class TaxPackService {
  private readonly logger = new Logger(TaxPackService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionAttachment)
    private readonly attachmentRepository: Repository<TransactionAttachment>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly fileStorageService: FileStorageService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async yearReport(
    workspaceId: string,
    year: number,
    viewerMemberId: string | null,
  ): Promise<TaxYearReport> {
    const currency = await this.workspaceCurrency(workspaceId);
    const rows = await this.loadRows(
      workspaceId,
      `${year}-01-01`,
      `${year}-12-31`,
      'relevant',
      viewerMemberId,
    );
    const documents = await this.collectDocuments(workspaceId, rows);
    const documentCount = countBy(documents.map(doc => doc.transactionId));
    const missing = new Set<string>();
    const convert = this.converter(workspaceId, currency, missing);

    const reportRows: TaxYearRow[] = [];
    const byCategory = new Map<string, TaxYearCategory>();
    let incomeMinor = 0;
    let expenseMinor = 0;

    for (const row of rows) {
      const amount = rowAmount(row);
      const type = row.transactionType === TransactionType.INCOME ? 'income' : 'expense';
      const converted = await convert(amount, row.currency, toDateOnly(row.transactionDate));
      const docs = documentCount.get(row.id) ?? 0;
      reportRows.push({
        id: row.id,
        date: toDateOnly(row.transactionDate),
        counterparty: row.counterpartyName,
        categoryId: row.categoryId,
        categoryName: row.category?.name ?? null,
        type,
        amount,
        currency: row.currency,
        converted,
        documentCount: docs,
        markedOnRow: row.taxRelevant === true,
      });

      const key = `${row.categoryId ?? 'none'}:${type}`;
      const entry = byCategory.get(key) ?? {
        categoryId: row.categoryId,
        name: row.category?.name ?? '—',
        type,
        count: 0,
        total: 0,
        documentCount: 0,
      };
      entry.count++;
      entry.documentCount += docs;
      if (converted !== null) {
        entry.total = fromMinor(toMinor(entry.total) + toMinor(converted));
        if (type === 'income') {
          incomeMinor += toMinor(converted);
        } else {
          expenseMinor += toMinor(converted);
        }
      }
      byCategory.set(key, entry);
    }

    return {
      year,
      currency,
      categories: [...byCategory.values()].sort((a, b) => b.total - a.total),
      rows: reportRows,
      total: { income: fromMinor(incomeMinor), expense: fromMinor(expenseMinor) },
      missingRateCurrencies: [...missing],
    };
  }

  /** Streams the archive into `output`. */
  async writePack(
    workspaceId: string,
    options: { from: string; to: string; scope: TaxPackScope },
    viewerMemberId: string | null,
    output: NodeJS.WritableStream,
  ): Promise<void> {
    const { from, to, scope } = options;
    if (to < from) {
      throw new BadRequestException('The period must not end before it starts');
    }
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days > MAX_RANGE_DAYS) {
      throw new BadRequestException('A tax pack covers at most three years');
    }

    const currency = await this.workspaceCurrency(workspaceId);
    const rows = await this.loadRows(workspaceId, from, to, scope, viewerMemberId);
    const documents = await this.collectDocuments(workspaceId, rows);
    const missing = new Set<string>();
    const convert = this.converter(workspaceId, currency, missing);

    const namesByTransaction = new Map<string, string[]>();
    for (const doc of documents) {
      if (doc.transactionId) {
        const list = namesByTransaction.get(doc.transactionId) ?? [];
        list.push(doc.entryName);
        namesByTransaction.set(doc.transactionId, list);
      }
    }

    const header = [
      'Date',
      'Counterparty',
      'Purpose',
      'Category',
      'Type',
      'Amount',
      'Currency',
      `Amount (${currency})`,
      'Exchange rate',
      'Tax relevant',
      'VAT rate',
      'VAT amount',
      'Net amount',
      'Reverse charge',
      'On a filed VAT return',
      'Documents',
    ];
    const lines: Array<Array<string | number | null>> = [header];
    const summary = new Map<
      string,
      { category: string; type: string; count: number; total: number }
    >();

    for (const row of rows) {
      const amount = rowAmount(row);
      const date = toDateOnly(row.transactionDate);
      const converted = await convert(amount, row.currency, date);
      const type = row.transactionType === TransactionType.INCOME ? 'income' : 'expense';
      const relevant =
        row.taxRelevant === true ||
        (row.taxRelevant === null && row.category?.taxRelevant === true);
      lines.push([
        date,
        row.counterpartyName,
        row.paymentPurpose,
        row.category?.name ?? '',
        type,
        amount,
        row.currency,
        converted,
        converted !== null && amount !== 0 ? round6(converted / amount) : null,
        relevant ? 'yes' : 'no',
        row.taxRate?.name ?? '',
        row.taxAmount !== null ? Number(row.taxAmount) : null,
        row.taxNetAmount !== null ? Number(row.taxNetAmount) : null,
        row.taxReverseCharge ? 'yes' : 'no',
        row.taxLocked ? 'yes' : 'no',
        (namesByTransaction.get(row.id) ?? []).join('; '),
      ]);

      const key = `${row.category?.name ?? '—'}:${type}`;
      const entry = summary.get(key) ?? {
        category: row.category?.name ?? '—',
        type,
        count: 0,
        total: 0,
      };
      entry.count++;
      entry.total = fromMinor(toMinor(entry.total) + toMinor(converted ?? 0));
      summary.set(key, entry);
    }

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('warning', error => this.logger.warn(`Tax pack: ${error.message}`));
    archive.pipe(output);

    archive.append(toCsv(lines), { name: 'transactions.csv' });
    archive.append(
      toCsv([
        ['Category', 'Type', 'Transactions', `Total (${currency})`],
        ...[...summary.values()]
          .sort((a, b) => a.type.localeCompare(b.type) || b.total - a.total)
          .map(entry => [entry.category, entry.type, entry.count, entry.total]),
      ]),
      { name: 'summary.csv' },
    );
    archive.append(
      readme({ from, to, scope, currency, rows: rows.length, documents, missing: [...missing] }),
      { name: 'README.txt' },
    );

    for (const doc of documents) {
      try {
        const content = await doc.open();
        if (content) {
          archive.append(content as never, { name: doc.entryName });
        }
      } catch (error) {
        this.logger.warn(
          `Tax pack: skipped ${doc.entryName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await archive.finalize();
  }

  private async loadRows(
    workspaceId: string,
    from: string,
    to: string,
    scope: TaxPackScope,
    viewerMemberId: string | null,
  ): Promise<Transaction[]> {
    const query = onlyCounted(
      this.transactionRepository
        .createQueryBuilder('t')
        .leftJoinAndSelect('t.category', 'c')
        .leftJoinAndSelect('t.taxRate', 'r')
        .where('t.workspaceId = :workspaceId', { workspaceId })
        .andWhere('t.transferPairId IS NULL')
        .andWhere('t.transactionDate BETWEEN :from AND :to', { from, to }),
      't',
    );
    if (scope === 'relevant') {
      query.andWhere(RELEVANT_SQL);
    }
    const rows = await query
      .orderBy('t.transactionDate', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .getMany();
    // Another member's private row is theirs alone, in a tax pack as everywhere.
    return rows.filter(row => canReadPrivate(row, viewerMemberId));
  }

  /**
   * Every file behind the rows: attachments pinned to a row, the files of a
   * receipt booked to it, and the scanned or PDF document the row was read
   * from. A bank statement PDF covers many rows and is added once.
   */
  private async collectDocuments(
    workspaceId: string,
    rows: Transaction[],
  ): Promise<PackDocument[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map(row => row.id);
    const rowById = new Map(rows.map(row => [row.id, row]));
    const names = new Set<string>();
    const unique = (base: string): string => {
      const ext = path.extname(base);
      const stem = base.slice(0, base.length - ext.length);
      let name = base;
      for (let n = 2; names.has(name); n++) {
        name = `${stem}_${n}${ext}`;
      }
      names.add(name);
      return name;
    };
    const documentName = (row: Transaction, original: string): string =>
      unique(
        `documents/${sanitizeArchiveEntryName(
          `${toDateOnly(row.transactionDate)}_${row.counterpartyName || 'document'}_${rowAmount(row)}_${row.currency}${extensionOf(original)}`,
        )}`,
      );

    const documents: PackDocument[] = [];
    const uploadsDir = path.resolve(resolveUploadsDir());

    for (const chunk of chunks(ids, 1000)) {
      const attachments = await this.attachmentRepository.find({
        where: { workspaceId, transactionId: In(chunk) },
        order: { createdAt: 'ASC' },
      });
      for (const attachment of attachments) {
        const row = rowById.get(attachment.transactionId) as Transaction;
        const filePath = path.join(
          uploadsDir,
          'transaction-attachments',
          path.basename(attachment.storedFileName),
        );
        documents.push({
          transactionId: row.id,
          entryName: documentName(row, attachment.fileName),
          open: async () => (fs.existsSync(filePath) ? fs.createReadStream(filePath) : null),
        });
      }

      const receipts = await this.receiptRepository.find({
        where: { workspaceId, transactionId: In(chunk) },
        select: { id: true, transactionId: true, attachmentPaths: true },
      });
      for (const receipt of receipts) {
        const row = rowById.get(receipt.transactionId as string) as Transaction;
        for (const stored of receipt.attachmentPaths ?? []) {
          const resolved = path.resolve(stored);
          // Paths come from the database; only files under the uploads dir are read.
          if (!resolved.startsWith(`${uploadsDir}${path.sep}`)) {
            continue;
          }
          documents.push({
            transactionId: row.id,
            entryName: documentName(row, stored),
            open: async () => (fs.existsSync(resolved) ? fs.createReadStream(resolved) : null),
          });
        }
      }
    }

    const statementIds = [...new Set(rows.map(row => row.statementId).filter(Boolean))] as string[];
    for (const chunk of chunks(statementIds, 1000)) {
      const statements = await this.statementRepository.find({
        where: { workspaceId, id: In(chunk) },
        select: {
          id: true,
          fileName: true,
          filePath: true,
          fileType: true,
          fileHash: true,
          userId: true,
          totalTransactions: true,
        },
      });
      for (const statement of statements) {
        if (!DOCUMENT_FILE_TYPES.has(statement.fileType)) {
          continue;
        }
        const own = rows.filter(row => row.statementId === statement.id);
        const open = async () =>
          (await this.fileStorageService.getStatementFileStream(statement)).stream;
        // A scan or a single-document upload is that row's receipt. A bank
        // statement PDF stays a statement even when only one of its rows is
        // in the pack.
        const singleDocument =
          statement.fileType === FileType.IMAGE || Number(statement.totalTransactions ?? 0) <= 1;
        if (own.length === 1 && singleDocument) {
          documents.push({
            transactionId: own[0].id,
            entryName: documentName(own[0], statement.fileName),
            open,
          });
        } else {
          documents.push({
            transactionId: null,
            entryName: unique(`statements/${sanitizeArchiveEntryName(statement.fileName)}`),
            open,
          });
        }
      }
    }

    return documents;
  }

  private async workspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, currency: true },
    });
    return (workspace?.currency ?? 'EUR').toUpperCase();
  }

  private converter(workspaceId: string, to: string, missing: Set<string>) {
    const cache = new Map<string, number | null>();
    return async (amount: number, from: string, date: string): Promise<number | null> => {
      const source = (from || to).toUpperCase();
      if (source === to) {
        return amount;
      }
      const key = `${source}:${date}`;
      if (!cache.has(key)) {
        cache.set(
          key,
          await this.exchangeRatesService.getRateOrNull(source, to, date, workspaceId),
        );
      }
      const rate = cache.get(key) ?? null;
      if (rate === null) {
        missing.add(source);
        return null;
      }
      return fromMinor(roundHalfAwayFromZero(toMinor(amount) * rate));
    };
  }
}

function rowAmount(row: Transaction): number {
  const raw =
    row.amount ?? (row.transactionType === TransactionType.INCOME ? row.credit : row.debit);
  const value = Math.abs(Number(raw ?? 0));
  return Number.isFinite(value) ? value : 0;
}

function extensionOf(name: string): string {
  const ext = path.extname(name || '').toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function countBy(keys: Array<string | null>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function readme(input: {
  from: string;
  to: string;
  scope: TaxPackScope;
  currency: string;
  rows: number;
  documents: PackDocument[];
  missing: string[];
}): string {
  const lines = [
    `${APP_NAME} tax pack`,
    '==============',
    '',
    `Period: ${input.from} to ${input.to}`,
    `Contents: ${input.scope === 'relevant' ? 'transactions marked as tax relevant' : 'all transactions'}`,
    `Transactions: ${input.rows}`,
    `Documents: ${input.documents.length}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'transactions.csv  every transaction, with the VAT figures the app assessed and',
    '                  the documents that belong to it',
    'summary.csv       totals per category, in the workspace currency',
    'documents/        receipts, invoices and scans, named date_counterparty_amount',
    'statements/       statement PDFs that cover more than one transaction',
    '',
    `Amounts in ${input.currency} are converted at the exchange rate of each transaction's own day.`,
    'Only transactions confirmed in Review are included; duplicates and trashed statements are not.',
    'Bank CSV/XLSX exports are not repeated here: their rows are in transactions.csv.',
  ];
  if (input.missing.length > 0) {
    lines.push(
      '',
      `No exchange rate was available for some rows in ${input.missing.join(', ')}; their converted amount is empty.`,
    );
  }
  lines.push(
    '',
    'This pack is prepared from your own records. It is not a tax return and has not been',
    'filed anywhere. Check it, or hand it to your tax adviser.',
    '',
  );
  return lines.join('\n');
}
