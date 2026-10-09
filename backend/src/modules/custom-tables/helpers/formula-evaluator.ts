/**
 * Вычислитель формул колонок: выражение над полями одной строки.
 *
 * Умышленно НЕ использует eval/new Function — выражение приходит от
 * пользователя и попадает в общий воркспейс, поэтому исполнять его как код
 * недопустимо. Здесь честный разбор: токенизация -> рекурсивный спуск в
 * дерево -> вычисление. Грамматика близка к Excel: арифметика, `^`, `&`,
 * сравнения, проценты, строки, TRUE/FALSE и набор функций из FORMULA_FUNCTIONS.
 * Всё, что выходит за одну строку — итоги по колонке, предыдущая строка,
 * нарастающий итог — берётся из TableContext, который даёт пересчёт таблицы.
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

export type FormulaValue = number | string | boolean | null;
export type FormulaResultType = 'number' | 'text' | 'boolean' | 'date';

export type ColumnAggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'counta';

/**
 * Что формула знает о таблице целиком. Без контекста (старые вызовы,
 * одиночный предпросмотр) табличные функции честно дают null.
 */
export interface TableContext {
  /** Итог по колонке над всеми строками таблицы. */
  aggregate(fn: ColumnAggregateFn, key: string): FormulaValue;
  /** SUMIF/COUNTIF/AVERAGEIF: итог по колонке `key` там, где `criteriaKey` равен критерию. */
  conditional(
    fn: 'sumif' | 'countif' | 'averageif',
    key: string | null,
    criteriaKey: string,
    criterion: FormulaValue,
  ): FormulaValue;
  /** Данные предыдущей по порядку строки; null для первой. */
  prev: Record<string, unknown> | null;
  /** Сумма колонки от первой строки до текущей включительно. */
  runningSum(key: string): number;
  /** Номер текущей строки по порядку, с единицы. */
  rowIndex: number;
}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'field'; key: string }
  | { kind: 'ident'; name: string }
  | { kind: 'op'; value: string }
  | { kind: 'paren'; value: '(' | ')' }
  | { kind: 'comma' };

type Node =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'field'; key: string }
  | { kind: 'unary'; op: '-' | '+'; arg: Node }
  | { kind: 'percent'; arg: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] };

const MAX_EXPRESSION_LENGTH = 500;
/** Ссылка на колонку: [ключ] — скобки снимают вопрос о пробелах в ключе. */
const FIELD_RE = /^\[([^\]]{1,120})\]/;
const NUMBER_RE = /^\d+(?:\.\d+)?/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/;
const OPERATORS = ['<=', '>=', '<>', '+', '-', '*', '/', '^', '&', '=', '<', '>'];
const COMPARISON_OPS = new Set(['=', '<>', '<', '<=', '>', '>=']);
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function readString(rest: string): { value: string; length: number } {
  let value = '';
  let index = 1;
  while (index < rest.length) {
    const char = rest[index];
    if (char === '"') {
      if (rest[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }
      return { value, length: index + 1 };
    }
    value += char;
    index += 1;
  }
  throw new FormulaError('Unterminated string in formula');
}

export function tokenizeFormula(expression: string): Token[] {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new FormulaError('Formula is too long');
  }
  const tokens: Token[] = [];
  let rest = expression;

  while (rest.length) {
    const char = rest[0];

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      rest = rest.slice(1);
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', value: char });
      rest = rest.slice(1);
      continue;
    }
    if (char === ',' || char === ';') {
      tokens.push({ kind: 'comma' });
      rest = rest.slice(1);
      continue;
    }
    if (char === '"') {
      const { value, length } = readString(rest);
      tokens.push({ kind: 'string', value });
      rest = rest.slice(length);
      continue;
    }
    if (char === '%') {
      // Процент только сразу после числа или скобки: «[a] % 2» — не остаток, а опечатка.
      const previous = tokens[tokens.length - 1];
      const afterValue =
        previous &&
        (previous.kind === 'number' || (previous.kind === 'paren' && previous.value === ')'));
      if (!afterValue) {
        throw new FormulaError(`Invalid character in formula: ${char}`);
      }
      tokens.push({ kind: 'op', value: '%' });
      rest = rest.slice(1);
      continue;
    }
    const operator = OPERATORS.find(op => rest.startsWith(op));
    if (operator) {
      tokens.push({ kind: 'op', value: operator });
      rest = rest.slice(operator.length);
      continue;
    }
    const field = FIELD_RE.exec(rest);
    if (field) {
      tokens.push({ kind: 'field', key: field[1].trim() });
      rest = rest.slice(field[0].length);
      continue;
    }
    const num = NUMBER_RE.exec(rest);
    if (num) {
      tokens.push({ kind: 'number', value: Number(num[0]) });
      rest = rest.slice(num[0].length);
      continue;
    }
    const ident = IDENT_RE.exec(rest);
    if (ident) {
      tokens.push({ kind: 'ident', name: ident[0].toUpperCase() });
      rest = rest.slice(ident[0].length);
      continue;
    }
    throw new FormulaError(`Invalid character in formula: ${char}`);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent, precedence low → high:
// comparison, &, + -, * /, unary, ^, %)
// ---------------------------------------------------------------------------

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    if (!this.tokens.length) {
      throw new FormulaError('Formula is empty');
    }
    const node = this.parseComparison();
    if (this.index < this.tokens.length) {
      throw new FormulaError('Unexpected token in formula');
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private take(): Token {
    const token = this.tokens[this.index];
    if (!token) {
      throw new FormulaError('Unexpected end of formula');
    }
    this.index += 1;
    return token;
  }

  private isOp(values: string[]): string | null {
    const token = this.peek();
    return token && token.kind === 'op' && values.includes(token.value) ? token.value : null;
  }

  private parseComparison(): Node {
    let left = this.parseConcat();
    let op = this.isOp([...COMPARISON_OPS]);
    while (op) {
      this.take();
      left = { kind: 'binary', op, left, right: this.parseConcat() };
      op = this.isOp([...COMPARISON_OPS]);
    }
    return left;
  }

  private parseConcat(): Node {
    let left = this.parseAdditive();
    while (this.isOp(['&'])) {
      this.take();
      left = { kind: 'binary', op: '&', left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    let op = this.isOp(['+', '-']);
    while (op) {
      this.take();
      left = { kind: 'binary', op, left, right: this.parseMultiplicative() };
      op = this.isOp(['+', '-']);
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    let op = this.isOp(['*', '/']);
    while (op) {
      this.take();
      left = { kind: 'binary', op, left, right: this.parseUnary() };
      op = this.isOp(['*', '/']);
    }
    return left;
  }

  private parseUnary(): Node {
    const op = this.isOp(['-', '+']);
    if (op) {
      this.take();
      return { kind: 'unary', op: op as '-' | '+', arg: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePostfix();
    if (this.isOp(['^'])) {
      this.take();
      // Правая ассоциативность: 2^3^2 = 2^(3^2), как в Excel.
      return { kind: 'binary', op: '^', left: base, right: this.parseUnary() };
    }
    return base;
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (this.isOp(['%'])) {
      this.take();
      node = { kind: 'percent', arg: node };
    }
    return node;
  }

  private parsePrimary(): Node {
    const token = this.take();
    switch (token.kind) {
      case 'number':
        return { kind: 'number', value: token.value };
      case 'string':
        return { kind: 'string', value: token.value };
      case 'field':
        return { kind: 'field', key: token.key };
      case 'ident':
        return this.parseIdent(token.name);
      case 'paren': {
        if (token.value !== '(') {
          throw new FormulaError('Unbalanced parenthesis in formula');
        }
        const inner = this.parseComparison();
        const close = this.peek();
        if (!(close && close.kind === 'paren' && close.value === ')')) {
          throw new FormulaError('Unbalanced parenthesis in formula');
        }
        this.take();
        return inner;
      }
      default:
        throw new FormulaError('Invalid formula');
    }
  }

  private parseIdent(name: string): Node {
    if (name === 'TRUE' || name === 'FALSE') {
      return { kind: 'boolean', value: name === 'TRUE' };
    }
    const open = this.peek();
    if (!(open && open.kind === 'paren' && open.value === '(')) {
      throw new FormulaError(`Unknown name in formula: ${name}`);
    }
    this.take();
    const args: Node[] = [];
    const close = this.peek();
    if (close && close.kind === 'paren' && close.value === ')') {
      this.take();
      return { kind: 'call', name, args };
    }
    for (;;) {
      args.push(this.parseComparison());
      const next = this.take();
      if (next.kind === 'comma') {
        continue;
      }
      if (next.kind === 'paren' && next.value === ')') {
        return { kind: 'call', name, args };
      }
      throw new FormulaError('Unbalanced parenthesis in formula');
    }
  }
}

const AST_CACHE = new Map<string, Node>();
const AST_CACHE_LIMIT = 500;

export function parseFormula(expression: string): Node {
  const cached = AST_CACHE.get(expression);
  if (cached) {
    return cached;
  }
  const node = new Parser(tokenizeFormula(expression)).parse();
  if (AST_CACHE.size >= AST_CACHE_LIMIT) {
    AST_CACHE.clear();
  }
  AST_CACHE.set(expression, node);
  return node;
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

function toNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') {
    // Пустая ячейка — ноль: иначе одна пустая клетка обнуляла бы всю колонку ошибкой.
    return 0;
  }
  if (typeof raw === 'boolean') {
    return raw ? 1 : 0;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  const num = Number(String(raw).replace(',', '.').trim());
  if (!Number.isFinite(num)) {
    throw new FormulaError('Non-numeric value in formula');
  }
  return num;
}

function toText(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (typeof raw === 'boolean') {
    return raw ? 'TRUE' : 'FALSE';
  }
  if (Array.isArray(raw)) {
    return raw.map(item => toText(item)).join(', ');
  }
  return String(raw);
}

function toBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === null || raw === undefined || raw === '') {
    return false;
  }
  if (typeof raw === 'number') {
    return raw !== 0;
  }
  const text = String(raw).trim().toLowerCase();
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  const num = Number(text.replace(',', '.'));
  if (Number.isFinite(num)) {
    return num !== 0;
  }
  throw new FormulaError('Value is not a condition');
}

function toDate(raw: unknown): Date {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new FormulaError('Value is not a date');
  }
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const date = iso
    ? new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    : new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new FormulaError('Value is not a date');
  }
  return date;
}

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

const looksNumeric = (value: unknown): boolean =>
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  (typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Number(value.replace(',', '.').trim())));

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

type Thunk = () => FormulaValue;

interface FunctionDef {
  min: number;
  max: number;
  /** Число (по умолчанию), текст, условие или дата — для вывода типа колонки. */
  result: FormulaResultType | 'branch';
  /** Ленивые функции получают невычисленные аргументы: IF не должен считать обе ветки. */
  lazy?: boolean;
  fn: (args: FormulaValue[], thunks: Thunk[]) => FormulaValue;
}

const numbers = (args: FormulaValue[]): number[] =>
  args.filter(arg => !isBlank(arg)).map(arg => toNumber(arg));

const roundWith = (mode: 'round' | 'up' | 'down') => (args: FormulaValue[]) => {
  const value = toNumber(args[0]);
  const digits = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
  const factor = 10 ** digits;
  const scaled = value * factor;
  const rounded =
    mode === 'round'
      ? Math.round(scaled)
      : mode === 'up'
        ? Math.sign(scaled) * Math.ceil(Math.abs(scaled))
        : Math.sign(scaled) * Math.floor(Math.abs(scaled));
  return rounded / factor;
};

const FUNCTIONS: Record<string, FunctionDef> = {
  SUM: { min: 1, max: 50, result: 'number', fn: args => numbers(args).reduce((a, b) => a + b, 0) },
  AVERAGE: {
    min: 1,
    max: 50,
    result: 'number',
    fn: args => {
      const values = numbers(args);
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    },
  },
  MIN: {
    min: 1,
    max: 50,
    result: 'number',
    fn: args => (numbers(args).length ? Math.min(...numbers(args)) : null),
  },
  MAX: {
    min: 1,
    max: 50,
    result: 'number',
    fn: args => (numbers(args).length ? Math.max(...numbers(args)) : null),
  },
  COUNT: { min: 1, max: 50, result: 'number', fn: args => args.filter(looksNumeric).length },
  COUNTA: { min: 1, max: 50, result: 'number', fn: args => args.filter(a => !isBlank(a)).length },
  ROUND: { min: 1, max: 2, result: 'number', fn: roundWith('round') },
  ROUNDUP: { min: 1, max: 2, result: 'number', fn: roundWith('up') },
  ROUNDDOWN: { min: 1, max: 2, result: 'number', fn: roundWith('down') },
  ABS: { min: 1, max: 1, result: 'number', fn: args => Math.abs(toNumber(args[0])) },
  IF: {
    min: 2,
    max: 3,
    result: 'branch',
    lazy: true,
    fn: (_args, thunks) =>
      toBoolean(thunks[0]()) ? thunks[1]() : thunks.length > 2 ? thunks[2]() : null,
  },
  IFS: {
    min: 2,
    max: 50,
    result: 'branch',
    lazy: true,
    fn: (_args, thunks) => {
      for (let index = 0; index + 1 < thunks.length; index += 2) {
        if (toBoolean(thunks[index]())) {
          return thunks[index + 1]();
        }
      }
      return null;
    },
  },
  AND: {
    min: 1,
    max: 50,
    result: 'boolean',
    lazy: true,
    fn: (_args, thunks) => thunks.every(thunk => toBoolean(thunk())),
  },
  OR: {
    min: 1,
    max: 50,
    result: 'boolean',
    lazy: true,
    fn: (_args, thunks) => thunks.some(thunk => toBoolean(thunk())),
  },
  NOT: { min: 1, max: 1, result: 'boolean', fn: args => !toBoolean(args[0]) },
  IFERROR: {
    min: 2,
    max: 2,
    result: 'branch',
    lazy: true,
    fn: (_args, thunks) => {
      try {
        return thunks[0]();
      } catch {
        return thunks[1]();
      }
    },
  },
  ISBLANK: { min: 1, max: 1, result: 'boolean', fn: args => isBlank(args[0]) },
  CONCAT: { min: 1, max: 50, result: 'text', fn: args => args.map(toText).join('') },
  LEN: { min: 1, max: 1, result: 'number', fn: args => toText(args[0]).length },
  LEFT: {
    min: 1,
    max: 2,
    result: 'text',
    fn: args => toText(args[0]).slice(0, args.length > 1 ? Math.trunc(toNumber(args[1])) : 1),
  },
  RIGHT: {
    min: 1,
    max: 2,
    result: 'text',
    fn: args => {
      const text = toText(args[0]);
      const count = args.length > 1 ? Math.trunc(toNumber(args[1])) : 1;
      return count > 0 ? text.slice(-count) : '';
    },
  },
  UPPER: { min: 1, max: 1, result: 'text', fn: args => toText(args[0]).toUpperCase() },
  LOWER: { min: 1, max: 1, result: 'text', fn: args => toText(args[0]).toLowerCase() },
  TRIM: { min: 1, max: 1, result: 'text', fn: args => toText(args[0]).trim().replace(/\s+/g, ' ') },
  YEAR: { min: 1, max: 1, result: 'number', fn: args => toDate(args[0]).getUTCFullYear() },
  MONTH: { min: 1, max: 1, result: 'number', fn: args => toDate(args[0]).getUTCMonth() + 1 },
  DAY: { min: 1, max: 1, result: 'number', fn: args => toDate(args[0]).getUTCDate() },
  TODAY: { min: 0, max: 0, result: 'date', fn: () => isoDate(new Date()) },
  DAYS: {
    min: 2,
    max: 2,
    result: 'number',
    fn: args => Math.round((toDate(args[0]).getTime() - toDate(args[1]).getTime()) / DAY_MS),
  },
  EOMONTH: {
    min: 1,
    max: 2,
    result: 'date',
    fn: args => {
      const date = toDate(args[0]);
      const months = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      return isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)));
    },
  },
};
FUNCTIONS.AVG = FUNCTIONS.AVERAGE;

/** Функции, которым нужна вся таблица; считаются в evaluateNode отдельной веткой. */
const COLUMN_AGGREGATES: Record<string, ColumnAggregateFn> = {
  SUM: 'sum',
  AVERAGE: 'avg',
  AVG: 'avg',
  MIN: 'min',
  MAX: 'max',
  COUNT: 'count',
  COUNTA: 'counta',
};
const CONDITIONAL_AGGREGATES: Record<string, 'sumif' | 'countif' | 'averageif'> = {
  SUMIF: 'sumif',
  COUNTIF: 'countif',
  AVERAGEIF: 'averageif',
};
const ORDER_FUNCTIONS: Record<
  string,
  { min: number; max: number; result: FormulaResultType | 'branch' }
> = {
  PREV: { min: 1, max: 1, result: 'branch' },
  RUNNING_SUM: { min: 1, max: 1, result: 'number' },
  ROW: { min: 0, max: 0, result: 'number' },
};
const CONDITIONAL_ARITY: Record<string, { min: number; max: number }> = {
  SUMIF: { min: 3, max: 3 },
  COUNTIF: { min: 2, max: 2 },
  AVERAGEIF: { min: 3, max: 3 },
};

const fieldKeyOf = (node: Node | undefined): string | null =>
  node && node.kind === 'field' ? node.key : null;

/** Подсказки редактора: имя и сигнатура каждой функции. */
export const FORMULA_FUNCTIONS: Array<{ name: string; signature: string }> = [
  { name: 'SUM', signature: 'SUM(a, b, …)' },
  { name: 'AVERAGE', signature: 'AVERAGE(a, b, …)' },
  { name: 'MIN', signature: 'MIN(a, b, …)' },
  { name: 'MAX', signature: 'MAX(a, b, …)' },
  { name: 'COUNT', signature: 'COUNT(a, b, …)' },
  { name: 'COUNTA', signature: 'COUNTA(a, b, …)' },
  { name: 'ROUND', signature: 'ROUND(value, digits)' },
  { name: 'ROUNDUP', signature: 'ROUNDUP(value, digits)' },
  { name: 'ROUNDDOWN', signature: 'ROUNDDOWN(value, digits)' },
  { name: 'ABS', signature: 'ABS(value)' },
  { name: 'IF', signature: 'IF(condition, then, else)' },
  { name: 'IFS', signature: 'IFS(condition1, value1, condition2, value2, …)' },
  { name: 'AND', signature: 'AND(a, b, …)' },
  { name: 'OR', signature: 'OR(a, b, …)' },
  { name: 'NOT', signature: 'NOT(condition)' },
  { name: 'IFERROR', signature: 'IFERROR(value, fallback)' },
  { name: 'ISBLANK', signature: 'ISBLANK(value)' },
  { name: 'CONCAT', signature: 'CONCAT(a, b, …)' },
  { name: 'LEN', signature: 'LEN(text)' },
  { name: 'LEFT', signature: 'LEFT(text, count)' },
  { name: 'RIGHT', signature: 'RIGHT(text, count)' },
  { name: 'UPPER', signature: 'UPPER(text)' },
  { name: 'LOWER', signature: 'LOWER(text)' },
  { name: 'TRIM', signature: 'TRIM(text)' },
  { name: 'YEAR', signature: 'YEAR(date)' },
  { name: 'MONTH', signature: 'MONTH(date)' },
  { name: 'DAY', signature: 'DAY(date)' },
  { name: 'TODAY', signature: 'TODAY()' },
  { name: 'DAYS', signature: 'DAYS(end, start)' },
  { name: 'EOMONTH', signature: 'EOMONTH(date, months)' },
  { name: 'SUMIF', signature: 'SUMIF([column], [criteria column], criterion)' },
  { name: 'COUNTIF', signature: 'COUNTIF([criteria column], criterion)' },
  { name: 'AVERAGEIF', signature: 'AVERAGEIF([column], [criteria column], criterion)' },
  { name: 'PREV', signature: 'PREV([column])' },
  { name: 'RUNNING_SUM', signature: 'RUNNING_SUM([column])' },
  { name: 'ROW', signature: 'ROW()' },
];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function compare(op: string, left: FormulaValue, right: FormulaValue): boolean {
  if (looksNumeric(left) && looksNumeric(right)) {
    const a = toNumber(left);
    const b = toNumber(right);
    return op === '='
      ? a === b
      : op === '<>'
        ? a !== b
        : op === '<'
          ? a < b
          : op === '<='
            ? a <= b
            : op === '>'
              ? a > b
              : a >= b;
  }
  const a = toText(left).toLowerCase();
  const b = toText(right).toLowerCase();
  return op === '='
    ? a === b
    : op === '<>'
      ? a !== b
      : op === '<'
        ? a < b
        : op === '<='
          ? a <= b
          : op === '>'
            ? a > b
            : a >= b;
}

function evaluateBinary(op: string, left: FormulaValue, right: FormulaValue): FormulaValue {
  if (COMPARISON_OPS.has(op)) {
    return compare(op, left, right);
  }
  if (op === '&') {
    return toText(left) + toText(right);
  }
  const a = toNumber(left);
  const b = toNumber(right);
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) {
        // Деление на ноль — пустая ячейка, а не Infinity в отчёте.
        throw new FormulaError('Division by zero');
      }
      return a / b;
    case '^':
      return a ** b;
    default:
      throw new FormulaError('Invalid formula');
  }
}

function evaluateContextual(
  node: Extract<Node, { kind: 'call' }>,
  rowData: Record<string, unknown>,
  context: TableContext | undefined,
): FormulaValue | undefined {
  const columnFn = COLUMN_AGGREGATES[node.name];
  const soleField = node.args.length === 1 ? fieldKeyOf(node.args[0]) : null;
  if (columnFn && soleField) {
    // SUM([amount]) — итог по колонке, а не сумма одной ячейки.
    return context ? context.aggregate(columnFn, soleField) : null;
  }
  const conditionalFn = CONDITIONAL_AGGREGATES[node.name];
  if (conditionalFn) {
    if (!context) {
      return null;
    }
    const [first, second, third] = node.args;
    if (conditionalFn === 'countif') {
      const criteriaKey = fieldKeyOf(first);
      if (!criteriaKey) {
        throw new FormulaError('COUNTIF expects a column as its first argument');
      }
      return context.conditional(
        'countif',
        null,
        criteriaKey,
        evaluateNode(second, rowData, context),
      );
    }
    const key = fieldKeyOf(first);
    const criteriaKey = fieldKeyOf(second);
    if (!(key && criteriaKey)) {
      throw new FormulaError(`${node.name} expects columns as its first two arguments`);
    }
    return context.conditional(
      conditionalFn,
      key,
      criteriaKey,
      evaluateNode(third, rowData, context),
    );
  }
  if (node.name === 'PREV') {
    const key = fieldKeyOf(node.args[0]);
    if (!key) {
      throw new FormulaError('PREV expects a column');
    }
    const raw = context?.prev?.[key];
    return raw === undefined || raw === null ? null : (raw as FormulaValue);
  }
  if (node.name === 'RUNNING_SUM') {
    const key = fieldKeyOf(node.args[0]);
    if (!key) {
      throw new FormulaError('RUNNING_SUM expects a column');
    }
    return context ? context.runningSum(key) : toNumber(rowData?.[key]);
  }
  if (node.name === 'ROW') {
    return context ? context.rowIndex : null;
  }
  return undefined;
}

function evaluateNode(
  node: Node,
  rowData: Record<string, unknown>,
  context?: TableContext,
): FormulaValue {
  switch (node.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return node.value;
    case 'field': {
      const raw = rowData?.[node.key];
      if (raw === undefined || raw === null) {
        return null;
      }
      if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean') {
        return raw;
      }
      return toText(raw);
    }
    case 'unary': {
      const value = toNumber(evaluateNode(node.arg, rowData, context));
      return node.op === '-' ? -value : value;
    }
    case 'percent':
      return toNumber(evaluateNode(node.arg, rowData, context)) / 100;
    case 'binary':
      return evaluateBinary(
        node.op,
        evaluateNode(node.left, rowData, context),
        evaluateNode(node.right, rowData, context),
      );
    case 'call': {
      const contextual = evaluateContextual(node, rowData, context);
      if (contextual !== undefined) {
        return contextual;
      }
      const def = FUNCTIONS[node.name];
      if (!def) {
        throw new FormulaError(`Unknown function: ${node.name}`);
      }
      const thunks = node.args.map(arg => () => evaluateNode(arg, rowData, context));
      if (def.lazy) {
        return def.fn([], thunks);
      }
      return def.fn(
        thunks.map(thunk => thunk()),
        thunks,
      );
    }
    default:
      throw new FormulaError('Invalid formula');
  }
}

const finite = (value: FormulaValue): FormulaValue =>
  typeof value === 'number' && !Number.isFinite(value) ? null : value;

/**
 * Вычисляет формулу для одной строки. Возвращает null, если посчитать нельзя —
 * ошибка в одной строке не должна ронять выдачу всей таблицы.
 */
export function evaluateFormula(
  expression: string,
  rowData: Record<string, unknown>,
  context?: TableContext,
): FormulaValue {
  try {
    return finite(evaluateNode(parseFormula(expression), rowData, context));
  } catch {
    return null;
  }
}

/** То же, но с причиной сбоя — для предпросмотра в редакторе. */
export function evaluateFormulaDetailed(
  expression: string,
  rowData: Record<string, unknown>,
  context?: TableContext,
): { value: FormulaValue; error: string | null } {
  try {
    return {
      value: finite(evaluateNode(parseFormula(expression), rowData, context)),
      error: null,
    };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : 'Invalid formula' };
  }
}

// ---------------------------------------------------------------------------
// Static analysis
// ---------------------------------------------------------------------------

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  switch (node.kind) {
    case 'unary':
    case 'percent':
      walk(node.arg, visit);
      break;
    case 'binary':
      walk(node.left, visit);
      walk(node.right, visit);
      break;
    case 'call':
      for (const arg of node.args) {
        walk(arg, visit);
      }
      break;
    default:
  }
}

/**
 * Ключи колонок, на которые ссылается формула (без дублей, в порядке появления).
 * Ссылка внутри PREV смотрит на предыдущую строку, а не на текущую, поэтому для
 * графа зависимостей её можно исключить: так колонка «остаток» может расти сама от себя.
 */
export function collectFieldRefs(
  expression: string,
  options: { excludePrev?: boolean } = {},
): string[] {
  const refs: string[] = [];
  const visit = (node: Node): void => {
    if (node.kind === 'field') {
      if (!refs.includes(node.key)) {
        refs.push(node.key);
      }
      return;
    }
    if (node.kind === 'call' && node.name === 'PREV' && options.excludePrev) {
      return;
    }
    switch (node.kind) {
      case 'unary':
      case 'percent':
        visit(node.arg);
        break;
      case 'binary':
        visit(node.left);
        visit(node.right);
        break;
      case 'call':
        for (const arg of node.args) {
          visit(arg);
        }
        break;
      default:
    }
  };
  visit(parseFormula(expression));
  return refs;
}

/** Нужна ли формуле вся таблица: итоги по колонке, условные итоги, порядок строк. */
export function needsTableContext(expression: string): boolean {
  let needed = false;
  walk(parseFormula(expression), node => {
    if (node.kind !== 'call') {
      return;
    }
    if (
      CONDITIONAL_AGGREGATES[node.name] ||
      ORDER_FUNCTIONS[node.name] ||
      (COLUMN_AGGREGATES[node.name] && node.args.length === 1 && fieldKeyOf(node.args[0]))
    ) {
      needed = true;
    }
  });
  return needed;
}

/**
 * Тип результата по дереву: сравнения и логика дают условие, `&` и текстовые
 * функции — текст, TODAY/EOMONTH — дату, остальное — число. Для ветвящихся
 * функций берётся тип первой ветки значения.
 */
export function inferFormulaResultType(
  expression: string,
  fieldTypes: Record<string, FormulaResultType | undefined>,
): FormulaResultType {
  const typeOf = (node: Node): FormulaResultType => {
    switch (node.kind) {
      case 'number':
      case 'unary':
      case 'percent':
        return 'number';
      case 'string':
        return 'text';
      case 'boolean':
        return 'boolean';
      case 'field':
        return fieldTypes[node.key] ?? 'text';
      case 'binary':
        return COMPARISON_OPS.has(node.op) ? 'boolean' : node.op === '&' ? 'text' : 'number';
      case 'call': {
        if (node.name === 'PREV') {
          return node.args[0] ? typeOf(node.args[0]) : 'text';
        }
        const order = ORDER_FUNCTIONS[node.name];
        if (order && order.result !== 'branch') {
          return order.result;
        }
        if (CONDITIONAL_AGGREGATES[node.name]) {
          return 'number';
        }
        const def = FUNCTIONS[node.name];
        if (!def) {
          return 'number';
        }
        if (def.result !== 'branch') {
          return def.result;
        }
        const branch = node.name === 'IFERROR' ? node.args[0] : node.args[1];
        return branch ? typeOf(branch) : 'text';
      }
      default:
        return 'number';
    }
  };
  return typeOf(parseFormula(expression));
}

const checkArity = (name: string, count: number, min: number, max: number): void => {
  if (count < min || count > max) {
    throw new FormulaError(`Wrong number of arguments for ${name}`);
  }
};

/**
 * Проверка формулы при сохранении колонки: тут ошибку нужно показать.
 * Собственный ключ колонки допустим только внутри PREV: «остаток = PREV([остаток]) + [сумма]».
 */
export function assertValidFormula(
  expression: string,
  knownKeys: string[],
  options: { selfKey?: string | null } = {},
): void {
  if (!expression.trim()) {
    throw new FormulaError('Formula is empty');
  }
  const ast = parseFormula(expression);
  const known = new Set(knownKeys);
  const check = (node: Node, insidePrev: boolean): void => {
    if (node.kind === 'field') {
      if (known.has(node.key) || (insidePrev && node.key === options.selfKey)) {
        return;
      }
      throw new FormulaError(`Column not found: ${node.key}`);
    }
    if (node.kind === 'call') {
      const order = ORDER_FUNCTIONS[node.name];
      const conditional = CONDITIONAL_ARITY[node.name];
      const def = FUNCTIONS[node.name];
      if (order) {
        checkArity(node.name, node.args.length, order.min, order.max);
      } else if (conditional) {
        checkArity(node.name, node.args.length, conditional.min, conditional.max);
      } else if (def) {
        checkArity(node.name, node.args.length, def.min, def.max);
      } else {
        throw new FormulaError(`Unknown function: ${node.name}`);
      }
      for (const arg of node.args) {
        check(arg, insidePrev || node.name === 'PREV');
      }
      return;
    }
    if (node.kind === 'unary' || node.kind === 'percent') {
      check(node.arg, insidePrev);
    } else if (node.kind === 'binary') {
      check(node.left, insidePrev);
      check(node.right, insidePrev);
    }
  };
  check(ast, false);
}
