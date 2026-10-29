#!/usr/bin/env node
// Turns a statement layout a user shared (an issue in parser-submissions, its
// JSON block saved to a file) into a golden case the parser must read: an
// invented statement printed in that layout, and what reading it must give.
// No real statement is needed or used: the rows are made up here.
//
//   node scripts/layout-to-golden.mjs <submission.json> [case-name] [--apply] [--report <file>]
//
// Run from backend/. Vets the submission (layout-submission-vet.mjs), writes
// golden/<case-name>/synthetic.pdf and synthetic.pdf.expected.json, and with
// --apply adds the bank's entry to src/modules/parsing/helpers/
// contributed-layouts.data.ts: its headings are read only in files that name
// the bank. A refused submission exits 2 and changes nothing. --report writes
// the verdict as Markdown, for the pull request or the issue.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { caseNameOf, registryEntry, registryOf, vetSubmission, withEntry } from './layout-submission-vet.mjs';

const DATA_FILE = 'src/modules/parsing/helpers/contributed-layouts.data.ts';

const PAGE = { width: 600, height: 800 };
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

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** An invented second line, for banks whose descriptions run over two. */
const SECOND_LINE = 'Online purchase';

/** An amount as the bank prints it: its separators, and its minus where it shows one. */
function moneyIn(print) {
  const format = print?.amounts ?? { decimal: '.', thousands: ',', negative: 'minus', marks: [] };
  return (value, signed = false) => {
    const [whole, cents] = Math.abs(value).toFixed(2).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands);
    const plain = format.decimal ? `${grouped}${format.decimal}${cents}` : `${grouped}${cents}`;
    if (!signed) {
      return plain;
    }
    if (format.marks.includes('DR') && format.marks.includes('CR')) {
      return `${plain} ${value < 0 ? 'DR' : 'CR'}`;
    }
    if (value >= 0) {
      return plain;
    }
    return { parentheses: `(${plain})`, 'trailing-minus': `${plain}-`, minus: `-${plain}`, none: `-${plain}` }[
      format.negative
    ];
  };
}

/**
 * A February date in the bank's shape: numbers by the lengths of the # runs
 * (day first unless the year leads), a month word kept as English when it is
 * one. A shape this cannot follow falls back to dd-mm-yyyy, said on the console.
 */
function dateIn(shape) {
  const fallback = day => `${String(day).padStart(2, '0')}-02-2025`;
  if (!shape) {
    return fallback;
  }
  const word = shape.match(/\p{L}+/u)?.[0];
  if (word && !MONTHS.includes(word.slice(0, 3).toLowerCase())) {
    console.log(`Date shape "${shape}" names a month this script cannot write; dates print as dd-mm-yyyy.`);
    return fallback;
  }
  const month = word ? (word.length > 3 ? 'February' : 'Feb') : null;
  return day => {
    const runs = [];
    const text = shape.replace(/#+/g, run => {
      runs.push(run.length);
      return `\u0000${runs.length - 1}\u0000`;
    });
    const yearFirst = runs[0] === 4;
    const numbers = yearFirst ? ['2025', '02', String(day).padStart(2, '0')] : [String(day).padStart(2, '0'), '02', '2025'];
    const values = month ? numbers.filter(value => value !== '02') : numbers;
    return text
      .replace(/\u0000(\d+)\u0000/g, (_, index) => {
        const value = values[Number(index)] ?? '';
        return runs[Number(index)] === 2 && value.length === 4 ? value.slice(2) : value;
      })
      .replace(/\p{L}+/u, month ?? '');
  };
}
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

function rowCells(role, row, balance, money, date) {
  const [day, description, amount] = row;
  switch (role) {
    case 'date':
      return date(day);
    case 'description':
    case 'counterparty':
      return description;
    case 'debit':
      return amount < 0 ? money(amount) : '';
    case 'credit':
      return amount > 0 ? money(amount) : '';
    case 'amount':
      return money(amount, true);
    case 'balance':
      return money(balance, true);
    default:
      return '';
  }
}

/** The verdict as Markdown: what stops the layout, what a reviewer should look at. */
function reportOf({ refusals, warnings }, caseName) {
  return [
    refusals.length > 0 ? '**Not proposed:**' : `**Proposed** as golden case \`${caseName}\`.`,
    ...refusals.map(reason => `- ${reason}`),
    ...(warnings.length > 0 ? ['', '**Look at:**', ...warnings.map(warning => `- ${warning}`)] : []),
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const reportAt = args.indexOf('--report');
  const report = reportAt === -1 ? null : args[reportAt + 1];
  const [file, named] = args.filter(
    (arg, index) => !arg.startsWith('--') && (reportAt === -1 || index !== reportAt + 1),
  );
  const submission = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const caseName = named ?? (submission ? caseNameOf(submission) : '');
  if (!(submission && /^[a-z0-9-]+$/.test(caseName))) {
    console.error('Usage: node scripts/layout-to-golden.mjs <submission.json> [case-name] [--apply] [--report <file>]');
    process.exit(1);
  }
  const data = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : null;
  const verdict = vetSubmission(submission, data ? registryOf(data) : []);
  if (report) {
    fs.writeFileSync(report, `${reportOf(verdict, caseName)}\n`);
  }
  for (const reason of verdict.refusals) {
    console.log(`Refused: ${reason}`);
  }
  for (const warning of verdict.warnings) {
    console.log(`Look at: ${warning}`);
  }
  if (apply && verdict.refusals.length > 0) {
    process.exit(2);
  }
  const columns = columnsOf(submission);
  const print = submission.print;
  const size = print?.fontSize ?? 9;
  const gap = Math.max(print?.rowGap ?? 20, size + 4);
  const lines = Math.min(print?.descriptionLines ?? 1, 2);
  const currency = print?.currency ?? 'USD';
  const money = moneyIn(print);
  const date = dateIn(print?.dateShape);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE.width, PAGE.height]);
  const put = (text, x, top, { right = false, face = font, at = size } = {}) => {
    const width = face.widthOfTextAtSize(text, at);
    page.drawText(text, { x: right ? x - width : x, y: PAGE.height - top - at, size: at, font: face });
  };
  const headings = top => {
    for (const column of columns) {
      if (column.heading) {
        const right = !TEXT_ROLES.has(column.role);
        put(titled(column.heading), right ? column.x1 : column.x0, top, { right, face: bold });
      }
    }
  };

  put(submission.institution ?? 'Example Bank', 40, 40, { face: bold, at: 14 });
  put(`Currency: ${currency}`, 40, 62);
  let top = 90;
  if (submission.balances?.start) {
    put(titled(submission.balances.start), 40, top);
    put(money(OPENING), 250, top, { right: true });
    top += 24;
  }
  headings(top);
  let balance = OPENING;
  const transactions = [];
  // Rows split over the pages the bank's file had, two at most.
  const perPage = Math.ceil(ROWS.length / Math.min(Math.max(print?.pages ?? 1, 1), 2));
  ROWS.forEach((row, index) => {
    if (index > 0 && index % perPage === 0) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      top = 60;
      if (print?.headerOnEveryPage !== false) {
        headings(top);
      }
    }
    top += gap;
    balance = Number((balance + row[2]).toFixed(2));
    for (const column of columns) {
      const text = rowCells(column.role, row, balance, money, date);
      if (text) {
        put(text, TEXT_ROLES.has(column.role) ? column.x0 : column.x1, top, {
          right: !TEXT_ROLES.has(column.role),
        });
      }
    }
    const description = columns.find(column => column.role === 'description');
    if (lines > 1 && description) {
      put(SECOND_LINE, description.x0, top + size + 2);
      top += size + 2;
    }
    const purpose = lines > 1 && description ? `${row[1]} ${SECOND_LINE}` : row[1];
    transactions.push({
      transactionDate: `2025-02-${String(row[0]).padStart(2, '0')}T00:00:00`,
      counterpartyName: purpose,
      paymentPurpose: purpose,
      ...(row[2] < 0 ? { debit: -row[2] } : { credit: row[2] }),
      currency,
    });
  });
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
      currency,
      dateFrom: transactions[0].transactionDate,
      dateTo: transactions.at(-1).transactionDate,
      ...(hasBalances ? { balanceStart: OPENING, balanceEnd: balance } : {}),
    },
    transactions,
  };
  fs.writeFileSync(path.join(dir, 'synthetic.pdf.expected.json'), `${JSON.stringify(expected, null, 2)}\n`);

  console.log(`Wrote ${dir}/synthetic.pdf and its expected reading (${transactions.length} rows).`);
  if (apply) {
    fs.writeFileSync(DATA_FILE, withEntry(data, registryEntry(submission)));
    console.log(`Added ${submission.institution} to ${DATA_FILE}.`);
  } else if (verdict.refusals.length === 0) {
    console.log(`\nWith --apply it would add to ${DATA_FILE}:`);
    console.log(JSON.stringify(registryEntry(submission), null, 2));
  }
  console.log('\nThen: GOLDEN_ENABLED=1 npx vitest run --project golden');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
