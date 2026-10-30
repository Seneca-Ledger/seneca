import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import {
  CUSTOM_TABLE_AGGREGATE_FNS,
  type CustomTableAggregateDto,
  type CustomTableAggregateFn,
  type CustomTableRowFilterDto,
  type CustomTableRowSortDto,
} from '../dto/list-custom-table-rows.dto';

/** Query-string JSON (`filters`, `aggs`, `sort`) of the rows endpoints, read and checked. */
export function parseRowFiltersParam(filtersRaw?: string): CustomTableRowFilterDto[] | undefined {
  if (!filtersRaw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(filtersRaw);
  } catch {
    throw new BadRequestException(appError('FILTER_JSON_INVALID'));
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException(appError('FILTER_FORMAT_INVALID'));
  }
  return parsed as CustomTableRowFilterDto[];
}

export function parseAggregatesParam(aggsRaw?: string): CustomTableAggregateDto[] {
  if (!aggsRaw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(aggsRaw);
  } catch {
    throw new BadRequestException(appError('AGG_JSON_INVALID'));
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException(appError('AGG_FORMAT_INVALID'));
  }
  return parsed.map(entry => {
    const { col, fn } = (entry ?? {}) as { col?: unknown; fn?: unknown };
    if (typeof col !== 'string' || !col.trim()) {
      throw new BadRequestException(appError('AGG_FORMAT_INVALID'));
    }
    if (
      typeof fn !== 'string' ||
      !CUSTOM_TABLE_AGGREGATE_FNS.includes(fn as CustomTableAggregateFn)
    ) {
      throw new BadRequestException(appError('AGG_FUNCTION_UNKNOWN', { fn: String(fn) }));
    }
    return { col: col.trim(), fn: fn as CustomTableAggregateFn };
  });
}

export function parseRowSortParam(sortRaw?: string): CustomTableRowSortDto | undefined {
  if (!sortRaw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(sortRaw);
  } catch {
    throw new BadRequestException(appError('SORT_JSON_INVALID'));
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException(appError('SORT_FORMAT_INVALID'));
  }
  const { col, dir } = parsed as { col?: unknown; dir?: unknown };
  if (typeof col !== 'string' || !col.trim()) {
    throw new BadRequestException(appError('SORT_FORMAT_INVALID'));
  }
  if (dir !== 'asc' && dir !== 'desc') {
    throw new BadRequestException(appError('SORT_DIRECTION_INVALID'));
  }
  return { col: col.trim(), dir };
}
