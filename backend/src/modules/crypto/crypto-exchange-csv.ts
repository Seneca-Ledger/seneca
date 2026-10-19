/**
 * Reading a CSV an exchange exported.
 *
 * Most people's coins are not on a chain we can read, they are on Coinbase,
 * Binance or Kraken — and every one of those lets you download your history.
 * This turns such a file into plain entries; what they mean for the ledger is
 * decided in the import service, and nothing here touches the database.
 *
 * A file whose header we do not recognise returns null rather than a guess: a
 * mis-read row would quietly change what the user is said to own.
 */

export type ExchangeName = 'Coinbase' | 'Binance' | 'Kraken';

/**
 * What a row did. A `trade` swaps one thing for another, a `move` carries coins
 * in or out of the account, `earn` is interest or staking the exchange paid, and
 * `fee` is what it charged.
 */
export type ExchangeEntryKind = 'trade' | 'move' | 'earn' | 'fee';

export interface ExchangeEntry {
  /** The exchange's own id for the row, or the row's text when it has none. */
  reference: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Ticker, uppercase and normalised (Kraken's `XXBT` is `BTC`). */
  asset: string;
  /** Signed: positive into the account, negative out of it. */
  amount: number;
  kind: ExchangeEntryKind;
  description: string;
  /**
   * What the row actually cost or fetched, when the file says so. Coinbase states
   * it; Kraken and Binance put the money on a row of its own, which would double
   * count, so there the price of the day is used instead.
   */
  value?: { amount: number; currency: string };
}

export interface ParsedExchangeFile {
  exchange: ExchangeName;
  entries: ExchangeEntry[];
}

/** Money on the exchange is not a holding we can price; those rows are skipped. */
const FIAT = new Set(['USD', 'EUR', 'GBP', 'CHF', 'KZT', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK']);

/** Kraken's own spellings, which no other exchange uses. */
const KRAKEN_ASSETS: Record<string, string> = {
  XXBT: 'BTC',
  XBT: 'BTC',
  XETH: 'ETH',
  XXDG: 'DOGE',
  XDG: 'DOGE',
  XLTC: 'LTC',
  XXRP: 'XRP',
  ZUSD: 'USD',
  ZEUR: 'EUR',
  ZGBP: 'GBP',
};

export function parseExchangeCsv(text: string): ParsedExchangeFile | null {
  const rows = splitCsv(text);
  const header = findHeader(rows);
  if (!header) {
    return null;
  }

  const { index, columns } = header;
  const body = rows.slice(index + 1).filter(row => row.some(cell => cell.trim() !== ''));

  if (has(columns, ['transaction type', 'asset', 'quantity transacted'])) {
    return { exchange: 'Coinbase', entries: coinbase(columns, body) };
  }
  if (has(columns, ['operation', 'coin', 'change'])) {
    return { exchange: 'Binance', entries: binance(columns, body) };
  }
  if (has(columns, ['refid', 'type', 'asset', 'amount'])) {
    return { exchange: 'Kraken', entries: kraken(columns, body) };
  }
  return null;
}

/**
 * Coinbase puts a preamble above the header, so the header is found by its
 * content rather than by position.
 */
function findHeader(rows: string[][]): { index: number; columns: Map<string, number> } | null {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const names = rows[index].map(cell => cell.trim().toLowerCase());
    const columns = new Map(names.map((name, position) => [name, position]));
    if (
      has(columns, ['transaction type', 'asset']) ||
      has(columns, ['operation', 'coin']) ||
      has(columns, ['refid', 'asset'])
    ) {
      return { index, columns };
    }
  }
  return null;
}

function coinbase(columns: Map<string, number>, rows: string[][]): ExchangeEntry[] {
  const entries: ExchangeEntry[] = [];
  for (const row of rows) {
    const date = isoDate(cell(row, columns, 'timestamp'));
    const type = cell(row, columns, 'transaction type');
    const asset = normalizeAsset(cell(row, columns, 'asset'));
    const quantity = toNumber(cell(row, columns, 'quantity transacted'));
    const notes = cell(row, columns, 'notes');
    const reference = cell(row, columns, 'id') || `${date}|${type}|${asset}|${quantity}`;
    if (!(date && asset && quantity)) {
      continue;
    }

    const kind = coinbaseKind(type);
    // The total includes the fee and the spread: it is the money that actually
    // moved, which is what a cost basis and a tax return are made of.
    const money = toNumber(
      cell(row, columns, 'total (inclusive of fees and/or spread)') ||
        cell(row, columns, 'total (inclusive of fees)') ||
        cell(row, columns, 'subtotal'),
    );
    const moneyCurrency = (
      cell(row, columns, 'price currency') || cell(row, columns, 'spot price currency')
    ).toUpperCase();
    const value =
      money > 0 && moneyCurrency ? { amount: money, currency: moneyCurrency } : undefined;
    // "Converted 0.005 BTC to 0.079 ETH": the row states the coin that left, the
    // note states the one that arrived. Without the note only the first is known.
    const converted = /converted\s+[\d.,]+\s+\w+\s+to\s+([\d.,]+)\s+(\w+)/i.exec(notes);
    const outgoing = kind === 'trade' && /sell|convert/i.test(type);

    if (!FIAT.has(asset)) {
      entries.push({
        reference,
        date,
        asset,
        amount: outgoing ? -Math.abs(quantity) : Math.abs(quantity),
        kind,
        description: `${type}${notes ? ` — ${notes}` : ''}`.trim(),
        ...(value ? { value } : {}),
      });
    }

    if (converted) {
      const target = normalizeAsset(converted[2]);
      if (!FIAT.has(target)) {
        entries.push({
          reference: `${reference}|to`,
          date,
          asset: target,
          amount: Math.abs(toNumber(converted[1])),
          kind: 'trade',
          description: notes,
        });
      }
    }
  }
  return entries;
}

function coinbaseKind(type: string): ExchangeEntryKind {
  const value = type.toLowerCase();
  if (/reward|income|interest|inflation/.test(value)) {
    return 'earn';
  }
  if (/buy|sell|convert|trade/.test(value)) {
    return 'trade';
  }
  return 'move';
}

function binance(columns: Map<string, number>, rows: string[][]): ExchangeEntry[] {
  const entries: ExchangeEntry[] = [];
  for (const row of rows) {
    const date = isoDate(cell(row, columns, 'utc_time'));
    const operation = cell(row, columns, 'operation');
    const asset = normalizeAsset(cell(row, columns, 'coin'));
    const change = toNumber(cell(row, columns, 'change'));
    if (!(date && asset && change) || FIAT.has(asset)) {
      continue;
    }
    entries.push({
      reference: `${date}|${operation}|${asset}|${change}`,
      date,
      asset,
      amount: change,
      kind: binanceKind(operation),
      description: operation,
    });
  }
  return entries;
}

function binanceKind(operation: string): ExchangeEntryKind {
  const value = operation.toLowerCase();
  if (value.includes('fee')) {
    return 'fee';
  }
  if (/interest|reward|earn|distribution|airdrop|dividend/.test(value)) {
    return 'earn';
  }
  if (/deposit|withdraw|transfer/.test(value)) {
    return 'move';
  }
  return 'trade';
}

/**
 * Kraken's ledger has one row per movement, and states the fee in its own column
 * rather than on a row of its own; that fee becomes a second entry here.
 */
function kraken(columns: Map<string, number>, rows: string[][]): ExchangeEntry[] {
  const entries: ExchangeEntry[] = [];
  for (const row of rows) {
    const date = isoDate(cell(row, columns, 'time'));
    const type = cell(row, columns, 'type');
    const asset = normalizeAsset(cell(row, columns, 'asset'));
    const amount = toNumber(cell(row, columns, 'amount'));
    const fee = toNumber(cell(row, columns, 'fee'));
    const reference = cell(row, columns, 'txid') || `${date}|${type}|${asset}|${amount}`;
    if (!(date && asset) || FIAT.has(asset)) {
      continue;
    }

    if (amount) {
      entries.push({
        reference,
        date,
        asset,
        amount,
        kind: krakenKind(type),
        description: type,
      });
    }
    if (fee > 0) {
      entries.push({
        reference: `${reference}|fee`,
        date,
        asset,
        amount: -fee,
        kind: 'fee',
        description: `${type} fee`,
      });
    }
  }
  return entries;
}

function krakenKind(type: string): ExchangeEntryKind {
  const value = type.toLowerCase();
  if (/staking|earn|reward|dividend/.test(value)) {
    return 'earn';
  }
  if (/deposit|withdrawal|transfer/.test(value)) {
    return 'move';
  }
  return 'trade';
}

function has(columns: Map<string, number>, names: string[]): boolean {
  return names.every(name => columns.has(name));
}

function cell(row: string[], columns: Map<string, number>, name: string): string {
  const index = columns.get(name);
  return index === undefined ? '' : (row[index] ?? '').trim();
}

/** `XXBT` → `BTC`, `ETH.S` (staked) → `ETH`. */
function normalizeAsset(value: string): string {
  const ticker = value.trim().toUpperCase().split('.')[0];
  return KRAKEN_ASSETS[ticker] ?? ticker;
}

/** The leading date of an ISO or `YYYY-MM-DD HH:MM:SS` timestamp. */
function isoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/[^\d.eE+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** RFC 4180: commas inside quotes are data, `""` is a quote. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
