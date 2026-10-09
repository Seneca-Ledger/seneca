import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';

/** A fill is a working table, not an archive: past this the grid is unusable anyway. */
export const MAX_SOURCE_ROWS = 20_000;
/** One extra row lets the service tell "exactly at the limit" from "over it". */
export const SOURCE_FETCH_LIMIT = MAX_SOURCE_ROWS + 1;

/** Same base colours as the frontend colour presets (`colorPalette.ts`). */
const OPTION_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  gray: '#6b7280',
};

export function option(
  value: string,
  color: keyof typeof OPTION_COLORS,
): {
  value: string;
  color: string;
} {
  return { value, color: OPTION_COLORS[color] ?? OPTION_COLORS.gray };
}

export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Enum-valued filters: an unknown value is a client bug, not "no rows". */
export function assertEnumFilter(
  value: string | undefined,
  allowed: readonly string[],
): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new BadRequestException(appError('SOURCE_FILTER_INVALID'));
  }
  return value;
}
