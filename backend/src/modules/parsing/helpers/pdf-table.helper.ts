import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { normalizeDate, normalizeNumber } from '../../../common/utils/number-normalizer.util';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';

type TableColumnKey =
  | 'date'
  | 'document'
  | 'counterparty'
  | 'bin'
  | 'account'
  | 'bank'
  | 'debit'
  | 'credit'
  | 'purpose'
  | 'currency'
  | 'knp';

export interface TableParsingOptions {
  defaultCurrency?: string;
  stopWords?: string[];
}

const DATE_REGEX = /\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}:\d{2})?/;
const DEFAULT_STOP_WORDS = ['итого', 'оборот', 'остаток'];

export function getExcludedColumnIndexes(
  columnMap: Partial<Record<TableColumnKey, number>>,
  keys: TableColumnKey[],
): Set<number> {
  const excludedIndexes = new Set<number>();
  keys.forEach(key => {
    const idx = columnMap[key];
    if (idx !== undefined) {
      excludedIndexes.add(idx);
    }
  });

  return excludedIndexes;
}

export function mapPdfTableRowsToTransactions(
  tableRows: string[][],
  options?: TableParsingOptions,
): ParsedTransaction[] {
  const normalized = (tableRows || [])
    .map(row => (row || []).map(cell => sanitizeCell(cell)))
    .filter(row => row.some(cell => cell));

  if (!normalized.length) {
    return [];
  }

  const headerIndex = findHeaderIndex(normalized);
  const header = normalized[headerIndex];
  const dataRows = normalized.slice(headerIndex + 1);

  const columnMap = enhanceColumnMap(buildColumnMap(header), dataRows);
  const stopWords = options?.stopWords?.map(w => w.toLowerCase()) || DEFAULT_STOP_WORDS;

  const transactions: ParsedTransaction[] = [];
  let current: ParsedTransaction | null = null;

  for (const row of dataRows) {
    const rowText = row.join(' ').toLowerCase();
    if (stopWords.some(word => rowText.includes(word))) {
      break;
    }

    const dateValue = pickDateValue(row, columnMap);
    const parsedDate = dateValue ? normalizeDate(dateValue) : null;

    if (parsedDate) {
      if (current) {
        transactions.push(current);
      }
      current = buildTransactionFromRow(row, parsedDate, columnMap, options);
      continue;
    }

    if (current) {
      const continuation = collectContinuation(row, columnMap);
      if (continuation) {
        current.paymentPurpose = `${current.paymentPurpose} ${continuation}`.trim();
      }
    }
  }

  if (current) {
    transactions.push(current);
  }

  return transactions;
}

export function mergeTransactions(
  primary: ParsedTransaction[],
  secondary: ParsedTransaction[],
): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];
  const seen = new Set<string>();

  const pushUnique = (tx: ParsedTransaction) => {
    const key = buildSignature(tx);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(tx);
  };

  primary.forEach(pushUnique);
  secondary.forEach(pushUnique);

  return result;
}

function buildSignature(tx: ParsedTransaction): string {
  const datePart = tx.transactionDate ? tx.transactionDate.toISOString().split('T')[0] : 'no-date';
  const amount = tx.debit ?? tx.credit ?? 0;
  const doc = tx.documentNumber || '';
  const name = (tx.counterpartyName || '').toLowerCase();
  return `${datePart}|${doc}|${name}|${amount}`;
}

function sanitizeCell(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  return cell.toString().replace(/\s+/g, ' ').trim();
}

function isHeaderRow(row: string[]): boolean {
  const lowerJoined = row.join(' ').toLowerCase();
  const keywords = [
    'дата',
    'date',
    'номер',
    'документ',
    'контрагент',
    'получател',
    'плательщ',
    'бин',
    'iin',
    'счет',
    'счёт',
    'account',
    'банк',
    'debit',
    'дебет',
    'credit',
    'кредит',
    'назначение',
    'основание',
    'purpose',
  ];

  const matches = keywords.filter(kw => lowerJoined.includes(kw)).length;
  return matches >= 2;
}

function findHeaderIndex(rows: string[][]): number {
  // Pick the row with the largest number of non-empty cells as header
  let bestIndex = 0;
  let bestFilled = 0;

  rows.forEach((row, idx) => {
    const filled = row.filter(c => c && c.trim().length > 0).length;
    if (filled > bestFilled) {
      bestFilled = filled;
      bestIndex = idx;
    }
  });

  return bestIndex;
}

function buildColumnMap(header: string[]): Partial<Record<TableColumnKey, number>> {
  const map: Partial<Record<TableColumnKey, number>> = {};

  const definitions: Array<{ key: TableColumnKey; patterns: RegExp[] }> = [
    { key: 'date', patterns: [/\bdate\b/i, /дата/i, /күні|күн/i] },
    { key: 'document', patterns: [/документ/i, /номер/i, /\bnumber\b/i, /\bno\.?\b/i] },
    {
      key: 'counterparty',
      patterns: [/контрагент/i, /получател/i, /плательщ/i, /beneficiar/i, /payer/i, /payee/i],
    },
    { key: 'bin', patterns: [/\bбин\b/i, /\biin\b/i, /\bиин\b/i] },
    { key: 'account', patterns: [/сч[её]т/i, /account/i, /iban/i] },
    { key: 'bank', patterns: [/\bбанк/i, /\bbank\b/i, /\bbic\b/i, /бик/i] },
    { key: 'debit', patterns: [/\bdebit\b/i, /дебет/i, /списан/i, /расход/i] },
    { key: 'credit', patterns: [/\bcredit\b/i, /кредит/i, /поступ/i, /зачисл/i, /доход/i] },
    { key: 'purpose', patterns: [/назначени/i, /основани/i, /purpose/i, /description/i, /детал/i] },
    { key: 'currency', patterns: [/валют/i, /currency/i, /\bcurrency\b/i] },
    { key: 'knp', patterns: [/\bкнп\b/i, /\bknp\b/i] },
  ];

  header.forEach((cell, index) => {
    const value = sanitizeCell(cell);
    if (!value) {
      return;
    }

    const match = definitions.find(
      definition =>
        map[definition.key] === undefined &&
        definition.patterns.some(pattern => pattern.test(value)),
    );
    if (match) {
      map[match.key] = index;
    }
  });

  return map;
}

function enhanceColumnMap(
  base: Partial<Record<TableColumnKey, number>>,
  dataRows: string[][],
): Partial<Record<TableColumnKey, number>> {
  const map = { ...base };
  const columnsCount = dataRows[0]?.length || 0;
  if (columnsCount === 0) {
    return map;
  }

  const columnStats = buildColumnStats(dataRows);

  // Date column by frequency of date regex
  if (map.date === undefined) {
    const bestDate = columnStats
      .filter(c => c.dateMatches > 0)
      .sort((a, b) => b.dateMatches - a.dateMatches)[0];
    if (bestDate) {
      map.date = bestDate.index;
    }
  }

  // BIN / Account / Bank
  if (map.bin === undefined) {
    const binCol = columnStats
      .filter(c => c.binMatches > 0)
      .sort((a, b) => b.binMatches - a.binMatches)[0];
    if (binCol) {
      map.bin = binCol.index;
    }
  }

  if (map.account === undefined) {
    const accCol = columnStats
      .filter(c => c.accountMatches > 0)
      .sort((a, b) => b.accountMatches - a.accountMatches)[0];
    if (accCol) {
      map.account = accCol.index;
    }
  }

  if (map.bank === undefined) {
    const bankCol = columnStats
      .filter(c => c.bankMatches > 0)
      .sort((a, b) => b.bankMatches - a.bankMatches)[0];
    if (bankCol) {
      map.bank = bankCol.index;
    }
  }

  // Currency
  if (map.currency === undefined) {
    const curCol = columnStats
      .filter(c => c.currencyMatches > 0)
      .sort((a, b) => b.currencyMatches - a.currencyMatches)[0];
    if (curCol) {
      map.currency = curCol.index;
    }
  }

  const used = new Set<number>();
  Object.values(map).forEach(idx => {
    if (typeof idx === 'number') {
      used.add(idx);
    }
  });

  // Document number
  if (map.document === undefined) {
    const docCol = columnStats
      .filter(c => c.documentMatches > 0 && !used.has(c.index))
      .sort((a, b) => b.documentMatches - a.documentMatches || a.index - b.index)[0];
    if (docCol) {
      map.document = docCol.index;
      used.add(docCol.index);
    }
  }

  // KNP
  if (map.knp === undefined) {
    const knpCol = columnStats
      .filter(c => c.knpMatches > 0 && !used.has(c.index))
      .sort((a, b) => b.knpMatches - a.knpMatches || a.index - b.index)[0];
    if (knpCol) {
      map.knp = knpCol.index;
      used.add(knpCol.index);
    }
  }

  // Numeric columns for debit/credit
  const numericColumns = columnStats
    .filter(c => c.numericMatches > 0)
    .sort((a, b) => b.numericMatches - a.numericMatches || a.index - b.index);

  if (map.debit === undefined && numericColumns.length) {
    const candidate = numericColumns.find(c => !used.has(c.index));
    if (candidate) {
      map.debit = candidate.index;
      used.add(candidate.index);
    }
  }
  if (map.credit === undefined && numericColumns.length > 1) {
    const candidate = numericColumns.find(c => !used.has(c.index));
    if (candidate) {
      map.credit = candidate.index;
      used.add(candidate.index);
    }
  }

  // Counterparty / purpose: pick text-heavy columns not already used
  const textColumns = columnStats
    .filter(c => c.textScore > 0)
    .sort((a, b) => b.textScore - a.textScore || a.index - b.index);

  if (map.counterparty === undefined) {
    const candidate = textColumns.find(c => !used.has(c.index));
    if (candidate) {
      map.counterparty = candidate.index;
      used.add(candidate.index);
    }
  }

  if (map.purpose === undefined) {
    const candidate = textColumns.find(c => !used.has(c.index) && c.textScore > 0);
    if (candidate) {
      map.purpose = candidate.index;
      used.add(candidate.index);
    }
  }

  return map;
}

function buildColumnStats(dataRows: string[][]): Array<{
  index: number;
  dateMatches: number;
  numericMatches: number;
  textScore: number;
  binMatches: number;
  accountMatches: number;
  bankMatches: number;
  currencyMatches: number;
  documentMatches: number;
  knpMatches: number;
}> {
  const columnsCount = dataRows.reduce((max, row) => Math.max(max, row.length), 0);
  const stats: Array<{
    index: number;
    dateMatches: number;
    numericMatches: number;
    textScore: number;
    binMatches: number;
    accountMatches: number;
    bankMatches: number;
    currencyMatches: number;
    documentMatches: number;
    knpMatches: number;
  }> = [];

  for (let i = 0; i < columnsCount; i++) {
    let dateMatches = 0;
    let numericMatches = 0;
    let textScore = 0;
    let binMatches = 0;
    let accountMatches = 0;
    let bankMatches = 0;
    let currencyMatches = 0;
    let documentMatches = 0;
    let knpMatches = 0;

    dataRows.forEach(row => {
      const cell = row[i] || '';
      if (DATE_REGEX.test(cell)) {
        dateMatches += 1;
      }
      if (isAmount(cell)) {
        numericMatches += 1;
      }
      if (cell && !DATE_REGEX.test(cell) && !isAmount(cell)) {
        textScore += cell.length;
      }

      // BIN/Account/BIC/Currency detection
      if (/\b\d{11,12}\b/.test(cell.replace(/\s+/g, ''))) {
        binMatches += 1;
      }
      if (/KZ\d{10,}|[A-Z0-9]{20,}/i.test(cell)) {
        accountMatches += 1;
      }
      if (/[A-Z]{6}[A-Z0-9]{2,5}/.test(cell)) {
        bankMatches += 1;
      }
      if (/\b(USD|EUR|KZT|RUB)\b/i.test(cell)) {
        currencyMatches += 1;
      }
      if (/\b\d{5,}\b/.test(cell) && !DATE_REGEX.test(cell)) {
        documentMatches += 1;
      }
      if (/^\d{3}$/.test(cell) || /кнп/i.test(cell)) {
        knpMatches += 1;
      }
    });

    stats.push({
      index: i,
      dateMatches,
      numericMatches,
      textScore,
      binMatches,
      accountMatches,
      bankMatches,
      currencyMatches,
      documentMatches,
      knpMatches,
    });
  }

  return stats;
}

function pickDateValue(
  row: string[],
  columnMap: Partial<Record<TableColumnKey, number>>,
): string | null {
  if (columnMap.date !== undefined) {
    const value = row[columnMap.date];
    if (value && DATE_REGEX.test(value)) {
      return value;
    }
  }

  const fallback = row.find(cell => DATE_REGEX.test(cell));
  return fallback || null;
}

function buildTransactionFromRow(
  row: string[],
  transactionDate: Date,
  columnMap: Partial<Record<TableColumnKey, number>>,
  options?: TableParsingOptions,
): ParsedTransaction {
  let debit =
    columnMap.debit !== undefined
      ? (normalizeNumber(row[columnMap.debit]) ?? undefined)
      : undefined;
  let credit =
    columnMap.credit !== undefined
      ? (normalizeNumber(row[columnMap.credit]) ?? undefined)
      : undefined;

  // If only one amount was detected, try to infer debit/credit based on sign
  if (debit === undefined && credit === undefined) {
    const amounts = row.map(cell => normalizeNumber(cell)).filter(v => typeof v === 'number');
    if (amounts.length === 1) {
      const value = amounts[0];
      if (value !== 0) {
        debit = value > 0 ? value : undefined;
        credit = value < 0 ? Math.abs(value) : undefined;
      }
    }
  }

  const documentNumber = valueAt(row, columnMap.document) || extractDocument(row);
  const bin = valueAt(row, columnMap.bin) || extractBin(row);
  const account = valueAt(row, columnMap.account) || extractAccount(row);
  const bank = valueAt(row, columnMap.bank) || extractBank(row);
  const knp = valueAt(row, columnMap.knp);
  const currency =
    detectCurrency(row, columnMap) || options?.defaultCurrency || appDefaultCurrency();

  const counterpartyName =
    valueAt(row, columnMap.counterparty) || collectName(row, columnMap) || 'Неизвестный контрагент';

  const purpose = valueAt(row, columnMap.purpose) || collectPurpose(row, columnMap) || 'Не указано';

  return {
    transactionDate,
    documentNumber,
    counterpartyName: counterpartyName.trim(),
    counterpartyBin: bin,
    counterpartyAccount: account,
    counterpartyBank: bank,
    debit,
    credit,
    paymentPurpose: [purpose.trim(), knp ? `КНП ${knp}` : ''].filter(Boolean).join(' ').trim(),
    currency,
  };
}

function collectContinuation(
  row: string[],
  columnMap: Partial<Record<TableColumnKey, number>>,
): string {
  const excludedIndexes = getExcludedColumnIndexes(columnMap, [
    'date',
    'document',
    'debit',
    'credit',
    'purpose',
  ]);

  const parts = row
    .map((cell, idx) => ({ cell, idx }))
    .filter(({ idx, cell }) => !excludedIndexes.has(idx) && cell)
    .map(({ cell }) => cell);

  return parts.join(' ').trim();
}

function collectPurpose(row: string[], columnMap: Partial<Record<TableColumnKey, number>>): string {
  const used = new Set<number>();
  ['date', 'document', 'counterparty', 'bin', 'account', 'bank', 'debit', 'credit', 'knp'].forEach(
    key => {
      const columnKey = key as TableColumnKey;
      const idx = columnMap[columnKey];
      if (idx !== undefined) {
        used.add(idx);
      }
    },
  );

  const parts = row
    .map((cell, idx) => ({ cell, idx }))
    .filter(({ idx, cell }) => !(used.has(idx) || isAmount(cell) || DATE_REGEX.test(cell)))
    .map(({ cell }) => cell);

  return parts.join(' ').trim();
}

function collectName(
  row: string[],
  columnMap: Partial<Record<TableColumnKey, number>>,
): string | null {
  const excludedIndexes = getExcludedColumnIndexes(columnMap, [
    'date',
    'document',
    'debit',
    'credit',
    'purpose',
  ]);

  for (let i = 0; i < row.length; i++) {
    if (excludedIndexes.has(i)) {
      continue;
    }
    const cell = row[i];
    if (!cell || isAmount(cell) || DATE_REGEX.test(cell)) {
      continue;
    }
    if (cell.length > 2) {
      return cell;
    }
  }
  return null;
}

function valueAt(row: string[], index?: number): string | undefined {
  if (index === undefined) {
    return undefined;
  }
  return row[index];
}

function extractDocument(row: string[]): string | undefined {
  for (const cell of row) {
    const match = cell.match(/\b\d{5,}\b/);
    if (match) {
      return match[0];
    }
  }
  return undefined;
}

function extractBin(row: string[]): string | undefined {
  const text = row.join(' ');
  const match = text.match(/\b\d{11,12}\b/);
  return match ? match[0] : undefined;
}

function extractAccount(row: string[]): string | undefined {
  const text = row.join(' ');
  const match = text.match(/KZ\d{10,}|[A-Z0-9]{20,}/i);
  return match ? match[0].toUpperCase() : undefined;
}

function extractBank(row: string[]): string | undefined {
  const text = row.join(' ');
  const match = text.match(/[A-Z]{6}[A-Z0-9]{2,5}/);
  return match ? match[0] : undefined;
}

function detectCurrency(
  row: string[],
  columnMap: Partial<Record<TableColumnKey, number>>,
): string | undefined {
  if (columnMap.currency !== undefined) {
    const value = row[columnMap.currency];
    if (value) {
      return value.toUpperCase();
    }
  }

  const text = row.join(' ').toUpperCase();
  const match = text.match(/\b(USD|EUR|KZT|RUB)\b/);
  return match ? match[1] : undefined;
}

function isAmount(value: string): boolean {
  const num = normalizeNumber(value);
  return typeof num === 'number';
}
