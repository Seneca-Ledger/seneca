import { COLOR_PRESETS } from './colorPalette';
import {
  matchFieldByName,
  parseDateCell,
  parseNumberCellDetailed,
  parsePaidCell,
  resolveCurrencyCode,
} from './pasteParser';
import type { PasteFieldKey } from './pasteTypes';
import type { TabularCell } from './tabularFileReader';
import type { ColumnType, CustomTableColumnConfig } from './types';

/** Что импорт предлагает для новой колонки: тип, его настройки и как разбирать ячейки. */
export interface InferredColumn {
  type: ColumnType;
  config?: CustomTableColumnConfig;
  /** Правило разбора ячеек; null — хранить как текст. */
  field: PasteFieldKey | null;
}

const SAMPLE_SIZE = 50;
/** Доля ячеек, которые должны разобраться, чтобы колонка получила тип. */
const THRESHOLD = 0.6;
const BOOLEAN_THRESHOLD = 0.9;
const SELECT_MIN_ROWS = 10;
const SELECT_MAX_OPTIONS = 12;
const SELECT_MAX_LENGTH = 40;
const SELECT_MAX_DISTINCT_RATIO = 0.5;
const MAX_PRECISION = 6;
const MONEY_HEADER_WORDS = [
  'amount',
  'sum',
  'сумма',
  'price',
  'cost',
  'стоимость',
  'цена',
  'total',
  'итого',
  'debit',
  'credit',
  'дебет',
  'кредит',
  'balance',
  'остаток',
  'fee',
  'salary',
  'revenue',
  'expense',
  'расход',
  'доход',
];
const CURRENCY_FORMAT_RE = /[$€₽₸£¥]|\[\$[^\]]*\]/;

const TEXT: InferredColumn = { type: 'text', field: null };

type Sample = { values: string[]; cells: TabularCell[] };

const sampleOf = (values: string[], cells?: TabularCell[]): Sample => {
  const picked: string[] = [];
  const pickedCells: TabularCell[] = [];
  for (let index = 0; index < values.length && picked.length < SAMPLE_SIZE; index += 1) {
    const value = values[index].trim();
    if (!value) {
      continue;
    }
    picked.push(value);
    pickedCells.push(cells?.[index] ?? { text: value, kind: 'text' });
  }
  return { values: picked, cells: pickedCells };
};

const share = (hits: number, total: number): number => (total ? hits / total : 0);

const mostCommon = (items: string[]): string | null => {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [item, count] of counts) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
};

const headerLooksLikeMoney = (header: string): boolean => {
  const lower = header.toLowerCase();
  return MONEY_HEADER_WORDS.some(word => lower.includes(word));
};

const inferDate = ({ values, cells }: Sample): InferredColumn | null => {
  const hits = values.filter(
    (value, index) => cells[index].kind === 'date' || !parseDateCell(value).error,
  ).length;
  return share(hits, values.length) >= THRESHOLD ? { type: 'date', field: 'date' } : null;
};

const inferNumeric = ({ values, cells }: Sample, header: string): InferredColumn | null => {
  const parsed = values.map(parseNumberCellDetailed);
  const numeric = parsed.filter(item => !item.error);
  if (share(numeric.length, values.length) < THRESHOLD) {
    return null;
  }
  const decimals = Math.min(MAX_PRECISION, Math.max(0, ...numeric.map(item => item.decimals)));
  const percentHits =
    numeric.filter(item => item.percent).length +
    cells.filter(cell => cell.numFmt?.includes('%')).length;
  if (share(percentHits, numeric.length) >= THRESHOLD) {
    return {
      type: 'number',
      config: { format: 'percent', precision: decimals },
      field: 'amount',
    };
  }
  const codes = numeric.map(item => item.currency).filter((code): code is string => Boolean(code));
  const formatCurrency = cells.some(cell => CURRENCY_FORMAT_RE.test(cell.numFmt ?? ''));
  const isMoney =
    share(codes.length, numeric.length) >= THRESHOLD ||
    formatCurrency ||
    headerLooksLikeMoney(header);
  if (isMoney) {
    const code = mostCommon(codes);
    return {
      type: 'currency',
      config: { precision: Math.max(2, decimals), ...(code ? { currency: code } : {}) },
      field: 'amount',
    };
  }
  return { type: 'number', config: { precision: decimals }, field: 'amount' };
};

const inferBoolean = ({ values }: Sample): InferredColumn | null => {
  const hits = values.filter(value => !parsePaidCell(value).error).length;
  return share(hits, values.length) >= BOOLEAN_THRESHOLD
    ? { type: 'boolean', field: 'paid' }
    : null;
};

const inferCurrencyCodes = ({ values }: Sample): InferredColumn | null => {
  const hits = values.filter(value => resolveCurrencyCode(value)).length;
  return share(hits, values.length) >= THRESHOLD ? { type: 'text', field: 'currency' } : null;
};

const inferSelect = (allValues: string[], header: string): InferredColumn | null => {
  const filled = allValues.map(value => value.trim()).filter(Boolean);
  if (filled.length < SELECT_MIN_ROWS) {
    return null;
  }
  const distinct = [...new Set(filled)];
  if (
    distinct.length > SELECT_MAX_OPTIONS ||
    distinct.length / filled.length > SELECT_MAX_DISTINCT_RATIO ||
    distinct.some(value => value.length > SELECT_MAX_LENGTH)
  ) {
    return null;
  }
  return {
    type: 'select',
    config: {
      options: distinct.map((value, index) => ({
        value,
        color: COLOR_PRESETS[index % COLOR_PRESETS.length].base,
      })),
    },
    field: matchFieldByName(header) === 'type' ? 'type' : null,
  };
};

/**
 * Определяет тип колонки по значениям (и по формату ячеек, когда файл его
 * знает). Порядок важен: даты раньше чисел, числа раньше булевых («1»/«0»
 * чаще суммы, чем флажки), select только когда значений заметно меньше строк.
 */
export function inferColumnType(
  values: string[],
  options: { header?: string; cells?: TabularCell[] } = {},
): InferredColumn {
  const header = options.header ?? '';
  const sample = sampleOf(values, options.cells);
  if (!sample.values.length) {
    return TEXT;
  }
  return (
    inferDate(sample) ??
    inferNumeric(sample, header) ??
    inferBoolean(sample) ??
    inferCurrencyCodes(sample) ??
    inferSelect(values, header) ??
    TEXT
  );
}

const FIELD_TO_TYPE: Record<string, ColumnType> = {
  date: 'date',
  amount: 'number',
  paid: 'boolean',
};

/** Тип, с которым согласуется правило разбора; нужен, когда пользователь меняет тип руками. */
export const fieldForType = (type: ColumnType): PasteFieldKey | null => {
  if (type === 'date') {
    return 'date';
  }
  if (type === 'number' || type === 'currency') {
    return 'amount';
  }
  if (type === 'boolean') {
    return 'paid';
  }
  return null;
};

export const typeForField = (field: PasteFieldKey | null): ColumnType =>
  field ? (FIELD_TO_TYPE[field] ?? 'text') : 'text';

/** Оставляет от угаданного конфига только то, что имеет смысл для выбранного типа. */
export const configForType = (
  type: ColumnType,
  config: CustomTableColumnConfig | undefined,
): CustomTableColumnConfig | undefined => {
  if (!config) {
    return undefined;
  }
  if (type === 'currency') {
    const { currency, precision } = config;
    return { precision: precision ?? 2, ...(currency ? { currency } : {}) };
  }
  if (type === 'number') {
    const { precision, format } = config;
    return { ...(precision !== undefined ? { precision } : {}), ...(format ? { format } : {}) };
  }
  if (type === 'select') {
    return config.options ? { options: config.options } : undefined;
  }
  return undefined;
};
