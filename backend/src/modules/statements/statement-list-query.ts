import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { StatementsQuery } from '../../contracts';
import { BankName, type Statement, StatementStatus } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';
import { reviewHoldsStatementRows } from '../review-inbox/review-queue.queries';
import { getDatePresetRange } from './statement-date-presets.util';
import { buildStatementSearchClause } from './statement-search.util';

/**
 * The documents list's filters and sort orders as SQL on the `statement`
 * query (with `user` joined). Filters that read the statement's rows need the
 * transactions repository; the rest need only the statement.
 */

/** The date a document is listed and grouped by: the end of its period, else when it came in. */
export const STATEMENT_DATE_SQL =
  'DATE(COALESCE(statement.statementDateTo, statement.statementDateFrom, statement.createdAt))';
/** The larger of its spending and its income. */
export const STATEMENT_AMOUNT_SQL =
  'GREATEST(COALESCE(statement.totalDebit, 0), COALESCE(statement.totalCredit, 0))';

const APPROVED_STATUSES = [
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
  StatementStatus.PARSED,
];

const splitReferenceTokens = (tokens?: string[]) => {
  const normalizedTokens = tokens || [];
  const allowedBankNames = new Set(Object.values(BankName));

  return normalizedTokens.reduce(
    (acc, token) => {
      if (token.startsWith('user:')) {
        const userId = token.replace('user:', '').trim();
        if (userId) {
          acc.userIds.push(userId);
        }
      }

      if (token.startsWith('bank:')) {
        const bankName = token.replace('bank:', '').trim().toLowerCase();
        if (bankName && allowedBankNames.has(bankName as BankName)) {
          acc.bankNames.push(bankName);
        }
      }

      return acc;
    },
    { userIds: [] as string[], bankNames: [] as string[] },
  );
};

type StatementQuery = SelectQueryBuilder<Statement>;

/** From and To: the people who uploaded and the banks that issued, any of them. */
function applyReferenceFilter(
  qb: StatementQuery,
  tokens: string[] | undefined,
  side: 'from' | 'to',
) {
  const references = splitReferenceTokens(tokens);
  if (references.userIds.length === 0 && references.bankNames.length === 0) {
    return;
  }
  const conditions: string[] = [];
  const params: Record<string, string[]> = {};

  if (references.userIds.length > 0) {
    conditions.push(`statement.userId IN (:...${side}UserIds)`);
    params[`${side}UserIds`] = references.userIds;
  }

  if (references.bankNames.length > 0) {
    conditions.push(`statement.bankName IN (:...${side}BankNames)`);
    params[`${side}BankNames`] = references.bankNames;
  }

  qb.andWhere(`(${conditions.join(' OR ')})`, params);
}

function applyDateFilter(qb: StatementQuery, filters: StatementsQuery) {
  if (filters.datePreset) {
    const { dateFrom, dateTo } = getDatePresetRange(filters.datePreset, new Date());
    qb.andWhere(`${STATEMENT_DATE_SQL} BETWEEN :dateFrom AND :dateTo`, {
      dateFrom,
      dateTo,
    });
  } else if (filters.dateMode && filters.dateFrom) {
    if (filters.dateMode === 'on') {
      if (filters.dateTo) {
        const sortedRange = [filters.dateFrom, filters.dateTo].sort();
        qb.andWhere(`${STATEMENT_DATE_SQL} BETWEEN :dateFrom AND :dateTo`, {
          dateFrom: sortedRange[0],
          dateTo: sortedRange[1],
        });
      } else {
        qb.andWhere(`${STATEMENT_DATE_SQL} = :dateFrom`, {
          dateFrom: filters.dateFrom,
        });
      }
    } else if (filters.dateMode === 'after') {
      qb.andWhere(`${STATEMENT_DATE_SQL} > :dateFrom`, {
        dateFrom: filters.dateFrom,
      });
    } else {
      qb.andWhere(`${STATEMENT_DATE_SQL} < :dateTo`, {
        dateTo: filters.dateTo || filters.dateFrom,
      });
    }
  }
}

function applyAmountFilter(qb: StatementQuery, filters: StatementsQuery) {
  if (typeof filters.billable === 'boolean') {
    if (filters.billable) {
      qb.andWhere(`${STATEMENT_AMOUNT_SQL} > 0`);
    } else {
      qb.andWhere(`${STATEMENT_AMOUNT_SQL} <= 0`);
    }
  }

  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    const amountConditions: string[] = [];
    const params: Record<string, number> = {};

    if (filters.amountMin !== undefined) {
      amountConditions.push(`${STATEMENT_AMOUNT_SQL} >= :amountMin`);
      params.amountMin = filters.amountMin;
    }

    if (filters.amountMax !== undefined) {
      amountConditions.push(`${STATEMENT_AMOUNT_SQL} <= :amountMax`);
      params.amountMax = filters.amountMax;
    }

    qb.andWhere(amountConditions.join(' AND '), params);
  }
}

/** "Has": errors, a processing log, rows, a period, a currency. */
function applyHasFilter(qb: StatementQuery, has: string[] | undefined) {
  if (has?.includes('errors')) {
    qb.andWhere(
      `(
        statement.status = :errorStatus OR
        statement.errorMessage IS NOT NULL OR
        jsonb_array_length(COALESCE(statement.parsingDetails->'errors', '[]'::jsonb)) > 0
      )`,
      { errorStatus: StatementStatus.ERROR },
    );
  }

  if (has?.includes('processingDetails')) {
    qb.andWhere(
      "jsonb_array_length(COALESCE(statement.parsingDetails->'logEntries', '[]'::jsonb)) > 0",
    );
  }

  if (has?.includes('transactions')) {
    qb.andWhere('statement.totalTransactions > 0');
  }

  if (has?.includes('dateRange')) {
    qb.andWhere(
      '(statement.statementDateFrom IS NOT NULL OR statement.statementDateTo IS NOT NULL)',
    );
  }

  if (has?.includes('currency')) {
    qb.andWhere(
      `(
        statement.currency IS NOT NULL OR
        statement.parsingDetails->'metadataExtracted'->>'currency' IS NOT NULL OR
        statement.parsingDetails->'metadataExtracted'->'headerDisplay'->>'currencyDisplay' IS NOT NULL
      )`,
    );
  }
}

/** The filters that read only the statement itself. */
export function applyStatementFilters(qb: StatementQuery, filters: StatementsQuery): void {
  const search = filters.search ? buildStatementSearchClause(filters.search) : null;
  if (search) {
    qb.andWhere(search.clause, search.params);
  }

  if (filters.type) {
    qb.andWhere('statement.fileType = :type', {
      type: filters.type.toLowerCase(),
    });
  }

  if (filters.statuses && filters.statuses.length > 0) {
    // status is a Postgres enum: LOWER() has no enum overload, and comparing the
    // enum to an unknown value errors, so compare as text.
    qb.andWhere('CAST(statement.status AS text) IN (:...statuses)', {
      statuses: filters.statuses.map(status => status.toLowerCase()),
    });
  }

  applyAmountFilter(qb, filters);
  applyDateFilter(qb, filters);
  applyReferenceFilter(qb, filters.from, 'from');
  applyReferenceFilter(qb, filters.to, 'to');

  if (filters.keywords?.trim()) {
    qb.andWhere(
      `(
        statement.fileName ILIKE :keywords OR
        CAST(statement.bankName AS text) ILIKE :keywords OR
        CAST(statement.status AS text) ILIKE :keywords OR
        COALESCE(user.name, '') ILIKE :keywords OR
        COALESCE(user.email, '') ILIKE :keywords OR
        COALESCE(statement.accountNumber, '') ILIKE :keywords
      )`,
      {
        keywords: `%${filters.keywords.trim()}%`,
      },
    );
  }

  if (filters.currencies && filters.currencies.length > 0) {
    qb.andWhere('LOWER(statement.currency) IN (:...currencies)', {
      currencies: filters.currencies.map(currency => currency.toLowerCase()),
    });
  }

  if (typeof filters.exported === 'boolean') {
    qb.andWhere(
      filters.exported ? 'statement.processedAt IS NOT NULL' : 'statement.processedAt IS NULL',
    );
  }

  if (typeof filters.paid === 'boolean') {
    qb.andWhere(
      filters.paid ? 'statement.statementDateTo IS NOT NULL' : 'statement.statementDateTo IS NULL',
    );
  }

  applyHasFilter(qb, filters.has);
}

/**
 * The filters that read the statement's rows: Approved (as the column says it:
 * parsed, and Review holds none of its rows), and a category or merchant
 * (documents holding such a row, dated in the window if given). `categoryIds`
 * is the chosen category with every category below it.
 */
export function applyStatementRowFilters(
  qb: StatementQuery,
  filters: StatementsQuery,
  transactions: Repository<Transaction>,
  workspaceId: string,
  categoryIds: string[] | null,
): void {
  if (typeof filters.approved === 'boolean') {
    const review = reviewHoldsStatementRows(transactions, workspaceId, 'statement');
    const approved = `(statement.status IN (:...approvedStatuses) AND NOT ${review.clause})`;
    qb.andWhere(filters.approved ? approved : `NOT ${approved}`, {
      approvedStatuses: APPROVED_STATUSES,
      ...review.params,
    });
  }

  if (!(filters.categoryId || filters.merchant)) {
    return;
  }
  const rowSubQuery = transactions
    .createQueryBuilder('transaction')
    .select('DISTINCT transaction.statementId')
    .where('transaction.workspaceId = :workspaceId', { workspaceId })
    .andWhere('transaction.statementId IS NOT NULL');

  if (filters.categoryId === 'uncategorized') {
    rowSubQuery.andWhere('transaction.categoryId IS NULL');
  } else if (categoryIds) {
    // A parent's figure in the reports includes its subcategories; so does its list.
    rowSubQuery.andWhere('transaction.categoryId IN (:...categoryIds)', { categoryIds });
  }
  if (filters.merchant) {
    // The merchant key the analytics charts group by.
    rowSubQuery.andWhere(
      'LOWER(TRIM(COALESCE(transaction.vendorNormalized, transaction.counterpartyName))) = :merchant',
      { merchant: filters.merchant.trim().toLowerCase() },
    );
  }
  if (filters.transactionsFrom) {
    rowSubQuery.andWhere('transaction.transactionDate >= :transactionsFrom', {
      transactionsFrom: filters.transactionsFrom,
    });
  }
  if (filters.transactionsTo) {
    rowSubQuery.andWhere('transaction.transactionDate <= :transactionsTo', {
      transactionsTo: filters.transactionsTo,
    });
  }

  qb.andWhere(`statement.id IN (${rowSubQuery.getQuery()})`).setParameters(
    rowSubQuery.getParameters(),
  );
}

const GROUP_ORDER: Record<string, string> = {
  date: STATEMENT_DATE_SQL,
  status: 'statement.status',
  type: 'statement.fileType',
  bank: 'statement.bankName',
  user: `LOWER(COALESCE(user.name, user.email, ''))`,
  amount: STATEMENT_AMOUNT_SQL,
};

/** Grouping sorts by the grouped value; otherwise the newest upload comes first. */
export function orderStatementList(qb: StatementQuery, groupBy: string | undefined): void {
  const order = groupBy ? GROUP_ORDER[groupBy] : undefined;
  if (order) {
    qb.orderBy(order, 'ASC');
  }
}
