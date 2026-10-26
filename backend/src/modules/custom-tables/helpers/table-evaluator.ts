import {
  type ColumnAggregateFn,
  collectFieldRefs,
  evaluateFormula,
  type FormulaValue,
  type TableContext,
} from './formula-evaluator';

/** Ровно то, что нужно вычислителю от колонки. */
export interface FormulaColumnLike {
  key: string;
  expression: string;
}

const numericOf = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw === 'boolean') {
    return raw ? 1 : 0;
  }
  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(num) ? num : null;
};

const isBlank = (raw: unknown): boolean =>
  raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');

/** Критерий SUMIF/COUNTIF: числа по значению, текст без учёта регистра, пусто = пусто. */
const matchesCriterion = (raw: unknown, criterion: FormulaValue): boolean => {
  if (isBlank(criterion)) {
    return isBlank(raw);
  }
  const a = numericOf(raw);
  const b = numericOf(criterion);
  if (a !== null && b !== null) {
    return a === b;
  }
  return (
    String(raw ?? '')
      .trim()
      .toLowerCase() === String(criterion).trim().toLowerCase()
  );
};

/**
 * Формула, ссылающаяся на другую формулу, считается после неё. Ссылка внутри
 * PREV зависимости не создаёт: она смотрит на уже посчитанную строку выше.
 */
export function orderFormulaColumns<T extends FormulaColumnLike>(columns: T[]): T[] {
  const byKey = new Map(columns.map(col => [col.key, col]));
  const refs = new Map<string, string[]>();
  for (const col of columns) {
    let deps: string[] = [];
    try {
      deps = collectFieldRefs(col.expression, { excludePrev: true }).filter(
        key => key !== col.key && byKey.has(key),
      );
    } catch {
      deps = [];
    }
    refs.set(col.key, deps);
  }
  const ordered: T[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (col: T): void => {
    if (done.has(col.key) || visiting.has(col.key)) {
      return;
    }
    visiting.add(col.key);
    for (const dep of refs.get(col.key) ?? []) {
      const target = byKey.get(dep);
      if (target) {
        visit(target);
      }
    }
    visiting.delete(col.key);
    done.add(col.key);
    ordered.push(col);
  };
  for (const col of columns) {
    visit(col);
  }
  return ordered;
}

/**
 * Считает формульные колонки над всей таблицей: строки в порядке отображения,
 * колонки в порядке зависимостей. Даёт TableContext для итогов по колонке,
 * предыдущей строки и нарастающих сумм; кеши сбрасываются после каждой колонки,
 * потому что её значения могли войти в чужие итоги.
 */
export class TableEvaluator {
  private aggregates = new Map<string, FormulaValue>();
  private prefixSums = new Map<string, number[]>();

  constructor(readonly rows: Array<Record<string, unknown>>) {}

  private clearCaches(): void {
    this.aggregates.clear();
    this.prefixSums.clear();
  }

  private numbers(key: string): number[] {
    const values: number[] = [];
    for (const row of this.rows) {
      const num = numericOf(row[key]);
      if (num !== null) {
        values.push(num);
      }
    }
    return values;
  }

  aggregate(fn: ColumnAggregateFn, key: string): FormulaValue {
    const cacheKey = `${fn}|${key}`;
    const cached = this.aggregates.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    let value: FormulaValue = null;
    if (fn === 'counta') {
      value = this.rows.filter(row => !isBlank(row[key])).length;
    } else {
      const values = this.numbers(key);
      if (fn === 'count') {
        value = values.length;
      } else if (values.length) {
        const sum = values.reduce((a, b) => a + b, 0);
        value =
          fn === 'sum'
            ? sum
            : fn === 'avg'
              ? sum / values.length
              : fn === 'min'
                ? Math.min(...values)
                : Math.max(...values);
      }
    }
    this.aggregates.set(cacheKey, value);
    return value;
  }

  conditional(
    fn: 'sumif' | 'countif' | 'averageif',
    key: string | null,
    criteriaKey: string,
    criterion: FormulaValue,
  ): FormulaValue {
    const cacheKey = `${fn}|${key ?? ''}|${criteriaKey}|${JSON.stringify(criterion)}`;
    const cached = this.aggregates.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const matched = this.rows.filter(row => matchesCriterion(row[criteriaKey], criterion));
    let value: FormulaValue = null;
    if (fn === 'countif') {
      value = matched.length;
    } else if (key) {
      const values = matched
        .map(row => numericOf(row[key]))
        .filter((num): num is number => num !== null);
      const sum = values.reduce((a, b) => a + b, 0);
      value = fn === 'sumif' ? sum : values.length ? sum / values.length : null;
    }
    this.aggregates.set(cacheKey, value);
    return value;
  }

  private runningSum(key: string, index: number): number {
    let prefix = this.prefixSums.get(key);
    if (!prefix) {
      prefix = [];
      let total = 0;
      for (const row of this.rows) {
        total += numericOf(row[key]) ?? 0;
        prefix.push(total);
      }
      this.prefixSums.set(key, prefix);
    }
    return prefix[index] ?? 0;
  }

  /** Контекст строки с индексом `index` (с нуля). */
  contextFor(index: number): TableContext {
    return {
      aggregate: (fn, key) => this.aggregate(fn, key),
      conditional: (fn, key, criteriaKey, criterion) =>
        this.conditional(fn, key, criteriaKey, criterion),
      prev: index > 0 ? this.rows[index - 1] : null,
      runningSum: key => this.runningSum(key, index),
      rowIndex: index + 1,
    };
  }

  /** Контекст сводки под таблицей: строки нет, нарастающий итог равен полному. */
  summaryContext(): TableContext {
    return {
      aggregate: (fn, key) => this.aggregate(fn, key),
      conditional: (fn, key, criteriaKey, criterion) =>
        this.conditional(fn, key, criteriaKey, criterion),
      prev: null,
      runningSum: key => this.runningSum(key, this.rows.length - 1),
      rowIndex: 0,
    };
  }

  /** Заполняет одну формульную колонку во всех строках, сверху вниз. */
  computeColumn(column: FormulaColumnLike): void {
    for (let index = 0; index < this.rows.length; index += 1) {
      // Нарастающие суммы по этой же колонке пересчитываются от строки к строке.
      this.prefixSums.delete(column.key);
      this.rows[index][column.key] = evaluateFormula(
        column.expression,
        this.rows[index],
        this.contextFor(index),
      );
    }
    this.clearCaches();
  }

  computeAll(columns: FormulaColumnLike[]): void {
    for (const column of orderFormulaColumns(columns)) {
      this.computeColumn(column);
    }
  }
}
