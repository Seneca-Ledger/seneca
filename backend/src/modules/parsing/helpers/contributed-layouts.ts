import { CONTRIBUTED_LAYOUT_DATA } from './contributed-layouts.data';
import type { ColumnRole, TaughtHeadings } from './pdf-layout-columns.helper';
import { foldText } from './statement-date.helper';

/**
 * Statement layouts users taught and shared with the project, accepted into
 * it (infra/parser-submissions, scripts/layout-to-golden.mjs). Each one's
 * headings are read only in a file that names its bank: a wrong submission
 * can then misread no other bank's statements, and the parse checks hold any
 * statement it misreads for review.
 */
export interface ContributedLayout {
  /** The bank, as people know it. */
  bank: string;
  /** How its statements print its name, folded (lower case, no accents). */
  names: string[];
  /** Folded heading phrases, as a taught layout keeps them. */
  headings: { phrase: string; role: ColumnRole }[];
}

/** Accepted layouts; the list lives in contributed-layouts.data.ts, which the script writes. */
export const CONTRIBUTED_LAYOUTS: ContributedLayout[] = [...CONTRIBUTED_LAYOUT_DATA];

/** The contributed headings for a file, from the layouts whose bank it names; none otherwise. */
export function contributedHeadings(
  text: string,
  layouts: readonly ContributedLayout[] = CONTRIBUTED_LAYOUTS,
): TaughtHeadings | undefined {
  const words = ` ${foldText(text).replace(/\s+/g, ' ')} `;
  const named = layouts.filter(layout => layout.names.some(name => words.includes(` ${name} `)));
  if (named.length === 0) {
    return undefined;
  }
  return new Map(named.flatMap(layout => layout.headings.map(h => [h.phrase, h.role] as const)));
}
