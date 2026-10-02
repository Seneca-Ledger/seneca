import { BadRequestException } from '@nestjs/common';
import * as xlsx from 'xlsx';
import { normalizeDate, normalizeNumber } from '../../common/utils/number-normalizer.util';
import type { BalanceHistoryPoint } from './balance.service';

/**
 * Header spellings we accept, lower-cased. People bring these files out of
 * their old app or their own spreadsheet, so the column is called whatever
 * that app called it.
 */
const DATE_HEADERS = ['date', 'day', 'дата', 'день', 'период'];
const AMOUNT_HEADERS = ['amount', 'balance', 'value', 'сумма', 'баланс', 'значение'];
const CURRENCY_HEADERS = ['currency', 'валюта'];

/**
 * The dated balances in a CSV or spreadsheet.
 *
 * Rows without both a date and an amount are skipped rather than refused: an
 * export usually carries a total row or a note at the bottom, and throwing the
 * whole file away over it would send the user back to editing by hand.
 */
export function readBalanceHistoryFile(buffer: Buffer): BalanceHistoryPoint[] {
  // cellDates, or a spreadsheet hands back its own serial numbers for days;
  // codepage, or a CSV is read as Windows-1252 and non-Latin headers arrive
  // as mojibake that matches nothing.
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true, codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new BadRequestException('The file has no sheet to read');
  }

  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const headers = Object.keys(rows[0] ?? {});
  const dateKey = matchHeader(headers, DATE_HEADERS);
  const amountKey = matchHeader(headers, AMOUNT_HEADERS);
  if (!(dateKey && amountKey)) {
    throw new BadRequestException(
      'The file needs a date column and an amount column (date, amount)',
    );
  }
  const currencyKey = matchHeader(headers, CURRENCY_HEADERS);

  const points: BalanceHistoryPoint[] = [];
  for (const row of rows) {
    const date = toDate(row[dateKey]);
    const amount = normalizeNumber(String(row[amountKey] ?? ''));
    if (!date || amount === null) {
      continue;
    }
    const currency = currencyKey ? String(row[currencyKey] ?? '').trim() : '';
    points.push({
      date: toDateOnly(date),
      amount,
      currency: currency || undefined,
    });
  }

  if (points.length === 0) {
    throw new BadRequestException('No dated amounts were found in the file');
  }
  return points;
}

/** A cell a spreadsheet already understood as a day, or a date someone typed. */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  return normalizeDate(String(value ?? ''));
}

function matchHeader(headers: string[], accepted: string[]): string | null {
  return headers.find(header => accepted.includes(header.trim().toLowerCase())) ?? null;
}

/** Local parts, not the UTC ones: the file means the day it says. */
function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
