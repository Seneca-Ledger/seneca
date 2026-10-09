import type { Repository } from 'typeorm';
import { CustomTableColumnType } from '../../../entities/custom-table-column.entity';
import { Invoice, InvoiceStatus } from '../../../entities/invoice.entity';
import type { SourceAdapter, SourceColumnDef, SourceFilters, SourceRow } from './source.types';
import { assertEnumFilter, option, SOURCE_FETCH_LIMIT, toDateOnly, toNumber } from './source.utils';

export class InvoicesSource implements SourceAdapter {
  readonly kind = 'invoices' as const;

  readonly columns: SourceColumnDef[] = [
    { field: 'invoiceNumber', title: 'Invoice #', type: CustomTableColumnType.TEXT },
    { field: 'client', title: 'Client', type: CustomTableColumnType.TEXT },
    {
      field: 'status',
      title: 'Status',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(InvoiceStatus.DRAFT, 'gray'),
          option(InvoiceStatus.SENT, 'blue'),
          option(InvoiceStatus.PAID, 'green'),
          option(InvoiceStatus.OVERDUE, 'red'),
          option(InvoiceStatus.VOID, 'gray'),
        ],
      },
    },
    { field: 'issueDate', title: 'Issue date', type: CustomTableColumnType.DATE },
    { field: 'dueDate', title: 'Due date', type: CustomTableColumnType.DATE },
    { field: 'subtotal', title: 'Subtotal', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'taxTotal', title: 'Tax', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'total', title: 'Total', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'currency', title: 'Currency', type: CustomTableColumnType.TEXT },
    { field: 'notes', title: 'Notes', type: CustomTableColumnType.TEXT },
  ];

  constructor(private readonly invoiceRepository: Repository<Invoice>) {}

  async fetchRows(workspaceId: string, filters: SourceFilters): Promise<SourceRow[]> {
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .where('invoice.workspaceId = :workspaceId', { workspaceId })
      .orderBy('invoice.issueDate', 'ASC')
      .addOrderBy('invoice.createdAt', 'ASC')
      .take(SOURCE_FETCH_LIMIT);
    const status = assertEnumFilter(filters.status, Object.values(InvoiceStatus));
    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }
    if (filters.ids?.length) {
      qb.andWhere('invoice.id IN (:...ids)', { ids: filters.ids });
    }
    const invoices = await qb.getMany();
    return invoices.map(invoice => ({
      sourceKey: invoice.id,
      values: {
        invoiceNumber: invoice.invoiceNumber ?? '',
        client: invoice.client?.name ?? '',
        status: invoice.status,
        issueDate: toDateOnly(invoice.issueDate),
        dueDate: toDateOnly(invoice.dueDate),
        subtotal: toNumber(invoice.subtotal),
        taxTotal: toNumber(invoice.taxTotal),
        total: toNumber(invoice.total),
        currency: invoice.currency || '',
        notes: invoice.notes ?? '',
      },
    }));
  }
}
