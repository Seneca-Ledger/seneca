import type { LayoutTemplate } from './layout-template.helper';

/**
 * What leaves the instance when a user shares a layout they taught (the
 * project's parser-submissions Worker, or an e-mail): the headings, where the
 * columns sit, the balance labels and the bank's name. Not the skipped lines:
 * a user may mark a line with a name or an address to skip, and the project
 * can do without them.
 */
export interface LayoutSubmission {
  version: 1;
  bankName: string;
  institution?: string;
  headings: LayoutTemplate['headings'];
  columns: LayoutTemplate['columns'];
  balances: LayoutTemplate['balances'];
  appVersion?: string;
  evidence?: LayoutEvidence;
}

export type CheckOutcome = 'passed' | 'failed' | 'unchecked';

/**
 * How the layout read the statement it was taught on: rows, the checks a
 * changed layout breaks, and how many statements it has read. Counts and
 * outcomes only. The project reads it as a signal, not as proof.
 */
export interface LayoutEvidence {
  rows: number;
  balanceChain: CheckOutcome;
  printedTotals: CheckOutcome;
  statementsRead: number;
}

/** A check's outcome in a statement's stored checks. */
export function checkOutcome(
  checks: ReadonlyArray<{ code: string; passed: boolean }> | undefined,
  code: string,
): CheckOutcome {
  const check = checks?.find(candidate => candidate.code === code);
  if (!check) {
    return 'unchecked';
  }
  return check.passed ? 'passed' : 'failed';
}

/** Coordinates to a tenth of a point: enough to place a column, and short to read. */
const tenth = (value: number) => Math.round(value * 10) / 10;

export function layoutSubmission(
  template: LayoutTemplate,
  bankName: string,
  appVersion?: string,
  evidence?: LayoutEvidence,
): LayoutSubmission {
  return {
    version: 1,
    bankName,
    ...(template.institution ? { institution: template.institution } : {}),
    headings: template.headings,
    columns: template.columns.map(column => ({
      role: column.role,
      x0: tenth(column.x0),
      x1: tenth(column.x1),
    })),
    balances: template.balances,
    ...(appVersion ? { appVersion } : {}),
    ...(evidence ? { evidence } : {}),
  };
}
