import { appDefaultCurrency } from '../../../common/utils/currency.util';
import {
  extractTablesFromPdf,
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
  type PdfTextRow,
} from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import {
  type LayoutTransaction,
  openingBalanceFromRows,
  readLayoutTransactions,
  toParsedTransactions,
} from '../helpers/pdf-layout-table.helper';
import {
  mapPdfTableRowsToTransactions,
  pickReconciledTransactions,
} from '../helpers/pdf-table.helper';
import {
  detectNumericDateOrder,
  findFullDates,
  type NumericDateOrder,
} from '../helpers/statement-date.helper';
import {
  detectStatementCurrency,
  findAccountNumber,
  findStatementBalances,
  findStatementPeriod,
  isCreditCardStatement,
} from '../helpers/statement-metadata.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';

const negate = (value: number | null) => (value === null ? null : -value);

export class GenericPdfParser extends BaseParser {
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
    const { text, rowSets, layoutRows } = await this.extract(filePath, cachedText);

    const headerInfo = this.extractHeaderFromText(text);
    const localeInfo = this.detectLocale(text);
    const detectedCurrency = detectStatementCurrency(text) || appDefaultCurrency();

    const layoutTransactions = readLayoutTransactions(layoutRows);
    // Row dates decide first; in free text only dates with a year count, since
    // "38.2gal" or "19.5%" look like day-first dates too.
    const dateOrder =
      detectNumericDateOrder(layoutTransactions.map(t => t.dateText)) ??
      detectNumericDateOrder(text.match(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g) ?? []) ??
      'dmy';
    const printedDates = findFullDates(text, dateOrder).map(found => found.date.getTime());
    const latestPrinted = printedDates.length > 0 ? new Date(Math.max(...printedDates)) : null;
    const isCard = isCreditCardStatement(text);
    const { balanceStart, balanceEnd } = this.readBalances(
      text,
      layoutTransactions,
      dateOrder,
      isCard,
    );

    // The layout reading comes first: on statements without ruling lines the
    // table attempts read page-wide noise, and on Russian-headed tables it
    // finds nothing and steps aside.
    const transactions = pickReconciledTransactions(
      [
        toParsedTransactions(
          layoutTransactions,
          dateOrder,
          latestPrinted,
          detectedCurrency,
          isCard,
        ),
        ...rowSets.map(rows =>
          mapPdfTableRowsToTransactions(rows, {
            defaultCurrency: detectedCurrency,
            stopWords: ['итого', 'оборот', 'остаток'],
          }),
        ),
      ],
      balanceStart,
      balanceEnd,
    );

    const legacyRange = this.extractDateRange(text);
    const dateRange = legacyRange.from ? legacyRange : findStatementPeriod(text, dateOrder);
    const transactionDates = transactions.map(t => t.transactionDate).filter(Boolean);
    const minDate =
      transactionDates.length > 0
        ? new Date(Math.min(...transactionDates.map(d => d.getTime())))
        : null;
    const maxDate =
      transactionDates.length > 0
        ? new Date(Math.max(...transactionDates.map(d => d.getTime())))
        : null;
    const dateFrom = dateRange?.from || minDate || new Date();
    const dateTo = dateRange?.to || maxDate || dateFrom;

    return {
      metadata: {
        accountNumber: this.extractAccountNumber(text) || findAccountNumber(text) || '',
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

  private async extract(filePath: string, cachedText?: string) {
    let text = '';
    let rowSets: string[][][] = [];
    let layoutRows: PdfTextRow[] = [];

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

    try {
      layoutRows = (await extractTextAndLayoutFromPdf(filePath)).rows;
    } catch (error) {
      this.logger.warn('Failed to extract PDF layout:', (error as Error)?.message);
    }

    return { text, rowSets, layoutRows };
  }

  /**
   * Russian labels first, as before; then the running balance column, which
   * is exact; then labels in other languages. A card's printed balance is what
   * is owed: a debt, so below zero.
   */
  private readBalances(
    text: string,
    layoutTransactions: LayoutTransaction[],
    dateOrder: NumericDateOrder,
    isCard: boolean,
  ) {
    const printed = findStatementBalances(text, dateOrder);
    const labelled = isCard ? { start: negate(printed.start), end: negate(printed.end) } : printed;
    const balanceStart =
      this.extractBalance(text, 'Остаток на начало') ??
      this.extractBalance(text, 'Остаток на начало периода') ??
      this.extractBalance(text, 'Входящий остаток') ??
      openingBalanceFromRows(layoutTransactions) ??
      labelled.start;
    const balanceEnd =
      this.extractBalance(text, 'Остаток на конец') ??
      this.extractBalance(text, 'Остаток на конец периода') ??
      this.extractBalance(text, 'Исходящий остаток') ??
      layoutTransactions[layoutTransactions.length - 1]?.balance ??
      labelled.end;
    return { balanceStart, balanceEnd };
  }
}
