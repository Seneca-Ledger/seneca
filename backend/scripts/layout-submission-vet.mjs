// What makes a shared statement layout worth proposing to the project, and
// how it joins the registry. Used by layout-to-golden.mjs (--vet, --apply) and
// by the parser-submissions workflow that opens a pull request for it.

const MONEY_ROLES = ['debit', 'credit', 'amount'];
/**
 * Words too common to be trusted as a column heading on their own. A layout
 * using them is still proposed, flagged for a look: it is read only in its
 * bank's files, so the risk is a misread header row there, not elsewhere.
 */
const COMMON_WORDS = new Set([
  'when', 'what', 'where', 'who', 'which', 'left', 'right', 'in', 'out', 'sum',
  'page', 'from', 'to', 'and', 'or', 'of', 'the', 'no', 'yes', 'item',
]);

const fold = text =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Whether a submission may become a pull request, and what a reviewer should
 * look at. `refusals` stop it; `warnings` go into the pull request.
 */
export function vetSubmission(submission, registry = []) {
  const refusals = [];
  const warnings = [];
  const bank = submission.institution?.trim() ?? '';
  if (bank.length < 3) {
    refusals.push('names no bank: a contributed layout applies only to files that name theirs');
  }
  if (submission.bankName !== 'other') {
    refusals.push(`the bank has a parser of its own (${submission.bankName}): fix that parser instead`);
  }
  const roles = new Set(submission.headings.map(heading => heading.role));
  if (!roles.has('date') || !(roles.has('description') || roles.has('counterparty'))) {
    refusals.push('the headings lack a date or a description column');
  }
  if (!MONEY_ROLES.some(role => roles.has(role))) {
    refusals.push('the headings lack a money column');
  }
  const evidence = submission.evidence;
  if (!evidence) {
    refusals.push('no reading reported: the layout was never seen reading a statement');
  } else if (evidence.rows < 3) {
    refusals.push(`it read ${evidence.rows} row(s), too few to trust`);
  } else if (evidence.balanceChain !== 'passed' && evidence.printedTotals !== 'passed') {
    refusals.push('neither the running balance nor the printed totals held when it read');
  }
  if (bank && registry.some(entry => entry.names.includes(fold(bank)))) {
    refusals.push(`${bank} is already in CONTRIBUTED_LAYOUTS: compare by hand`);
  }
  const common = submission.headings.filter(heading => COMMON_WORDS.has(fold(heading.phrase)));
  if (common.length > 0) {
    warnings.push(
      `common words as headings: ${common.map(h => `"${h.phrase}" (${h.role})`).join(', ')}`,
    );
  }
  if (evidence && evidence.balanceChain !== 'passed') {
    warnings.push(`running balance ${evidence.balanceChain}; printed totals ${evidence.printedTotals}`);
  }
  if (evidence && evidence.statementsRead < 2) {
    warnings.push('seen on a single statement');
  }
  return { refusals, warnings };
}

/** The registry entry for a submission: the bank's printed name, its headings. */
export function registryEntry(submission) {
  const bank = submission.institution.trim();
  return {
    bank,
    names: [fold(bank)],
    headings: submission.headings.map(({ phrase, role }) => ({ phrase: fold(phrase), role })),
  };
}

const DATA_ANCHOR = 'export const CONTRIBUTED_LAYOUT_DATA: ContributedLayout[] = ';

/** The registry's entries, read back from contributed-layouts.data.ts. */
export function registryOf(source) {
  const at = source.indexOf(DATA_ANCHOR);
  if (at === -1) {
    throw new Error('CONTRIBUTED_LAYOUT_DATA not found in contributed-layouts.data.ts');
  }
  return JSON.parse(source.slice(at + DATA_ANCHOR.length, source.lastIndexOf(';')));
}

/**
 * contributed-layouts.data.ts with the entry added. Written as JSON, so a
 * heading cannot break out of its string, and read back the same way.
 */
export function withEntry(source, entry) {
  const at = source.indexOf(DATA_ANCHOR);
  const entries = [...registryOf(source), entry];
  return `${source.slice(0, at)}${DATA_ANCHOR}${JSON.stringify(entries, null, 2)};\n`;
}

/** A case name for the golden set: the bank's name, lower case, dashes. */
export function caseNameOf(submission) {
  return fold(submission.institution ?? 'bank')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
