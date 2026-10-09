import { appDefaultCurrency } from '../../../common/utils/currency.util';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';

type TabularColumnMapping = Record<string, number>;

export abstract class BaseTabularParser extends BaseParser {
  /**
   * Converts a raw table cell to a Date. Handles Excel serial dates (numeric
   * cells like 45424) and rejects dates with implausible years, which appear
   * when free-text cells accidentally parse as dates.
   */
  protected normalizeCellDate(value: unknown): Date | null {
    if (typeof value === 'number' && value >= 15000 && value <= 80000) {
      // Excel serial date: days since 1899-12-30 (range ≈ 1941..2119)
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = this.normalizeDate(String(value ?? ''));
    if (!date || Number.isNaN(date.getTime())) {
      return null;
    }
    const year = date.getFullYear();
    return year >= 1950 && year <= 2100 ? date : null;
  }

  /**
   * Finds the most plausible transaction-table header row within the first
   * `maxScan` rows: the row whose cells map to the most columns, requiring at
   * least a date column and one money column (debit/credit/amount).
   */
  protected findHeaderRow(
    rows: Array<unknown[] | undefined>,
    maxScan = 40,
  ): { index: number; mapping: TabularColumnMapping } | null {
    let best: { index: number; mapping: TabularColumnMapping; score: number } | null = null;
    for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
      const row = rows[i];
      if (!row || row.length < 2) {
        continue;
      }
      const mapping = this.mapColumns(
        row.map(cell =>
          String(cell ?? '')
            .toLowerCase()
            .trim(),
        ),
      );
      if (
        mapping.date === undefined ||
        (mapping.debit === undefined &&
          mapping.credit === undefined &&
          mapping.amount === undefined)
      ) {
        continue;
      }
      const score = Object.keys(mapping).length;
      if (!best || score > best.score) {
        best = { index: i, mapping, score };
      }
    }
    return best ? { index: best.index, mapping: best.mapping } : null;
  }

  protected mapColumns(headers: string[]): TabularColumnMapping {
    const mapping: TabularColumnMapping = {};

    // `??=` (not `=`): a category's keyword can match more than one header
    // in the same file (e.g. both "Сумма операции" and "Сумма в валюте
    // счета" contain "сумма"). The first, left-to-right match — normally
    // the primary column for that category — wins instead of a later,
    // secondary column silently overwriting it with no warning.
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase();
      // "Deposit No.", "Cheque number", "Payment date" are not money columns
      const looksLikeIdOrDate = /\b(no\.?|number|id|ref|date)\b|#|дата|номер/.test(lowerHeader);
      if (
        lowerHeader.includes('дата') ||
        lowerHeader.includes('date') ||
        lowerHeader.includes('fecha') ||
        lowerHeader.includes('data')
      ) {
        mapping.date ??= index;
      }
      if (
        lowerHeader.includes('номер') ||
        lowerHeader.includes('документ') ||
        lowerHeader.includes('document') ||
        lowerHeader.includes('номерок') ||
        lowerHeader.includes('doc')
      ) {
        mapping.document ??= index;
      }
      if (
        lowerHeader.includes('контрагент') ||
        lowerHeader.includes('counterparty') ||
        lowerHeader.includes('beneficiary') ||
        lowerHeader.includes('cliente') ||
        lowerHeader.includes('payer') ||
        lowerHeader.includes('payee')
      ) {
        mapping.counterparty ??= index;
      }
      if (
        lowerHeader.includes('бин') ||
        lowerHeader.includes('bin') ||
        lowerHeader.includes('inn') ||
        lowerHeader.includes('tax')
      ) {
        mapping.bin ??= index;
      }
      if (
        lowerHeader.includes('счёт') ||
        lowerHeader.includes('счет') ||
        lowerHeader.includes('account') ||
        lowerHeader.includes('iban')
      ) {
        mapping.account ??= index;
      }
      if (lowerHeader.includes('банк') || lowerHeader.includes('bank')) {
        mapping.bank ??= index;
      }
      if (
        !looksLikeIdOrDate &&
        (lowerHeader.includes('дебет') ||
          lowerHeader.includes('debit') ||
          lowerHeader.includes('debe') ||
          lowerHeader.includes('withdrawal') ||
          lowerHeader.includes('charges') ||
          lowerHeader.includes('money out') ||
          lowerHeader.includes('paid out') ||
          lowerHeader.includes('£ out') ||
          lowerHeader.includes('расход'))
      ) {
        mapping.debit ??= index;
      }
      if (
        !looksLikeIdOrDate &&
        (lowerHeader.includes('кредит') ||
          lowerHeader.includes('credit') ||
          lowerHeader.includes('haber') ||
          lowerHeader.includes('deposit') ||
          lowerHeader.includes('money in') ||
          lowerHeader.includes('paid in') ||
          lowerHeader.includes('£ in') ||
          lowerHeader.includes('приход'))
      ) {
        mapping.credit ??= index;
      }
      if (
        lowerHeader === 'сумма' ||
        lowerHeader === 'amount' ||
        lowerHeader === 'monto' ||
        lowerHeader === 'importe' ||
        (!looksLikeIdOrDate &&
          (lowerHeader.includes('сумма') ||
            lowerHeader.includes('amount') ||
            lowerHeader.includes('importe')))
      ) {
        mapping.amount ??= index;
      }
      if (
        lowerHeader.includes('назначение') ||
        lowerHeader.includes('цель') ||
        lowerHeader.includes('purpose') ||
        lowerHeader.includes('описание') ||
        lowerHeader.includes('description') ||
        lowerHeader.includes('descr') ||
        lowerHeader.includes('concepto') ||
        (!looksLikeIdOrDate &&
          (lowerHeader.includes('transaction') ||
            lowerHeader.includes('details') ||
            lowerHeader.includes('particulars') ||
            lowerHeader.includes('narrative')))
      ) {
        mapping.purpose ??= index;
      }
      if (
        lowerHeader === 'валюта' ||
        lowerHeader === 'currency' ||
        lowerHeader === 'ccy' ||
        lowerHeader === 'cur' ||
        lowerHeader.includes('валюта') ||
        lowerHeader.includes('currency')
      ) {
        mapping.currency ??= index;
      }
    });

    return mapping;
  }

  protected parseRow(
    _row: unknown,
    columnMapping: TabularColumnMapping,
    getValue: (index: number) => unknown,
    sourceLabel = 'tabular',
    defaultCurrency = appDefaultCurrency(),
    unsignedAmountDirection: 'debit' | 'credit' = 'credit',
  ): ParsedTransaction | null {
    try {
      const dateIndex = columnMapping.date;
      if (dateIndex === undefined) {
        return null;
      }

      const transactionDate = this.normalizeCellDate(getValue(dateIndex));
      if (!transactionDate) {
        return null;
      }

      const documentIndex = columnMapping.document;
      const counterpartyIndex = columnMapping.counterparty;
      const binIndex = columnMapping.bin;
      const accountIndex = columnMapping.account;
      const bankIndex = columnMapping.bank;
      const debitIndex = columnMapping.debit;
      const creditIndex = columnMapping.credit;
      const amountIndex = columnMapping.amount;
      const purposeIndex = columnMapping.purpose;
      const currencyIndex = columnMapping.currency;

      const currencyFromColumn =
        currencyIndex !== undefined
          ? String(getValue(currencyIndex) || '')
              .trim()
              .toUpperCase()
          : null;
      const currency =
        currencyFromColumn && /^[A-Z]{3}$/.test(currencyFromColumn)
          ? currencyFromColumn
          : defaultCurrency;

      let debit =
        debitIndex !== undefined
          ? this.normalizeNumberValue(getValue(debitIndex) as string | number | null | undefined) ||
            undefined
          : undefined;
      let credit =
        creditIndex !== undefined
          ? this.normalizeNumberValue(
              getValue(creditIndex) as string | number | null | undefined,
            ) || undefined
          : undefined;

      // Single "Amount" column: sign decides direction; unsigned amounts fall
      // to the caller-provided hint (e.g. a "Withdrawals" section caption).
      if (debit === undefined && credit === undefined && amountIndex !== undefined) {
        const amount = this.normalizeNumberValue(
          getValue(amountIndex) as string | number | null | undefined,
        );
        if (amount !== null && amount !== 0) {
          if (amount < 0) {
            debit = Math.abs(amount);
          } else if (unsignedAmountDirection === 'debit') {
            debit = amount;
          } else {
            credit = amount;
          }
        }
      }

      return {
        transactionDate,
        documentNumber:
          documentIndex !== undefined ? String(getValue(documentIndex) || '') : undefined,
        counterpartyName:
          counterpartyIndex !== undefined ? String(getValue(counterpartyIndex) || '') : 'Unknown',
        counterpartyBin: binIndex !== undefined ? String(getValue(binIndex) || '') : undefined,
        counterpartyAccount:
          accountIndex !== undefined ? String(getValue(accountIndex) || '') : undefined,
        counterpartyBank: bankIndex !== undefined ? String(getValue(bankIndex) || '') : undefined,
        debit,
        credit,
        paymentPurpose:
          purposeIndex !== undefined ? String(getValue(purposeIndex) || '') : 'Не указано',
        currency,
      };
    } catch (error) {
      this.logger.error(`Error parsing ${sourceLabel} row:`, error);
      return null;
    }
  }
}
