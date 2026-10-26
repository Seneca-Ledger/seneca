/**
 * Column layouts of CSV exports from well-known banks, matched by their
 * header row. A preset is exact where the generic header guesser is a
 * heuristic: Revolut's "Completed Date" is the date, its "Amount" is signed,
 * Wise's "Target name" is the counterparty, Monzo's "Name" is the payee.
 */

/** Order of day and month in numeric dates such as 01/05/2026. */
export type DateOrder = 'dmy' | 'mdy';

export interface CsvPreset {
  name: string;
  /** Lower-cased header names that must all be present. */
  requires: string[];
  /** Lower-cased header name → mapping key the tabular parser understands. */
  columns: Record<
    string,
    'date' | 'debit' | 'credit' | 'amount' | 'counterparty' | 'purpose' | 'currency' | 'document'
  >;
  /** Unsigned amount columns: which way a bare positive number flows. */
  unsignedAmountDirection?: 'debit' | 'credit';
  /** A hint when the file has no currency column. */
  currency?: string;
  /** Used only when no date in the file settles the order (every day ≤ 12). */
  dateOrder?: DateOrder;
}

export const CSV_PRESETS: CsvPreset[] = [
  {
    name: 'Revolut',
    requires: ['completed date', 'description', 'amount', 'currency'],
    columns: {
      'completed date': 'date',
      description: 'counterparty',
      amount: 'amount',
      currency: 'currency',
      type: 'purpose',
    },
  },
  {
    name: 'Wise',
    requires: ['date', 'amount', 'currency', 'target name'],
    columns: {
      date: 'date',
      amount: 'amount',
      currency: 'currency',
      'target name': 'counterparty',
      description: 'purpose',
      id: 'document',
    },
  },
  {
    name: 'N26',
    requires: ['booking date', 'partner name', 'amount (eur)'],
    columns: {
      'booking date': 'date',
      'partner name': 'counterparty',
      'amount (eur)': 'amount',
      'payment reference': 'purpose',
    },
    currency: 'EUR',
  },
  {
    name: 'N26 (legacy)',
    requires: ['date', 'payee', 'amount (eur)'],
    columns: {
      date: 'date',
      payee: 'counterparty',
      'amount (eur)': 'amount',
      'payment reference': 'purpose',
    },
    currency: 'EUR',
  },
  {
    name: 'Monzo',
    requires: ['transaction id', 'date', 'name', 'amount'],
    columns: {
      date: 'date',
      name: 'counterparty',
      amount: 'amount',
      description: 'purpose',
      currency: 'currency',
      'transaction id': 'document',
    },
  },
  {
    name: 'Starling',
    requires: ['date', 'counter party', 'amount (gbp)'],
    columns: {
      date: 'date',
      'counter party': 'counterparty',
      reference: 'purpose',
      'amount (gbp)': 'amount',
    },
    currency: 'GBP',
  },
  {
    name: 'Chase',
    requires: ['transaction date', 'post date', 'description', 'amount'],
    columns: {
      'transaction date': 'date',
      description: 'counterparty',
      amount: 'amount',
      category: 'purpose',
    },
    currency: 'USD',
    dateOrder: 'mdy',
  },
  {
    name: 'Bank of America',
    requires: ['date', 'description', 'amount', 'running bal.'],
    columns: { date: 'date', description: 'counterparty', amount: 'amount' },
    currency: 'USD',
    dateOrder: 'mdy',
  },
  {
    name: 'Capital One',
    requires: ['transaction date', 'posted date', 'description', 'debit', 'credit'],
    columns: {
      'transaction date': 'date',
      description: 'counterparty',
      debit: 'debit',
      credit: 'credit',
      category: 'purpose',
    },
    currency: 'USD',
    dateOrder: 'mdy',
  },
  {
    name: 'American Express',
    requires: ['date', 'description', 'amount', 'card member'],
    // Amex lists charges as positive numbers.
    columns: {
      date: 'date',
      description: 'counterparty',
      amount: 'amount',
      'extended details': 'purpose',
    },
    unsignedAmountDirection: 'debit',
    currency: 'USD',
    dateOrder: 'mdy',
  },
  {
    name: 'Wells Fargo',
    requires: ['date', 'amount', 'description'],
    columns: { date: 'date', amount: 'amount', description: 'counterparty' },
    currency: 'USD',
    dateOrder: 'mdy',
  },
  {
    name: 'PayPal',
    requires: ['date', 'name', 'gross', 'currency'],
    columns: {
      date: 'date',
      name: 'counterparty',
      gross: 'amount',
      currency: 'currency',
      type: 'purpose',
      'transaction id': 'document',
    },
  },
  {
    name: 'ING (NL)',
    requires: ['datum', 'naam / omschrijving', 'af bij', 'bedrag (eur)'],
    columns: {
      datum: 'date',
      'naam / omschrijving': 'counterparty',
      'bedrag (eur)': 'amount',
      mededelingen: 'purpose',
    },
    currency: 'EUR',
  },
  {
    name: 'Rabobank',
    requires: ['iban/bban', 'datum', 'bedrag', 'naam tegenpartij'],
    columns: {
      datum: 'date',
      bedrag: 'amount',
      'naam tegenpartij': 'counterparty',
      'omschrijving-1': 'purpose',
      munt: 'currency',
    },
  },
  {
    name: 'Sparkasse / DKB (CAMT-CSV)',
    requires: ['buchungstag', 'verwendungszweck', 'betrag'],
    columns: {
      buchungstag: 'date',
      verwendungszweck: 'purpose',
      betrag: 'amount',
      'beguenstigter/zahlungspflichtiger': 'counterparty',
      waehrung: 'currency',
    },
    currency: 'EUR',
  },
  {
    name: 'Commerzbank',
    requires: ['buchungstag', 'umsatzart', 'buchungstext', 'betrag'],
    columns: {
      buchungstag: 'date',
      buchungstext: 'purpose',
      betrag: 'amount',
      währung: 'currency',
    },
    currency: 'EUR',
  },
  {
    name: 'Nordea',
    requires: ['bokföringsdag', 'belopp', 'rubrik'],
    columns: {
      bokföringsdag: 'date',
      belopp: 'amount',
      rubrik: 'counterparty',
      valuta: 'currency',
    },
    currency: 'SEK',
  },
  {
    name: 'Santander UK',
    requires: ['date', 'description', 'money in', 'money out'],
    columns: {
      date: 'date',
      description: 'counterparty',
      'money in': 'credit',
      'money out': 'debit',
    },
    currency: 'GBP',
  },
  {
    name: 'Barclays',
    requires: ['number', 'date', 'account', 'amount', 'subcategory', 'memo'],
    columns: { date: 'date', amount: 'amount', memo: 'counterparty', subcategory: 'purpose' },
    currency: 'GBP',
  },
  {
    name: 'HSBC',
    requires: ['date', 'description', 'amount'],
    columns: { date: 'date', description: 'counterparty', amount: 'amount' },
    currency: 'GBP',
  },
  {
    name: 'Lloyds',
    requires: ['transaction date', 'transaction description', 'debit amount', 'credit amount'],
    columns: {
      'transaction date': 'date',
      'transaction description': 'counterparty',
      'debit amount': 'debit',
      'credit amount': 'credit',
    },
    currency: 'GBP',
  },
  {
    name: 'Tinkoff / T-Bank',
    requires: ['дата операции', 'сумма операции', 'описание'],
    columns: {
      'дата операции': 'date',
      'сумма операции': 'amount',
      описание: 'counterparty',
      категория: 'purpose',
      'валюта операции': 'currency',
    },
    currency: 'RUB',
  },
];

/** The first preset whose required headers are all present; exact header names, lower-cased. */
export function findCsvPreset(headers: string[]): CsvPreset | null {
  const set = new Set(headers.map(header => header.trim().toLowerCase()));
  return CSV_PRESETS.find(preset => preset.requires.every(header => set.has(header))) ?? null;
}

/** Index-based mapping the tabular parser consumes, from a preset and the actual header row. */
export function presetColumnMapping(preset: CsvPreset, headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  headers.forEach((header, index) => {
    const key = preset.columns[header.trim().toLowerCase()];
    if (key && mapping[key] === undefined) mapping[key] = index;
  });
  return mapping;
}
