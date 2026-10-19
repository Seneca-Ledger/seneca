import { matchFieldByName, normalizeToken, parseDateCell, parseNumberCell } from './pasteParser';
import type { PasteFieldKey } from './pasteTypes';

export type RowKind = 'data' | 'total' | 'note';
export type TotalsAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface RowClassification {
  kinds: RowKind[];
  /** Индексы итоговых строк и агрегат по каждой исходной колонке итоговой строки. */
  totals: { rowIndexes: number[]; aggregates: Record<number, TotalsAggregate> };
}

const HEADER_SCAN_LIMIT = 40;
const TOTAL_WORDS = [
  'итого',
  'итог',
  'всего',
  'total',
  'subtotal',
  'grandtotal',
  'sum',
  'summe',
  'balance',
  'остаток',
  'оборот',
  'celkem',
  'totaal',
  'razem',
  'toplam',
];
const AGGREGATE_FORMULA_RE = /^\s*=?\s*(SUM|AVERAGE|AVG|MIN|MAX|COUNT|COUNTA|SUBTOTAL)\s*\(/i;
const FORMULA_AGGREGATES: Record<string, TotalsAggregate> = {
  sum: 'sum',
  subtotal: 'sum',
  average: 'avg',
  avg: 'avg',
  min: 'min',
  max: 'max',
  count: 'count',
  counta: 'count',
};

const isNumeric = (cell: string): boolean => Boolean(cell.trim()) && !parseNumberCell(cell).error;
const isDate = (cell: string): boolean => Boolean(cell.trim()) && !parseDateCell(cell).error;

type RowShape = { filled: string[]; numeric: number; dates: number; text: number };

const shapeOf = (row: string[]): RowShape => {
  const filled = row.map(cell => String(cell ?? '').trim()).filter(Boolean);
  let numeric = 0;
  let dates = 0;
  let text = 0;
  for (const cell of filled) {
    if (isDate(cell)) {
      dates += 1;
    } else if (isNumeric(cell)) {
      numeric += 1;
    } else {
      text += 1;
    }
  }
  return { filled, numeric, dates, text };
};

const headerScore = (
  row: string[],
  next: string[] | undefined,
  fieldByColumnName: Map<string, PasteFieldKey> | undefined,
): number => {
  const shape = shapeOf(row);
  if (!shape.filled.length || shape.text < Math.ceil(shape.filled.length / 2)) {
    return 0;
  }
  const aliasHits = shape.filled.filter(cell => {
    const token = normalizeToken(cell);
    return Boolean(fieldByColumnName?.has(token) || matchFieldByName(cell));
  }).length;
  const nextShape = next ? shapeOf(next) : null;
  const nextLooksLikeData = nextShape ? nextShape.numeric + nextShape.dates > 0 : false;
  // Одинокий заголовок отчёта в A1 — не шапка: под ним нет данных той же ширины.
  if (shape.filled.length < 2 && row.length > 1 && !aliasHits) {
    return 0;
  }
  if (!(nextLooksLikeData || aliasHits)) {
    return 0;
  }
  return shape.text + aliasHits;
};

/**
 * Ищет шапку в первых 40 строках: титульные строки отчёта выше неё
 * отбрасываются. Возвращает -1, если шапки нет (сразу данные).
 */
export function findHeaderRow(
  rows: string[][],
  fieldByColumnName?: Map<string, PasteFieldKey>,
): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const score = headerScore(rows[index], rows[index + 1], fieldByColumnName);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}

/** Та же оценка для одной строки: нужна переключателю «первая строка — заголовки». */
export const isHeaderRow = (
  rows: string[][],
  index: number,
  fieldByColumnName?: Map<string, PasteFieldKey>,
): boolean => headerScore(rows[index] ?? [], rows[index + 1], fieldByColumnName) > 0;

const isTotalWord = (cell: string): boolean => {
  const token = normalizeToken(cell);
  return Boolean(token) && TOTAL_WORDS.some(word => token.startsWith(word));
};

const aggregateOfFormula = (formula: string | undefined): TotalsAggregate | null => {
  const match = formula ? AGGREGATE_FORMULA_RE.exec(formula) : null;
  return match ? (FORMULA_AGGREGATES[match[1].toLowerCase()] ?? null) : null;
};

const collectAggregates = (
  row: string[],
  formulas: (string | undefined)[] | undefined,
): Record<number, TotalsAggregate> => {
  const aggregates: Record<number, TotalsAggregate> = {};
  row.forEach((cell, index) => {
    const formula = formulas?.[index];
    const fromFormula = aggregateOfFormula(formula);
    if (fromFormula) {
      aggregates[index] = fromFormula;
    } else if (!formula && isNumeric(cell)) {
      // Число без формулы — итог; ячейка с другой формулой станет сводкой.
      aggregates[index] = 'sum';
    }
  });
  return aggregates;
};

const isTotalRow = (row: string[], formulas: (string | undefined)[] | undefined): boolean => {
  const shape = shapeOf(row);
  if (!shape.numeric || shape.dates) {
    return false;
  }
  const hasAggregateFormula = Boolean(formulas?.some(formula => aggregateOfFormula(formula)));
  const label = shape.filled.find(cell => !isNumeric(cell));
  return hasAggregateFormula || (label !== undefined && isTotalWord(label));
};

/**
 * Делит строки под шапкой на данные, итоги и заметки: строка «Итого» (по
 * слову или по формуле SUM/AVERAGE…) — итог, всё без чисел и дат после
 * итога — примечания. Агрегаты итоговой строки потом становятся итогами футера.
 */
export function classifyRows(
  rows: string[][],
  formulas?: (string | undefined)[][],
): RowClassification {
  const kinds: RowKind[] = [];
  const rowIndexes: number[] = [];
  const aggregates: Record<number, TotalsAggregate> = {};
  let totalSeen = false;
  rows.forEach((row, index) => {
    const rowFormulas = formulas?.[index];
    if (isTotalRow(row, rowFormulas)) {
      kinds.push('total');
      rowIndexes.push(index);
      if (!totalSeen) {
        Object.assign(aggregates, collectAggregates(row, rowFormulas));
      }
      totalSeen = true;
      return;
    }
    const shape = shapeOf(row);
    if (totalSeen && !shape.numeric && !shape.dates) {
      kinds.push('note');
      return;
    }
    kinds.push('data');
  });
  return { kinds, totals: { rowIndexes, aggregates } };
}
