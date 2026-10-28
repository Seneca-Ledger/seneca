/**
 * A statement layout a user taught and chose to share: the printed words of
 * its column headings and labels, where its columns sit, and the bank's name.
 * Never a figure, a description or a file. Anything else is refused.
 */

export const ROLES = [
  'date',
  'otherDate',
  'description',
  'counterparty',
  'debit',
  'credit',
  'amount',
  'balance',
  'other',
] as const;
export type Role = (typeof ROLES)[number];

export const OUTCOMES = ['passed', 'failed', 'unchecked'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * How the layout read the statement it was taught on, as the instance
 * reports it: honest users' signal, not proof (anyone can post this JSON).
 */
export interface Evidence {
  rows: number;
  balanceChain: Outcome;
  printedTotals: Outcome;
  statementsRead: number;
}

export interface Submission {
  version: 1;
  bankName: string;
  institution?: string;
  headings: { phrase: string; role: Role }[];
  columns: { role: Role; x0: number; x1: number }[];
  balances: { start?: string; end?: string };
  appVersion?: string;
  evidence?: Evidence;
}

const MAX_TEXT = 80;
const MAX_ITEMS = 30;
const MAX_COORDINATE = 5000;
/**
 * Characters that could turn a word into markup in the issue: code fences,
 * mentions, HTML, table cells, links, control characters.
 */
const UNSAFE = /[\u0000-\u001f\u007f`@<>|[\]\\]/;

type Result = { ok: true; submission: Submission } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, field: string, errors: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > MAX_TEXT || UNSAFE.test(value)) {
    errors.push(field);
    return undefined;
  }
  return value.trim() || undefined;
}

const isRole = (value: unknown): value is Role => (ROLES as readonly unknown[]).includes(value);
const isOutcome = (value: unknown): value is Outcome =>
  (OUTCOMES as readonly unknown[]).includes(value);
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100_000;

function evidenceOf(value: unknown, errors: string[]): Evidence | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    isRecord(value) &&
    Object.keys(value).length === 4 &&
    isCount(value.rows) &&
    isCount(value.statementsRead) &&
    isOutcome(value.balanceChain) &&
    isOutcome(value.printedTotals)
  ) {
    return {
      rows: value.rows,
      balanceChain: value.balanceChain,
      printedTotals: value.printedTotals,
      statementsRead: value.statementsRead,
    };
  }
  errors.push('evidence');
  return undefined;
}
const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_COORDINATE;

function list<T>(value: unknown, field: string, errors: string[], read: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    errors.push(field);
    return [];
  }
  return value.flatMap((item, index) => {
    const read_ = read(item);
    if (read_ === null) {
      errors.push(`${field}[${index}]`);
      return [];
    }
    return [read_];
  });
}

/** The submission in a request body, or why it is refused. Unknown keys are refused too. */
export function parseSubmission(body: unknown): Result {
  const errors: string[] = [];
  if (!isRecord(body) || body.version !== 1) {
    return { ok: false, error: 'version' };
  }
  const known = [
    'version',
    'bankName',
    'institution',
    'headings',
    'columns',
    'balances',
    'appVersion',
    'evidence',
  ];
  const unknown = Object.keys(body).filter(key => !known.includes(key));
  if (unknown.length > 0) {
    return { ok: false, error: `unknown: ${unknown.join(',')}` };
  }
  const bankName =
    typeof body.bankName === 'string' && /^[a-z0-9_]{1,64}$/.test(body.bankName) ? body.bankName : '';
  if (!bankName) {
    errors.push('bankName');
  }
  const headings = list(body.headings, 'headings', errors, item => {
    if (!isRecord(item) || !isRole(item.role)) {
      return null;
    }
    const phrase = text(item.phrase, 'phrase', errors);
    return phrase ? { phrase, role: item.role } : null;
  });
  const columns = list(body.columns, 'columns', errors, item =>
    isRecord(item) && isRole(item.role) && isCoordinate(item.x0) && isCoordinate(item.x1)
      ? { role: item.role, x0: item.x0, x1: item.x1 }
      : null,
  );
  const balances = isRecord(body.balances) ? body.balances : {};
  if (body.balances !== undefined && !isRecord(body.balances)) {
    errors.push('balances');
  }
  const submission: Submission = {
    version: 1,
    bankName,
    institution: text(body.institution, 'institution', errors),
    headings,
    columns,
    balances: {
      start: text(balances.start, 'balances.start', errors),
      end: text(balances.end, 'balances.end', errors),
    },
    appVersion: text(body.appVersion, 'appVersion', errors),
    evidence: evidenceOf(body.evidence, errors),
  };
  if (headings.length === 0 && columns.length === 0) {
    errors.push('empty');
  }
  return errors.length > 0 ? { ok: false, error: errors.join(', ') } : { ok: true, submission };
}

/**
 * One value per layout, whoever sends it: the heading phrases alone, sorted,
 * folded. Roles are left out on purpose, so two senders who give the same
 * words different roles land on the same issue, where the conflict shows.
 */
export async function layoutKey(submission: Submission): Promise<string> {
  const phrases = submission.headings.map(heading => heading.phrase.toLowerCase().trim()).sort();
  const basis = phrases.length > 0 ? phrases.join('\n') : JSON.stringify(submission.columns);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(basis));
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

const OUTCOME_MARK: Record<Outcome, string> = { passed: 'passed', failed: 'FAILED', unchecked: 'not checked' };

/** What the sender's reading showed, as one line; reported, not verified. */
export function evidenceLine(submission: Submission): string {
  const evidence = submission.evidence;
  if (!evidence) {
    return '**Reading:** not reported';
  }
  return [
    `**Reading (reported):** ${evidence.rows} rows`,
    `running balance ${OUTCOME_MARK[evidence.balanceChain]}`,
    `printed totals ${OUTCOME_MARK[evidence.printedTotals]}`,
    `${evidence.statementsRead} statement(s) read with it`,
  ].join(' · ');
}

/** The issue a submission is filed as: a title to scan the queue by, the layout as JSON. */
export function issueFor(
  submission: Submission,
  key: string,
): { title: string; body: string; labels: string[] } {
  const name = submission.institution ?? submission.bankName;
  const headings = submission.headings.map(heading => `${heading.role}: ${heading.phrase}`);
  const body = [
    `**Bank:** ${name} (\`${submission.bankName}\`)`,
    `**Layout key:** \`${key}\` (the same headings from anyone come back here as comments)`,
    evidenceLine(submission),
    submission.appVersion ? `**App version:** ${submission.appVersion}` : null,
    '',
    '**Headings**',
    ...(headings.length > 0 ? headings.map(line => `- ${line}`) : ['- none (a table without a header)']),
    '',
    layoutBlock(submission),
  ]
    .filter(line => line !== null)
    .join('\n');
  return { title: `Layout: ${name}`, body, labels: ['layout', `key:${key}`] };
}

/** A later submission of a layout already filed: its roles and reading, to compare. */
export function commentFor(submission: Submission): string {
  const headings = submission.headings.map(heading => `${heading.role}: ${heading.phrase}`).join(', ');
  return [
    'Submitted again.',
    evidenceLine(submission),
    `**Headings:** ${headings || 'none'}`,
    '',
    layoutBlock(submission),
  ].join('\n');
}

function layoutBlock(submission: Submission): string {
  return [
    '<details><summary>Layout as submitted</summary>',
    '',
    '```json',
    JSON.stringify(submission, null, 2),
    '```',
    '',
    '</details>',
  ].join('\n');
}
