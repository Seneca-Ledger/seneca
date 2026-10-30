import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import {
  applyOwnerFilter,
  type OwnerFilter,
  parseOwnerFilter,
} from '../../common/utils/transaction-owner.util';
import { PRIVACY_VIEWER_PARAM, redactedSql } from '../../common/utils/transaction-privacy.util';
import type { CashFlowMapQuery } from '../../contracts';
import { Category, CategoryType } from '../../entities/category.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { CurrencyConverter } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  buildCashFlowMap,
  type CashFlowMap,
  type CashFlowMapOptions,
  type CashFlowRow,
  type CategoryNode,
} from './cash-flow-map.util';
import { comparisonPeriod } from './comparison-period.util';

/** A row as the database returns it, before conversion. */
interface RawCashFlowRow extends CashFlowRow {
  /** Absolute, in `currency`. */
  amount: number;
  currency: string;
  /** The transaction's day: each amount converts at its own day's rate. */
  date: string;
}

export interface CashFlowMapResponse extends CashFlowMap {
  currency: string;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string } | null;
  includeTransfers: boolean;
  /** Whether refunds were netted against their category. */
  netRefunds: boolean;
  /** Currencies left out of every figure because no rate was found for their day. */
  missingRates: string[];
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
    query: CashFlowMapQuery,
    locale?: string,
    selfMemberId: string | null = null,
  ): Promise<CashFlowMapResponse> {
    const to = query.dateTo ?? today();
    const from = query.dateFrom ?? shiftDays(to, -29);
    const previous = query.compare ? comparisonPeriod(from, to, query.compareTo) : null;
    const includeTransfers = query.includeTransfers === true;
    const netRefunds = query.netRefunds === true;

    const [workspace, categories] = await Promise.all([
      this.workspaceRepository.findOne({
        where: { id: workspaceId },
        select: {
          currency: true,
        },
      }),
      this.categoryRepository.find({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          parentId: true,
          type: true,
          icon: true,
        },
      }),
    ]);
    const currency = normalizeCurrency(workspace?.currency);
    const nodes: CategoryNode[] = categories.map(category => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId ?? null,
      icon: category.icon,
      isExpenseCategory: category.type === CategoryType.EXPENSE,
    }));
    const allowed = this.allowedCategoryIds(nodes, query.categories);
    // A category filter narrows spending; with refunds netted, a refund is spending too.
    const spendingCategories = netRefunds
      ? new Set(nodes.filter(node => node.isExpenseCategory).map(node => node.id))
      : null;

    const owner = parseOwnerFilter(query.owner, selfMemberId);
    const load = (window: { from: string; to: string }) =>
      this.loadRows(workspaceId, window, includeTransfers, owner, selfMemberId).then(rows =>
        rows.filter(row => {
          const spending =
            row.type === 'expense' ||
            Boolean(row.categoryId && spendingCategories?.has(row.categoryId));
          if (row.isTransfer || !allowed || !spending) return true;
          return Boolean(row.categoryId && allowed.has(row.categoryId));
        }),
      );
    const rawRows = await load({ from, to });
    const rawPrevious = previous ? await load(previous) : null;

    // Each amount converts at its own day's rate, and a currency without one is
    // left out and named, never counted 1:1 or silently dropped. One converter
    // for both periods, so both are converted on the same terms.
    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      [...rawRows, ...(rawPrevious ?? [])].map(row => ({ currency: row.currency, date: row.date })),
      workspaceId,
    );
    const convert = (raw: RawCashFlowRow[]): CashFlowRow[] =>
      raw
        .map(({ currency: rowCurrency, date, ...row }) => ({
          ...row,
          amount: converter.convert(row.amount, rowCurrency, date),
        }))
        .filter(row => row.amount !== 0);

    const labels = LABELS[(locale ?? 'en').slice(0, 2)] ?? LABELS.en;
    const map = buildCashFlowMap(
      convert(rawRows),
      rawPrevious ? convert(rawPrevious) : null,
      nodes,
      {
        labels,
        netRefunds,
      },
    );
    return {
      ...map,
      currency,
      period: { from, to },
      previousPeriod: previous,
      includeTransfers,
      netRefunds,
      missingRates: converter.missing,
      availableCategories: nodes
        .filter(node => {
          const category = categories.find(item => item.id === node.id);
          return category?.type !== 'income';
        })
        .map(({ id, name, parentId }) => ({ id, name, parentId })),
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
    window: { from: string; to: string },
    includeTransfers: boolean,
    owner: OwnerFilter,
    selfMemberId: string | null,
  ): Promise<RawCashFlowRow[]> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .select([
        't.transactionType AS "type"',
        't.currency AS currency',
        't.credit AS credit',
        't.debit AS debit',
        't.transactionDate AS "transactionDate"',
        't.categoryId AS "categoryId"',
        // Another member's private rows count under the placeholder, not their merchant.
        `${redactedSql('t', 't.counterparty_name')} AS "counterpartyName"`,
        't.transferPairId AS "transferPairId"',
      ])
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transactionDate >= :from', { from: window.from })
      .andWhere('t.transactionDate <= :to', { to: window.to })
      .setParameter(PRIVACY_VIEWER_PARAM, selfMemberId);
    onlyFlows(qb, 't');
    applyOwnerFilter(qb, 't', owner);
    if (!includeTransfers) {
      qb.andWhere('t.transferPairId IS NULL');
    }
    const raw = await qb.getRawMany<{
      type: TransactionType;
      currency: string;
      credit: string | null;
      debit: string | null;
      transactionDate: Date | string;
      categoryId: string | null;
      counterpartyName: string | null;
      transferPairId: string | null;
    }>();
    const rows: RawCashFlowRow[] = [];
    for (const row of raw) {
      const amount =
        row.type === TransactionType.INCOME
          ? Number.parseFloat(row.credit ?? '0')
          : Number.parseFloat(row.debit ?? '0');
      if (!Number.isFinite(amount) || amount === 0) continue;
      rows.push({
        amount: Math.abs(amount),
        type: row.type === TransactionType.INCOME ? 'income' : 'expense',
        categoryId: row.categoryId,
        counterpartyName: row.counterpartyName,
        isTransfer: row.transferPairId !== null,
        currency: normalizeCurrency(row.currency),
        date: toDateOnly(row.transactionDate),
      });
    }
    return rows;
  }
}

/** A `date` column comes back as a string, but a Date survives too. */
function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
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
