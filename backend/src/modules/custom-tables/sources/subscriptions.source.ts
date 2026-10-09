import type { Repository } from 'typeorm';
import { CustomTableColumnType } from '../../../entities/custom-table-column.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../../entities/subscription.entity';
import type { SourceAdapter, SourceColumnDef, SourceFilters, SourceRow } from './source.types';
import { assertEnumFilter, option, SOURCE_FETCH_LIMIT, toDateOnly, toNumber } from './source.utils';

export class SubscriptionsSource implements SourceAdapter {
  readonly kind = 'subscriptions' as const;

  readonly columns: SourceColumnDef[] = [
    { field: 'vendor', title: 'Vendor', type: CustomTableColumnType.TEXT },
    { field: 'amount', title: 'Amount', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'currency', title: 'Currency', type: CustomTableColumnType.TEXT },
    {
      field: 'frequency',
      title: 'Frequency',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(SubscriptionFrequency.WEEKLY, 'blue'),
          option(SubscriptionFrequency.MONTHLY, 'teal'),
          option(SubscriptionFrequency.QUARTERLY, 'violet'),
          option(SubscriptionFrequency.ANNUAL, 'amber'),
        ],
      },
    },
    {
      field: 'status',
      title: 'Status',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(SubscriptionStatus.DETECTED, 'gray'),
          option(SubscriptionStatus.ACTIVE, 'green'),
          option(SubscriptionStatus.PAUSED, 'amber'),
          option(SubscriptionStatus.CANCELLED, 'red'),
        ],
      },
    },
    { field: 'nextChargeDate', title: 'Next charge', type: CustomTableColumnType.DATE },
    { field: 'lastChargeDate', title: 'Last charge', type: CustomTableColumnType.DATE },
    { field: 'category', title: 'Category', type: CustomTableColumnType.TEXT },
  ];

  constructor(private readonly subscriptionRepository: Repository<Subscription>) {}

  async fetchRows(workspaceId: string, filters: SourceFilters): Promise<SourceRow[]> {
    const qb = this.subscriptionRepository
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.category', 'category')
      .where('sub.workspaceId = :workspaceId', { workspaceId })
      .orderBy('sub.vendorName', 'ASC')
      .take(SOURCE_FETCH_LIMIT);
    const status = assertEnumFilter(filters.status, Object.values(SubscriptionStatus));
    if (status) {
      qb.andWhere('sub.status = :status', { status });
    }
    if (filters.ids?.length) {
      qb.andWhere('sub.id IN (:...ids)', { ids: filters.ids });
    }
    const subscriptions = await qb.getMany();
    return subscriptions.map(sub => ({
      sourceKey: sub.id,
      values: {
        vendor: sub.vendorName,
        amount: toNumber(sub.amount),
        currency: sub.currency || '',
        frequency: sub.frequency,
        status: sub.status,
        nextChargeDate: toDateOnly(sub.nextChargeDate),
        lastChargeDate: toDateOnly(sub.lastChargeDate),
        category: sub.category?.name ?? '',
      },
    }));
  }
}
