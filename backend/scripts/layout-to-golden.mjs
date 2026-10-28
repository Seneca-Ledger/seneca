#!/usr/bin/env node
// Turns a statement layout a user shared (an issue in parser-submissions, its
// JSON block saved to a file) into a golden case the parser must read: an
// invented statement printed in that layout, and what reading it must give.
// No real statement is needed or used: the rows are made up here.
//
//   node scripts/layout-to-golden.mjs <submission.json> <case-name>
//
// Writes golden/<case-name>/synthetic.pdf and synthetic.pdf.expected.json, and
// prints the entry to add to CONTRIBUTED_LAYOUTS in
// src/modules/parsing/helpers/contributed-layouts.ts: its headings are read
// only in files that name the bank. Until it is there, the case fails.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const PAGE = { width: 600, height: 800 };
const SIZE = 9;
const TEXT_ROLES = new Set(['date', 'otherDate', 'description', 'counterparty', 'other']);
/** Columns where a layout taught without a header puts them. */
const DEFAULT_X = {
  date: [40, 100],
  description: [115, 280],
  counterparty: [115, 280],
  debit: [295, 342],
  credit: [365, 412],
  amount: [330, 412],
  balance: [450, 500],
};
/** Invented rows: [day, description, signed amount]; a payment is negative. */
const ROWS = [
  [3, 'ACME Store Wireless Buds', -12.5],
  [7, 'Member One transfer', 100],
  [12, 'City Water Utility', -45.2],
  [15, 'Example Payroll Ltd', 2500],
  [21, 'Corner Bakery', -8.75],
  [26, 'Rent Example Homes', -900],
];
const OPENING = 1000;

const money = value =>
  Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titled = phrase => phrase.replace(/\b\p{L}/gu, letter => letter.toUpperCase());

/** Each role's column: where the user drew it, or the default, and its printed heading. */
function columnsOf(submission) {
  const heading = role => submission.headings.find(entry => entry.role === role)?.phrase;
  const roles = [
    ...new Set([...submission.columns.map(c => c.role), ...submission.headings.map(h => h.role)]),
  ].filter(role => role in DEFAULT_X);
  return roles
    .map(role => {
      const drawn = submission.columns.find(column => column.role === role);
      const [x0, x1] = drawn ? [drawn.x0, drawn.x1] : DEFAULT_X[role];
      return { role, x0, x1, heading: heading(role) };
    })
    .sort((a, b) => a.x0 - b.x0);
}

function rowCells(role, row, balance) {
  const [day, description, amount] = row;
  switch (role) {
    case 'date':
      return `${String(day).padStart(2, '0')}-02-2025`;
    case 'description':
    case 'counterparty':
      return description;
    case 'debit':
      return amount < 0 ? money(amount) : '';
    case 'credit':
      return amount > 0 ? money(amount) : '';
    case 'amount':
      return `${amount < 0 ? '-' : ''}${money(amount)}`;
    case 'balance':
      return money(balance);
    default:
      return '';
  }
}

async function main() {
  const [file, caseName] = process.argv.slice(2);
  if (!(file && caseName && /^[a-z0-9-]+$/.test(caseName))) {
    console.error('Usage: node scripts/layout-to-golden.mjs <submission.json> <case-name (a-z, 0-9, -)>');
    process.exit(1);
  }
  const submission = JSON.parse(fs.readFileSync(file, 'utf8'));
  const columns = columnsOf(submission);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const put = (text, x, top, { right = false, face = font, size = SIZE } = {}) => {
    const width = face.widthOfTextAtSize(text, size);
    page.drawText(text, { x: right ? x - width : x, y: PAGE.height - top - size, size, font: face });
  };

  put(submission.institution ?? 'Example Bank', 40, 40, { face: bold, size: 14 });
  put('Currency: USD', 40, 62);
  let top = 90;
  if (submission.balances?.start) {
    put(titled(submission.balances.start), 40, top);
    put(money(OPENING), 250, top, { right: true });
    top += 24;
  }
  for (const column of columns) {
    if (column.heading) {
      const money_ = !TEXT_ROLES.has(column.role);
      put(titled(column.heading), money_ ? column.x1 : column.x0, top, { right: money_, face: bold });
    }
  }
  let balance = OPENING;
  const transactions = [];
  for (const row of ROWS) {
    top += 20;
    balance = Number((balance + row[2]).toFixed(2));
    for (const column of columns) {
      const text = rowCells(column.role, row, balance);
      if (text) {
        put(text, TEXT_ROLES.has(column.role) ? column.x0 : column.x1, top, {
          right: !TEXT_ROLES.has(column.role),
        });
      }
    }
    transactions.push({
      transactionDate: `2025-02-${String(row[0]).padStart(2, '0')}T00:00:00`,
      counterpartyName: row[1],
      paymentPurpose: row[1],
      ...(row[2] < 0 ? { debit: -row[2] } : { credit: row[2] }),
      currency: 'USD',
    });
  }
  if (submission.balances?.end) {
    top += 28;
    put(titled(submission.balances.end), 40, top);
    put(money(balance), 250, top, { right: true });
  }

  const dir = path.join('golden', caseName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'synthetic.pdf'), await doc.save());
  // The running balance column gives the balances; without it the reader has none to compare.
  const hasBalances = columns.some(column => column.role === 'balance');
  const expected = {
    metadata: {
      accountNumber: '',
      currency: 'USD',
      dateFrom: transactions[0].transactionDate,
      dateTo: transactions.at(-1).transactionDate,
      ...(hasBalances ? { balanceStart: OPENING, balanceEnd: balance } : {}),
    },
    transactions,
  };
  fs.writeFileSync(path.join(dir, 'synthetic.pdf.expected.json'), `${JSON.stringify(expected, null, 2)}\n`);

  console.log(`Wrote ${dir}/synthetic.pdf and its expected reading (${transactions.length} rows).`);
  const bank = submission.institution;
  if (!bank) {
    console.log('\nThe submission names no bank: find its name before adding the layout, or it would apply to no file.');
  }
  const entry = {
    bank: bank ?? 'TODO bank name',
    names: [(bank ?? 'todo bank name').toLowerCase()],
    headings: submission.headings,
  };
  console.log('\nAdd to CONTRIBUTED_LAYOUTS (src/modules/parsing/helpers/contributed-layouts.ts):');
  console.log(`${JSON.stringify(entry, null, 2).replace(/"(\w+)":/g, '$1:').replace(/"/g, "'")},`);
  console.log('\nThen: GOLDEN_ENABLED=1 npx vitest run --project golden');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
