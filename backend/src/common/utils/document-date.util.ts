/**
 * The date a receipt or invoice was paid or issued, read from its text.
 *
 * A document carries several dates: issued, paid, due, the service period, when
 * the report was printed. The one that dates the payment is told apart by its
 * label ("Date paid", "Date of issue", "Дата"), not by being the first in the text.
 */

export type DocumentDate = {
  date: Date;
  /** "07/08/2026" with nothing in the document to say which number is the month. */
  ambiguous: boolean;
};

export type DocumentDateOptions = {
  /** Read an ambiguous numeric date as month first (a US document). */
  monthFirst?: boolean;
};

// Month names and abbreviations as dates are printed: nominative and genitive
// ("июнь", "21 июня"), English, German, French, Spanish, Italian, Portuguese,
// Dutch, Russian, Ukrainian, Polish and Kazakh.
const MONTH_WORDS: Record<number, string> = {
  1: 'january jan januar jänner jän janvier janv enero ene gennaio gen janeiro januari январь января янв січень січня styczeń stycznia қаңтар',
  2: 'february feb februar février févr fevrier febrero febbraio fevereiro fev februari февраль февраля фев лютий лютого luty lutego ақпан',
  3: 'march mar märz mär mars marzo março maart mrt март марта мар березень березня marzec marca наурыз',
  4: 'april apr avril avr abril abr aprile апрель апреля апр квітень квітня kwiecień kwietnia сәуір',
  5: 'may mai mayo maggio mag maio mei май мая травень травня maj maja мамыр',
  6: 'june jun juni juin junio giugno giu junho июнь июня июн червень червня czerwiec czerwca маусым',
  7: 'july jul juli juillet juil julio luglio lug julho июль июля июл липень липня lipiec lipca шілде',
  8: 'august aug août aout agosto ago augustus август августа авг серпень серпня sierpień sierpnia тамыз',
  9: 'september sep sept septembre septiembre setiembre settembre set setembro сентябрь сентября сен сент вересень вересня wrzesień września қыркүйек',
  10: 'october oct oktober okt octobre octubre ottobre ott outubro out октябрь октября окт жовтень жовтня październik października қазан',
  11: 'november nov novembre noviembre novembro ноябрь ноября ноя листопад листопада listopad listopada қараша',
  12: 'december dec dezember dez décembre déc diciembre dic dicembre dezembro декабрь декабря дек грудень грудня grudzień grudnia желтоқсан',
};

const MONTH_BY_WORD = new Map(
  Object.entries(MONTH_WORDS).flatMap(([month, words]) =>
    words.split(' ').map(word => [word, Number(month)] as const),
  ),
);

// Longest first, so "июня" is not read as "июн" plus a stray letter.
const MONTH = `(${[...MONTH_BY_WORD.keys()]
  .sort((a, b) => b.length - a.length)
  .join('|')})\\.?(?!\\p{L})`;

const DATE_PATTERNS: Array<{ regex: RegExp; read: (m: RegExpExecArray) => DateParts }> = [
  // June 21, 2026 · Jun 21st 2026
  {
    regex: new RegExp(`${MONTH}\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})(?!\\d)`, 'giu'),
    read: m => ({
      month: monthOf(m[1]),
      day: Number(m[2]),
      year: Number(m[3]),
      leadingMonth: true,
    }),
  },
  // 21 июня 2026 · 21. Juni 2026 · 21 de junio de 2026
  {
    regex: new RegExp(
      `(?<!\\d)(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s*(?:de\\s+)?${MONTH}\\s*,?\\s*(?:de\\s+)?(\\d{4})(?!\\d)`,
      'giu',
    ),
    read: m => ({ day: Number(m[1]), month: monthOf(m[2]), year: Number(m[3]) }),
  },
  // 2026-06-21 · 2026.06.21
  {
    regex: /(?<![\d.,])(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?![\d])/g,
    read: m => ({ year: Number(m[1]), month: Number(m[3]), day: Number(m[4]) }),
  },
  // 21.06.2026 · 06/21/2026 · 21.06.26: which number is the day is settled later.
  {
    regex: /(?<![\d.,])(\d{1,2})([-/.])(\d{1,2})\2(\d{4}|\d{2})(?!\d|[.,]\d)/g,
    read: m => ({
      first: Number(m[1]),
      second: Number(m[3]),
      year: m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4]),
    }),
  },
];

type DateParts =
  | { year: number; month: number; day: number; leadingMonth?: boolean }
  | { year: number; first: number; second: number };

// Checked against the text between the start of the line (or the previous date
// on it) and the date. A due date, a service period or the moment a report was
// printed says nothing about when the money moved.
const NOT_THE_PAYMENT_LABEL =
  /\b(?:due|payable|pay\s+by|valid|expir\w*|period|billing|service|generated|printed)\b|fällig|zahlbar|gültig|zeitraum|срок|оплатить\s+до|период|сформирован|напечатан|vencimiento|échéance|scadenza|vencimento|vervaldatum/iu;

const PAYMENT_LABEL =
  /\b(?:date\s*paid|paid|payment\s*date|transaction\s*date|purchase\s*date|date\s*of\s*(?:payment|purchase|transaction|sale))\b|дата\s*(?:оплаты|платежа|операции|покупки|продажи)|zahlungsdatum|bezahlt|kaufdatum|fecha\s*de\s*(?:pago|compra)|date\s*de\s*paiement|data\s*d[io]\s*pagamento|תאריך\s*תשלום/iu;

const DATE_LABEL = /date|datum|dato|data|fecha|issued|дата|күні|תאריך|dátum|päivämäärä/iu;

// The second half of a range: "Jun 21 – Jul 21, 2026", "01.06.–30.06.2026".
const RANGE_START_BEFORE = new RegExp(
  `(?:${MONTH}\\s*\\d{1,2}|\\d{1,2}[./]\\d{1,2}[./]?(?:\\d{2,4})?)\\s*(?:[-–—]|to|bis|по|до)?\\s*$`,
  'iu',
);

const LABEL_SCORE = { payment: 3, issued: 2, none: 1 } as const;

function monthOf(word: string): number {
  return MONTH_BY_WORD.get(word.toLowerCase().replace(/\.$/, '')) ?? 0;
}

function utcDate(year: number, month: number, day: number): Date | undefined {
  if (year <= 1900 || year >= 2100) {
    return undefined;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 31.02 over into March; such a date is not on the page.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : undefined;
}

function resolve(parts: DateParts, options: DocumentDateOptions): DocumentDate | undefined {
  if ('day' in parts) {
    const date = utcDate(parts.year, parts.month, parts.day);
    return date ? { date, ambiguous: false } : undefined;
  }

  const { first, second, year } = parts;
  if (first > 12 || second > 12 || first === second) {
    const [day, month] = second > 12 ? [second, first] : [first, second];
    const date = utcDate(year, month, day);
    return date ? { date, ambiguous: false } : undefined;
  }

  const date = options.monthFirst ? utcDate(year, first, second) : utcDate(year, second, first);
  return date ? { date, ambiguous: true } : undefined;
}

/**
 * pdf-parse glues a label to its value ("Date of issueJune 21, 2026"), so a
 * month name may follow a letter; but only as a capitalised word after a
 * lower-case one, not the tail of a word ("Kumar 21, 2026").
 */
function startsWord(text: string, at: number): boolean {
  const before = text[at - 1];
  if (!(before && /\p{L}/u.test(before))) {
    return true;
  }
  return /\p{Ll}/u.test(before) && /\p{Lu}/u.test(text[at]);
}

function labelScore(label: string): number | null {
  if (NOT_THE_PAYMENT_LABEL.test(label)) {
    return null;
  }
  if (PAYMENT_LABEL.test(label)) {
    return LABEL_SCORE.payment;
  }
  return DATE_LABEL.test(label) ? LABEL_SCORE.issued : LABEL_SCORE.none;
}

type Candidate = { found: DocumentDate; score: number; at: number; end: number };

function candidatesOn(line: string, options: DocumentDateOptions): Candidate[] {
  const matches: Array<{ at: number; end: number; parts: DateParts }> = [];
  for (const { regex, read } of DATE_PATTERNS) {
    for (const match of line.matchAll(regex)) {
      const at = match.index ?? 0;
      const end = at + match[0].length;
      // A shorter pattern inside a date already read ("21, 2026" of "June 21, 2026").
      if (matches.some(other => at < other.end && end > other.at)) {
        continue;
      }
      const parts = read(match as RegExpExecArray);
      if ('leadingMonth' in parts && !startsWord(line, at)) {
        continue;
      }
      matches.push({ at, end, parts });
    }
  }
  return matches
    .sort((a, b) => a.at - b.at)
    .flatMap((match, index, all) => {
      const found = resolve(match.parts, options);
      if (!found) {
        return [];
      }
      const label = line.slice(index > 0 ? all[index - 1].end : 0, match.at);
      if (RANGE_START_BEFORE.test(label)) {
        return [];
      }
      return [{ found, score: labelScore(label) ?? -1, at: match.at, end: match.end }];
    });
}

export function findDocumentDate(
  text: string,
  options: DocumentDateOptions = {},
): DocumentDate | undefined {
  const lines = text.split('\n');
  let best: Candidate | undefined;

  for (const [index, line] of lines.entries()) {
    for (const candidate of candidatesOn(line, options)) {
      let { score } = candidate;
      // A table puts the label on the line above: "Date" / "21.06.2026".
      if (score === LABEL_SCORE.none && !/\p{L}/u.test(line.slice(0, candidate.at))) {
        score = labelScore(lines[index - 1] ?? '') ?? -1;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { ...candidate, score };
      }
    }
  }

  return best?.found;
}
