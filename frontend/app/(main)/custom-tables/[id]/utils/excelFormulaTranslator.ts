/**
 * Перевод формул Excel (A1) в формулы таблицы. Работает на одной колонке:
 * ссылка на ту же строку — [Колонка], на строку выше — PREV([Колонка]),
 * диапазон по колонке внутри SUM/AVERAGE/… — итог по колонке, ссылка на
 * ячейку строки «Итого» — тот же итог. Всё остальное честно объявляется
 * непереносимым, с причиной: значения при этом импортируются как есть.
 */

export type ExcelTranslation =
  | { kind: 'row' | 'summary'; expression: string }
  | { kind: 'unsupported'; reason: string };

export type TotalsAggregateName = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface TranslationScope {
  /** 0-based sheet row of the cell holding the formula. */
  cellRow: number;
  /** First and last 0-based sheet rows of the data block (inclusive). */
  dataRows: { first: number; last: number };
  /** Target column for a 0-based sheet column; null when it is not imported. */
  columnAt: (sheetCol: number) => { title: string } | null;
  /** Aggregate a totals-row cell holds, by 0-based sheet row/col; null when it is not a totals cell. */
  totalsAggregateAt: (sheetRow: number, sheetCol: number) => TotalsAggregateName | null;
}

type Token =
  | { kind: 'ref'; col: number; row: number; absRow: boolean; absCol: boolean; text: string }
  | { kind: 'range'; from: Token & { kind: 'ref' }; to: Token & { kind: 'ref' }; text: string }
  | { kind: 'colRange'; from: number; to: number; text: string }
  | { kind: 'ident'; name: string }
  | { kind: 'number'; text: string }
  | { kind: 'string'; text: string }
  | { kind: 'op'; text: string }
  | { kind: 'paren'; text: '(' | ')' }
  | { kind: 'sep' }
  | { kind: 'sheet'; text: string };

const AGGREGATE_FN: Record<string, string> = {
  SUM: 'SUM',
  AVERAGE: 'AVERAGE',
  MIN: 'MIN',
  MAX: 'MAX',
  COUNT: 'COUNT',
  COUNTA: 'COUNTA',
};
const CONDITIONAL_FN = new Set(['SUMIF', 'COUNTIF', 'AVERAGEIF']);
const PLAIN_FN = new Set([
  'ROUND',
  'ROUNDUP',
  'ROUNDDOWN',
  'ABS',
  'IF',
  'IFS',
  'AND',
  'OR',
  'NOT',
  'IFERROR',
  'ISBLANK',
  'CONCAT',
  'LEN',
  'LEFT',
  'RIGHT',
  'UPPER',
  'LOWER',
  'TRIM',
  'YEAR',
  'MONTH',
  'DAY',
  'TODAY',
  'DAYS',
  'EOMONTH',
]);
const RENAMED_FN: Record<string, string> = { CONCATENATE: 'CONCAT', AVG: 'AVERAGE' };
const AGGREGATE_OF_TOTALS: Record<TotalsAggregateName, string> = {
  sum: 'SUM',
  avg: 'AVERAGE',
  min: 'MIN',
  max: 'MAX',
  count: 'COUNTA',
};

class Unsupported extends Error {}

const colIndex = (letters: string): number =>
  [...letters.toUpperCase()].reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;

export const columnLetters = (index: number): string => {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/;
const COL_RANGE_RE = /^\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})(?![A-Za-z0-9])/;
const SHEET_RE = /^(?:'[^']+'|[A-Za-z0-9_.]+)!/;
const NUMBER_RE = /^\d+(?:\.\d+)?/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_.]*/;
const OPERATORS = ['<=', '>=', '<>', '+', '-', '*', '/', '^', '&', '=', '<', '>', '%'];

const parseRef = (text: string): (Token & { kind: 'ref' }) | null => {
  const match = REF_RE.exec(text);
  if (!match) {
    return null;
  }
  return {
    kind: 'ref',
    absCol: match[1] === '$',
    col: colIndex(match[2]),
    absRow: match[3] === '$',
    row: Number(match[4]) - 1,
    text: match[0],
  };
};

export function tokenizeExcelFormula(formula: string): Token[] {
  let rest = formula.trim().replace(/^=/, '');
  const tokens: Token[] = [];
  while (rest.length) {
    const char = rest[0];
    if (/\s/.test(char)) {
      rest = rest.slice(1);
      continue;
    }
    if (char === '"') {
      let index = 1;
      while (index < rest.length) {
        if (rest[index] === '"') {
          if (rest[index + 1] === '"') {
            index += 2;
            continue;
          }
          break;
        }
        index += 1;
      }
      tokens.push({ kind: 'string', text: rest.slice(0, index + 1) });
      rest = rest.slice(index + 1);
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', text: char });
      rest = rest.slice(1);
      continue;
    }
    if (char === ',' || char === ';') {
      tokens.push({ kind: 'sep' });
      rest = rest.slice(1);
      continue;
    }
    const sheet = SHEET_RE.exec(rest);
    if (sheet) {
      tokens.push({ kind: 'sheet', text: sheet[0] });
      rest = rest.slice(sheet[0].length);
      continue;
    }
    const colRange = COL_RANGE_RE.exec(rest);
    if (colRange) {
      tokens.push({
        kind: 'colRange',
        from: colIndex(colRange[1]),
        to: colIndex(colRange[2]),
        text: colRange[0],
      });
      rest = rest.slice(colRange[0].length);
      continue;
    }
    const ref = parseRef(rest);
    if (ref) {
      rest = rest.slice(ref.text.length);
      if (rest.startsWith(':')) {
        const to = parseRef(rest.slice(1));
        if (to) {
          rest = rest.slice(1 + to.text.length);
          tokens.push({ kind: 'range', from: ref, to, text: `${ref.text}:${to.text}` });
          continue;
        }
      }
      tokens.push(ref);
      continue;
    }
    const num = NUMBER_RE.exec(rest);
    if (num) {
      tokens.push({ kind: 'number', text: num[0] });
      rest = rest.slice(num[0].length);
      continue;
    }
    const op = OPERATORS.find(item => rest.startsWith(item));
    if (op) {
      tokens.push({ kind: 'op', text: op });
      rest = rest.slice(op.length);
      continue;
    }
    const ident = IDENT_RE.exec(rest);
    if (ident) {
      tokens.push({ kind: 'ident', name: ident[0].toUpperCase() });
      rest = rest.slice(ident[0].length);
      continue;
    }
    throw new Unsupported(`Unexpected character: ${char}`);
  }
  return tokens;
}

/**
 * Форма формулы без привязки к строке: относительные строки становятся
 * смещениями. Одинаковая форма во всей колонке означает «это одна формула,
 * протянутая вниз» — как её и задумывал автор файла.
 */
export function normalizeFormulaShape(formula: string, cellRow: number): string {
  return formula
    .trim()
    .replace(/^=/, '')
    .replace(
      /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g,
      (_match, absCol: string, col: string, absRow: string, row: string) =>
        absRow === '$'
          ? `${absCol}${col.toUpperCase()}$${row}`
          : `${absCol}${col.toUpperCase()}[${Number(row) - 1 - cellRow}]`,
    );
}

type Ctx = { scope: TranslationScope; summary: boolean };

const titleOf = (ctx: Ctx, sheetCol: number): string => {
  const column = ctx.scope.columnAt(sheetCol);
  if (!column) {
    throw new Unsupported(`Column ${columnLetters(sheetCol)} is not imported`);
  }
  return `[${column.title}]`;
};

const translateRef = (ref: Token & { kind: 'ref' }, ctx: Ctx): string => {
  const { scope } = ctx;
  const totals = scope.totalsAggregateAt(ref.row, ref.col);
  if (totals) {
    return `${AGGREGATE_OF_TOTALS[totals]}(${titleOf(ctx, ref.col)})`;
  }
  if (ctx.summary) {
    throw new Unsupported(`Cell ${ref.text} is outside the totals row`);
  }
  if (ref.row === scope.cellRow) {
    return titleOf(ctx, ref.col);
  }
  if (ref.row === scope.cellRow - 1 && !ref.absRow) {
    return `PREV(${titleOf(ctx, ref.col)})`;
  }
  throw new Unsupported(`Reference to another row: ${ref.text}`);
};

const coversDataBlock = (from: number, to: number, scope: TranslationScope): boolean =>
  Math.min(from, to) <= scope.dataRows.first && Math.max(from, to) >= scope.dataRows.last;

const translateRange = (token: Token, ctx: Ctx, insideAggregate: boolean): string => {
  if (!insideAggregate) {
    throw new Unsupported(
      'A range is only supported inside SUM, AVERAGE, MIN, MAX, COUNT, SUMIF, COUNTIF or AVERAGEIF',
    );
  }
  if (token.kind === 'colRange') {
    if (token.from !== token.to) {
      throw new Unsupported(`Multi-column range: ${token.text}`);
    }
    return titleOf(ctx, token.from);
  }
  if (token.kind !== 'range') {
    throw new Unsupported('Invalid range');
  }
  if (token.from.col !== token.to.col) {
    throw new Unsupported(`Multi-column range: ${token.text}`);
  }
  if (!coversDataBlock(token.from.row, token.to.row, ctx.scope)) {
    throw new Unsupported(`Range ${token.text} does not cover the data rows`);
  }
  return titleOf(ctx, token.from.col);
};

/** Аргументы вызова: группы токенов верхнего уровня между разделителями. */
const splitArgs = (tokens: Token[]): Token[][] => {
  const args: Token[][] = [];
  let depth = 0;
  let current: Token[] = [];
  for (const token of tokens) {
    if (token.kind === 'paren') {
      depth += token.text === '(' ? 1 : -1;
    }
    if (token.kind === 'sep' && depth === 0) {
      args.push(current);
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length || args.length) {
    args.push(current);
  }
  return args;
};

function translateCall(name: string, args: Token[][], ctx: Ctx): string {
  const fn = RENAMED_FN[name] ?? name;
  if (AGGREGATE_FN[fn]) {
    return `${fn}(${args.map(arg => translateTokens(arg, ctx, true)).join(', ')})`;
  }
  if (CONDITIONAL_FN.has(fn)) {
    // Excel: SUMIF(criteria_range, criterion, [sum_range]); наш порядок: SUMIF([sum], [criteria], criterion).
    const [criteriaRange, criterion, sumRange] = args;
    if (!(criteriaRange && criterion)) {
      throw new Unsupported(`${fn} needs a range and a criterion`);
    }
    const criteria = translateTokens(criteriaRange, ctx, true);
    const value = translateTokens(criterion, ctx, false);
    if (fn === 'COUNTIF') {
      return `COUNTIF(${criteria}, ${value})`;
    }
    const sum = sumRange ? translateTokens(sumRange, ctx, true) : criteria;
    return `${fn}(${sum}, ${criteria}, ${value})`;
  }
  if (PLAIN_FN.has(fn)) {
    return `${fn}(${args.map(arg => translateTokens(arg, ctx, false)).join(', ')})`;
  }
  throw new Unsupported(`Function ${name} is not supported`);
}

function translateTokens(tokens: Token[], ctx: Ctx, insideAggregate: boolean): string {
  let out = '';
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    switch (token.kind) {
      case 'sheet':
        throw new Unsupported(`Reference to another sheet: ${token.text}`);
      case 'ref':
        out += translateRef(token, ctx);
        break;
      case 'range':
      case 'colRange':
        out += translateRange(token, ctx, insideAggregate);
        break;
      case 'ident': {
        const next = tokens[index + 1];
        if (next && next.kind === 'paren' && next.text === '(') {
          let depth = 0;
          let end = index + 1;
          for (; end < tokens.length; end += 1) {
            const item = tokens[end];
            if (item.kind === 'paren') {
              depth += item.text === '(' ? 1 : -1;
              if (depth === 0) {
                break;
              }
            }
          }
          if (end >= tokens.length) {
            throw new Unsupported('Unbalanced parenthesis');
          }
          out += translateCall(token.name, splitArgs(tokens.slice(index + 2, end)), ctx);
          index = end;
          break;
        }
        if (token.name === 'TRUE' || token.name === 'FALSE') {
          out += token.name;
          break;
        }
        throw new Unsupported(`Named range or unknown name: ${token.name}`);
      }
      case 'number':
      case 'string':
        out += token.text;
        break;
      case 'op':
        out += ` ${token.text} `;
        break;
      case 'paren':
        out += token.text;
        break;
      case 'sep':
        out += ', ';
        break;
      default:
    }
    index += 1;
  }
  return out.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
}

/** Формула из ячейки строки данных → формула колонки. */
export function translateExcelFormula(formula: string, scope: TranslationScope): ExcelTranslation {
  try {
    const expression = translateTokens(
      tokenizeExcelFormula(formula),
      { scope, summary: false },
      false,
    );
    return { kind: 'row', expression };
  } catch (error) {
    return {
      kind: 'unsupported',
      reason: error instanceof Error ? error.message : 'Unsupported formula',
    };
  }
}

/** Формула из ячейки строки «Итого» → сводка под таблицей. */
export function translateTotalsFormula(formula: string, scope: TranslationScope): ExcelTranslation {
  try {
    const expression = translateTokens(
      tokenizeExcelFormula(formula),
      { scope, summary: true },
      false,
    );
    return { kind: 'summary', expression };
  } catch (error) {
    return {
      kind: 'unsupported',
      reason: error instanceof Error ? error.message : 'Unsupported formula',
    };
  }
}

export interface ColumnFormulaDecision {
  /** Formula of the first data cell that has one, as written in the file. */
  excel: string;
  translation: ExcelTranslation;
  /** Data cells that hold a value instead of the formula and would be recomputed. */
  overriddenCells: number;
}

/** Требуемая доля ячеек с формулой, чтобы колонка считалась формульной. */
const FORMULA_SHARE = 0.8;

/**
 * Решает, является ли исходная колонка «одной формулой, протянутой вниз».
 * `cells` — формулы (или undefined) ячеек строк данных, `sheetRowOf(i)` — их
 * строки на листе.
 */
export function decideColumnFormula(
  cells: Array<{ formula?: string; text: string }>,
  sheetRowOf: (index: number) => number,
  scopeFor: (index: number) => TranslationScope,
): ColumnFormulaDecision | null {
  const filled = cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.formula || cell.text.trim());
  if (!filled.length) {
    return null;
  }
  const withFormula = filled.filter(({ cell }) => cell.formula);
  if (withFormula.length / filled.length < FORMULA_SHARE) {
    return null;
  }
  const shapeOf = (item: { cell: { formula?: string }; index: number }): string =>
    normalizeFormulaShape(item.cell.formula as string, sheetRowOf(item.index));
  const uniformFrom = (items: typeof withFormula): boolean =>
    items.length > 0 && items.every(item => shapeOf(item) === shapeOf(items[0]));
  // Нарастающий остаток часто начинается особой формулой в первой строке
  // («=D4», дальше «=F4+D5»): форма со второй строки и есть настоящая формула,
  // а для первой строки PREV даёт пусто, то есть ноль.
  const representative = uniformFrom(withFormula)
    ? withFormula[0]
    : withFormula.length > 2 && uniformFrom(withFormula.slice(1))
      ? withFormula[1]
      : null;
  const excel = (representative ?? withFormula[0]).cell.formula as string;
  const translation: ExcelTranslation = representative
    ? translateExcelFormula(excel, scopeFor(representative.index))
    : { kind: 'unsupported', reason: 'The formulas differ from row to row' };
  return { excel, translation, overriddenCells: filled.length - withFormula.length };
}
