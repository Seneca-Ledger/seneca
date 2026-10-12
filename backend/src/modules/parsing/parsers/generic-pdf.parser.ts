import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { extractTablesFromPdf, extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { AiTransactionExtractor } from '../helpers/ai-transaction-extractor.helper';
import {
  mapPdfTableRowsToTransactions,
  pickReconciledTransactions,
} from '../helpers/pdf-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';

export class GenericPdfParser extends BaseParser {
  private aiExtractor = new AiTransactionExtractor();

  async canParse(
    bankName: BankName,
    fileType: FileType,
    _filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    const cachedTextLength = cachedText?.length ?? 0;
    return bankName === BankName.OTHER && fileType === FileType.PDF && cachedTextLength >= 0;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    let text = '';
    let rowSets: string[][][] = [];

    try {
      text = cachedText ?? (await extractTextFromPdf(filePath));
    } catch (error) {
      this.logger.warn('Failed to extract PDF text:', (error as Error)?.message);
    }

    try {
      const extracted = await extractTablesFromPdf(filePath);
      rowSets = extracted.rowSets;
    } catch (error) {
      this.logger.warn('Failed to extract PDF tables:', (error as Error)?.message);
    }

    const headerInfo = this.extractHeaderFromText(text);
    const localeInfo = this.detectLocale(text);
    const detectedCurrency = this.detectCurrency(text) || appDefaultCurrency();
    const balanceStart =
      this.extractBalance(text, 'Остаток на начало') ??
      this.extractBalance(text, 'Остаток на начало периода') ??
      this.extractBalance(text, 'Входящий остаток');
    const balanceEnd =
      this.extractBalance(text, 'Остаток на конец') ??
      this.extractBalance(text, 'Остаток на конец периода') ??
      this.extractBalance(text, 'Исходящий остаток');

    let transactions = pickReconciledTransactions(
      rowSets.map(rows =>
        mapPdfTableRowsToTransactions(rows, {
          defaultCurrency: detectedCurrency,
          stopWords: ['итого', 'оборот', 'остаток'],
        }),
      ),
      balanceStart,
      balanceEnd,
    );

    if (!transactions.length && this.aiExtractor.isAvailable() && text.trim().length) {
      try {
        transactions = await this.aiExtractor.extractTransactions(text);
      } catch (error) {
        this.logger.warn('AI extraction failed:', (error as Error)?.message);
      }
    }

    const dateRange = this.extractDateRange(text);
    const transactionDates = transactions.map(t => t.transactionDate).filter(Boolean);
    const minDate =
      transactionDates.length > 0
        ? new Date(Math.min(...transactionDates.map(d => d.getTime())))
        : null;
    const maxDate =
      transactionDates.length > 0
        ? new Date(Math.max(...transactionDates.map(d => d.getTime())))
        : null;
    const dateFrom = dateRange.from || minDate || new Date();
    const dateTo = dateRange.to || maxDate || dateFrom;

    return {
      metadata: {
        accountNumber: this.extractAccountNumber(text) || '',
        currency: detectedCurrency,
        dateFrom,
        dateTo,
        balanceStart: balanceStart ?? undefined,
        balanceEnd: balanceEnd ?? undefined,
        rawHeader: headerInfo.rawHeader,
        normalizedHeader: headerInfo.normalizedHeader,
        locale: localeInfo.locale !== 'unknown' ? localeInfo.locale : undefined,
      },
      transactions,
    };
  }
}
