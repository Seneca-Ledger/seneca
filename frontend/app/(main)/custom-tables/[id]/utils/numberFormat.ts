import { formatMoney } from '@/app/lib/format-money';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { readStoredFormatPreferences } from '@/app/lib/user-format-store';
import { parseNumberCell } from './pasteParser';

export type NumberDisplayFormat = 'plain' | 'percent';

export interface CellNumberFormat {
  /** ISO 4217 — задан у денежных колонок (и у формул, считающих деньги). */
  currency?: string;
  /** Знаков после запятой. */
  precision?: number;
  /** Процент хранится как обычное число: 12.5 показывается как «12,5 %». */
  format?: NumberDisplayFormat;
  /** Ключ локали приложения; по умолчанию — из сохранённого профиля. */
  locale?: string | null;
}

/** Цвет отрицательных сумм в гриде, подвале и формулах. */
export const NEGATIVE_NUMBER_COLOR = 'var(--destructive)';

const resolveLocale = (locale?: string | null): string =>
  resolveLocaleTag(locale ?? readStoredFormatPreferences().locale);

/**
 * Единый формат чисел грида: деньги, проценты и просто числа — по локали
 * приложения, а не браузера, чтобы таблица не расходилась с остальным UI.
 */
export function formatCellNumber(value: number, options: CellNumberFormat = {}): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const locale = resolveLocale(options.locale);
  if (options.format === 'percent') {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: options.precision ?? 0,
      maximumFractionDigits: options.precision ?? 2,
    }).format(value / 100);
  }
  if (options.currency) {
    return formatMoney(value, options.currency, locale, {
      fractionDigits: options.precision ?? 2,
    });
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.precision ?? 0,
    maximumFractionDigits: options.precision ?? 2,
  }).format(value);
}

/**
 * Разбор числа, как его набирает человек: «1 234,56», «1,234.56», «-12,5 %»,
 * «(123)» как отрицательное. Мусор → null. Логика разделителей общая с
 * вставкой из буфера, чтобы ячейка и paste понимали одно и то же.
 */
export function parseLocalizedNumber(raw: string): number | null {
  let text = raw.trim().replace(/−/g, '-');
  if (!text) {
    return null;
  }
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  const cleaned = text.replace(/[^\d.,+-]/g, '');
  if (!cleaned) {
    return null;
  }
  const parsed = parseNumberCell(cleaned);
  if (parsed.value === null) {
    return null;
  }
  return negative ? -Math.abs(parsed.value) : parsed.value;
}
