import {
  extractTablesFromPdf,
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
  type PdfTextItem,
  type PdfTextRow,
} from '../../../common/utils/pdf-parser.util';
import { type BankName, FileType } from '../../../entities/statement.entity';
import {
  mapPdfTableRowsToTransactions,
  pickReconciledTransactions,
} from '../helpers/pdf-table.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';

export interface ColumnBoundary<ColumnKey extends string> {
  key: ColumnKey;
  label: ColumnKey;
  start: number;
  end: number;
  mid: number;
}

type RequiredColumnKey = 'date' | 'document' | 'debit' | 'credit' | 'purpose';

export type BerekeCellMap<ColumnKey extends string> = Record<ColumnKey | RequiredColumnKey, string>;

type ParsedCounterpartyDetails = {
  name: string;
  bin?: string;
  account?: string;
};

type TransactionGroupContext<ColumnKey extends string> = {
  cells: BerekeCellMap<ColumnKey>;
  combinedText: string;
  counterpartyBlock: string;
  bankBlock: string;
  counterpartyDetails: ParsedCounterpartyDetails;
  purpose: string;
};

export abstract class BerekeBaseParser<ColumnKey extends string> extends BaseParser {
  protected abstract readonly parserName: string;

  protected abstract getSupportedBankName(): BankName;

  protected abstract matchesBankText(text: string): boolean;

  protected abstract getBalanceStartLabels(): string[];

  protected abstract getBalanceEndLabels(): string[];

  protected abstract getDefaultMetadataDates(
    dateRange: { from: Date | null; to: Date | null },
    transactions: ParsedTransaction[],
  ): { from: Date; to: Date };

  protected abstract isHeaderRow(text: string): boolean;

  protected abstract detectColumnKey(label: string): ColumnKey | null;

  protected abstract getExpectedColumnOrder(): ColumnKey[];

  protected abstract createEmptyCells(): BerekeCellMap<ColumnKey>;

  protected abstract isEndOfTable(text: string): boolean;

  protected abstract resolveCounterpartyBlock(
    cells: BerekeCellMap<ColumnKey>,
    combinedText: string,
  ): string;

  protected abstract resolveBankBlock(
    cells: BerekeCellMap<ColumnKey>,
    combinedText: string,
  ): string;

  protected sanitizePurpose(purpose: string): string {
    return purpose;
  }

  protected resolveCounterpartyNameForGroup(context: TransactionGroupContext<ColumnKey>): string {
    return this.resolveCounterpartyName(
      context.counterpartyDetails.name,
      context.purpose,
      context.combinedText,
    );
  }

  protected finalizeBankBlock(bankBlock: string, _combinedText: string): string {
    return bankBlock;
  }

  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (bankName !== this.getSupportedBankName() || fileType !== FileType.PDF) {
      return false;
    }

    try {
      const text = (cachedText ?? (await extractTextFromPdf(filePath))).toLowerCase();
      return this.matchesBankText(text);
    } catch (error) {
      this.logger.error('Error parsing PDF in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    this.logger.debug(`Starting to parse file: ${filePath}`);
    const extractStartTime = Date.now();

    const { text, rows } = await extractTextAndLayoutFromPdf(filePath);
    const normalizedText = cachedText ?? text;
    const { rowSets } = await extractTablesFromPdf(filePath);
    const extractTime = Date.now() - extractStartTime;
    this.logger.debug(
      `PDF text extracted in ${extractTime}ms, length: ${normalizedText.length} characters, rows: ${rows.length}`,
    );

    this.logger.debug('Extracting metadata...');
    const accountNumber = this.extractAccountNumber(normalizedText) || '';
    const dateRange = this.extractDateRange(normalizedText);
    const balanceStart = this.extractFirstBalance(normalizedText, this.getBalanceStartLabels());
    const balanceEnd = this.extractFirstBalance(normalizedText, this.getBalanceEndLabels());

    this.logger.debug(
      `Metadata extracted - Account: ${
        accountNumber || 'N/A'
      }, Date range: ${dateRange.from?.toISOString() || 'N/A'} to ${
        dateRange.to?.toISOString() || 'N/A'
      }`,
    );
    this.logger.debug(
      `Balance start: ${balanceStart || 'N/A'}, Balance end: ${balanceEnd || 'N/A'}`,
    );

    const detectedCurrency = this.detectCurrency(normalizedText) || 'KZT';

    const transactionStartTime = Date.now();
    this.logger.debug('Extracting transactions from pdf2table rows...');
    const tableAttempts = rowSets.map(tableRows =>
      mapPdfTableRowsToTransactions(tableRows, {
        defaultCurrency: detectedCurrency,
        stopWords: ['итого', 'оборот', 'остаток'],
      }),
    );

    this.logger.debug('Extracting transactions from structured text...');
    const { transactions: structuredTransactions } = this.extractTransactions(normalizedText, rows);

    const attempts = [...tableAttempts, structuredTransactions];
    const transactions = pickReconciledTransactions(attempts, balanceStart, balanceEnd);

    const { from, to } = this.getDefaultMetadataDates(dateRange, transactions);
    const transactionTime = Date.now() - transactionStartTime;
    this.logger.debug(`Extracted ${transactions.length} transactions in ${transactionTime}ms`);

    return {
      metadata: {
        accountNumber,
        dateFrom: from,
        dateTo: to,
        balanceStart: balanceStart ?? undefined,
        balanceEnd: balanceEnd ?? undefined,
        currency: detectedCurrency,
      },
      transactions,
    };
  }

  /** The statement's own account follows "Счет №"; the first IBAN in the text may be a counterparty's. */
  protected extractAccountNumber(text: string): string | null {
    const match = text.match(/Сч[её]т\s*№\s*(KZ[0-9A-Z]{18})/i);
    return match ? match[1].toUpperCase() : super.extractAccountNumber(text);
  }

  /** Bereke prints the period as "за период с 27.11.2025 по 27.11.2025". */
  protected extractDateRange(text: string): { from: Date | null; to: Date | null } {
    const match = text.match(
      /за\s+период\s+с\s*(\d{2}\.\d{2}\.\d{4})\s*по\s*(\d{2}\.\d{2}\.\d{4})/i,
    );
    return match
      ? { from: this.normalizeDate(match[1]), to: this.normalizeDate(match[2]) }
      : super.extractDateRange(text);
  }

  protected inferDateRangeFromTransactions(transactions: ParsedTransaction[]): {
    from: Date | null;
    to: Date | null;
  } {
    const dates = transactions
      .map(tx => tx.transactionDate)
      .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));

    if (!dates.length) {
      return { from: null, to: null };
    }

    const timestamps = dates.map(date => date.getTime());
    return {
      from: new Date(Math.min(...timestamps)),
      to: new Date(Math.max(...timestamps)),
    };
  }

  protected extractTransactions(
    text: string,
    rows: PdfTextRow[],
  ): { transactions: ParsedTransaction[]; groupsDetected: number } {
    const structuredRows = this.prepareStructuredRows(text, rows);
    const { cleanRows, headerIndex, dataRows } =
      this.prepareRowsForTransactionParsing(structuredRows);
    this.logger.debug(`Processing ${cleanRows.length} non-empty lines of text`);

    const columnBoundaries =
      headerIndex >= 0 && cleanRows[headerIndex]?.items?.length
        ? this.buildColumnBoundaries(cleanRows[headerIndex])
        : undefined;

    if (columnBoundaries?.length) {
      const mapping = columnBoundaries
        .map(column => {
          return `${column.key} [${Math.round(column.start)} - ${Math.round(column.end)}]@${Math.round(column.mid)}`;
        })
        .join('; ');
      this.logger.debug(`Column boundaries detected: ${mapping}`);
    } else {
      this.logger.debug('Column boundaries not detected, using heuristics');
    }

    const groups = this.groupRowsIntoTransactions(dataRows);
    this.logger.debug(`Detected ${groups.length} potential transaction groups`);

    const transactions: ParsedTransaction[] = [];

    let failedGroups = 0;
    groups.forEach(group => {
      const transaction = this.parseTransactionGroup(group, columnBoundaries);
      if (transaction) {
        transactions.push(transaction);
      } else {
        // The row text is statement content, so only the count is logged.
        failedGroups++;
      }
    });

    if (failedGroups) {
      this.logger.warn(`Failed to parse ${failedGroups}/${groups.length} transaction groups`);
    }

    const groupsDetected = groups.length;

    this.logger.debug(`Total transactions extracted: ${transactions.length}`);
    return { transactions, groupsDetected };
  }

  protected buildColumnBoundaries(row: PdfTextRow): ColumnBoundary<ColumnKey>[] | undefined {
    if (!row.items?.length) {
      return undefined;
    }

    const grouped = new Map<ColumnKey, number[]>();
    row.items.forEach(item => {
      const key = this.detectColumnKey(item.text);
      if (!key) {
        return;
      }

      const mid = item.x + (item.width || 0) / 2;
      grouped.set(key, [...(grouped.get(key) || []), mid]);
    });

    const columns = this.getExpectedColumnOrder()
      .flatMap(key => {
        const mids = grouped.get(key);
        if (!mids?.length) {
          return [];
        }

        const avg = mids.reduce((sum, value) => sum + value, 0) / mids.length;
        return [{ key, label: key, mid: avg }];
      })
      .sort((left, right) => left.mid - right.mid);

    if (!columns.length) {
      return undefined;
    }

    const boundaries: ColumnBoundary<ColumnKey>[] = [];
    columns.forEach((column, index) => {
      const prevMid = index === 0 ? 0 : columns[index - 1].mid;
      const nextMid = index === columns.length - 1 ? column.mid + 2000 : columns[index + 1].mid;
      boundaries.push({
        key: column.key,
        label: column.label,
        start: index === 0 ? 0 : (prevMid + column.mid) / 2,
        end: index === columns.length - 1 ? Number.POSITIVE_INFINITY : (column.mid + nextMid) / 2,
        mid: column.mid,
      });
    });

    return boundaries;
  }

  protected groupRowsIntoTransactions(rows: PdfTextRow[]): PdfTextRow[][] {
    const groups: PdfTextRow[][] = [];
    let current: PdfTextRow[] = [];
    const dateRegex = /\d{2}\.\d{2}\.\d{4}/;

    for (const row of rows) {
      const text = row.text.trim();
      if (!text) {
        continue;
      }

      if (this.isEndOfTable(text)) {
        break;
      }

      if (dateRegex.test(text)) {
        if (current.length) {
          groups.push(current);
        }
        current = [row];
      } else if (current.length) {
        current.push(row);
      }
    }

    if (current.length) {
      groups.push(current);
    }

    return groups;
  }

  protected parseTransactionGroup(
    group: PdfTextRow[],
    columnBoundaries?: ColumnBoundary<ColumnKey>[],
  ): ParsedTransaction | null {
    const combinedText = group
      .map(row => row.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const items = group.flatMap(row => row.items || []);

    const cells = columnBoundaries?.length
      ? this.extractCellsByColumn(items, columnBoundaries)
      : this.createEmptyCells();

    const dateRaw = (cells.date || this.extractFirstDate(combinedText)) ?? '';
    const transactionDate = this.normalizeDate(dateRaw);
    if (!transactionDate) {
      return null;
    }

    const documentNumber =
      (cells.document || this.extractDocumentNumber(combinedText))?.trim() || undefined;
    const counterpartyBlock = this.resolveCounterpartyBlock(cells, combinedText);
    let bankBlock = this.resolveBankBlock(cells, combinedText);
    const counterpartyDetails = this.extractCounterpartyDetails(counterpartyBlock || combinedText);

    let debit = this.normalizeNumberValue(cells.debit);
    let credit = this.normalizeNumberValue(cells.credit);

    if (debit === null && credit === null) {
      const amounts = this.extractAmountsFromText(combinedText);
      if (amounts.length === 1) {
        debit = amounts[0];
      } else if (amounts.length >= 2) {
        [debit, credit] = amounts;
      }
    }

    let purpose = cells.purpose?.trim() || '';
    if (!purpose) {
      purpose = this.extractPurposeFromText(combinedText, counterpartyBlock, bankBlock);
    }

    purpose = this.sanitizePurpose(purpose);
    if (!purpose) {
      purpose = 'Не указано';
    }

    const counterpartyName = this.resolveCounterpartyNameForGroup({
      cells,
      combinedText,
      counterpartyBlock,
      bankBlock,
      counterpartyDetails,
      purpose,
    });
    bankBlock = this.finalizeBankBlock(bankBlock, combinedText);

    return {
      transactionDate,
      documentNumber,
      counterpartyName,
      counterpartyBin: counterpartyDetails.bin,
      counterpartyAccount: counterpartyDetails.account,
      counterpartyBank: bankBlock || undefined,
      debit: debit || undefined,
      credit: credit || undefined,
      paymentPurpose: purpose.trim(),
      currency: 'KZT',
    };
  }

  protected extractCellsByColumn(
    items: PdfTextItem[],
    columnBoundaries: ColumnBoundary<ColumnKey>[],
  ): BerekeCellMap<ColumnKey> {
    const cells = this.createEmptyCells();

    items.forEach(item => {
      const column = columnBoundaries.find(
        boundary => item.x >= boundary.start && item.x < boundary.end,
      );
      if (column) {
        cells[column.key] = `${cells[column.key]} ${item.text}`.trim();
      }
    });

    return cells;
  }

  protected extractFirstDate(text: string): string | null {
    const match = text.match(/\d{2}\.\d{2}\.\d{4}/);
    return match ? match[0] : null;
  }

  protected extractDocumentNumber(text: string): string | undefined {
    const cleaned = text.replace(/\d{2}\.\d{2}\.\d{4}/, '');
    const match = cleaned.match(/\b\d{6,}\b/);
    return match ? match[0] : undefined;
  }

  protected prepareStructuredRows(text: string, rows: PdfTextRow[]): PdfTextRow[] {
    return rows.length > 0
      ? rows.map(row => ({
          ...row,
          text: (row.text || '').replace(/\s+/g, ' ').trim(),
        }))
      : text
          .split('\n')
          .map((line, index) => ({
            page: 1,
            y: index,
            text: line.trim(),
            items: [],
          }))
          .filter(row => row.text.length > 0);
  }

  protected prepareRowsForTransactionParsing(structuredRows: PdfTextRow[]): {
    cleanRows: PdfTextRow[];
    headerIndex: number;
    dataRows: PdfTextRow[];
  } {
    const cleanRows = structuredRows.filter(row => row.text.length > 0);
    const headerIndex = cleanRows.findIndex(row => this.isHeaderRow(row.text));

    return {
      cleanRows,
      headerIndex,
      dataRows: headerIndex >= 0 ? cleanRows.slice(headerIndex + 1) : cleanRows,
    };
  }

  protected collectParsedTransactions<TBoundary>(
    groups: PdfTextRow[][],
    columnBoundaries: TBoundary,
    parseGroup: (group: PdfTextRow[], columnBoundaries: TBoundary) => ParsedTransaction | null,
    options?: {
      onParsed?: (transaction: ParsedTransaction, index: number) => void;
      onFailed?: (group: PdfTextRow[], index: number) => void;
    },
  ): {
    transactions: ParsedTransaction[];
    groupsDetected: number;
  } {
    const transactions: ParsedTransaction[] = [];

    groups.forEach((group, index) => {
      const transaction = parseGroup(group, columnBoundaries);
      if (transaction) {
        transactions.push(transaction);
        options?.onParsed?.(transaction, index);
      } else {
        options?.onFailed?.(group, index);
      }
    });

    return {
      transactions,
      groupsDetected: groups.length,
    };
  }

  protected extractFirstBalance(text: string, labels: string[]): number | null {
    for (const label of labels) {
      const value = this.extractBalance(text, label);
      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  protected extractCounterpartyBlockFromText(text: string): string {
    const pieces = text.split(/\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})/);
    return pieces.length ? pieces[0].trim() : text;
  }

  protected extractCounterpartyNameFromText(text: string): string | null {
    const match = text.match(/(АО|ТОО|ИП)\s+[^0-9KZ]{2,120}?(?=\s+БИН|\s+ИНН|\s+KZ|\s+\d{6,}|$)/i);
    return match?.[0] ? match[0].trim() : null;
  }

  protected extractCounterpartyDetails(text: string): ParsedCounterpartyDetails {
    const binMatch = text.match(/\b\d{12}\b/);
    const accountMatch = text.match(/KZ\d{10,}/i);

    let name = text;
    if (binMatch) {
      name = name.replace(binMatch[0], '');
    }
    if (accountMatch) {
      name = name.replace(accountMatch[0], '');
    }

    name = name.replace(/\s+/g, ' ').trim();

    return {
      name: name || 'Неизвестный контрагент',
      bin: binMatch ? binMatch[0] : undefined,
      account: accountMatch ? accountMatch[0] : undefined,
    };
  }

  protected extractAmountsFromText(text: string): number[] {
    const matches = text.match(/\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})/g) || [];
    return matches
      .map(match => this.normalizeNumberValue(match))
      .filter((value): value is number => value !== null);
  }

  protected extractPurposeFromText(
    text: string,
    counterpartyBlock?: string,
    bankBlock?: string,
  ): string {
    let purpose = text;

    if (counterpartyBlock) {
      purpose = purpose.replace(counterpartyBlock, '');
    }
    if (bankBlock) {
      purpose = purpose.replace(bankBlock, '');
    }

    return purpose
      .replace(/\d{2}\.\d{2}\.\d{4}/g, '')
      .replace(/\b[\p{L}]{2,}\d{4,}\b/gu, '')
      .replace(/\b\d{6,}\b/g, '')
      .replace(/KZ\d{10,}/gi, '')
      .replace(/\b\d{12}\b/g, '')
      .replace(/\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected extractBic(text: string): string | null {
    const match = text.match(/[A-Z]{6}[A-Z0-9]{2,5}/);
    return match ? match[0] : null;
  }

  protected resolveCounterpartyName(
    rawName: string,
    purpose: string,
    combinedText: string,
  ): string {
    if (!this.isUnknownCounterparty(rawName)) {
      return rawName.trim();
    }

    const fromPurpose = this.extractNameFromText(purpose);
    if (fromPurpose) {
      return fromPurpose;
    }

    const fromCombined = this.extractNameFromText(combinedText);
    if (fromCombined) {
      return fromCombined;
    }

    return 'Неизвестный контрагент';
  }

  protected extractNameFromText(text: string): string | null {
    const withOrg = text.match(/(АО|ТОО|ИП)\s+[A-Za-zА-Яа-яёЁ0-9"«»().\s-]{3,}/i);
    if (withOrg) {
      return withOrg[0].trim();
    }

    const cleaned = text.replace(/оплата|перевод|зачисление|от\s+/gi, '').trim();
    if (cleaned && cleaned.length > 3 && cleaned.length < 120) {
      return cleaned;
    }

    return null;
  }

  protected isUnknownCounterparty(name?: string): boolean {
    if (!name) {
      return true;
    }

    const lower = name.toLowerCase();
    return (
      lower.length < 3 || lower.includes('неизвест') || lower === 'n/a' || lower === 'не указано'
    );
  }
}
