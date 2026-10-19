import type { CustomTableColumnConfig, SelectOptionDef } from './types';

/**
 * Опции select хранятся как строки (старые таблицы, импорт) или объекты с
 * цветом. Наружу отдаём единый вид; в ячейке по-прежнему лежит только `value`,
 * поэтому фильтры, группировка и экспорт про цвета не знают.
 */
export function normalizeSelectOptions(
  config: CustomTableColumnConfig | null | undefined,
): SelectOptionDef[] {
  const raw = config?.options;
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: SelectOptionDef[] = [];
  for (const item of raw) {
    const def = toOptionDef(item);
    if (!def || seen.has(def.value)) {
      continue;
    }
    seen.add(def.value);
    result.push(def);
  }
  return result;
}

function toOptionDef(item: unknown): SelectOptionDef | null {
  if (typeof item === 'string' || typeof item === 'number') {
    const value = String(item).trim();
    return value ? { value } : null;
  }
  if (item && typeof item === 'object' && 'value' in item) {
    const value = String((item as { value: unknown }).value ?? '').trim();
    if (!value) {
      return null;
    }
    const { label, color } = item as { label?: unknown; color?: unknown };
    return {
      value,
      ...(typeof label === 'string' && label.trim() ? { label: label.trim() } : {}),
      ...(typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? { color } : {}),
    };
  }
  return null;
}

export function findOption(
  options: SelectOptionDef[],
  value: unknown,
): SelectOptionDef | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const key = String(value);
  return options.find(option => option.value === key);
}

/** Только значения — для мест, которым цвета не нужны (вставка из буфера). */
export function optionValues(config: CustomTableColumnConfig | null | undefined): string[] {
  return normalizeSelectOptions(config).map(option => option.value);
}
