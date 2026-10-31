/// <reference types="vitest/globals" />

import * as fs from 'fs';
import * as path from 'path';
import { FileType } from '../../../entities/statement.entity';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { ParserFactoryService } from '../services/parser-factory.service';

type ExpectedTransactionInput = Record<string, unknown> & {
  transactionDate?: string;
  date?: string;
};

function guessFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return FileType.PDF;
  }
  if (ext === '.xlsx' || ext === '.xls') {
    return FileType.XLSX;
  }
  if (ext === '.csv') {
    return FileType.CSV;
  }
  return FileType.PDF;
}

/**
 * One statement per account. A fixture for a file that prints several accounts
 * lists them under `accounts`; otherwise the fixture itself is the one account.
 */
function loadExpected(filePath: string): ParsedStatement[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const accounts: (typeof parsed)[] = Array.isArray(parsed.accounts) ? parsed.accounts : [parsed];
  return accounts.map(account => {
    const tx = Array.isArray(account.transactions)
      ? (account.transactions as ExpectedTransactionInput[])
      : [];
    const metadata = account.metadata || {};
    return {
      metadata: {
        accountNumber: metadata.accountNumber || '',
        currency: metadata.currency || 'KZT',
        dateFrom: new Date(metadata.dateFrom || metadata.date_from || Date.now()),
        dateTo: new Date(metadata.dateTo || metadata.date_to || metadata.dateFrom || Date.now()),
        balanceStart: metadata.balanceStart ?? metadata.balance_start,
        balanceEnd: metadata.balanceEnd ?? metadata.balance_end,
      },
      transactions: tx.map(t => ({
        ...t,
        transactionDate: new Date(t.transactionDate || t.date || Number.NaN),
        counterpartyName: typeof t.counterpartyName === 'string' ? t.counterpartyName : '',
        paymentPurpose: typeof t.paymentPurpose === 'string' ? t.paymentPurpose : '',
      })),
    };
  });
}

const sum = (list: ParsedStatement['transactions'], key: 'debit' | 'credit') =>
  list.reduce((acc, t) => acc + (Number(t[key]) || 0), 0);

/**
 * Local wall-clock time, the way the statement prints it and the way fixtures
 * store it ("2025-11-25T23:59:59", no zone). Comparing UTC strings instead
 * would shift midnight dates by a day depending on the machine's TZ.
 */
const toLocalDateTime = (value: Date | null | undefined) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
};

const toDateOnly = (value: Date | null | undefined) => toLocalDateTime(value)?.split('T')[0] ?? null;

/**
 * `loadExpected` falls back to "now" when a fixture omits a date, so only a date
 * that actually came from the fixture is worth asserting on.
 */
const hasRealDate = (value: Date | null | undefined) => {
  const dateOnly = toDateOnly(value);
  return dateOnly !== null && dateOnly !== toDateOnly(new Date());
};

/**
 * The comparable shape of a transaction. Amounts are rounded to cents and text
 * is whitespace-normalized so a fixture does not break on PDF spacing noise.
 */
function projectTransaction(
  transaction: ParsedStatement['transactions'][number],
  withPaymentType = false,
) {
  const round = (value: unknown) =>
    Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : null;

  return {
    date: toLocalDateTime(transaction.transactionDate),
    debit: round(transaction.debit),
    credit: round(transaction.credit),
    counterpartyName: (transaction.counterpartyName || '').replace(/\s+/g, ' ').trim(),
    documentNumber: (transaction.documentNumber || '').trim(),
    // Only a fixture that records the payment type is held to it.
    ...(withPaymentType && { paymentType: transaction.paymentType ?? null }),
  };
}

function listGoldenCases(root: string) {
  const cases: { input: string; expected: string }[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  entries.forEach(entry => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      listGoldenCases(full).forEach(c => cases.push(c));
    } else if (entry.isFile() && entry.name.endsWith('.expected.json')) {
      const inputCandidate = full.replace(/\.expected\.json$/, '');
      if (fs.existsSync(inputCandidate)) {
        cases.push({ input: inputCandidate, expected: full });
      }
    }
  });
  return cases;
}

describe('golden parsing (optional)', () => {
  const goldenRoot = path.resolve(__dirname, '../../../../golden');
  const goldenEnabled = process.env.GOLDEN_ENABLED === '1' || process.env.GOLDEN_ENABLED === 'true';

  if (!goldenEnabled) {
    it.skip('set GOLDEN_ENABLED=1 to run golden parsing checks', () => {});
    return;
  }

  if (!fs.existsSync(goldenRoot)) {
    it.skip(`golden dir not found at ${goldenRoot}`, () => {});
    return;
  }

  const cases = listGoldenCases(goldenRoot);
  if (cases.length === 0) {
    it.skip('no golden samples found', () => {});
    return;
  }

  const factory = new ParserFactoryService();

  cases.forEach(({ input, expected }) => {
    const caseName = path.relative(goldenRoot, input);
    it(caseName, async () => {
      const fileType = guessFileType(input);
      const detected = await factory.detectBankAndFormat(input, fileType);
      const parser = await factory.getParser(detected.bankName, fileType, input);
      if (!parser) {
        throw new Error(`No parser for ${caseName}`);
      }

      const actual = await parser.parse(input);
      const expectedAccounts = loadExpected(expected);

      // Guard against the fixture itself being a recording of broken output.
      // Comparing a parse only against its own past result is tautological: it
      // passes just as happily when the parser drops or invents rows. A fixture
      // carrying both balances must reconcile before it is worth comparing to.
      expectedAccounts.forEach(account => {
        const { balanceStart, balanceEnd } = account.metadata;
        if (balanceStart !== null && balanceStart !== undefined && balanceEnd != null) {
          const debits = sum(account.transactions, 'debit');
          const credits = sum(account.transactions, 'credit');
          expect({
            fixture: caseName,
            account: account.metadata.accountNumber,
            reconciled: Number((balanceStart + credits - debits).toFixed(2)),
          }).toEqual({
            fixture: caseName,
            account: account.metadata.accountNumber,
            reconciled: Number(balanceEnd.toFixed(2)),
          });
        }
      });

      // A file printing several accounts yields one statement per account,
      // the first in place and the rest under `otherAccounts`.
      const actualAccounts = [actual, ...(actual.otherAccounts ?? [])];
      expect(actualAccounts.map(account => account.metadata.accountNumber)).toHaveLength(
        expectedAccounts.length,
      );

      // A known format must pass every check of its own reading: a check that
      // fails here would hold good statements for review. A fixture of an
      // incomplete file names the checks it is expected to fail.
      const expectedFailures: string[] = JSON.parse(fs.readFileSync(expected, 'utf8')).failedChecks ?? [];
      actualAccounts.forEach((account, index) => {
        const failed = (account.checks ?? []).filter(check => !check.passed);
        expect({ account: index, failed: failed.map(check => check.code) }).toEqual({
          account: index,
          failed: index === 0 ? expectedFailures : [],
        });
      });

      expectedAccounts.forEach((expected, index) => {
        const actualAccount = actualAccounts[index];
        expect(actualAccount.metadata.currency).toBe(expected.metadata.currency);
        expect(actualAccount.transactions.length).toBe(expected.transactions.length);

        expect(sum(actualAccount.transactions, 'debit')).toBeCloseTo(
          sum(expected.transactions, 'debit'),
          2,
        );
        expect(sum(actualAccount.transactions, 'credit')).toBeCloseTo(
          sum(expected.transactions, 'credit'),
          2,
        );

        // Matching totals are not enough: a parser can drop one row and misread
        // another by the same amount. Compare row by row.
        const withPaymentType = expected.transactions.some(t => t.paymentType !== undefined);
        expect(actualAccount.transactions.map(t => projectTransaction(t, withPaymentType))).toEqual(
          expected.transactions.map(t => projectTransaction(t, withPaymentType)),
        );

        if (expected.metadata.accountNumber) {
          expect(actualAccount.metadata.accountNumber).toBe(expected.metadata.accountNumber);
        }

        // Balances are what the statement reconciles against, so a drift here is
        // exactly the failure the runtime balance check is meant to catch.
        (['balanceStart', 'balanceEnd'] as const).forEach(key => {
          const expectedBalance = expected.metadata[key];
          if (expectedBalance === null || expectedBalance === undefined) {
            return;
          }
          expect(actualAccount.metadata[key]).toBeCloseTo(expectedBalance, 2);
        });

        if (hasRealDate(expected.metadata.dateFrom)) {
          expect(toDateOnly(actualAccount.metadata.dateFrom)).toBe(
            toDateOnly(expected.metadata.dateFrom),
          );
          expect(toDateOnly(actualAccount.metadata.dateTo)).toBe(toDateOnly(expected.metadata.dateTo));
        }
      });
      // A scanned statement is read by OCR, a few seconds a page.
    }, 120_000);
  });
});
