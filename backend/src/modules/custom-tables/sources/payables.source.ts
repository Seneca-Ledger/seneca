import type { Repository } from 'typeorm';
import { CustomTableColumnType } from '../../../entities/custom-table-column.entity';
import {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
} from '../../../entities/payable.entity';
import type { SourceAdapter, SourceColumnDef, SourceFilters, SourceRow } from './source.types';
import { assertEnumFilter, option, SOURCE_FETCH_LIMIT, toDateOnly, toNumber } from './source.utils';

export class PayablesSource implements SourceAdapter {
  readonly kind = 'payables' as const;

  readonly columns: SourceColumnDef[] = [
    {
      field: 'direction',
      title: 'Direction',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(PayableDirection.PAYABLE, 'red'),
          option(PayableDirection.RECEIVABLE, 'green'),
        ],
      },
    },
    { field: 'vendor', title: 'Vendor', type: CustomTableColumnType.TEXT },
    { field: 'amount', title: 'Amount', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'currency', title: 'Currency', type: CustomTableColumnType.TEXT },
    { field: 'dueDate', title: 'Due date', type: CustomTableColumnType.DATE },
    {
      field: 'status',
      title: 'Status',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(PayableStatus.TO_PAY, 'amber'),
          option(PayableStatus.SCHEDULED, 'blue'),
          option(PayableStatus.PAID, 'green'),
          option(PayableStatus.OVERDUE, 'red'),
          option(PayableStatus.ARCHIVED, 'gray'),
        ],
      },
    },
    {
      field: 'source',
      title: 'Source',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(PayableSource.STATEMENT, 'blue'),
          option(PayableSource.INVOICE, 'violet'),
          option(PayableSource.MANUAL, 'gray'),
        ],
      },
    },
    { field: 'isRecurring', title: 'Recurring', type: CustomTableColumnType.BOOLEAN },
    { field: 'paidAt', title: 'Paid at', type: CustomTableColumnType.DATE },
    { field: 'comment', title: 'Comment', type: CustomTableColumnType.TEXT },
  ];

  constructor(private readonly payableRepository: Repository<Payable>) {}

  async fetchRows(workspaceId: string, filters: SourceFilters): Promise<SourceRow[]> {
    const qb = this.payableRepository
      .createQueryBuilder('payable')
      .where('payable.workspaceId = :workspaceId', { workspaceId })
      .orderBy('payable.dueDate', 'ASC', 'NULLS LAST')
      .addOrderBy('payable.createdAt', 'ASC')
      .take(SOURCE_FETCH_LIMIT);
    const direction = assertEnumFilter(filters.direction, Object.values(PayableDirection));
    if (direction) {
      qb.andWhere('payable.direction = :direction', { direction });
    }
    const status = assertEnumFilter(filters.status, Object.values(PayableStatus));
    if (status) {
      qb.andWhere('payable.status = :status', { status });
    }
    if (filters.dueDateFrom) {
      qb.andWhere('payable.dueDate >= :dueDateFrom', { dueDateFrom: filters.dueDateFrom });
    }
    if (filters.dueDateTo) {
      qb.andWhere('payable.dueDate <= :dueDateTo', { dueDateTo: filters.dueDateTo });
    }
    if (filters.ids?.length) {
      qb.andWhere('payable.id IN (:...ids)', { ids: filters.ids });
    }
    const payables = await qb.getMany();
    return payables.map(payable => ({
      sourceKey: payable.id,
      values: {
        direction: payable.direction,
        vendor: payable.vendor,
        amount: toNumber(payable.amount),
        currency: payable.currency || '',
        dueDate: toDateOnly(payable.dueDate),
        status: payable.status,
        source: payable.source,
        isRecurring: Boolean(payable.isRecurring),
        paidAt: toDateOnly(payable.paidAt),
        comment: payable.comment ?? '',
      },
    }));
  }
}
