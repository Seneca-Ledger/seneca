import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import {
  applyOwnerFilter,
  type OwnerFilter,
  parseOwnerFilter,
} from '../../common/utils/transaction-owner.util';
import { Category } from '../../entities/category.entity';
import { StatementStatus } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  buildCashFlowMap,
  type CashFlowMap,
  type CashFlowMapOptions,
  type CashFlowRow,
  type CategoryNode,
  previousPeriod,
} from './cash-flow-map.util';
import type { CashFlowMapQueryDto } from './dto/cash-flow-map-query.dto';

export interface CashFlowMapResponse extends CashFlowMap {
  currency: string;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string } | null;
  includeTransfers: boolean;
  /** Every expense category of the workspace, for the filter chips. */
  availableCategories: CategoryNode[];
}

const LABELS: Record<string, CashFlowMapOptions['labels']> = {
  en: {
    uncategorised: 'Uncategorised',
    otherSources: 'Other sources',
    total: 'Money flow',
    transfers: 'Transfers & investments',
    fromBalance: 'From your balance',
    leftOver: 'Left over',
  },
  ru: {
    uncategorised: 'Без категории',
    otherSources: 'Другие источники',
    total: 'Денежный поток',
    transfers: 'Переводы и инвестиции',
    fromBalance: 'Из остатка',
    leftOver: 'Осталось',
  },
};

/**
 * Where the money came from and where it went in a period: the data behind
 * the Sankey, the treemap and the period comparison on the reports page.
 */
@Injectable()
export class CashFlowMapService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getMap(
    workspaceId: string,
    query: CashFlowMapQueryDto,
    locale?: string,
    selfMemberId: string | null = null,
  ): Promise<CashFlowMapResponse> {
    const to = query.dateTo ?? today();
    const from = query.dateFrom ?? shiftDays(to, -29);
    const previous = query.compare ? previousPeriod(from, to) : null;
    const includeTransfers = query.includeTransfers === true;

    const [workspace, categories] = await Promise.all([
      this.workspaceRepository.findOne({ where: { id: workspaceId }, select: ['currency'] }),
      this.categoryRepository.find({
        where: { workspaceId },
        select: ['id', 'name', 'parentId', 'type'],
      }),
    ]);
    const currency = normalizeCurrency(workspace?.currency);
    const nodes: CategoryNode[] = categories.map(category => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId ?? null,
    }));
    const allowed = this.allowedCategoryIds(nodes, query.categories);

    const owner = parseOwnerFilter(query.owner, selfMemberId);
    const rows = await this.loadRows(
      workspaceId,
      from,
      to,
      currency,
      includeTransfers,
      allowed,
      owner,
    );
    const previousRows = previous
      ? await this.loadRows(
          workspaceId,
          previous.from,
          previous.to,
          currency,
          includeTransfers,
          allowed,
          owner,
        )
      : null;

    const labels = LABELS[(locale ?? 'en').slice(0, 2)] ?? LABELS.en;
    const map = buildCashFlowMap(rows, previousRows, nodes, { labels });
    return {
      ...map,
      currency,
      period: { from, to },
      previousPeriod: previous,
      includeTransfers,
      availableCategories: nodes.filter(node => {
        const category = categories.find(item => item.id === node.id);
        return category?.type !== 'income';
      }),
    };
  }

  /** A root in the filter brings its subcategories along; a leaf stands alone. */
  private allowedCategoryIds(nodes: CategoryNode[], picked?: string[]): Set<string> | null {
    if (!picked || picked.length === 0) return null;
    const allowed = new Set(picked);
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of nodes) {
        if (node.parentId && allowed.has(node.parentId) && !allowed.has(node.id)) {
          allowed.add(node.id);
          grew = true;
        }
      }
    }
    return allowed;
  }

  private async loadRows(
    workspaceId: string,
    from: string,
    to: string,
    currency: string,
    includeTransfers: boolean,
    allowed: Set<string> | null,
    owner: OwnerFilter,
  ): Promise<CashFlowRow[]> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin('t.statement', 's')
      .select([
        't.transactionType AS "type"',
        't.currency AS currency',
        't.credit AS credit',
        't.debit AS debit',
        't.categoryId AS "categoryId"',
        't.counterpartyName AS "counterpartyName"',
        't.transferPairId AS "transferPairId"',
      ])
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('s.deletedAt IS NULL')
      .andWhere('s.status NOT IN (:...excluded)', {
        excluded: [StatementStatus.ERROR, StatementStatus.PROCESSING],
      })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transactionDate >= :from', { from })
      .andWhere('t.transactionDate <= :to', { to });
    onlyCounted(qb, 't');
    applyOwnerFilter(qb, 't', owner);
    if (!includeTransfers) {
      qb.andWhere('t.transferPairId IS NULL');
    }
    const raw = await qb.getRawMany<{
      type: TransactionType;
      currency: string;
      credit: string | null;
      debit: string | null;
      categoryId: string | null;
      counterpartyName: string | null;
      transferPairId: string | null;
    }>();
    const rates = new Map<string, number>();
    const rows: CashFlowRow[] = [];
    for (const row of raw) {
      const isTransfer = row.transferPairId !== null;
      if (!isTransfer && allowed && row.type === TransactionType.EXPENSE) {
        if (!(row.categoryId && allowed.has(row.categoryId))) continue;
      }
      const source = normalizeCurrency(row.currency);
      if (!rates.has(source)) {
        rates.set(
          source,
          source === currency
            ? 1
            : ((await this.exchangeRatesService.getRateOrNull(
                source,
                currency,
                undefined,
                workspaceId,
              )) ?? 0),
        );
      }
      const rate = rates.get(source) ?? 0;
      const amount =
        row.type === TransactionType.INCOME
          ? Number.parseFloat(row.credit ?? '0')
          : Number.parseFloat(row.debit ?? '0');
      if (!Number.isFinite(amount) || amount === 0) continue;
      rows.push({
        amount: Math.abs(amount) * rate,
        type: row.type === TransactionType.INCOME ? 'income' : 'expense',
        categoryId: row.categoryId,
        counterpartyName: row.counterpartyName,
        isTransfer,
      });
    }
    return rows;
  }
}

function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
}

function today(): string {
  return shiftDays(new Date().toISOString().slice(0, 10), 0);
}

function shiftDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const result = new Date(y, m - 1, d + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}
