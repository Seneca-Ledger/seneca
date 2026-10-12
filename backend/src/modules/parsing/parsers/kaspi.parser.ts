import { normalizeDate, normalizeNumber } from '../../../common/utils/number-normalizer.util';
import { extractTablesFromPdf, extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { AiTransactionExtractor } from '../helpers/ai-transaction-extractor.helper';
import { mapPdfTableRowsToTransactions, mergeTransactions } from '../helpers/pdf-table.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';

export class KaspiParser extends BaseParser {
  private aiExtractor = new AiTransactionExtractor();

  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (bankName !== BankName.KASPI && bankName !== BankName.OTHER) {
      return false;
    }

    if (fileType !== FileType.PDF) {
      return false;
    }

    try {
      const text = (cachedText ?? (await extractTextFromPdf(filePath))).toLowerCase();
      return text.includes('kaspi') || text.includes('каспи') || text.includes('caspkzka');
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    this.logger.debug('Starting to parse file:', filePath);

    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const { rows: tableRows } = await extractTablesFromPdf(filePath);
    this.logger.debug(`PDF text length: ${text.length}`);

    // Extract metadata
    const accountNumber = this.extractKaspiAccountNumber(text);
    const balances = this.extractBalancesFromText(text);
    const dateRange = this.extractPeriodFromText(text);

    this.logger.debug(`Account: ${accountNumber || 'N/A'}`);
    this.logger.debug(`Balances: start=${balances.start}, end=${balances.end}`);
    this.logger.debug(`Period: ${dateRange.from?.toISOString().split('T')[0] || 'N/A'}`);

    const detectedCurrency = this.detectCurrency(text) || 'KZT';

    const tableTransactions = mapPdfTableRowsToTransactions(tableRows, {
      defaultCurrency: detectedCurrency,
      stopWords: ['итого', 'оборот', 'остаток'],
    });
    const kaspiTableTransactions = this.extractKaspiTableTransactions(tableRows, detectedCurrency);
    const combinedTableTx = kaspiTableTransactions.length
      ? mergeTransactions(kaspiTableTransactions, tableTransactions)
      : tableTransactions;
    if (tableTransactions.length) {
      this.logger.debug(`pdf2table extracted ${tableTransactions.length} transactions`);
    }

    // Parse transactions from the structured text
    const parsedFromText = await this.parseTransactionsFromText(text);
    const transactions = combinedTableTx.length
      ? mergeTransactions(combinedTableTx, parsedFromText)
      : parsedFromText;
    this.logger.debug(`Parsed ${transactions.length} transactions`);

    return {
      metadata: {
        accountNumber: accountNumber || '',
        currency: detectedCurrency,
        dateFrom: dateRange.from || new Date(),
        dateTo: dateRange.to || new Date(),
        balanceStart: balances.start ?? undefined,
        balanceEnd: balances.end ?? undefined,
      },
      transactions,
    };
  }

  private extractKaspiAccountNumber(text: string): string | null {
    const match = text.match(/KZ\d{2}722S\d{12}/i);
    return match ? match[0].toUpperCase() : null;
  }

  private extractBalancesFromText(text: string): { start: number | null; end: number | null } {
    let start: number | null = null;
    let end: number | null = null;

    // Look for "Incoming balance" followed by amount
    const startMatch = text.match(/Входящий\s+остаток\s*:?\s*([\d\s]+[,.][\d]+)/i);
    if (startMatch) {
      start = this.normalizeNumberValue(startMatch[1]);
    }

    // Look for "Outgoing balance" followed by amount
    const endMatch = text.match(/Исходящий\s+остаток\s*:?\s*([\d\s]+[,.][\d]+)/i);
    if (endMatch) {
      end = this.normalizeNumberValue(endMatch[1]);
    }

    return { start, end };
  }

  private extractPeriodFromText(text: string): { from: Date | null; to: Date | null } {
    // Look for "Period: DD.MM.YYYY - DD.MM.YYYY" or single date
    const periodMatch = text.match(
      /Период\s*:?\s*(\d{2}\.\d{2}\.\d{4})(?:\s*[-–—]\s*(\d{2}\.\d{2}\.\d{4}))?/i,
    );
    if (periodMatch) {
      const fromDate = this.normalizeDate(periodMatch[1]);
      const toDate = periodMatch[2] ? this.normalizeDate(periodMatch[2]) : fromDate;
      return { from: fromDate, to: toDate };
    }

    const periodRangeMatch = text.match(
      /за\s+период\s+с\s*(\d{2}\.\d{2}\.\d{4})\s+по\s*(\d{2}\.\d{2}\.\d{4})/i,
    );
    if (periodRangeMatch) {
      const fromDate = this.normalizeDate(periodRangeMatch[1]);
      const toDate = this.normalizeDate(periodRangeMatch[2]);
      return { from: fromDate, to: toDate };
    }

    return { from: null, to: null };
  }

  private async parseTransactionsFromText(text: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n');
    let currentTransaction: Partial<ParsedTransaction> | null = null;
    let collectingPurpose = false;
    let purposeLines: string[] = [];
    let blockLines: string[] = [];

    const flushCurrent = () => {
      if (currentTransaction?.transactionDate) {
        transactions.push(
          this.enrichKaspiTransaction(currentTransaction, purposeLines, blockLines),
        );
      }
      currentTransaction = null;
      purposeLines = [];
      blockLines = [];
      collectingPurpose = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      // Document number starts a new block
      const docMatch = line.match(/^(8\d{7})$/);
      if (docMatch) {
        flushCurrent();
        currentTransaction = {
          documentNumber: docMatch[1],
          counterpartyName: 'Не указано',
          paymentPurpose: 'Не указано',
        };
        blockLines.push(line);
        continue;
      }

      if (!currentTransaction) {
        continue;
      }

      blockLines.push(line);

      // Date (DD.MM.YYYY)
      const dateMatch = line.match(/^(\d{2}\.\d{2}\.\d{4})(?:\s+\d{2}:\d{2}:\d{2})?$/);
      if (dateMatch && !currentTransaction.transactionDate) {
        const normalizedDate = this.normalizeDate(dateMatch[1]);
        if (normalizedDate) {
          currentTransaction.transactionDate = normalizedDate;
          continue;
        }
      }

      // Amount
      const amountMatch = line.match(/^([\d\s]+[,.]?\d*)$/);
      if (amountMatch && currentTransaction.transactionDate) {
        const amount = this.normalizeNumberValue(amountMatch[1]);
        if (amount && amount > 0) {
          if (!(currentTransaction.debit || currentTransaction.credit)) {
            currentTransaction.debit = amount;
          }
        }
        continue;
      }

      // Counterparty and BIN
      if (line.includes('БИН/ИИН') || line.match(/^(АО|ТОО|ИП)\s/)) {
        const cpMatch = line.match(/^(.+?)\s*БИН\/ИИН\s*(\d+)/);
        if (cpMatch) {
          currentTransaction.counterpartyName = cpMatch[1].trim();
          currentTransaction.counterpartyBin = cpMatch[2];
        } else {
          currentTransaction.counterpartyName = line;
        }
        continue;
      }

      // Simple name
      if (
        line.match(/^[А-Яа-яЁё\s.]+$/) &&
        line.length < 50 &&
        !line.match(/^(Дебет|Кредит|Номер|Дата|Назначение)/)
      ) {
        if (currentTransaction.counterpartyName === 'Не указано') {
          currentTransaction.counterpartyName = line;
        }
        continue;
      }

      // Account, bank, KNP
      if (line.match(/^KZ\d{2}722/i)) {
        currentTransaction.counterpartyAccount = line.toUpperCase();
        continue;
      }

      if (line.match(/^[A-Z]{8}$/)) {
        currentTransaction.counterpartyBank = line;
        continue;
      }

      if (line.match(/^\d{3}$/) && currentTransaction.counterpartyAccount) {
        collectingPurpose = true;
        continue;
      }

      if (
        collectingPurpose ||
        (currentTransaction.counterpartyAccount && line.length > 10 && !line.match(/^\d+$/))
      ) {
        if (!line.match(/^(Итого|национальной|операций)/i)) {
          purposeLines.push(line);
          collectingPurpose = true;
        }
      }
    }

    flushCurrent();

    if (transactions.length === 0 && this.aiExtractor.isAvailable()) {
      this.logger.debug('No transactions parsed, trying AI...');
      try {
        const aiTransactions = await this.aiExtractor.extractTransactions(text);
        return aiTransactions;
      } catch (error) {
        this.logger.error('AI extraction failed:', error);
        return [];
      }
    }

    return transactions;
  }

  private extractKaspiTableTransactions(
    tableRows: string[][],
    defaultCurrency = 'KZT',
  ): ParsedTransaction[] {
    if (!tableRows.length) {
      return [];
    }

    const cleanedRows = tableRows.map(row => (row || []).map(c => (c || '').trim()));
    const headerIndex = cleanedRows.findIndex(row =>
      row.join(' ').toLowerCase().includes('номер документа'),
    );

    if (headerIndex === -1) {
      return [];
    }

    const header = cleanedRows[headerIndex].map(c => c.toLowerCase());
    const findIdx = (needle: string) => header.findIndex(c => c.includes(needle));

    const idxDocument = findIdx('номер');
    const idxDate = findIdx('дата');
    const idxDebit = findIdx('дебет');
    const idxCredit = findIdx('кредит');
    const idxName = findIdx('наимен');
    const idxAccount = findIdx('иик');
    const idxBank = findIdx('бик');
    const idxPurpose = findIdx('назнач');
    const idxBin = findIdx('бин');

    const dataRows = cleanedRows.slice(headerIndex + 1);
    const transactions: ParsedTransaction[] = [];

    for (const row of dataRows) {
      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('итого')) {
        break;
      }
      if ((idxDocument === -1 || !row[idxDocument]) && (idxDate === -1 || !row[idxDate])) {
        continue;
      }

      const transactionDate = idxDate >= 0 ? normalizeDate(row[idxDate]) : null;
      if (!transactionDate) {
        continue;
      }

      const debit = idxDebit >= 0 ? normalizeNumber(row[idxDebit]) || undefined : undefined;
      const credit = idxCredit >= 0 ? normalizeNumber(row[idxCredit]) || undefined : undefined;
      if (debit === undefined && credit === undefined) {
        continue;
      }

      const counterpartyName =
        (idxName >= 0 ? row[idxName] : '') ||
        (idxPurpose >= 0 ? row[idxPurpose] : 'Неизвестный контрагент');

      const transaction: ParsedTransaction = {
        transactionDate,
        documentNumber: idxDocument >= 0 ? row[idxDocument] : undefined,
        counterpartyName: counterpartyName || 'Неизвестный контрагент',
        counterpartyAccount: idxAccount >= 0 ? row[idxAccount] : undefined,
        counterpartyBank: idxBank >= 0 ? row[idxBank] : undefined,
        counterpartyBin: idxBin >= 0 ? row[idxBin] : undefined,
        debit,
        credit,
        paymentPurpose: idxPurpose >= 0 ? row[idxPurpose] : 'Не указано',
        currency: defaultCurrency,
      };

      transactions.push(transaction);
    }

    return transactions;
  }

  private looksLikeKaspiMetaLine(line: string): boolean {
    return (
      /^\d{2}\.\d{2}\.\d{4}/.test(line) ||
      /^\d{8}$/.test(line) ||
      /^[0-9\s.,]+$/.test(line) ||
      /^KZ\d+/i.test(line) ||
      /^[A-Z]{8}$/i.test(line) ||
      /^\d{3}$/.test(line)
    );
  }

  private enrichKaspiTransaction(
    currentTransaction: Partial<ParsedTransaction>,
    purposeLines: string[],
    blockLines: string[],
  ): ParsedTransaction {
    const normalizedLines = blockLines.map(l => l.trim()).filter(Boolean);
    const combinedBlock = normalizedLines.join(' ');

    let paymentPurpose = currentTransaction.paymentPurpose;
    if ((!paymentPurpose || paymentPurpose === 'Не указано') && purposeLines.length) {
      paymentPurpose = purposeLines.join(' ').trim();
    }

    if (!paymentPurpose || paymentPurpose === 'Не указано') {
      const purposeIdx = normalizedLines.findIndex(l => l.toLowerCase().includes('назначение'));
      if (purposeIdx >= 0 && purposeIdx < normalizedLines.length - 1) {
        paymentPurpose = normalizedLines
          .slice(purposeIdx + 1)
          .join(' ')
          .trim();
      }
    }

    if (!paymentPurpose || paymentPurpose === 'Не указано') {
      const freeText = normalizedLines
        .filter(l => !this.looksLikeKaspiMetaLine(l))
        .join(' ')
        .trim();
      if (freeText) {
        paymentPurpose = freeText;
      }
    }

    let counterpartyName = currentTransaction.counterpartyName;
    let counterpartyBin = currentTransaction.counterpartyBin;

    if (!counterpartyBin) {
      const binMatch = combinedBlock.match(/\b\d{12}\b/);
      if (binMatch) {
        counterpartyBin = binMatch[0];
      }
    }

    if (!counterpartyName || counterpartyName === 'Не указано') {
      const cpLine =
        normalizedLines.find(l => l.includes('БИН/ИИН') || l.match(/^(АО|ТОО|ИП)\s/i)) ||
        normalizedLines.find(
          l =>
            l.length > 5 &&
            !this.looksLikeKaspiMetaLine(l) &&
            !/назначение/i.test(l) &&
            !/каспи/i.test(l),
        );

      if (cpLine) {
        const name = cpLine.replace(/БИН\/ИИН\s*\d+/i, '').trim();
        if (name) {
          counterpartyName = name;
        }
      }
    }

    if ((!counterpartyName || counterpartyName === 'Не указано') && paymentPurpose) {
      const purposeNameMatch = paymentPurpose.match(
        /(?:от|поступление от|перевод от)\s+([A-Za-zА-Яа-яёЁ0-9"«»().\s-]{3,})/i,
      );
      if (purposeNameMatch) {
        counterpartyName = purposeNameMatch[1].trim();
      }
    }

    const currencyFromBlock = this.detectCurrency(combinedBlock);
    const currency = currencyFromBlock || currentTransaction.currency || 'KZT';

    let debit = currentTransaction.debit;
    let credit = currentTransaction.credit;
    // ponytail: the text-fallback path has no debit/credit column (unlike
    // extractKaspiTableTransactions, which reads real column headers), so an
    // amount is provisionally assigned to debit while scanning and direction
    // is inferred here from purpose keywords. "пополнение" is deliberately
    // excluded: it's ambiguous on Kaspi statements (also used for outgoing
    // mobile-balance top-ups), unlike the other three which are unambiguous
    // incoming-funds terms. Revisit with a labeled Kaspi sample if this
    // keyword list proves incomplete.
    if (debit !== undefined && credit === undefined) {
      const directionText = `${paymentPurpose || ''} ${combinedBlock}`.toLowerCase();
      if (/зачислен|поступлен|возврат/.test(directionText)) {
        credit = debit;
        debit = undefined;
      }
    }

    return {
      transactionDate: currentTransaction.transactionDate ?? new Date(),
      documentNumber: currentTransaction.documentNumber,
      counterpartyName: counterpartyName?.trim() || 'Неизвестный контрагент',
      counterpartyBin,
      counterpartyAccount: currentTransaction.counterpartyAccount,
      counterpartyBank: currentTransaction.counterpartyBank,
      debit,
      credit,
      paymentPurpose: paymentPurpose?.trim() || 'Не указано',
      currency: currency || 'KZT',
      exchangeRate: currentTransaction.exchangeRate,
      amountForeign: currentTransaction.amountForeign,
    };
  }
}
