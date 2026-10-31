import { createHash } from 'crypto';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutColumn } from './pdf-layout-columns.helper';
import type { SectionSign } from './pdf-layout-sections.helper';
import { foldText } from './statement-date.helper';

/**
 * A statement's layout, as words only: what its table headers and section
 * headings say, in order. A bank that renames, adds or reorders a column
 * prints a new fingerprint on the first file of the new layout, before any
 * reading goes wrong. Never a figure, a name or a description.
 */
export interface StatementLayout {
  /** Short hash of `headings`: one value per layout. */
  fingerprint: string;
  /** Each distinct header, "role:heading" left to right; then "section:credit" and the like. */
  headings: string[];
  /** Header words no heading knows, and the headings of columns read as `other`. */
  unknownWords: string[];
  /** A bank with a parser of its own that the text names, kept to tell a declined file. */
  mentionedBank?: BankName;
  /** The workspace's taught layout (parsing_layout_templates) the statement was read with. */
  taughtTemplate?: string;
}

const FINGERPRINT_LENGTH = 12;

/**
 * Banks with a parser of their own, by any mention of their name. Looser than
 * each parser's own test on purpose: a file that names the bank but went to
 * the generic parser is one its parser declined, maybe a new layout.
 */
const BANK_MENTIONS: [BankName, RegExp][] = [
  [BankName.ABSA, /\babsa\b/],
  [BankName.ALLY, /\bally bank\b/],
  [BankName.ANZ, /\banz\b|australia and new zealand banking/],
  [BankName.ASSOCIATED, /\bassociated bank\b/],
  [BankName.ATB, /\batb financial\b/],
  [BankName.AXIS, /\baxis bank\b/],
  [BankName.BANCO_DO_BRASIL, /\bbanco do brasil\b/],
  [BankName.BANK_OF_CHINA, /\bbochk\b|\bbank of china\b/],
  [BankName.BANK_OF_SCOTLAND, /\bbank\s*of\s*scotland/],
  [BankName.BARCLAYS, /\bbarclays bank\b/],
  [BankName.KASPI, /\bkaspi\b|\bкаспи\b/],
  [BankName.BEREKE_NEW, /\bbereke\b|\bбереке\b/],
  [BankName.HAPOALIM, /\bhapoalim\b|הפועלים/],
];

export function mentionedBank(text: string): BankName | undefined {
  const folded = foldText(text);
  return BANK_MENTIONS.find(([, pattern]) => pattern.test(folded))?.[0];
}

/** A word with a digit is a figure or a date read along with the header, not a heading. */
const isWord = (word: string) => !/\d/.test(word);

/** The words of a column no heading knows: its own if it is `other`, and those beside it. */
const unknownOf = (column: LayoutColumn) =>
  [
    ...(column.role === 'other' && column.heading ? [column.heading] : []),
    ...(column.extra ?? []),
  ].filter(isWord);

/** "role:heading", with the column's unknown words: "balance:balance in original currency". */
const headerLine = (header: LayoutColumn[]) =>
  header
    .filter(column => column.role !== 'other' || unknownOf(column).length > 0)
    .map(column =>
      [
        `${column.role}:${column.role === 'other' ? '' : (column.heading ?? '')}`,
        ...unknownOf(column),
      ]
        .join(' ')
        .replace(/: /, ':'),
    )
    .join(' | ');

/** The layout of what was read; none when no header or section heading was found. */
export function statementLayout(
  layout: { headers: LayoutColumn[][]; sections: SectionSign[] },
  text: string,
): StatementLayout | undefined {
  const headings = [
    ...new Set([
      ...layout.headers.map(headerLine),
      ...layout.sections.map(sign => `section:${sign}`),
    ]),
  ];
  if (headings.length === 0) {
    return undefined;
  }
  const unknownWords = [...new Set(layout.headers.flatMap(header => header.flatMap(unknownOf)))];
  const bank = mentionedBank(text);
  return {
    fingerprint: createHash('sha256')
      .update(headings.join('\n'))
      .digest('hex')
      .slice(0, FINGERPRINT_LENGTH),
    headings,
    unknownWords,
    ...(bank ? { mentionedBank: bank } : {}),
  };
}
