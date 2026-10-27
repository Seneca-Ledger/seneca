import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { extractTextAndLayoutFromPdf } from '../../../common/utils/pdf-parser.util';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';

const run = promisify(execFile);

/**
 * The pages on which a statement starts, for a file that holds several one
 * after another. A statement starts where its header names an account
 * (`accountPattern`, the account in its first group) other than the one
 * before, so a header repeated on every page of one statement does not split
 * it. Always starts with page 1.
 */
export function statementStartPages(pageTexts: string[], accountPattern: RegExp): number[] {
  const starts = [1];
  let account: string | null = null;
  for (const [index, text] of pageTexts.entries()) {
    const found = text.match(accountPattern)?.[1]?.toUpperCase() ?? null;
    if (found && account && found !== account) {
      starts.push(index + 1);
    }
    account = found ?? account;
  }
  return starts;
}

async function pageTextsOf(filePath: string): Promise<string[]> {
  const { rows } = await extractTextAndLayoutFromPdf(filePath);
  const pages: string[] = [];
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    pages[row.page - 1] = `${pages[row.page - 1] ?? ''}${row.text}\n`;
  }
  return Array.from(pages, page => page ?? '');
}

/** Copies pages `first`..`last` of a PDF into a file of their own (poppler-utils). */
async function copyPages(filePath: string, first: number, last: number, dir: string) {
  const pattern = path.join(dir, `p${first}-%d.pdf`);
  await run('pdfseparate', ['-f', String(first), '-l', String(last), filePath, pattern]);
  const pages = Array.from({ length: last - first + 1 }, (_, i) =>
    pattern.replace('%d', String(first + i)),
  );
  const target = path.join(dir, `statement-${first}.pdf`);
  await run('pdfunite', [...pages, target]);
  return target;
}

/**
 * Reads a file that may hold several statements one after another: each is
 * cut into a PDF of its own and read by `parseOne`. The first statement comes
 * back as the result and the rest as its `otherAccounts`. A file with one
 * statement is read as it is.
 */
export async function parseEachStatement(
  filePath: string,
  cachedText: string | undefined,
  accountPattern: RegExp,
  parseOne: (file: string, cachedText?: string) => Promise<ParsedStatement>,
): Promise<ParsedStatement> {
  const pageTexts = await pageTextsOf(filePath);
  const starts = statementStartPages(pageTexts, accountPattern);
  if (starts.length < 2) {
    return parseOne(filePath, cachedText);
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), 'statement-split-'));
  try {
    const parsed: ParsedStatement[] = [];
    for (const [index, first] of starts.entries()) {
      const last = (starts[index + 1] ?? pageTexts.length + 1) - 1;
      parsed.push(await parseOne(await copyPages(filePath, first, last, dir)));
    }
    const [statement, ...others] = parsed;
    return {
      ...statement,
      otherAccounts: others.map(({ metadata, transactions }) => ({ metadata, transactions })),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
