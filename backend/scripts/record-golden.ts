/**
 * Records golden fixtures for the parsing suite.
 *
 *   npm run golden:record -- golden/kaspi/sample3.pdf
 *   npm run golden:record -- --all
 *
 * Writes the parser's output next to each statement as
 * `<file>.expected.json`. Statements go into `backend/golden/<bank>/` already
 * anonymized — keep the real file in the git-ignored `backend/golden-private/`
 * and run it through `scripts/anonymize_statement_pdf.py` first. This script
 * never copies a statement anywhere.
 *
 * A recording is NOT a verified fixture. It captures whatever the parser does
 * today, bugs included. Check every row against the statement before
 * committing, and delete rows the parser invented rather than adjusting the
 * expected totals to match them. A fixture whose balances do not reconcile is
 * rejected by the golden test.
 *
 * Dates are written as local wall-clock time without a zone ("2025-11-25T23:59:59"),
 * the way the statement prints them, so the fixture reads the same in any TZ.
 *
 * Requires python3 with pdfplumber on PATH (same prerequisite as parsing).
 */
import * as fs from 'fs';
import * as path from 'path';
import { FileType } from '../src/entities/statement.entity';
import { ParserFactoryService } from '../src/modules/parsing/services/parser-factory.service';

const GOLDEN_ROOT = path.resolve(__dirname, '../golden');

function guessFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    return FileType.XLSX;
  }
  if (ext === '.csv') {
    return FileType.CSV;
  }
  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'].includes(ext)) {
    return FileType.IMAGE;
  }
  return FileType.PDF;
}

function toLocalIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function withLocalDates(value: unknown): unknown {
  if (value instanceof Date) {
    return toLocalIso(value);
  }
  if (Array.isArray(value)) {
    return value.map(withLocalDates);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, withLocalDates(entry)]),
    );
  }
  return value;
}

async function record(statementPath: string): Promise<boolean> {
  const factory = new ParserFactoryService();
  const fileType = guessFileType(statementPath);

  const detected = await factory.detectBankAndFormat(statementPath, fileType);
  const parser = await factory.getParser(detected.bankName, fileType, statementPath);
  if (!parser) {
    console.error(`✗ ${statementPath}: no parser (detected ${detected.bankName})`);
    return false;
  }

  const parsed = await parser.parse(statementPath);
  fs.writeFileSync(
    `${statementPath}.expected.json`,
    `${JSON.stringify(withLocalDates(parsed), null, 2)}\n`,
  );

  const debits = parsed.transactions.reduce((acc, t) => acc + (Number(t.debit) || 0), 0);
  const credits = parsed.transactions.reduce((acc, t) => acc + (Number(t.credit) || 0), 0);
  const { balanceStart, balanceEnd } = parsed.metadata;

  console.log(`✓ ${path.relative(GOLDEN_ROOT, statementPath)}`);
  console.log(`    parser:       ${parser.constructor.name}`);
  console.log(`    transactions: ${parsed.transactions.length}`);
  console.log(`    debit/credit: ${debits.toFixed(2)} / ${credits.toFixed(2)}`);

  if (balanceStart != null && balanceEnd != null) {
    const reconciled = balanceStart + credits - debits;
    const drift = Math.abs(reconciled - balanceEnd);
    const verdict = drift <= 0.01 ? 'reconciles' : `DRIFT ${drift.toFixed(2)} — review before commit`;
    console.log(`    balance:      ${balanceStart} -> ${balanceEnd} (${verdict})`);
    return drift <= 0.01;
  }

  console.log('    balance:      not reported by the statement — verify by hand');
  return true;
}

function collectGoldenStatements(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectGoldenStatements(full);
    }
    return entry.name.endsWith('.expected.json') ? [] : [full];
  });
}

async function main() {
  const args = process.argv.slice(2);
  const targets =
    args[0] === '--all'
      ? collectGoldenStatements(GOLDEN_ROOT)
      : args.length === 1
        ? [path.resolve(args[0])]
        : null;

  if (!targets) {
    console.error('usage: record-golden <golden statement file> | record-golden --all');
    process.exit(2);
    return;
  }

  const outside = targets.find(target => !target.startsWith(`${GOLDEN_ROOT}${path.sep}`));
  if (outside) {
    console.error(`${outside} is not under ${GOLDEN_ROOT}; anonymize it into golden/<bank>/ first.`);
    process.exit(2);
    return;
  }

  let clean = 0;
  for (const target of targets) {
    if (await record(target)) {
      clean++;
    }
  }

  console.log(`\n${clean}/${targets.length} recordings reconcile against their stated balances.`);
  console.log('Review every fixture against the source statement before committing.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
