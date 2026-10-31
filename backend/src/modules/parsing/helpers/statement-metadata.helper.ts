import { findStatementAmounts } from './statement-amount.helper';
import { findFullDates, foldText, type NumericDateOrder } from './statement-date.helper';

/**
 * Statement header facts read from free text, for statements in English,
 * French, Dutch, German and Spanish.
 */

const ISO_CODES =
  /\b(KZT|UZS|GEL|UAH|BYN|AMD|AZN|KGS|TJS|TMT|USD|EUR|RUB|GBP|CNY|TRY|AED|JPY|CHF|CAD|AUD|SEK|NOK|DKK|PLN|CZK|HUF|RON|INR|BRL|MXN|SGD|HKD|NZD|ZAR|THB|MYR|IDR|ILS|SAR|QAR|KWD)\b/g;

const PREFIXED_DOLLARS: [RegExp, string][] = [
  [/\bS\$/, 'SGD'],
  [/\bHK\$/, 'HKD'],
  [/\bC(?:A)?\$/, 'CAD'],
  [/\bA(?:U)?\$/, 'AUD'],
  [/\bNZ\$/, 'NZD'],
  [/\bUS\$/, 'USD'],
  [/\bR\$/, 'BRL'],
];

/**
 * Signs written with letters, glued to a figure with two decimals ("R13.40",
 * "-RM12.00"); a reference such as "R2D2" or "R66" is not money.
 */
const LETTER_SIGNS: [RegExp, string][] = [
  [/(?<![A-Za-z])RM\d[\d ,.]*[.,]\d{2}\b/, 'MYR'],
  [/(?<![A-Za-z])Rp\d[\d ,.]*[.,]\d{2}\b/, 'IDR'],
  [/(?<![A-Za-z])R\d[\d ,.]*[.,]\d{2}\b/, 'ZAR'],
];

/** Where a bare "$" is printed, the bank's country says which dollar. */
const DOLLAR_COUNTRIES: [RegExp, string][] = [
  [/\bcanada\b|\bqu[eé]bec\b/i, 'CAD'],
  [/\baustralia\b/i, 'AUD'],
  [/\bnew zealand\b/i, 'NZD'],
  [/\bsingapore\b/i, 'SGD'],
  [/\bhong kong\b/i, 'HKD'],
  [/\bm[eé]xico\b/i, 'MXN'],
];

/** Statements that print no currency at all, known by a code only one country uses. */
const UNMARKED_COUNTRIES: [RegExp, string][] = [
  [/\bIFSC\b/, 'INR'],
  [/\b(?:PIX|CNPJ|CPF)\b/, 'BRL'],
];

const SYMBOLS: [string, string][] = [
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['₸', 'KZT'],
  ['₽', 'RUB'],
  ['₪', 'ILS'],
  ['₹', 'INR'],
  ['฿', 'THB'],
  ['¥', 'JPY'],
];

/**
 * The statement currency: the ISO code printed most often (upper case only:
 * "try" and "eur" are words too), else a currency symbol.
 */
export function detectStatementCurrency(text: string): string | null {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(ISO_CODES)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const [mostPrinted] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (mostPrinted) {
    return mostPrinted[0];
  }

  const prefixed = PREFIXED_DOLLARS.find(([pattern]) => pattern.test(text));
  if (prefixed) {
    return prefixed[1];
  }
  const lettered = LETTER_SIGNS.find(([pattern]) => pattern.test(text));
  if (lettered) {
    return lettered[1];
  }
  const symbol = SYMBOLS.find(([mark]) => text.includes(mark));
  if (symbol) {
    return symbol[1];
  }
  if (text.includes('$')) {
    return DOLLAR_COUNTRIES.find(([pattern]) => pattern.test(text))?.[1] ?? 'USD';
  }
  return UNMARKED_COUNTRIES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

const ACCOUNT_LABEL =
  /(?:(?:account|acct\.?|conta)\s*(?:number|no\.?|#|:)|num[eé]ro\s+de\s+compte|rekeningnummer|kontonummer|n[uú]mero\s+de\s+cuenta)\s*[:.]?[ \t]*([X*\d][X*\d \t-]{3,}[X*\d])/i;
const IBAN_LABEL = /\bIBAN\s*[:.]?\s*([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?)/;

/** The account number as printed after its label, or the IBAN. */
export function findAccountNumber(text: string): string | null {
  const iban = text.match(IBAN_LABEL);
  if (iban) {
    return iban[1].replace(/\s+/g, '');
  }
  const labelled = text.match(ACCOUNT_LABEL);
  return labelled ? labelled[1].replace(/[ \t]+/g, ' ').trim() : null;
}

/** "09/01/2025 - 09/30/2025", "1 janvier 2025 - 31 janvier 2025", "from … to …", "From : … To : …". */
export function findStatementPeriod(
  text: string,
  order: NumericDateOrder,
): { from: Date; to: Date } | null {
  const folded = foldText(text);
  const dates = findFullDates(text, order);
  for (let index = 0; index + 1 < dates.length; index += 1) {
    const [from, to] = [dates[index], dates[index + 1]];
    const between = folded.slice(from.index + from.length, to.index);
    if (
      /^\s*(?:[-–—]|to|au|tot|bis|al|hasta|through)\s*:?\s*$/.test(between) &&
      from.date <= to.date
    ) {
      return { from: from.date, to: to.date };
    }
  }
  return null;
}

/**
 * The day the statement was drawn up, which dates printed without a year are
 * read against: the latest date it prints more than once, as the statement
 * date heads every page. The latest date of all can be years ahead ("payments
 * continue monthly until JUN 13, 2027"); it is the fallback when no date
 * repeats.
 */
export function findStatementAnchor(text: string, order: NumericDateOrder): Date | null {
  const counts = new Map<number, number>();
  for (const found of findFullDates(text, order)) {
    const time = found.date.getTime();
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  const repeated = [...counts].filter(([, count]) => count > 1).map(([time]) => time);
  const candidates = repeated.length > 0 ? repeated : [...counts.keys()];
  return candidates.length > 0 ? new Date(Math.max(...candidates)) : null;
}

const OPENING = [
  'opening balance',
  'balance brought forward',
  'previous balance',
  'beginning balance',
  "solde d'ouverture",
  'solde precedent',
  'ancien solde',
  'beginsaldo',
  'saldo inicial',
  'saldo anterior',
  'anfangssaldo',
  'alter kontostand',
];
const CLOSING = [
  'closing balance',
  'balance carried forward',
  'new balance',
  'ending balance',
  'solde de fermeture',
  'nouveau solde',
  'eindsaldo',
  'saldo final',
  'endsaldo',
  'neuer kontostand',
];
/** Words that alone, as a row's whole text, state a balance ("SALDO", "Balance"). */
const BALANCE_WORDS = ['balance', 'saldo', 'solde', 'balance forward', 'saldo atual'];

/**
 * The period between the dated balance rows, for a statement that prints no
 * period: "2020/09/30 Balance Brought Forward" opens it and "2020/10/31
 * Balance Carried Forward" closes it, even in a month without movements.
 */
export function findBalanceRowPeriod(
  text: string,
  order: NumericDateOrder,
): { from: Date; to: Date } | null {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const line of text.split('\n')) {
    const [found] = findFullDates(line, order);
    const folded = foldText(line);
    if (found && !from && OPENING.some(label => folded.includes(label))) {
      from = found.date;
    }
    if (found && CLOSING.some(label => folded.includes(label))) {
      to = found.date;
    }
  }
  return from && to && from <= to ? { from, to } : null;
}

/**
 * A row that states the balance instead of moving money: "Saldo Anterior
 * 35,65 (+)", "Opening Balance", a bare "SALDO", or one printed letter-spaced
 * ("S A L D O"). A label of one word must be the whole text: "Balance
 * transfer fee" moves money.
 */
export function isBalanceLabel(description: string): boolean {
  const folded = foldText(description)
    .replace(/[\s:.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const labels = [...OPENING, ...CLOSING];
  const spaced = /^(?:\S )+\S$/.test(folded) ? folded.replace(/ /g, '') : null;
  return (
    BALANCE_WORDS.includes(folded) ||
    labels.some(label => folded === label || folded.startsWith(`${label} `)) ||
    (spaced !== null &&
      [...BALANCE_WORDS, ...labels].some(label => label.replace(/ /g, '') === spaced))
  );
}

const DATED_BALANCE = /\b(?:balance|solde|saldo)\s+(?:as\s+(?:of|at)|on|au|per|op|al)\b/g;

/**
 * The last amount after a label, up to the end of its line: "Balance Carried
 * Forward: 2,181.67 2,002.15 15,271.23" ends with the balance. Dates on the
 * line are skipped. A dated balance takes the first: the figure right after
 * its date, whatever a box beside it prints on the same line ("Balance on 20
 * Jun 2025 £22,689.13   Debit card fee 8 £2.80").
 */
function amountAfter(
  text: string,
  folded: string,
  index: number,
  order: NumericDateOrder,
  pick: 'first' | 'last' = 'last',
) {
  const lineEnd = folded.indexOf('\n', index);
  const line = text.slice(index, lineEnd === -1 ? undefined : lineEnd);
  let withoutDates = line;
  for (const found of findFullDates(line, order).reverse()) {
    withoutDates = `${withoutDates.slice(0, found.index)} ${withoutDates.slice(found.index + found.length)}`;
  }
  const amounts = findStatementAmounts(withoutDates);
  return (pick === 'first' ? amounts[0] : amounts[amounts.length - 1]) ?? null;
}

function labelledAmount(text: string, folded: string, labels: string[], order: NumericDateOrder) {
  for (const label of labels) {
    for (let at = folded.indexOf(label); at !== -1; at = folded.indexOf(label, at + 1)) {
      const value = amountAfter(text, folded, at + label.length, order);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Opening and closing balance from their labels, or from two "balance as of
 * <date>" lines (the earlier date opens).
 */
export function findStatementBalances(
  text: string,
  order: NumericDateOrder,
): { start: number | null; end: number | null } {
  const folded = foldText(text).replace(/’/g, "'");
  const start = labelledAmount(text, folded, OPENING, order);
  const end = labelledAmount(text, folded, CLOSING, order);
  if (start !== null || end !== null) {
    return { start, end };
  }

  const dated = Array.from(folded.matchAll(DATED_BALANCE), match => {
    const after = (match.index ?? 0) + match[0].length;
    const lineEnd = folded.indexOf('\n', after);
    const line = text.slice(after, lineEnd === -1 ? undefined : lineEnd);
    const [date] = findFullDates(line, order);
    return { date: date?.date, amount: amountAfter(text, folded, after, order, 'first') };
  }).filter(
    (entry): entry is { date: Date; amount: number } => !!entry.date && entry.amount !== null,
  );
  if (dated.length < 2) {
    return { start: null, end: null };
  }
  dated.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { start: dated[0].amount, end: dated[dated.length - 1].amount };
}

/** Labels of the printed sums of a statement's credits and of its debits. */
const TOTAL_CREDITS = [
  'money in',
  'total money in',
  'total credits',
  'total deposits',
  'deposits and other additions',
  'total paid in',
];
const TOTAL_DEBITS = [
  'money out',
  'total money out',
  'total debits',
  'total withdrawals',
  'withdrawals and other subtractions',
  'total paid out',
];

/** Words that open a line of sums, not of a movement. */
const TOTAL_WORDS = ['total', 'totals', 'subtotal', 'sub total', 'summe', 'gesamt', 'итого'];

/**
 * A line that sums the rows above it ("Total 1,035.33", "TRANSACTION TOTAL",
 * "Money out 611.96"), not one more row: one of the labels as whole words.
 */
export function isTotalsLabel(description: string): boolean {
  const folded = ` ${foldText(description)
    .replace(/[\s:]+/g, ' ')
    .trim()} `;
  return [...TOTAL_WORDS, ...TOTAL_CREDITS, ...TOTAL_DEBITS].some(label =>
    folded.includes(` ${label} `),
  );
}

/**
 * The statement's printed sums of money in and money out ("Money in
 * £11,450.43", "Total withdrawals 2,040.00"): the first figure after the
 * label, as a box printed beside it can end the same line. Null for a side
 * the statement does not total.
 */
export function findStatementTotals(
  text: string,
  order: NumericDateOrder,
): { credits: number | null; debits: number | null } {
  const folded = foldText(text);
  const total = (labels: string[]) => {
    for (const label of labels) {
      const pattern = new RegExp(`(?:^|[^a-z])${label}(?![a-z])`, 'g');
      for (const match of folded.matchAll(pattern)) {
        const value = amountAfter(
          text,
          folded,
          (match.index ?? 0) + match[0].length,
          order,
          'first',
        );
        if (value !== null) {
          return Math.abs(value);
        }
      }
    }
    return null;
  };
  return { credits: total(TOTAL_CREDITS), debits: total(TOTAL_DEBITS) };
}

const CARD_MARKERS = [
  'minimum payment',
  'payment due date',
  'available credit',
  'credit limit',
  'credit line',
  'cardmember',
  'cardholder',
  'paiement minimum',
  'limite de credit',
  'minimumbetaling',
  'mindestzahlung',
  'pago minimo',
];

/**
 * A credit card statement prints charges as positive amounts and its balance
 * as what is owed. Bank arithmetic reconciles it just as well with every sign
 * flipped, so only the wording tells the two apart.
 */
export function isCreditCardStatement(text: string): boolean {
  const folded = foldText(text);
  return CARD_MARKERS.filter(marker => folded.includes(marker)).length >= 2;
}

const ACCOUNT_HEADING =
  /\b(?:account|compte|rekening|konto|cuenta)\b(?:\s+(?:number|no\.?|nr\.?|#))?\s*[:—–-]?\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30}|\d[\d -]{6,}\d)/i;

/**
 * The heading a statement prints above one account's table ("HKD Current
 * Account — 817-890692-838", "Numéro de compte: 67324-673-9893968"): the
 * number right after the word for account, and the currency code if the line
 * names one. Null for any other line.
 */
export function readAccountHeading(
  line: string,
): { accountNumber: string; currency?: string } | null {
  const match = line.match(ACCOUNT_HEADING);
  if (!match) {
    return null;
  }
  const currency = Array.from(line.matchAll(ISO_CODES), code => code[1])[0];
  return { accountNumber: match[1].trim(), ...(currency ? { currency } : {}) };
}
