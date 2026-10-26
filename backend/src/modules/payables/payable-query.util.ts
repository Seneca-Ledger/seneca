import type { SelectQueryBuilder } from 'typeorm';
import type { FilterPayablesBody } from '../../contracts';
import { type Payable, PayableStatus } from '../../entities/payable.entity';

/** A date from a request or a row; a bare day is read as UTC midnight, an invalid one as null. */
export function parsePayableDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = value.length <= 10 ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Narrows the payables list query (`payable` alias) to the filters of the list and export. */
export function applyPayableFilters(
  queryBuilder: SelectQueryBuilder<Payable>,
  filters: FilterPayablesBody,
): SelectQueryBuilder<Payable> {
  if (!filters.includeArchived) {
    queryBuilder.andWhere('payable.status != :archivedStatus', {
      archivedStatus: PayableStatus.ARCHIVED,
    });
  }

  if (filters.status) {
    queryBuilder.andWhere('payable.status = :status', { status: filters.status });
  }

  if (filters.source) {
    queryBuilder.andWhere('payable.source = :source', { source: filters.source });
  }

  if (filters.tagId) {
    queryBuilder.andWhere(
      'EXISTS (SELECT 1 FROM payable_tags pt WHERE pt.payable_id = payable.id AND pt.tag_id = :tagId)',
      { tagId: filters.tagId },
    );
  }

  if (filters.search) {
    queryBuilder.andWhere(
      "(LOWER(payable.vendor) LIKE :search OR LOWER(COALESCE(payable.comment, '')) LIKE :search)",
      {
        search: `%${filters.search.toLowerCase()}%`,
      },
    );
  }

  if (filters.minAmount !== undefined) {
    queryBuilder.andWhere('payable.amount >= :minAmount', { minAmount: filters.minAmount });
  }

  if (filters.maxAmount !== undefined) {
    queryBuilder.andWhere('payable.amount <= :maxAmount', { maxAmount: filters.maxAmount });
  }

  const dueDateFrom = parsePayableDate(filters.dueDateFrom);
  const dueDateTo = parsePayableDate(filters.dueDateTo);
  if (dueDateFrom && dueDateTo) {
    queryBuilder.andWhere('payable.dueDate BETWEEN :dueDateFrom AND :dueDateTo', {
      dueDateFrom,
      dueDateTo,
    });
  } else if (dueDateFrom) {
    queryBuilder.andWhere('payable.dueDate >= :dueDateFrom', { dueDateFrom });
  } else if (dueDateTo) {
    queryBuilder.andWhere('payable.dueDate <= :dueDateTo', { dueDateTo });
  }

  return queryBuilder;
}
