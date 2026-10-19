import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import { LedgerAccount, LedgerAccountType } from '../../entities';
import { LedgerSyncService } from './ledger-sync.service';

const decimal = (minor: number): string => fromMinor(minor).toFixed(2);
const today = (): string => new Date().toISOString().slice(0, 10);
const startOfYear = (date: string): string => `${date.slice(0, 4)}-01-01`;

/** Whether the ledger had caught up with its sources when the report was built. */
export interface ReportFreshness {
  upToDate: boolean;
  pendingTransactions: number;
  failingTransactions: number;
}

interface AccountRow {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  account_type: LedgerAccountType;
  is_postable: boolean;
  position: number;
}

interface AccountNode<T> {
  accountId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: LedgerAccountType;
  isPostable: boolean;
  /** Headers carry the sum of their descendants. */
  values: T;
}

export interface TrialBalanceRow {
  accountId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: LedgerAccountType;
  isPostable: boolean;
  openingDebit: string;
  openingCredit: string;
  debit: string;
  credit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalance {
  baseCurrency: string;
  dateFrom: string;
  dateTo: string;
  freshness: ReportFreshness;
  rows: TrialBalanceRow[];
  /** Over postable accounts only, so headers are not counted twice. */
  totals: Omit<
    TrialBalanceRow,
    'accountId' | 'parentId' | 'code' | 'name' | 'accountType' | 'isPostable'
  >;
  balanced: boolean;
}

export interface AmountRow {
  accountId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: LedgerAccountType;
  isPostable: boolean;
  amount: string;
}

export interface ProfitAndLoss {
  baseCurrency: string;
  dateFrom: string;
  dateTo: string;
  freshness: ReportFreshness;
  income: AmountRow[];
  expenses: AmountRow[];
  totals: { income: string; expenses: string; netIncome: string };
}

export interface BalanceSheet {
  baseCurrency: string;
  date: string;
  freshness: ReportFreshness;
  assets: AmountRow[];
  liabilities: AmountRow[];
  equity: AmountRow[];
  /**
   * Income less expenses to date. There is no period close, so profit is not
   * moved into retained earnings; it is shown as its own equity line instead.
   */
  unclosedEarnings: string;
  totals: { assets: string; liabilities: string; equity: string; liabilitiesAndEquity: string };
  balanced: boolean;
}

export interface AccountLedgerLine {
  entryId: string;
  lineNo: number;
  entryNo: string | null;
  entryDate: string;
  memo: string | null;
  source: string;
  side: 'debit' | 'credit';
  amount: string;
  currency: string;
  baseAmount: string;
  /** Base-currency balance after this line, in the account's normal direction. */
  runningBalance: string;
}

export interface AccountLedger {
  baseCurrency: string;
  account: {
    id: string;
    code: string;
    name: string;
    accountType: LedgerAccountType;
    normalBalance: string;
  };
  dateFrom: string;
  dateTo: string;
  freshness: ReportFreshness;
  openingBalance: string;
  closingBalance: string;
  lines: AccountLedgerLine[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportOptions {
  /** Build the report even while transactions are still waiting to be booked. */
  allowStale?: boolean;
}

/** Debit-normal types grow with debits; the rest with credits. */
const debitNormal = (type: LedgerAccountType): boolean =>
  type === LedgerAccountType.ASSET || type === LedgerAccountType.EXPENSE;

/**
 * Reports read straight from booked journal lines (posted and reversed
 * entries both count: a reversal pair nets to zero). Every amount is in the
 * ledger's base currency and computed in minor units.
 */
@Injectable()
export class LedgerReportsService {
  constructor(
    @InjectRepository(LedgerAccount)
    private readonly accountRepository: Repository<LedgerAccount>,
    private readonly syncService: LedgerSyncService,
  ) {}

  /**
   * The base currency and freshness, refusing a stale ledger unless asked.
   * A report on a half-synced ledger looks complete and is not; the default
   * is to say so rather than to show it.
   */
  private async prepare(
    workspaceId: string,
    options: ReportOptions,
  ): Promise<{ baseCurrency: string; freshness: ReportFreshness }> {
    const integrity = await this.syncService.getSettings(workspaceId);
    if (!integrity.baseCurrency) {
      throw new ConflictException(appError('LEDGER_DISABLED'));
    }
    const failing: Array<{ n: string }> = await this.accountRepository.query(
      `SELECT count(*) AS n FROM "transactions"
        WHERE "workspace_id" = $1 AND "ledger_dirty" AND "ledger_error" IS NOT NULL`,
      [workspaceId],
    );
    const freshness: ReportFreshness = {
      upToDate: integrity.pendingTransactions === 0,
      pendingTransactions: integrity.pendingTransactions,
      failingTransactions: Number(failing[0]?.n ?? 0),
    };
    if (!(freshness.upToDate || options.allowStale)) {
      throw new ConflictException(
        appError('LEDGER_NOT_UP_TO_DATE', { pending: freshness.pendingTransactions }),
      );
    }
    return { baseCurrency: integrity.baseCurrency, freshness };
  }

  private accounts(workspaceId: string): Promise<AccountRow[]> {
    return this.accountRepository.query(
      `SELECT "id", "parent_id", "code", "name", "account_type", "is_postable", "position"
         FROM "ledger_accounts" WHERE "workspace_id" = $1 AND "deleted_at" IS NULL
        ORDER BY "position", "code"`,
      [workspaceId],
    );
  }

  /**
   * Depth-first rows (a header, then its children), with every header's
   * values summed from its descendants. Rows where `keep` says nothing
   * happened are dropped unless a descendant has activity.
   */
  private tree<T>(
    accounts: AccountRow[],
    own: Map<string, T>,
    zero: () => T,
    add: (into: T, from: T) => void,
    keep: (values: T) => boolean,
  ): AccountNode<T>[] {
    const children = new Map<string | null, AccountRow[]>();
    for (const account of accounts) {
      const siblings = children.get(account.parent_id) ?? [];
      siblings.push(account);
      children.set(account.parent_id, siblings);
    }
    const known = new Set(accounts.map(account => account.id));

    const walk = (account: AccountRow, depth: number): AccountNode<T>[] => {
      const values = zero();
      add(values, own.get(account.id) ?? zero());
      const below =
        depth < 10 ? (children.get(account.id) ?? []).flatMap(child => walk(child, depth + 1)) : [];
      for (const node of below.filter(node => node.parentId === account.id)) {
        add(values, node.values);
      }
      const node: AccountNode<T> = {
        accountId: account.id,
        parentId: account.parent_id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        isPostable: account.is_postable,
        values,
      };
      return keep(values) || below.length > 0 ? [node, ...below] : [];
    };

    return accounts
      .filter(account => !(account.parent_id && known.has(account.parent_id)))
      .flatMap(root => walk(root, 0));
  }

  async trialBalance(
    workspaceId: string,
    range: { dateFrom?: string; dateTo?: string },
    options: ReportOptions = {},
  ): Promise<TrialBalance> {
    const { baseCurrency, freshness } = await this.prepare(workspaceId, options);
    const dateTo = range.dateTo ?? today();
    const dateFrom = range.dateFrom ?? startOfYear(dateTo);

    const rows: Array<{ account_id: string; opening: string; debit: string; credit: string }> =
      await this.accountRepository.query(
        `SELECT l."account_id",
                coalesce(sum(l."base_debit" - l."base_credit") FILTER (WHERE e."entry_date" < $2), 0) AS "opening",
                coalesce(sum(l."base_debit") FILTER (WHERE e."entry_date" >= $2), 0) AS "debit",
                coalesce(sum(l."base_credit") FILTER (WHERE e."entry_date" >= $2), 0) AS "credit"
           FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
          WHERE e."workspace_id" = $1 AND e."status" <> 'draft' AND e."entry_date" <= $3
          GROUP BY l."account_id"`,
        [workspaceId, dateFrom, dateTo],
      );

    type Turnover = { opening: number; debit: number; credit: number };
    const own = new Map<string, Turnover>(
      rows.map(row => [
        row.account_id,
        { opening: toMinor(row.opening), debit: toMinor(row.debit), credit: toMinor(row.credit) },
      ]),
    );
    const nodes = this.tree<Turnover>(
      await this.accounts(workspaceId),
      own,
      () => ({ opening: 0, debit: 0, credit: 0 }),
      (into, from) => {
        into.opening += from.opening;
        into.debit += from.debit;
        into.credit += from.credit;
      },
      values => values.opening !== 0 || values.debit !== 0 || values.credit !== 0,
    );

    const split = (signed: number) => ({
      debit: signed > 0 ? signed : 0,
      credit: signed < 0 ? -signed : 0,
    });
    const sums = {
      openingDebit: 0,
      openingCredit: 0,
      debit: 0,
      credit: 0,
      closingDebit: 0,
      closingCredit: 0,
    };
    const out = nodes.map(node => {
      const opening = split(node.values.opening);
      const closing = split(node.values.opening + node.values.debit - node.values.credit);
      if (node.isPostable) {
        sums.openingDebit += opening.debit;
        sums.openingCredit += opening.credit;
        sums.debit += node.values.debit;
        sums.credit += node.values.credit;
        sums.closingDebit += closing.debit;
        sums.closingCredit += closing.credit;
      }
      return {
        accountId: node.accountId,
        parentId: node.parentId,
        code: node.code,
        name: node.name,
        accountType: node.accountType,
        isPostable: node.isPostable,
        openingDebit: decimal(opening.debit),
        openingCredit: decimal(opening.credit),
        debit: decimal(node.values.debit),
        credit: decimal(node.values.credit),
        closingDebit: decimal(closing.debit),
        closingCredit: decimal(closing.credit),
      };
    });

    return {
      baseCurrency,
      dateFrom,
      dateTo,
      freshness,
      rows: out,
      totals: {
        openingDebit: decimal(sums.openingDebit),
        openingCredit: decimal(sums.openingCredit),
        debit: decimal(sums.debit),
        credit: decimal(sums.credit),
        closingDebit: decimal(sums.closingDebit),
        closingCredit: decimal(sums.closingCredit),
      },
      balanced:
        sums.openingDebit === sums.openingCredit &&
        sums.debit === sums.credit &&
        sums.closingDebit === sums.closingCredit,
    };
  }

  /** Base-currency balance (debits minus credits) of every account over a date window. */
  private async signedBalances(
    workspaceId: string,
    dateFrom: string | null,
    dateTo: string,
  ): Promise<Map<string, number>> {
    const rows: Array<{ account_id: string; balance: string }> = await this.accountRepository.query(
      `SELECT l."account_id", sum(l."base_debit" - l."base_credit") AS "balance"
         FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE e."workspace_id" = $1 AND e."status" <> 'draft'
          AND ($2::date IS NULL OR e."entry_date" >= $2::date) AND e."entry_date" <= $3
        GROUP BY l."account_id"`,
      [workspaceId, dateFrom, dateTo],
    );
    return new Map(rows.map(row => [row.account_id, toMinor(row.balance)]));
  }

  /** Amount rows for accounts of the given types, in each type's natural sign. */
  private amountRows(
    accounts: AccountRow[],
    signed: Map<string, number>,
    types: LedgerAccountType[],
  ): { rows: AmountRow[]; total: number } {
    const wanted = accounts.filter(account => types.includes(account.account_type));
    const natural = new Map(
      wanted.map(account => {
        const value = signed.get(account.id) ?? 0;
        return [account.id, debitNormal(account.account_type) ? value : -value];
      }),
    );
    const nodes = this.tree<{ amount: number }>(
      wanted,
      new Map([...natural].map(([id, amount]) => [id, { amount }])),
      () => ({ amount: 0 }),
      (into, from) => {
        into.amount += from.amount;
      },
      values => values.amount !== 0,
    );
    const total = wanted.reduce(
      (sum, account) => (account.is_postable ? sum + (natural.get(account.id) ?? 0) : sum),
      0,
    );
    return {
      rows: nodes.map(node => ({
        accountId: node.accountId,
        parentId: node.parentId,
        code: node.code,
        name: node.name,
        accountType: node.accountType,
        isPostable: node.isPostable,
        amount: decimal(node.values.amount),
      })),
      total,
    };
  }

  async profitAndLoss(
    workspaceId: string,
    range: { dateFrom?: string; dateTo?: string },
    options: ReportOptions = {},
  ): Promise<ProfitAndLoss> {
    const { baseCurrency, freshness } = await this.prepare(workspaceId, options);
    const dateTo = range.dateTo ?? today();
    const dateFrom = range.dateFrom ?? startOfYear(dateTo);
    const [accounts, signed] = await Promise.all([
      this.accounts(workspaceId),
      this.signedBalances(workspaceId, dateFrom, dateTo),
    ]);
    const income = this.amountRows(accounts, signed, [LedgerAccountType.INCOME]);
    const expenses = this.amountRows(accounts, signed, [LedgerAccountType.EXPENSE]);
    return {
      baseCurrency,
      dateFrom,
      dateTo,
      freshness,
      income: income.rows,
      expenses: expenses.rows,
      totals: {
        income: decimal(income.total),
        expenses: decimal(expenses.total),
        netIncome: decimal(income.total - expenses.total),
      },
    };
  }

  async balanceSheet(
    workspaceId: string,
    at: { date?: string },
    options: ReportOptions = {},
  ): Promise<BalanceSheet> {
    const { baseCurrency, freshness } = await this.prepare(workspaceId, options);
    const date = at.date ?? today();
    const [accounts, signed] = await Promise.all([
      this.accounts(workspaceId),
      this.signedBalances(workspaceId, null, date),
    ]);
    const assets = this.amountRows(accounts, signed, [LedgerAccountType.ASSET]);
    const liabilities = this.amountRows(accounts, signed, [LedgerAccountType.LIABILITY]);
    const equity = this.amountRows(accounts, signed, [LedgerAccountType.EQUITY]);
    const income = this.amountRows(accounts, signed, [LedgerAccountType.INCOME]).total;
    const expenses = this.amountRows(accounts, signed, [LedgerAccountType.EXPENSE]).total;
    const unclosed = income - expenses;
    const equityTotal = equity.total + unclosed;

    return {
      baseCurrency,
      date,
      freshness,
      assets: assets.rows,
      liabilities: liabilities.rows,
      equity: equity.rows,
      unclosedEarnings: decimal(unclosed),
      totals: {
        assets: decimal(assets.total),
        liabilities: decimal(liabilities.total),
        equity: decimal(equityTotal),
        liabilitiesAndEquity: decimal(liabilities.total + equityTotal),
      },
      balanced: assets.total === liabilities.total + equityTotal,
    };
  }

  /** Every line on one account over a window, with the running balance. */
  async accountLedger(
    workspaceId: string,
    accountId: string,
    query: { dateFrom?: string; dateTo?: string; page?: number; limit?: number },
    options: ReportOptions = {},
  ): Promise<AccountLedger> {
    const { baseCurrency, freshness } = await this.prepare(workspaceId, options);
    const account = await this.accountRepository.findOne({
      where: { id: accountId, workspaceId },
      withDeleted: true,
    });
    if (!account) {
      throw new NotFoundException(appError('LEDGER_ACCOUNT_NOT_FOUND'));
    }
    const dateTo = query.dateTo ?? today();
    const dateFrom = query.dateFrom ?? startOfYear(dateTo);
    const { page, limit, skip } = normalizePagination(query, { defaultLimit: 100, maxLimit: 500 });
    // Shown in the account's normal direction: a bank account and an income account both read positive.
    const direction = debitNormal(account.accountType) ? 1 : -1;

    const [opening] = await this.accountRepository.query(
      `SELECT coalesce(sum(l."base_debit" - l."base_credit"), 0) AS "balance"
         FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE l."account_id" = $1 AND e."workspace_id" = $2 AND e."status" <> 'draft'
          AND e."entry_date" < $3`,
      [accountId, workspaceId, dateFrom],
    );
    const lines: Array<{
      entry_id: string;
      line_no: number;
      entry_no: string | null;
      entry_date: string;
      memo: string | null;
      source: string;
      debit: string;
      credit: string;
      currency: string;
      base_debit: string;
      base_credit: string;
      running: string;
      total: string;
    }> = await this.accountRepository.query(
      `SELECT e."id" AS "entry_id", l."line_no", e."entry_no", to_char(e."entry_date", 'YYYY-MM-DD') AS "entry_date",
              e."memo", e."source", l."debit", l."credit", l."currency", l."base_debit", l."base_credit",
              sum(l."base_debit" - l."base_credit")
                OVER (ORDER BY e."entry_date", e."entry_no", l."line_no" ROWS UNBOUNDED PRECEDING) AS "running",
              count(*) OVER () AS "total"
         FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE l."account_id" = $1 AND e."workspace_id" = $2 AND e."status" <> 'draft'
          AND e."entry_date" >= $3 AND e."entry_date" <= $4
        ORDER BY e."entry_date", e."entry_no", l."line_no"
        OFFSET $5 LIMIT $6`,
      [accountId, workspaceId, dateFrom, dateTo, skip, limit],
    );
    const [closing] = await this.accountRepository.query(
      `SELECT coalesce(sum(l."base_debit" - l."base_credit"), 0) AS "balance"
         FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE l."account_id" = $1 AND e."workspace_id" = $2 AND e."status" <> 'draft'
          AND e."entry_date" <= $3`,
      [accountId, workspaceId, dateTo],
    );

    const openingMinor = toMinor(opening.balance);
    const total = Number(lines[0]?.total ?? 0);
    return {
      baseCurrency,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
      },
      dateFrom,
      dateTo,
      freshness,
      openingBalance: decimal(direction * openingMinor),
      closingBalance: decimal(direction * toMinor(closing.balance)),
      lines: lines.map(line => {
        const isDebit = toMinor(line.debit) > 0;
        return {
          entryId: line.entry_id,
          lineNo: Number(line.line_no),
          entryNo: line.entry_no,
          entryDate: line.entry_date,
          memo: line.memo,
          source: line.source,
          side: isDebit ? ('debit' as const) : ('credit' as const),
          amount: isDebit ? line.debit : line.credit,
          currency: line.currency,
          baseAmount: isDebit ? line.base_debit : line.base_credit,
          runningBalance: decimal(direction * (openingMinor + toMinor(line.running))),
        };
      }),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }
}
