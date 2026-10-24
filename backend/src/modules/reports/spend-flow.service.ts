import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import { applyOwnerFilter, parseOwnerFilter } from '../../common/utils/transaction-owner.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
  redactedSql,
} from '../../common/utils/transaction-privacy.util';
import type { SpendFlowQuery } from '../../contracts';
import { Category } from '../../entities/category.entity';
import { FileType } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, normalizeCurrency } from '../goals/goal-money.util';
import { TRANSACTION_TAG_PAIRS_SQL } from '../tags/transaction-tag-pairs.util';
import { buildSpendFlow, buildTagFlow, type SpendFlow } from './spend-flow.util';

const DEFAULT_MERCHANTS_PER_CATEGORY = 3;
const MAX_CATEGORIES = 6;
const MIN_MERCHANT_SHARE = 0.01;
const MAX_MERCHANTS = 10;

interface MerchantTotalRow {
  categoryId: string | null;
  merchantKey: string | null;
  merchantName: string | null;
  currency: string | null;
  total: string;
}

interface TagTotalRow {
  tagId: string;
  name: string;
  currency: string | null;
  total: string;
}

export interface SpendFlowResponse extends SpendFlow {
  currency: string;
  type: 'income' | 'expense';
  dateFrom: string | null;
  dateTo: string | null;
}

/**
 * The analytics sankeys: total → categories → merchants (or subcategories),
 * total → merchants, and total → tags. Reads transactions, not statements,
 * because only transactions carry a category.
 */
@Injectable()
export class SpendFlowService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getSpendFlow(
    workspaceId: string,
    query: SpendFlowQuery,
    selfMemberId: string | null = null,
  ): Promise<SpendFlowResponse> {
    const type = query.type ?? 'expense';
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const flow =
      query.groupBy === 'tag'
        ? await this.tagFlow(workspaceId, query, type, selfMemberId, currency)
        : await this.categoryFlow(workspaceId, query, type, selfMemberId, currency);

    return {
      ...flow,
      currency,
      type,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
    };
  }

  /** The transactions the sankey counts, with the page's filters; no selection yet. */
  private countedTransactions(
    workspaceId: string,
    query: SpendFlowQuery,
    type: 'income' | 'expense',
    selfMemberId: string | null,
  ): SelectQueryBuilder<Transaction> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 'statement')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transaction_type = :type', {
        type: type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE,
      })
      .andWhere('t.is_duplicate = false')
      .andWhere('(t.statement_id IS NULL OR statement.deleted_at IS NULL)')
      // Money moved between the user's own accounts is neither spending nor income.
      .andWhere('t.transfer_pair_id IS NULL')
      .setParameter(PRIVACY_VIEWER_PARAM, selfMemberId);
    onlyFlows(qb, 't');
    applyOwnerFilter(qb, 't', parseOwnerFilter(query.owner, selfMemberId));

    // No date means all time, the way the top-spenders table reads it.
    if (query.dateFrom) {
      qb.andWhere('t.transaction_date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('t.transaction_date <= :dateTo', { dateTo: query.dateTo });
    }

    const statuses = splitList(query.statuses);
    if (statuses.length > 0) {
      // Enum columns are compared as text: the page sends statuses such as
      // "unreported" that are not enum members, and an enum cast would throw.
      qb.andWhere('statement.status::text IN (:...statuses)', { statuses });
    }
    const bankNames = splitList(query.bankNames);
    if (bankNames.length > 0) {
      qb.andWhere('statement.bank_name::text IN (:...bankNames)', { bankNames });
    }
    const userIds = splitList(query.userIds).filter(id => UUID.test(id));
    if (userIds.length > 0) {
      qb.andWhere('statement.user_id IN (:...userIds)', { userIds });
    }
    applyDocumentType(qb, query.documentType?.trim().toLowerCase());
    return qb;
  }

  private async categoryFlow(
    workspaceId: string,
    query: SpendFlowQuery,
    type: 'income' | 'expense',
    selfMemberId: string | null,
    currency: string,
  ): Promise<SpendFlow> {
    // Same merchant key as goal flow and subscription detection. Another
    // member's private rows count under the placeholder, key and label alike.
    const merchant = redactedSql(
      't',
      'LOWER(TRIM(COALESCE(t.vendor_normalized, t.counterparty_name)))',
    );
    const qb = this.countedTransactions(workspaceId, query, type, selfMemberId)
      .select('t.category_id', 'categoryId')
      .addSelect(merchant, 'merchantKey')
      // vendor_normalized is stored lower-cased: fine as a key, not as a label.
      .addSelect(
        `COALESCE(MAX(${redactedSql('t', 'TRIM(t.counterparty_name)')}), MAX(${redactedSql('t', 'TRIM(t.vendor_normalized)')}))`,
        'merchantName',
      )
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total');

    const [rows, categories] = await Promise.all([
      qb
        .groupBy('t.category_id')
        .addGroupBy(merchant)
        .addGroupBy('t.currency')
        .getRawMany<MerchantTotalRow>(),
      this.categoryRepository.find({
        where: { workspaceId },
        select: ['id', 'name', 'parentId', 'color'],
      }),
    ]);

    const rates = await buildRateMap(
      this.exchangeRatesService,
      rows.map(row => normalizeCurrency(row.currency ?? currency)),
      currency,
      workspaceId,
    );

    return buildSpendFlow(
      rows.map(row => ({
        categoryId: row.categoryId,
        merchantKey: row.merchantKey,
        merchantName: row.merchantName,
        amount: convertWith(rates, row.total, row.currency ?? currency),
      })),
      categories.map(category => ({
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        color: category.color ?? null,
      })),
      {
        groupBy: query.groupBy ?? 'category-merchant',
        merchantsPerCategory: query.merchantsPerCategory ?? DEFAULT_MERCHANTS_PER_CATEGORY,
        maxMerchants: MAX_MERCHANTS,
        maxCategories: MAX_CATEGORIES,
        minMerchantShare: MIN_MERCHANT_SHARE,
      },
    );
  }

  /**
   * Total → tags: each counted transaction once per tag it carries. Another
   * member's private rows stay out: which tag they carry is what they hide.
   */
  private async tagFlow(
    workspaceId: string,
    query: SpendFlowQuery,
    type: 'income' | 'expense',
    selfMemberId: string | null,
    currency: string,
  ): Promise<SpendFlow> {
    const rows = await this.countedTransactions(workspaceId, query, type, selfMemberId)
      .innerJoin(`(${TRANSACTION_TAG_PAIRS_SQL})`, 'tp', 'tp.transaction_id = t.id')
      .innerJoin('tags', 'tag', 'tag.id = tp.tag_id')
      .andWhere(readablePrivateSql('t'))
      .select('tp.tag_id', 'tagId')
      .addSelect('MAX(tag.name)', 'name')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .groupBy('tp.tag_id')
      .addGroupBy('t.currency')
      .getRawMany<TagTotalRow>();

    const rates = await buildRateMap(
      this.exchangeRatesService,
      rows.map(row => normalizeCurrency(row.currency ?? currency)),
      currency,
      workspaceId,
    );
    return buildTagFlow(
      rows.map(row => ({
        tagId: row.tagId,
        name: row.name,
        amount: convertWith(rates, row.total, row.currency ?? currency),
      })),
      {
        groupBy: 'tag',
        merchantsPerCategory: DEFAULT_MERCHANTS_PER_CATEGORY,
        maxMerchants: MAX_MERCHANTS,
        maxCategories: MAX_CATEGORIES,
        minMerchantShare: MIN_MERCHANT_SHARE,
      },
    );
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['id', 'currency'],
    });
    return normalizeCurrency(workspace?.currency);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_TYPES = new Set<string>(Object.values(FileType));

/**
 * The Type chip, read the way the table reads it: a file type matches the
 * statement, "receipt" matches transactions a receipt points at,
 * and any other value (expense, trip, …) matches nothing, as in the table.
 */
function applyDocumentType(qb: SelectQueryBuilder<Transaction>, type: string | undefined): void {
  if (!type) {
    return;
  }
  if (FILE_TYPES.has(type)) {
    qb.andWhere('statement.file_type::text = :fileType', { fileType: type });
    return;
  }
  if (type === 'receipt') {
    qb.andWhere(
      `EXISTS (SELECT 1 FROM receipts r WHERE r.workspace_id = t.workspace_id
        AND (r.transaction_id = t.id OR (t.statement_id IS NOT NULL AND r.statement_id = t.statement_id)))`,
    );
    return;
  }
  qb.andWhere('1 = 0');
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}
