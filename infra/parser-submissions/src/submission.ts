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

export interface Submission {
  version: 1;
  bankName: string;
  institution?: string;
  headings: { phrase: string; role: Role }[];
  columns: { role: Role; x0: number; x1: number }[];
  balances: { start?: string; end?: string };
  appVersion?: string;
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
  const known = ['version', 'bankName', 'institution', 'headings', 'columns', 'balances', 'appVersion'];
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
  };
  if (headings.length === 0 && columns.length === 0) {
    errors.push('empty');
  }
  return errors.length > 0 ? { ok: false, error: errors.join(', ') } : { ok: true, submission };
}

/** The issue a submission is filed as: a title to scan the queue by, the layout as JSON. */
export function issueFor(submission: Submission): { title: string; body: string; labels: string[] } {
  const name = submission.institution ?? submission.bankName;
  const headings = submission.headings.map(heading => `${heading.role}: ${heading.phrase}`);
  const body = [
    `**Bank:** ${name} (\`${submission.bankName}\`)`,
    submission.appVersion ? `**App version:** ${submission.appVersion}` : null,
    '',
    '**Headings**',
    ...(headings.length > 0 ? headings.map(line => `- ${line}`) : ['- none (a table without a header)']),
    '',
    '<details><summary>Layout as submitted</summary>',
    '',
    '```json',
    JSON.stringify(submission, null, 2),
    '```',
    '',
    '</details>',
  ]
    .filter(line => line !== null)
    .join('\n');
  return { title: `Layout: ${name}`, body, labels: ['layout'] };
}
