import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { In } from 'typeorm';
import { normalizeFilename } from '../../../common/utils/filename.util';
import { generateTransactionFingerprint } from '../../../common/utils/fingerprint.util';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';
import { BankName, FileType, Statement, StatementStatus } from '../../../entities/statement.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import {
  isBlank,
  normalizeCurrencyCode,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

interface ParsedTx {
  index: number;
  date: string;
  amount: number;
  type: TransactionType;
  merchant: string;
  purpose: string;
  currency: string;
  categoryName: string;
  fingerprint: string;
}

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

/**
 * Rows become one statement plus its transactions, exactly like converting a
 * custom table, so they show up in the statements list and can be deleted
 * together. Sign convention: a negative amount or `type = expense` is a debit.
 */
export class TransactionsTarget implements ImportTarget {
  readonly kind = 'transactions' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const results: RowResult[] = [];
    const parsed: ParsedTx[] = [];
    const parsedValues: Array<{
      index: number;
      date: string;
      value: number;
      cellCurrency: string | null;
      merchant: string;
      row: string[];
    }> = [];
    for (const [index, row] of rows.entries()) {
      const date = parseImportDate(ctx.cell(row, 'date'));
      const { value, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'amount'));
      const merchant = ctx.cell(row, 'merchant').trim();
      if (!date) {
        results.push({ index, status: 'error', reason: 'date' });
        continue;
      }
      if (value === null || value === 0) {
        results.push({ index, status: 'error', reason: 'amount' });
        continue;
      }
      if (!merchant) {
        results.push({ index, status: 'error', reason: 'merchant' });
        continue;
      }
      parsedValues.push({ index, date, value, cellCurrency, merchant, row });
    }
    // Without a type column the sign decides only when the file mixes signs;
    // an all-positive expense sheet must not turn into income.
    const mixedSigns =
      parsedValues.some(item => item.value < 0) && parsedValues.some(item => item.value > 0);
    for (const { index, date, value, cellCurrency, merchant, row } of parsedValues) {
      const typeAlias = resolveEnumAlias('type', ctx.cell(row, 'type'));
      const type =
        typeAlias === 'income'
          ? TransactionType.INCOME
          : typeAlias === 'expense'
            ? TransactionType.EXPENSE
            : mixedSigns && value > 0
              ? TransactionType.INCOME
              : TransactionType.EXPENSE;
      const amount = Math.abs(value);
      const currency =
        normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency;
      const fingerprint = generateTransactionFingerprint({
        workspaceId: ctx.workspaceId,
        accountNumber: '',
        date,
        amount,
        currency,
        direction: type === TransactionType.EXPENSE ? 'debit' : 'credit',
        merchant,
      });
      parsed.push({
        index,
        date,
        amount,
        type,
        merchant,
        purpose: ctx.cell(row, 'purpose').trim(),
        currency,
        categoryName: ctx.cell(row, 'category').trim(),
        fingerprint,
      });
    }

    // Same date+amount+merchant already in the workspace, or twice in the file → skip.
    const seen = new Set<string>();
    const fingerprints = [...new Set(parsed.map(item => item.fingerprint))];
    const existing = fingerprints.length
      ? await ctx.manager.getRepository(Transaction).find({
          where: { workspaceId: ctx.workspaceId, fingerprint: In(fingerprints) },
          select: ['fingerprint'],
        })
      : [];
    for (const item of existing) {
      if (item.fingerprint) {
        seen.add(item.fingerprint);
      }
    }
    const fresh: ParsedTx[] = [];
    for (const item of parsed) {
      if (seen.has(item.fingerprint)) {
        results.push({ index: item.index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      seen.add(item.fingerprint);
      fresh.push(item);
    }
    if (dryRun || !fresh.length) {
      for (const item of fresh) {
        results.push({ index: item.index, status: 'created' });
      }
      return results.sort((a, b) => a.index - b.index);
    }

    const statement = await this.createStatement(ctx, fresh);
    ctx.created.push({ kind: 'statement', id: statement.id });
    const txRepo = ctx.manager.getRepository(Transaction);
    const entities: Transaction[] = [];
    for (const item of fresh) {
      const categoryId = isBlank(item.categoryName)
        ? null
        : await ctx.category(
            item.categoryName,
            item.type === TransactionType.INCOME ? 'income' : 'expense',
          );
      entities.push(
        txRepo.create({
          workspaceId: ctx.workspaceId,
          statementId: statement.id,
          transactionDate: new Date(item.date),
          counterpartyName: item.merchant,
          paymentPurpose: item.purpose,
          debit: item.type === TransactionType.EXPENSE ? item.amount : null,
          credit: item.type === TransactionType.INCOME ? item.amount : null,
          amount: item.amount,
          currency: item.currency,
          transactionType: item.type,
          categoryId,
          // Imported from a file: each row is confirmed in Review.
          isVerified: false,
          fingerprint: item.fingerprint,
        }),
      );
    }
    const saved = await txRepo.save(entities, { chunk: 500 });
    for (const [position, item] of fresh.entries()) {
      results.push({ index: item.index, status: 'created', id: saved[position]?.id });
    }
    return results.sort((a, b) => a.index - b.index);
  }

  private async createStatement(ctx: ImportContext, items: ParsedTx[]): Promise<Statement> {
    const csv = [
      ['date', 'merchant', 'purpose', 'amount', 'type', 'currency', 'category'].join(','),
      ...items.map(item =>
        [
          item.date,
          item.merchant,
          item.purpose,
          item.amount,
          item.type,
          item.currency,
          item.categoryName,
        ]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
    const dates = items.map(item => new Date(item.date).getTime());
    const totalDebit = items
      .filter(item => item.type === TransactionType.EXPENSE)
      .reduce((sum, item) => sum + item.amount, 0);
    const totalCredit = items
      .filter(item => item.type === TransactionType.INCOME)
      .reduce((sum, item) => sum + item.amount, 0);
    const baseName = (ctx.fileName || 'import').replace(/\.[^.]+$/, '');
    const fileName = normalizeFilename(`${baseName}-import.csv`);
    const filePath = path.join(resolveUploadsDir(), `${randomUUID()}.csv`);
    await fs.promises.writeFile(filePath, csv);
    const repo = ctx.manager.getRepository(Statement);
    const statement = await repo.save(
      repo.create({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        fileName,
        filePath,
        fileType: FileType.CSV,
        fileSize: csv.length,
        fileHash: createHash('sha256').update(csv).digest('hex'),
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        processedAt: new Date(),
        statementDateFrom: new Date(Math.min(...dates)),
        statementDateTo: new Date(Math.max(...dates)),
        totalTransactions: items.length,
        totalDebit,
        totalCredit,
        currency: items[0]?.currency ?? ctx.currency,
        deletedAt: null,
        parsingDetails: {
          detectedBy: 'entity-import',
          parserUsed: 'entity-import',
          parserVersion: '1',
          transactionsFound: items.length,
          transactionsCreated: items.length,
          importPreview: { source: 'entity-import', fileName: ctx.fileName },
        },
      }),
    );
    await repo.update(statement.id, { fileData: Buffer.from(csv) });
    return statement;
  }
}
