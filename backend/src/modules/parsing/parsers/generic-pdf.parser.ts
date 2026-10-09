import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { extractTablesFromPdf, extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { AiTransactionExtractor } from '../helpers/ai-transaction-extractor.helper';
import { mapPdfTableRowsToTransactions } from '../helpers/pdf-table.helper';
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
    let tableRows: string[][] = [];

    try {
      text = cachedText ?? (await extractTextFromPdf(filePath));
    } catch (error) {
      this.logger.warn('Failed to extract PDF text:', (error as Error)?.message);
    }

    try {
      const extracted = await extractTablesFromPdf(filePath);
      tableRows = extracted.rows || [];
    } catch (error) {
      this.logger.warn('Failed to extract PDF tables:', (error as Error)?.message);
    }

    const headerInfo = this.extractHeaderFromText(text);
    const localeInfo = this.detectLocale(text);
    const detectedCurrency = this.detectCurrency(text) || appDefaultCurrency();
    const tableTransactions = mapPdfTableRowsToTransactions(tableRows, {
      defaultCurrency: detectedCurrency,
      stopWords: ['итого', 'оборот', 'остаток'],
    });

    let transactions = tableTransactions;

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

    const balanceStart =
      this.extractBalance(text, 'Остаток на начало') ??
      this.extractBalance(text, 'Остаток на начало периода') ??
      this.extractBalance(text, 'Входящий остаток');
    const balanceEnd =
      this.extractBalance(text, 'Остаток на конец') ??
      this.extractBalance(text, 'Остаток на конец периода') ??
      this.extractBalance(text, 'Исходящий остаток');

    return {
      metadata: {
        accountNumber: this.extractAccountNumber(text) || '',
        currency: detectedCurrency,
        dateFrom,
        dateTo,
        balanceStart,
        balanceEnd,
        rawHeader: headerInfo.rawHeader,
        normalizedHeader: headerInfo.normalizedHeader,
        locale: localeInfo.locale !== 'unknown' ? localeInfo.locale : undefined,
      },
      transactions,
    };
  }
}
