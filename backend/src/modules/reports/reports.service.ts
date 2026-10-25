import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { In, MoreThanOrEqual, type Repository, type SelectQueryBuilder } from 'typeorm';
import * as xlsx from 'xlsx';
import { appError } from '../../common/errors/app-error';
import { onlyCounted, onlyFlows } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { formatMoney } from '../../common/utils/format-money.util';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import { applyOwnerFilter, parseOwnerFilter } from '../../common/utils/transaction-owner.util';
import {
  PRIVACY_VIEWER_PARAM,
  redactedSql,
  redactPrivateRows,
} from '../../common/utils/transaction-privacy.util';
import { resolveInUploadsDir, resolveUploadsDir } from '../../common/utils/uploads.util';
import type {
  CustomReportBody,
  CustomTablesReportBody,
  CustomTablesReportDrillDownBody,
  CustomTablesSummaryBody,
  ExportReportBody,
  GenerateReportBody,
  SpendOverTimeQuery,
  TopCategoriesQuery,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Branch } from '../../entities/branch.entity';
import { Category } from '../../entities/category.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { ReportHistory } from '../../entities/report-history.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditService } from '../audit/audit.service';
import { BalanceService } from '../balance/balance.service';
import { BalanceExportFormat } from '../balance/dto/export-balance.dto';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { BudgetVsActualReport } from './budget-vs-actual.report';
import { ReportGroupBy } from './dto/custom-report.dto';
import {
  CustomTableReportFlowType,
  CustomTableReportSortKey,
} from './dto/custom-tables-report.dto';
import { ExportFormat } from './dto/export-report.dto';
import { WorkspaceExportFormat } from './dto/workspace-export.dto';
import { HoldingsSnapshotReport } from './holdings-snapshot.report';
import type { CustomReport, CustomReportGroup } from './interfaces/custom-report.interface';
import type { DailyReport } from './interfaces/daily-report.interface';
import type { MonthlyReport } from './interfaces/monthly-report.interface';
import type { TopCategoriesReport } from './interfaces/top-categories-report.interface';
import {
  loadPdfMake,
  type ReportCell,
  type ReportDocument,
  type ReportFile,
  type ReportFileFormat,
  writeReportFile,
} from './report-document.util';
import { renderReportLabels } from './report-export.translations';
import { fillLabel, renderTemplateLabels } from './report-template.translations';
import type { TemplateLabels, TemplateReportRow } from './report-template.types';

export interface StatementsSummaryResponse {
  totals: {
    income: number;
    expense: number;
    net: number;
    rows: number;
  };
  timeseries: Array<{ date: string; income: number; expense: number }>;
  categories: Array<{ name: string; amount: number; rows: number }>;
  counterparties: Array<{ name: string; amount: number; rows: number }>;
  recent: Array<{
    id: string;
    amount: number;
    category: string | null;
    counterparty: string | null;
    updatedAt: string;
  }>;
}

export interface CustomTablesSummaryResponse {
  totals: {
    income: number;
    expense: number;
    net: number;
    rows: number;
  };
  timeseries: Array<{ date: string; income: number; expense: number }>;
  categories: Array<{ name: string; amount: number; rows: number }>;
  counterparties: Array<{ name: string; amount: number; rows: number }>;
  recent: Array<{
    id: string;
    tableId: string;
    tableName: string;
    rowNumber: number;
    amount: number;
    category: string | null;
    counterparty: string | null;
    updatedAt: string;
  }>;
  tables: Array<{
    id: string;
    name: string;
    income: number;
    expense: number;
    net: number;
    rows: number;
  }>;
}

interface WorkspaceTransactionExportRow {
  index: number;
  transactionDate: string;
  transactionType: string;
  counterpartyName: string;
  counterpartyBin: string;
  paymentPurpose: string;
  debit: number | null;
  credit: number | null;
  amount: number | null;
  currency: string;
  category: string;
  branch: string;
  wallet: string;
  documentNumber: string;
  comments: string;
}

interface CustomReportExportRow {
  group: string;
  date: string | null;
  counterparty: string;
  amount: number;
  category: string;
  branch: string;
  wallet: string;
}

/**
 * Where a category sorts: under its group, or — for a top-level category,
 * whose group cell is empty — under its own name, so it sits beside its children.
 */
function groupSortKey(entry: { groupName: string; categoryName: string }): string {
  return entry.groupName || entry.categoryName;
}

/**
 * Largest group first and largest category first within it: a flat category
 * tree reads as before, largest first, and a nested one keeps groups together.
 */
function byGroupThenAmount<T extends { groupName: string; categoryName: string; total: number }>(
  entries: T[],
): T[] {
  const groupTotal = new Map<string, number>();
  for (const entry of entries) {
    const key = groupSortKey(entry);
    groupTotal.set(key, (groupTotal.get(key) ?? 0) + entry.total);
  }
  return [...entries].sort(
    (a, b) =>
      (groupTotal.get(groupSortKey(b)) ?? 0) - (groupTotal.get(groupSortKey(a)) ?? 0) ||
      groupSortKey(a).localeCompare(groupSortKey(b)) ||
      b.total - a.total,
  );
}

interface CategoryTotal {
  groupName: string;
  categoryName: string;
  total: number;
  count: number;
}

export interface CustomTablesReportRow {
  counterparty: string;
  source: 'manual';
  tableId: string;
  tableName: string;
  count: number;
  total: number;
  average: number;
  lastDate: string | null;
  currency: string | null;
}

export interface CustomTablesReportResponse {
  totals: {
    total: number;
    manualTotal: number;
    operations: number;
  };
  comparison: {
    totalDelta: number;
    totalPercentage: number;
    totalTrend: 'up' | 'down' | 'flat';
    manualDelta: number;
    manualPercentage: number;
    manualTrend: 'up' | 'down' | 'flat';
    operationsDelta: number;
    operationsPercentage: number;
    operationsTrend: 'up' | 'down' | 'flat';
  };
  timeseries: Array<{ date: string; amount: number }>;
  sourceSplit: { manual: number };
  aggregatedRows: CustomTablesReportRow[];
  tables: Array<{
    id: string;
    name: string;
    source: 'manual';
    total: number;
    rows: number;
  }>;
}

export interface CustomTablesReportDrillDownResponse {
  counterparty: string;
  items: Array<{
    rowId: string;
    tableId: string;
    tableName: string;
    source: 'manual';
    date: string | null;
    amount: number;
    category: string | null;
    currency: string | null;
  }>;
}

/** Keeps the export cell inert while preserving the empty-string default. */
const neutralize = (value: string | null | undefined): string =>
  neutralizeSpreadsheetFormulaCell(value || '') as string;

@Injectable()
export class ReportsService {
  private toParsableDateInput(value: unknown): string | number | Date | null {
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
      return value;
    }

    return null;
  }

  private emptyCustomTablesReportResponse(): CustomTablesReportResponse {
    return {
      totals: { total: 0, manualTotal: 0, operations: 0 },
      comparison: {
        totalDelta: 0,
        totalPercentage: 0,
        totalTrend: 'flat',
        manualDelta: 0,
        manualPercentage: 0,
        manualTrend: 'flat',
        operationsDelta: 0,
        operationsPercentage: 0,
        operationsTrend: 'flat',
      },
      timeseries: [],
      sourceSplit: { manual: 0 },
      aggregatedRows: [],
      tables: [],
    };
  }

  private toStartOfUtcDay(date: Date): Date {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }

  private toEndOfUtcDay(date: Date): Date {
    const copy = new Date(date);
    copy.setUTCHours(23, 59, 59, 999);
    return copy;
  }

  private formatMonthPeriod(date: Date): string {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private formatMonthLabel(date: Date): string {
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${month}.${year}`;
  }

  private getIsoWeekInfo(date: Date): { year: number; week: number } {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { year: target.getUTCFullYear(), week };
  }

  private normalizeText(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const text = String(value).trim();
    return text.length ? text : null;
  }

  private parseNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const raw = String(value).trim();
    if (!raw.length) {
      return null;
    }

    const normalized = raw
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/,/g, '.');

    if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
      return null;
    }
    const asNumber = Number(normalized);
    return Number.isFinite(asNumber) ? asNumber : null;
  }

  private parseDate(value: unknown): Date | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw.length) {
        return null;
      }
      const v = raw.split('T')[0];

      const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) {
        const year = Number(ymd[1]);
        const month = Number(ymd[2]);
        const day = Number(ymd[3]);
        return new Date(Date.UTC(year, month - 1, day));
      }

      const dmyDot = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmyDot) {
        const day = Number(dmyDot[1]);
        const month = Number(dmyDot[2]);
        const year = Number(dmyDot[3]);
        return new Date(Date.UTC(year, month - 1, day));
      }

      const dmySlash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmySlash) {
        const day = Number(dmySlash[1]);
        const month = Number(dmySlash[2]);
        const year = Number(dmySlash[3]);
        return new Date(Date.UTC(year, month - 1, day));
      }

      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    try {
      const dateInput = this.toParsableDateInput(value);
      if (dateInput === null) {
        return null;
      }

      const parsed = new Date(dateInput);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  private toDateKey(value: unknown): string {
    if (typeof value === 'string') {
      // Postgres DATE columns often come back as 'YYYY-MM-DD'
      return value.split('T')[0];
    }
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    try {
      const dateInput = this.toParsableDateInput(value);
      if (dateInput === null) {
        return new Date().toISOString().split('T')[0];
      }

      const asDate = new Date(dateInput);
      if (!Number.isNaN(asDate.getTime())) {
        return asDate.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
    return new Date().toISOString().split('T')[0];
  }

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    categoryRepository: Repository<Category>,
    @InjectRepository(Branch)
    branchRepository: Repository<Branch>,
    @InjectRepository(Wallet)
    walletRepository: Repository<Wallet>,
    @InjectRepository(CustomTable)
    private customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
    @InjectRepository(ReportHistory)
    private readonly reportHistoryRepo: Repository<ReportHistory>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly balanceService: BalanceService,
    private readonly budgetVsActualReport: BudgetVsActualReport,
    private readonly holdingsSnapshotReport: HoldingsSnapshotReport,
  ) {}

  /** Cached reports are keyed by this version; TransactionsService bumps it on every edit. */
  private async getReportsVersion(workspaceId: string): Promise<string> {
    const key = `reports:version:${workspaceId}`;
    let version = await this.cacheManager.get<string>(key);
    if (!version) {
      version = Date.now().toString();
      await this.cacheManager.set(key, version, 0); // No expiry (until invalidated)
    }
    return version;
  }

  private scoreDateColumn(col: CustomTableColumn): number {
    const title = (col.title || '').toLowerCase();
    let score = 0;
    if (col.type === CustomTableColumnType.DATE) {
      score += 6;
    }
    if (/(^|[\s_])date([\s_]|$)/.test(title) || title.includes('дата')) {
      score += 4;
    }
    if (title.includes('год') || title.includes('year')) {
      score += 1;
    }
    if (title.includes('месяц') || title.includes('month')) {
      score += 1;
    }
    return score;
  }

  private scoreAmountColumn(col: CustomTableColumn): number {
    const title = (col.title || '').toLowerCase();
    let score = 0;
    if (col.type === CustomTableColumnType.NUMBER) {
      score += 6;
    }
    if (
      title.includes('сумм') ||
      title.includes('amount') ||
      title.includes('итог') ||
      title.includes('total')
    ) {
      score += 4;
    }
    if (title.includes('приход') || title.includes('доход')) {
      score += 2;
    }
    if (title.includes('расход')) {
      score += 2;
    }
    if (title.includes('год') || title.includes('year')) {
      score -= 4;
    }
    if (title.includes('мсц') || title.includes('месяц') || title.includes('month')) {
      score -= 3;
    }
    if (title.includes('курс') || title.includes('rate') || title.includes('обмен')) {
      score -= 4;
    }
    if (title.includes('валют') || title.includes('currency')) {
      score -= 3;
    }
    return score;
  }

  private scoreCategoryColumn(col: CustomTableColumn): number {
    const title = (col.title || '').toLowerCase();
    let score = 0;
    if (title.includes('катег') || title.includes('category')) {
      score += 6;
    }
    if (title.includes('статья') || title.includes('article')) {
      score += 5;
    }
    if (title.includes('группа') || title.includes('group')) {
      score += 2;
    }
    return score;
  }

  private scoreCounterpartyColumn(col: CustomTableColumn): number {
    const title = (col.title || '').toLowerCase();
    let score = 0;
    if (title.includes('контраг') || title.includes('counterparty')) {
      score += 6;
    }
    if (title.includes('постав') || title.includes('supplier')) {
      score += 4;
    }
    if (title.includes('клиент') || title.includes('customer')) {
      score += 4;
    }
    if (title.includes('merchant') || title.includes('получател') || title.includes('платель')) {
      score += 4;
    }
    if (title.includes('кошел') || title.includes('wallet')) {
      score -= 2;
    }
    if (title.includes('филиал') || title.includes('branch')) {
      score -= 2;
    }
    return score;
  }

  private pickBestColumnKey(
    columns: CustomTableColumn[],
    scorer: (col: CustomTableColumn) => number,
  ): string | null {
    let best: CustomTableColumn | null = null;
    let bestScore = 0;
    for (const col of columns) {
      const score = scorer(col);
      if (score > bestScore) {
        bestScore = score;
        best = col;
      }
    }
    return best ? best.key : null;
  }

  async getCustomTablesSummary(
    workspaceId: string,
    dto: CustomTablesSummaryBody,
  ): Promise<CustomTablesSummaryResponse> {
    const version = await this.getReportsVersion(workspaceId);
    const cacheKey = `reports:custom-tables:${workspaceId}:${version}:${JSON.stringify(dto)}`;
    const cached = await this.cacheManager.get<CustomTablesSummaryResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const safeDays =
      Number.isFinite(dto.days) && (dto.days as number) > 0
        ? Math.min(dto.days as number, 3650)
        : 30;
    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const requestedIds = (dto.tableIds || []).filter(id => typeof id === 'string' && id.length);

    const tables = await this.customTableRepository.find({
      where: {
        workspaceId,
        ...(requestedIds.length ? { id: In(requestedIds) } : {}),
      },
      relations: { category: true },
      order: { updatedAt: 'DESC' },
    });

    if (requestedIds.length && tables.length !== requestedIds.length) {
      throw new BadRequestException(appError('TABLES_NOT_FOUND'));
    }

    if (!tables.length) {
      return {
        totals: { income: 0, expense: 0, net: 0, rows: 0 },
        timeseries: [],
        categories: [],
        counterparties: [],
        recent: [],
        tables: [],
      };
    }

    const tableById = new Map<string, CustomTable>();
    for (const t of tables) {
      tableById.set(t.id, t);
    }
    const tableIds = tables.map(t => t.id);

    const columns = await this.customTableColumnRepository.find({
      where: { tableId: In(tableIds) },
      order: { tableId: 'ASC', position: 'ASC' },
    });

    const columnsByTableId = new Map<string, CustomTableColumn[]>();
    for (const col of columns) {
      const list = columnsByTableId.get(col.tableId) || [];
      list.push(col);
      columnsByTableId.set(col.tableId, list);
    }

    const mappingByTableId = new Map<
      string,
      {
        dateKey: string | null;
        amountKey: string | null;
        categoryKey: string | null;
        counterpartyKey: string | null;
      }
    >();

    for (const tableId of tableIds) {
      const cols = columnsByTableId.get(tableId) || [];
      mappingByTableId.set(tableId, {
        dateKey: this.pickBestColumnKey(cols, c => this.scoreDateColumn(c)),
        amountKey: this.pickBestColumnKey(cols, c => this.scoreAmountColumn(c)),
        categoryKey: this.pickBestColumnKey(cols, c => this.scoreCategoryColumn(c)),
        counterpartyKey: this.pickBestColumnKey(cols, c => this.scoreCounterpartyColumn(c)),
      });
    }

    const rows = await this.customTableRowRepository.find({
      where: { tableId: In(tableIds), updatedAt: MoreThanOrEqual(since) },
      order: { updatedAt: 'DESC' },
    });

    const totals = { income: 0, expense: 0, net: 0, rows: 0 };
    const timeseriesMap = new Map<string, { income: number; expense: number }>();
    const categoryMap = new Map<string, { amount: number; rows: number }>();
    const counterpartyMap = new Map<string, { amount: number; rows: number }>();
    const perTableMap = new Map<string, { income: number; expense: number; rows: number }>();
    const recent: CustomTablesSummaryResponse['recent'] = [];

    for (const row of rows) {
      const table = tableById.get(row.tableId);
      if (!table) {
        continue;
      }
      const mapping = mappingByTableId.get(row.tableId);
      const dateValue = mapping?.dateKey ? row.data?.[mapping.dateKey] : null;
      const parsedDate = this.parseDate(dateValue) || row.updatedAt || row.createdAt;
      if (parsedDate < since) {
        continue;
      }

      const amountValue = mapping?.amountKey ? row.data?.[mapping.amountKey] : null;
      const amountRaw = this.parseNumber(amountValue);
      if (amountRaw === null) {
        continue;
      }

      const abs = Math.abs(amountRaw);
      const isIncome = amountRaw >= 0;
      const dateKey = this.toDateKey(parsedDate);
      const ts = timeseriesMap.get(dateKey) || { income: 0, expense: 0 };
      if (isIncome) {
        ts.income += abs;
        totals.income += abs;
      } else {
        ts.expense += abs;
        totals.expense += abs;
      }
      timeseriesMap.set(dateKey, ts);
      totals.rows += 1;

      const perTable = perTableMap.get(row.tableId) || { income: 0, expense: 0, rows: 0 };
      if (isIncome) {
        perTable.income += abs;
      } else {
        perTable.expense += abs;
      }
      perTable.rows += 1;
      perTableMap.set(row.tableId, perTable);

      const categoryValue = mapping?.categoryKey ? row.data?.[mapping.categoryKey] : null;
      const counterpartyValue = mapping?.counterpartyKey
        ? row.data?.[mapping.counterpartyKey]
        : null;
      const categoryName = this.normalizeText(categoryValue) || table.category?.name || null;
      const counterpartyName = this.normalizeText(counterpartyValue) || null;

      if (isIncome) {
        const key = (counterpartyName || 'Без названия').trim() || 'Без названия';
        const existing = counterpartyMap.get(key) || { amount: 0, rows: 0 };
        counterpartyMap.set(key, { amount: existing.amount + abs, rows: existing.rows + 1 });
      } else {
        const key =
          (categoryName || UNCATEGORIZED_CATEGORY_NAME).trim() || UNCATEGORIZED_CATEGORY_NAME;
        const existing = categoryMap.get(key) || { amount: 0, rows: 0 };
        categoryMap.set(key, { amount: existing.amount + abs, rows: existing.rows + 1 });
      }

      if (recent.length < 20) {
        recent.push({
          id: row.id,
          tableId: table.id,
          tableName: table.name,
          rowNumber: row.rowNumber,
          amount: isIncome ? abs : -abs,
          category: categoryName,
          counterparty: counterpartyName,
          updatedAt: (row.updatedAt || row.createdAt).toISOString(),
        });
      }
    }

    totals.net = totals.income - totals.expense;

    const timeseries = Array.from(timeseriesMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, amount: data.amount, rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const counterparties = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, amount: data.amount, rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const tablesBreakdown = tables
      .map(t => {
        const metrics = perTableMap.get(t.id) || { income: 0, expense: 0, rows: 0 };
        return {
          id: t.id,
          name: t.name,
          income: metrics.income,
          expense: metrics.expense,
          net: metrics.income - metrics.expense,
          rows: metrics.rows,
        };
      })
      .sort((a, b) => b.rows - a.rows);

    const response: CustomTablesSummaryResponse = {
      totals,
      timeseries,
      categories,
      counterparties,
      recent,
      tables: tablesBreakdown,
    };

    await this.cacheManager.set(cacheKey, response, 300000); // 5 minutes
    return response;
  }

  async getCustomTablesReport(
    workspaceId: string,
    dto: CustomTablesReportBody,
  ): Promise<CustomTablesReportResponse> {
    const version = await this.getReportsVersion(workspaceId);
    const cacheKey = `reports:custom-tables-report:${workspaceId}:${version}:${JSON.stringify(dto)}`;
    const cached = await this.cacheManager.get<CustomTablesReportResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const safeDays =
      Number.isFinite(dto.days) && (dto.days as number) > 0
        ? Math.min(dto.days as number, 3650)
        : 30;
    const flowType = dto.flowType || CustomTableReportFlowType.ALL;
    const sortBy = dto.sortBy || CustomTableReportSortKey.AMOUNT;
    const limit =
      Number.isFinite(dto.limit) && (dto.limit as number) > 0
        ? Math.min(dto.limit as number, 500)
        : 60;
    const search = this.normalizeText(dto.search)?.toLowerCase() || null;

    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const previousSince = new Date(since);
    previousSince.setDate(previousSince.getDate() - safeDays);

    const requestedIds = (dto.tableIds || []).filter(id => typeof id === 'string' && id.length);
    const tables = await this.customTableRepository.find({
      where: {
        workspaceId,
        ...(requestedIds.length ? { id: In(requestedIds) } : {}),
      },
      relations: { category: true },
      order: { updatedAt: 'DESC' },
    });

    if (requestedIds.length && tables.length !== requestedIds.length) {
      throw new BadRequestException(appError('TABLES_NOT_FOUND'));
    }

    if (!tables.length) {
      return this.emptyCustomTablesReportResponse();
    }

    const tableById = new Map<string, CustomTable>();
    for (const table of tables) {
      tableById.set(table.id, table);
    }
    const tableIds = tables.map(table => table.id);

    const columns = await this.customTableColumnRepository.find({
      where: { tableId: In(tableIds) },
      order: { tableId: 'ASC', position: 'ASC' },
    });

    const columnsByTableId = new Map<string, CustomTableColumn[]>();
    for (const col of columns) {
      const list = columnsByTableId.get(col.tableId) || [];
      list.push(col);
      columnsByTableId.set(col.tableId, list);
    }

    const mappingByTableId = new Map<
      string,
      {
        dateKey: string | null;
        amountKey: string | null;
        categoryKey: string | null;
        counterpartyKey: string | null;
      }
    >();

    for (const tableId of tableIds) {
      const cols = columnsByTableId.get(tableId) || [];
      mappingByTableId.set(tableId, {
        dateKey: this.pickBestColumnKey(cols, c => this.scoreDateColumn(c)),
        amountKey: this.pickBestColumnKey(cols, c => this.scoreAmountColumn(c)),
        categoryKey: this.pickBestColumnKey(cols, c => this.scoreCategoryColumn(c)),
        counterpartyKey: this.pickBestColumnKey(cols, c => this.scoreCounterpartyColumn(c)),
      });
    }

    const currentRows = await this.customTableRowRepository
      .createQueryBuilder('row')
      .where('row.tableId IN (:...tableIds)', { tableIds })
      .andWhere('row.updatedAt >= :since', { since })
      .getMany();

    const previousRows = await this.customTableRowRepository
      .createQueryBuilder('row')
      .where('row.tableId IN (:...tableIds)', { tableIds })
      .andWhere('row.updatedAt >= :previousSince', { previousSince })
      .andWhere('row.updatedAt < :since', { since })
      .getMany();

    type ReportRecord = {
      rowId: string;
      tableId: string;
      tableName: string;
      source: 'manual';
      counterparty: string;
      amount: number;
      date: string | null;
      category: string | null;
      currency: string | null;
      flow: 'expense' | 'income';
    };

    const resolveCurrency = (tableId: string, row: CustomTableRow): string | null => {
      const cols = columnsByTableId.get(tableId) || [];
      for (const col of cols) {
        const title = (col.title || '').toLowerCase();
        if (title.includes('валют') || title.includes('currency')) {
          return this.normalizeText(row.data?.[col.key]);
        }
      }
      return null;
    };

    const toRecord = (row: CustomTableRow): ReportRecord | null => {
      const table = tableById.get(row.tableId);
      const mapping = mappingByTableId.get(row.tableId);
      if (!(table && mapping?.amountKey)) {
        return null;
      }

      const rawAmount = this.parseNumber(row.data?.[mapping.amountKey]);
      if (rawAmount === null) {
        return null;
      }

      const flow: 'expense' | 'income' = rawAmount < 0 ? 'expense' : 'income';
      if (flowType === CustomTableReportFlowType.EXPENSE && flow !== 'expense') {
        return null;
      }
      if (flowType === CustomTableReportFlowType.INCOME && flow !== 'income') {
        return null;
      }

      const counterparty =
        this.normalizeText(mapping.counterpartyKey ? row.data?.[mapping.counterpartyKey] : null) ||
        'Unknown';
      const category = this.normalizeText(
        mapping.categoryKey ? row.data?.[mapping.categoryKey] : null,
      );
      const parsedDate = mapping.dateKey
        ? this.parseDate(row.data?.[mapping.dateKey]) || row.updatedAt || row.createdAt
        : row.updatedAt || row.createdAt;
      const date = parsedDate ? this.toDateKey(parsedDate) : null;
      const currency = resolveCurrency(row.tableId, row);

      if (
        search &&
        !counterparty.toLowerCase().includes(search) &&
        !(category || '').toLowerCase().includes(search) &&
        !table.name.toLowerCase().includes(search)
      ) {
        return null;
      }

      return {
        rowId: row.id,
        tableId: row.tableId,
        tableName: table.name,
        source: table.source,
        counterparty,
        amount: Math.abs(rawAmount),
        date,
        category,
        currency,
        flow,
      };
    };

    const records = currentRows.map(toRecord).filter(Boolean) as ReportRecord[];
    const previousRecords = previousRows.map(toRecord).filter(Boolean) as ReportRecord[];

    const totals = { total: 0, manualTotal: 0, operations: 0 };
    const previousTotals = { total: 0, manualTotal: 0, operations: 0 };
    const timeseriesMap = new Map<string, number>();
    const aggregateMap = new Map<
      string,
      {
        counterparty: string;
        source: 'manual';
        tableId: string;
        tableName: string;
        count: number;
        total: number;
        lastDate: string | null;
        currency: string | null;
      }
    >();
    const tableTotalsMap = new Map<string, { total: number; rows: number }>();

    for (const record of records) {
      totals.total += record.amount;
      totals.operations += 1;
      totals.manualTotal += record.amount;

      if (record.date) {
        timeseriesMap.set(record.date, (timeseriesMap.get(record.date) || 0) + record.amount);
      }

      const aggregateKey = `${record.source}:${record.currency || ''}:${record.counterparty.toLowerCase()}`;
      const current = aggregateMap.get(aggregateKey);
      if (current) {
        current.count += 1;
        current.total += record.amount;
        if (record.date && (!current.lastDate || record.date > current.lastDate)) {
          current.lastDate = record.date;
        }
      } else {
        aggregateMap.set(aggregateKey, {
          counterparty: record.counterparty,
          source: record.source,
          tableId: record.tableId,
          tableName: record.tableName,
          count: 1,
          total: record.amount,
          lastDate: record.date,
          currency: record.currency,
        });
      }

      const tableMetrics = tableTotalsMap.get(record.tableId) || { total: 0, rows: 0 };
      tableMetrics.total += record.amount;
      tableMetrics.rows += 1;
      tableTotalsMap.set(record.tableId, tableMetrics);
    }

    for (const record of previousRecords) {
      previousTotals.total += record.amount;
      previousTotals.operations += 1;
      previousTotals.manualTotal += record.amount;
    }

    const toComparison = (current: number, previous: number) => {
      const delta = current - previous;
      const percentage =
        previous === 0 ? (current > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
      const trend: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      return { delta, percentage, trend };
    };

    const totalCmp = toComparison(totals.total, previousTotals.total);
    const manualCmp = toComparison(totals.manualTotal, previousTotals.manualTotal);
    const operationsCmp = toComparison(totals.operations, previousTotals.operations);

    let aggregatedRows: CustomTablesReportRow[] = Array.from(aggregateMap.values()).map(item => ({
      counterparty: item.counterparty,
      source: item.source,
      tableId: item.tableId,
      tableName: item.tableName,
      count: item.count,
      total: item.total,
      average: item.count > 0 ? item.total / item.count : 0,
      lastDate: item.lastDate,
      currency: item.currency,
    }));

    if (sortBy === CustomTableReportSortKey.AVERAGE) {
      aggregatedRows.sort((a, b) => b.average - a.average);
    } else if (sortBy === CustomTableReportSortKey.OPERATIONS) {
      aggregatedRows.sort((a, b) => b.count - a.count);
    } else {
      aggregatedRows.sort((a, b) => b.total - a.total);
    }
    aggregatedRows = aggregatedRows.slice(0, limit);

    const timeseries = Array.from(timeseriesMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const response: CustomTablesReportResponse = {
      totals,
      comparison: {
        totalDelta: totalCmp.delta,
        totalPercentage: totalCmp.percentage,
        totalTrend: totalCmp.trend,
        manualDelta: manualCmp.delta,
        manualPercentage: manualCmp.percentage,
        manualTrend: manualCmp.trend,
        operationsDelta: operationsCmp.delta,
        operationsPercentage: operationsCmp.percentage,
        operationsTrend: operationsCmp.trend,
      },
      timeseries,
      sourceSplit: {
        manual: totals.manualTotal,
      },
      aggregatedRows,
      tables: tables
        .map(table => {
          const metrics = tableTotalsMap.get(table.id) || { total: 0, rows: 0 };
          return {
            id: table.id,
            name: table.name,
            source: table.source,
            total: metrics.total,
            rows: metrics.rows,
          };
        })
        .filter(table => table.rows > 0)
        .sort((a, b) => b.total - a.total),
    };

    await this.cacheManager.set(cacheKey, response, 300000);
    return response;
  }

  async getCustomTablesReportDrillDown(
    workspaceId: string,
    dto: CustomTablesReportDrillDownBody,
  ): Promise<CustomTablesReportDrillDownResponse> {
    const safeDays =
      Number.isFinite(dto.days) && (dto.days as number) > 0
        ? Math.min(dto.days as number, 3650)
        : 30;
    const flowType = dto.flowType || CustomTableReportFlowType.ALL;
    const limit =
      Number.isFinite(dto.limit) && (dto.limit as number) > 0
        ? Math.min(dto.limit as number, 200)
        : 120;

    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const requestedIds = (dto.tableIds || []).filter(id => typeof id === 'string' && id.length);
    const tables = await this.customTableRepository.find({
      where: {
        workspaceId,
        ...(requestedIds.length ? { id: In(requestedIds) } : {}),
      },
      order: { updatedAt: 'DESC' },
    });

    if (!tables.length) {
      return { counterparty: dto.counterparty, items: [] };
    }

    const tableIds = tables.map(table => table.id);
    const tableById = new Map(tables.map(table => [table.id, table]));
    const columns = await this.customTableColumnRepository.find({
      where: { tableId: In(tableIds) },
      order: { tableId: 'ASC', position: 'ASC' },
    });

    const columnsByTableId = new Map<string, CustomTableColumn[]>();
    for (const col of columns) {
      const list = columnsByTableId.get(col.tableId) || [];
      list.push(col);
      columnsByTableId.set(col.tableId, list);
    }

    const mappingByTableId = new Map<
      string,
      {
        dateKey: string | null;
        amountKey: string | null;
        categoryKey: string | null;
        counterpartyKey: string | null;
      }
    >();

    for (const tableId of tableIds) {
      const cols = columnsByTableId.get(tableId) || [];
      mappingByTableId.set(tableId, {
        dateKey: this.pickBestColumnKey(cols, c => this.scoreDateColumn(c)),
        amountKey: this.pickBestColumnKey(cols, c => this.scoreAmountColumn(c)),
        categoryKey: this.pickBestColumnKey(cols, c => this.scoreCategoryColumn(c)),
        counterpartyKey: this.pickBestColumnKey(cols, c => this.scoreCounterpartyColumn(c)),
      });
    }

    const rows = await this.customTableRowRepository
      .createQueryBuilder('row')
      .where('row.tableId IN (:...tableIds)', { tableIds })
      .andWhere('row.updatedAt >= :since', { since })
      .getMany();

    const items: CustomTablesReportDrillDownResponse['items'] = [];
    const needle = dto.counterparty.trim().toLowerCase();

    for (const row of rows) {
      const table = tableById.get(row.tableId);
      const mapping = mappingByTableId.get(row.tableId);
      if (!(table && mapping?.amountKey)) {
        continue;
      }

      const rawAmount = this.parseNumber(row.data?.[mapping.amountKey]);
      if (rawAmount === null) {
        continue;
      }

      const flow: 'expense' | 'income' = rawAmount < 0 ? 'expense' : 'income';
      if (flowType === CustomTableReportFlowType.EXPENSE && flow !== 'expense') {
        continue;
      }
      if (flowType === CustomTableReportFlowType.INCOME && flow !== 'income') {
        continue;
      }

      const counterparty =
        this.normalizeText(mapping.counterpartyKey ? row.data?.[mapping.counterpartyKey] : null) ||
        'Unknown';
      if (counterparty.toLowerCase() !== needle) {
        continue;
      }

      const category = this.normalizeText(
        mapping.categoryKey ? row.data?.[mapping.categoryKey] : null,
      );
      const parsedDate = mapping.dateKey
        ? this.parseDate(row.data?.[mapping.dateKey]) || row.updatedAt || row.createdAt
        : row.updatedAt || row.createdAt;

      let currency: string | null = null;
      const cols = columnsByTableId.get(row.tableId) || [];
      for (const col of cols) {
        const title = (col.title || '').toLowerCase();
        if (title.includes('валют') || title.includes('currency')) {
          currency = this.normalizeText(row.data?.[col.key]);
          break;
        }
      }

      items.push({
        rowId: row.id,
        tableId: row.tableId,
        tableName: table.name,
        source: table.source,
        date: parsedDate ? this.toDateKey(parsedDate) : null,
        amount: Math.abs(rawAmount),
        category,
        currency,
      });
    }

    items.sort((a, b) => {
      const left = a.date || '';
      const right = b.date || '';
      return right.localeCompare(left);
    });

    return {
      counterparty: dto.counterparty,
      items: items.slice(0, limit),
    };
  }

  async getAvailableCustomTables(workspaceId: string): Promise<
    Array<{
      id: string;
      name: string;
      source: 'manual';
      rowCount: number;
    }>
  > {
    const tables = await this.customTableRepository.find({
      where: { workspaceId },
      order: { updatedAt: 'DESC' },
    });

    const results = [] as Array<{
      id: string;
      name: string;
      source: 'manual';
      rowCount: number;
    }>;

    for (const table of tables) {
      const rowCount = await this.customTableRowRepository.count({ where: { tableId: table.id } });
      results.push({
        id: table.id,
        name: table.name,
        source: table.source,
        rowCount,
      });
    }

    return results;
  }

  /**
   */
  async generateDailyReport(
    workspaceId: string,
    date: string,
    viewerMemberId: string | null = null,
  ): Promise<DailyReport> {
    const version = await this.getReportsVersion(workspaceId);
    // Per viewer: the report names the merchants of the viewer's own private rows.
    const cacheKey = `reports:daily:${workspaceId}:${version}:${viewerMemberId ?? '-'}:${date || 'latest'}`;
    const cached = await this.cacheManager.get<DailyReport>(cacheKey);
    if (cached) {
      return cached;
    }

    const resolvedDate = date || (await this.getLatestTransactionDate(workspaceId));
    const reportDate = resolvedDate ? new Date(resolvedDate) : new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get income transactions
    const incomeTransactions = await this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .andWhere('transaction.transactionType = :type', { type: TransactionType.INCOME })
      .andWhere('transaction.transactionDate >= :start', { start: startOfDay })
      .andWhere('transaction.transactionDate <= :end', { end: endOfDay })
      .getMany();

    // Get expense transactions
    const expenseTransactions = await this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .andWhere('transaction.transactionType = :type', { type: TransactionType.EXPENSE })
      .andWhere('transaction.transactionDate >= :start', { start: startOfDay })
      .andWhere('transaction.transactionDate <= :end', { end: endOfDay })
      .getMany();
    redactPrivateRows(incomeTransactions, viewerMemberId);
    redactPrivateRows(expenseTransactions, viewerMemberId);

    // Calculate income block
    const incomeTotal = incomeTransactions.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const counterpartyMap = new Map<string, { amount: number; count: number }>();
    incomeTransactions.forEach(t => {
      const existing = counterpartyMap.get(t.counterpartyName) || { amount: 0, count: 0 };
      counterpartyMap.set(t.counterpartyName, {
        amount: existing.amount + Number(t.amount ?? 0),
        count: existing.count + 1,
      });
    });

    const topCounterparties = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Calculate expense block
    const expenseTotal = expenseTransactions.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    expenseTransactions.forEach(t => {
      const categoryId = t.categoryId || 'uncategorized';
      const categoryName = t.category?.name || UNCATEGORIZED_CATEGORY_NAME;
      const existing = categoryMap.get(categoryId) || { name: categoryName, amount: 0, count: 0 };
      categoryMap.set(categoryId, {
        name: categoryName,
        amount: existing.amount + Number(t.amount ?? 0),
        count: existing.count + 1,
      });
    });

    const topCategories = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const report: DailyReport = {
      date: date,
      income: {
        totalAmount: incomeTotal,
        transactionCount: incomeTransactions.length,
        topCounterparties,
      },
      expense: {
        totalAmount: expenseTotal,
        transactionCount: expenseTransactions.length,
        topCategories,
      },
      summary: {
        incomeTotal,
        expenseTotal,
        difference: incomeTotal - expenseTotal,
      },
    };

    // Log to audit
    await this.logReportGeneration(workspaceId, 'daily', date);

    return report;
  }

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(
    workspaceId: string,
    year: number,
    month: number,
    viewerMemberId: string | null = null,
  ): Promise<MonthlyReport> {
    const version = await this.getReportsVersion(workspaceId);
    // Per viewer: the report names the merchants of the viewer's own private rows.
    const cacheKey = `reports:monthly:${workspaceId}:${version}:${viewerMemberId ?? '-'}:${year}:${month}`;
    const cached = await this.cacheManager.get<MonthlyReport>(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all transactions for the month
    const transactions = await this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .andWhere('transaction.transactionDate >= :start', { start: startDate })
      .andWhere('transaction.transactionDate <= :end', { end: endDate })
      .getMany();
    redactPrivateRows(transactions, viewerMemberId);

    // Calculate daily trends
    const dailyMap = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const dateKey = dayOf(t.transactionDate);
      const existing = dailyMap.get(dateKey) || { income: 0, expense: 0 };
      if (t.transactionType === TransactionType.INCOME) {
        existing.income += Number(t.amount ?? 0);
      } else {
        existing.expense += Number(t.amount ?? 0);
      }
      dailyMap.set(dateKey, existing);
    });

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate category distribution
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    transactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .forEach(t => {
        const categoryId = t.categoryId || 'uncategorized';
        const categoryName = t.category?.name || UNCATEGORIZED_CATEGORY_NAME;
        const existing = categoryMap.get(categoryId) || { name: categoryName, amount: 0, count: 0 };
        categoryMap.set(categoryId, {
          name: categoryName,
          amount: existing.amount + Number(t.amount ?? 0),
          count: existing.count + 1,
        });
      });

    const totalExpense = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.amount, 0);
    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
        percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate counterparty distribution
    const counterpartyMap = new Map<string, { amount: number; count: number }>();
    transactions.forEach(t => {
      const existing = counterpartyMap.get(t.counterpartyName) || { amount: 0, count: 0 };
      counterpartyMap.set(t.counterpartyName, {
        amount: existing.amount + Number(t.amount ?? 0),
        count: existing.count + 1,
      });
    });

    const totalAmount = Array.from(counterpartyMap.values()).reduce((sum, c) => sum + c.amount, 0);
    const counterpartyDistribution = Array.from(counterpartyMap.entries())
      .map(([counterpartyName, data]) => ({
        counterpartyName,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);

    // Calculate comparison with previous period
    const previousStartDate = new Date(year, month - 2, 1);
    const previousEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999);

    const previousTransactions = await this.countedTransactions(workspaceId)
      .andWhere('transaction.transactionDate >= :start', { start: previousStartDate })
      .andWhere('transaction.transactionDate <= :end', { end: previousEndDate })
      .getMany();

    const currentIncome = transactions
      .filter(t => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const currentExpense = transactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const currentDifference = currentIncome - currentExpense;

    const previousIncome = previousTransactions
      .filter(t => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const previousExpense = previousTransactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const previousDifference = previousIncome - previousExpense;

    const incomeChange = currentIncome - previousIncome;
    const expenseChange = currentExpense - previousExpense;
    const differenceChange = currentDifference - previousDifference;

    const report: MonthlyReport = {
      month: month.toString(),
      year,
      dailyTrends,
      categoryDistribution,
      counterpartyDistribution,
      comparison: {
        currentPeriod: {
          income: currentIncome,
          expense: currentExpense,
          difference: currentDifference,
        },
        previousPeriod: {
          income: previousIncome,
          expense: previousExpense,
          difference: previousDifference,
        },
        change: {
          incomeChange,
          expenseChange,
          differenceChange,
          incomeChangePercent: previousIncome > 0 ? (incomeChange / previousIncome) * 100 : 0,
          expenseChangePercent: previousExpense > 0 ? (expenseChange / previousExpense) * 100 : 0,
          differenceChangePercent:
            previousDifference !== 0 ? (differenceChange / Math.abs(previousDifference)) * 100 : 0,
        },
      },
      summary: {
        totalIncome: currentIncome,
        totalExpense: currentExpense,
        difference: currentDifference,
        transactionCount: transactions.length,
      },
    };

    // Log to audit
    await this.logReportGeneration(
      workspaceId,
      'monthly',
      `${year}-${month.toString().padStart(2, '0')}`,
    );

    return report;
  }

  /**
   * Returns latest transaction date for user (YYYY-MM-DD) and month/year pair
   */
  async getLatestTransactionPeriod(
    workspaceId: string,
  ): Promise<{ date: string | null; year: number | null; month: number | null }> {
    const latest = await this.getLatestTransactionDate(workspaceId);
    if (!latest) {
      return { date: null, year: null, month: null };
    }
    const dt = new Date(latest);
    return {
      date: latest,
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
    };
  }

  /**
   * Latest transaction date in ISO (YYYY-MM-DD) or null
   */
  async getLatestTransactionDate(workspaceId: string): Promise<string | null> {
    const latest = await this.countedTransactions(workspaceId)
      .orderBy('transaction.transactionDate', 'DESC')
      .select('transaction.transactionDate', 'transactionDate')
      .getRawOne<{ transactionDate: Date | string }>();

    if (!latest?.transactionDate) {
      return null;
    }
    return dayOf(latest.transactionDate);
  }

  /**
   * Generate custom report
   */
  async generateCustomReport(
    workspaceId: string,
    dto: CustomReportBody,
    viewerMemberId: string | null = null,
  ): Promise<CustomReport> {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);

    // Build query
    const queryBuilder = this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .andWhere('transaction.transactionDate >= :dateFrom', { dateFrom })
      .andWhere('transaction.transactionDate <= :dateTo', { dateTo });

    // Apply filters
    if (dto.categoryId) {
      queryBuilder.andWhere('transaction.categoryId = :categoryId', { categoryId: dto.categoryId });
    }
    if (dto.branchId) {
      queryBuilder.andWhere('transaction.branchId = :branchId', { branchId: dto.branchId });
    }
    if (dto.walletId) {
      queryBuilder.andWhere('transaction.walletId = :walletId', { walletId: dto.walletId });
    }

    const transactions = redactPrivateRows(await queryBuilder.getMany(), viewerMemberId);

    // Group transactions
    const groupMap = new Map<string, CustomReportGroup>();
    const groupBy = dto.groupBy || ReportGroupBy.DAY;

    transactions.forEach(t => {
      let key: string;
      let label: string;

      switch (groupBy) {
        case ReportGroupBy.CATEGORY:
          key = t.categoryId || 'uncategorized';
          label = t.category?.name || UNCATEGORIZED_CATEGORY_NAME;
          break;
        case ReportGroupBy.COUNTERPARTY:
          key = t.counterpartyName;
          label = t.counterpartyName;
          break;
        case ReportGroupBy.BRANCH:
          key = t.branchId || 'unassigned';
          label = t.branch?.name || 'Не назначен';
          break;
        case ReportGroupBy.WALLET:
          key = t.walletId || 'unassigned';
          label = t.wallet?.name || 'Не назначен';
          break;
        case ReportGroupBy.DAY: {
          key = dayOf(t.transactionDate);
          const [year, month, day] = key.split('-');
          label = `${day}.${month}.${year}`;
          break;
        }
        case ReportGroupBy.MONTH: {
          const [year, month] = dayOf(t.transactionDate).split('-');
          key = `${year}-${month}`;
          label = `${month}.${year}`;
          break;
        }
        default:
          key = 'all';
          label = 'Все';
      }

      const existing = groupMap.get(key) || {
        key,
        label,
        totalAmount: 0,
        transactionCount: 0,
        transactions: [],
      };

      existing.totalAmount += Number(t.amount ?? 0);
      existing.transactionCount += 1;
      existing.transactions.push({
        id: t.id,
        date: dayOf(t.transactionDate),
        counterparty: t.counterpartyName,
        amount: Number(t.amount ?? 0),
        category: t.category?.name,
        branch: t.branch?.name,
        wallet: t.wallet?.name,
      });

      groupMap.set(key, existing);
    });

    const groups = Array.from(groupMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    const totalIncome = transactions
      .filter(t => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const totalExpense = transactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    const report: CustomReport = {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      groupBy,
      groups,
      summary: {
        totalIncome,
        totalExpense,
        difference: totalIncome - totalExpense,
        transactionCount: transactions.length,
      },
    };

    // Log to audit
    await this.logReportGeneration(workspaceId, 'custom', `${dto.dateFrom}_${dto.dateTo}`);

    return report;
  }

  /**
   * Export report to Excel or CSV
   */
  async exportReport(
    workspaceId: string,
    dto: ExportReportBody,
    reportData: DailyReport | MonthlyReport | CustomReport,
    locale?: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `report-${timestamp}.${dto.format === ExportFormat.EXCEL ? 'xlsx' : 'csv'}`;
    const filePath = path.join(this.resolveReportsDir(workspaceId), `${randomUUID()}-${fileName}`);

    if (dto.format === ExportFormat.EXCEL) {
      await this.exportToExcel(reportData, filePath, locale);
    } else {
      await this.exportToCSV(reportData, filePath, locale);
    }

    return { filePath, fileName };
  }

  async exportWorkspaceTransactions(
    workspaceId: string,
    format: WorkspaceExportFormat,
    viewerMemberId: string | null = null,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    // A list of rows, not a figure: every confirmed row goes out, crypto moves
    // included — another member's private ones as the list shows them.
    const transactions = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.transferPairId IS NULL')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .getMany();
    redactPrivateRows(transactions, viewerMemberId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extensionMap: Record<WorkspaceExportFormat, string> = {
      [WorkspaceExportFormat.EXCEL]: 'xlsx',
      [WorkspaceExportFormat.PDF]: 'pdf',
      [WorkspaceExportFormat.CSV]: 'csv',
      [WorkspaceExportFormat.DOCX]: 'docx',
    };
    const mimeTypeMap: Record<WorkspaceExportFormat, string> = {
      [WorkspaceExportFormat.EXCEL]:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [WorkspaceExportFormat.PDF]: 'application/pdf',
      [WorkspaceExportFormat.CSV]: 'text/csv',
      [WorkspaceExportFormat.DOCX]:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const normalizedFormat = format || WorkspaceExportFormat.EXCEL;
    const fileName = `workspace-transactions-${timestamp}.${extensionMap[normalizedFormat]}`;
    const filePath = path.join(this.resolveReportsDir(workspaceId), `${randomUUID()}-${fileName}`);

    if (normalizedFormat === WorkspaceExportFormat.EXCEL) {
      await this.generateWorkspaceExcel(transactions, filePath);
    } else if (normalizedFormat === WorkspaceExportFormat.CSV) {
      await this.generateWorkspaceCsv(transactions, filePath);
    } else if (normalizedFormat === WorkspaceExportFormat.PDF) {
      await this.generateWorkspacePdf(transactions, filePath);
    } else {
      await this.generateWorkspaceDocx(transactions, filePath);
    }

    await this.logReportGeneration(workspaceId, 'workspace-transactions', 'all-time');

    return {
      filePath,
      fileName,
      mimeType: mimeTypeMap[normalizedFormat],
    };
  }

  private mapWorkspaceTransactionRows(
    transactions: Transaction[],
  ): WorkspaceTransactionExportRow[] {
    return transactions.map((transaction, index) => ({
      index: index + 1,
      transactionDate: transaction.transactionDate
        ? this.toDateKey(transaction.transactionDate as unknown as Date)
        : '',
      transactionType: transaction.transactionType === TransactionType.INCOME ? 'Приход' : 'Расход',
      // Free-text fields come from parsed statements, receipt OCR and email import, so
      // a value starting with = + - @ would execute as a formula when the CSV or
      // XLSX is opened. Control fields below are ours and stay untouched so the
      // summary can still match on them.
      counterpartyName: neutralize(transaction.counterpartyName),
      counterpartyBin: neutralize(transaction.counterpartyBin),
      paymentPurpose: neutralize(transaction.paymentPurpose),
      debit: transaction.debit != null ? Number(transaction.debit) : null,
      credit: transaction.credit != null ? Number(transaction.credit) : null,
      amount: transaction.amount != null ? Number(transaction.amount) : null,
      currency: currencyCodeOrDefault(transaction.currency),
      category: neutralize(transaction.category?.name) || UNCATEGORIZED_CATEGORY_NAME,
      branch: neutralize(transaction.branch?.name),
      wallet: neutralize(transaction.wallet?.name),
      documentNumber: neutralize(transaction.documentNumber),
      comments: neutralize(transaction.comments),
    }));
  }

  private buildWorkspaceSummaryRows(rows: WorkspaceTransactionExportRow[]) {
    const totalIncome = rows.reduce((sum, row) => sum + (row.credit || 0), 0);
    const totalExpense = rows.reduce((sum, row) => sum + (row.debit || 0), 0);
    const incomeCount = rows.filter(row => row.transactionType === 'Приход').length;
    const expenseCount = rows.filter(row => row.transactionType === 'Расход').length;

    return [
      { Показатель: 'Всего транзакций', Значение: rows.length },
      { Показатель: 'Приходы', Значение: incomeCount },
      { Показатель: 'Расходы', Значение: expenseCount },
      { Показатель: 'Сумма приходов', Значение: totalIncome },
      { Показатель: 'Сумма расходов', Значение: totalExpense },
      { Показатель: 'Баланс', Значение: totalIncome - totalExpense },
    ];
  }

  private formatWorkspaceAmount(value: number | null): string {
    return formatMoney(value);
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  private async generateWorkspaceExcel(
    transactions: Transaction[],
    filePath: string,
  ): Promise<void> {
    const workbook = xlsx.utils.book_new();
    const rows = this.mapWorkspaceTransactionRows(transactions);
    const transactionSheet = xlsx.utils.json_to_sheet(
      rows.map(row => ({
        '№': row.index,
        Дата: row.transactionDate,
        Тип: row.transactionType,
        Контрагент: row.counterpartyName,
        'БИН/ИИН': row.counterpartyBin,
        'Назначение платежа': row.paymentPurpose,
        Дебет: row.debit,
        Кредит: row.credit,
        Сумма: row.amount,
        Валюта: row.currency,
        Категория: row.category,
        Филиал: row.branch,
        Кошелек: row.wallet,
        '№ документа': row.documentNumber,
        Комментарий: row.comments,
      })),
    );

    transactionSheet['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 10 },
      { wch: 28 },
      { wch: 16 },
      { wch: 48 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
    ];

    const summarySheet = xlsx.utils.json_to_sheet(this.buildWorkspaceSummaryRows(rows));
    summarySheet['!cols'] = [{ wch: 24 }, { wch: 18 }];

    xlsx.utils.book_append_sheet(workbook, transactionSheet, 'Транзакции');
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

    xlsx.writeFile(workbook, filePath);
  }

  private async generateWorkspaceCsv(transactions: Transaction[], filePath: string): Promise<void> {
    const rows = this.mapWorkspaceTransactionRows(transactions);
    const headers = [
      '№',
      'Дата',
      'Тип',
      'Контрагент',
      'БИН/ИИН',
      'Назначение платежа',
      'Дебет',
      'Кредит',
      'Сумма',
      'Валюта',
      'Категория',
      'Филиал',
      'Кошелек',
      '№ документа',
      'Комментарий',
    ];

    const csvLines = [
      headers.join(','),
      ...rows.map(row =>
        [
          String(row.index),
          row.transactionDate,
          row.transactionType,
          row.counterpartyName,
          row.counterpartyBin,
          row.paymentPurpose,
          row.debit == null ? '' : String(row.debit),
          row.credit == null ? '' : String(row.credit),
          row.amount == null ? '' : String(row.amount),
          row.currency,
          row.category,
          row.branch,
          row.wallet,
          row.documentNumber,
          row.comments,
        ]
          .map(value => this.escapeCsvValue(value))
          .join(','),
      ),
    ];

    fs.writeFileSync(filePath, `\uFEFF${csvLines.join('\n')}`, 'utf-8');
  }

  private async generateWorkspacePdf(transactions: Transaction[], filePath: string): Promise<void> {
    const rows = this.mapWorkspaceTransactionRows(transactions);
    const summaryRows = this.buildWorkspaceSummaryRows(rows);
    const pdfMake = await loadPdfMake();

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 24, 20, 24],
      content: [
        { text: 'Отчет по транзакциям workspace', style: 'title' },
        {
          columns: summaryRows.map(row => ({
            stack: [
              { text: String(row.Показатель), style: 'summaryLabel' },
              { text: String(row.Значение), style: 'summaryValue' },
            ],
          })),
          columnGap: 12,
          margin: [0, 0, 0, 16],
        },
        {
          table: {
            headerRows: 1,
            widths: [24, 56, 50, '*', 64, 80],
            body: [
              ['№', 'Дата', 'Тип', 'Контрагент', 'Сумма', 'Категория'],
              ...rows.map(row => [
                String(row.index),
                row.transactionDate,
                row.transactionType,
                row.counterpartyName,
                this.formatWorkspaceAmount(row.amount),
                row.category,
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        title: { bold: true, fontSize: 16, margin: [0, 0, 0, 12] },
        summaryLabel: { fontSize: 9, color: '#6b7280' },
        summaryValue: { fontSize: 11, bold: true },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 8,
      },
    };

    await new Promise<void>(resolve => {
      pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
        fs.writeFileSync(filePath, Buffer.from(buffer));
        resolve();
      });
    });
  }

  private async generateWorkspaceDocx(
    transactions: Transaction[],
    filePath: string,
  ): Promise<void> {
    const rows = this.mapWorkspaceTransactionRows(transactions);
    const summaryRows = this.buildWorkspaceSummaryRows(rows);
    const docxModule = await import('docx');
    const {
      Document,
      HeadingLevel,
      Packer,
      Paragraph,
      Table,
      TableCell,
      TableRow,
      TextRun,
      WidthType,
    } = docxModule;

    const createCell = (text: string, bold = false) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text,
                bold,
                size: 18,
              }),
            ],
          }),
        ],
      });

    const summaryParagraph = new Paragraph({
      children: summaryRows.flatMap((row, index) => {
        const parts = [
          new TextRun({ text: `${row.Показатель}: `, bold: true, size: 20 }),
          new TextRun({ text: String(row.Значение), size: 20 }),
        ];

        if (index < summaryRows.length - 1) {
          parts.push(new TextRun({ text: '   ', size: 20 }));
        }

        return parts;
      }),
      spacing: { after: 240 },
    });

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            createCell('№', true),
            createCell('Дата', true),
            createCell('Тип', true),
            createCell('Контрагент', true),
            createCell('Сумма', true),
            createCell('Категория', true),
          ],
        }),
        ...rows.map(
          row =>
            new TableRow({
              children: [
                createCell(String(row.index)),
                createCell(row.transactionDate),
                createCell(row.transactionType),
                createCell(row.counterpartyName),
                createCell(this.formatWorkspaceAmount(row.amount)),
                createCell(row.category),
              ],
            }),
        ),
      ],
    });

    const document = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: 'landscape',
              },
            },
          },
          children: [
            new Paragraph({
              text: 'Отчет по транзакциям workspace',
              heading: HeadingLevel.HEADING_1,
            }),
            summaryParagraph,
            table,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);
    fs.writeFileSync(filePath, buffer);
  }

  private async exportToExcel(
    reportData: DailyReport | MonthlyReport | CustomReport,
    filePath: string,
    locale?: string,
  ): Promise<void> {
    const workbook = xlsx.utils.book_new();

    const L = renderReportLabels(locale);

    if ('date' in reportData) {
      // Daily report
      const dailyData = reportData as DailyReport;
      const ws = xlsx.utils.aoa_to_sheet([
        [L.type, L.amount, L.count],
        [L.income, dailyData.income.totalAmount, dailyData.income.transactionCount],
        [L.expense, dailyData.expense.totalAmount, dailyData.expense.transactionCount],
        [L.difference, dailyData.summary.difference],
      ]);
      xlsx.utils.book_append_sheet(workbook, ws, L.sheetReport);
    } else if ('month' in reportData) {
      // Monthly report
      const monthlyData = reportData as MonthlyReport;
      const ws = xlsx.utils.aoa_to_sheet([
        [L.date, L.income, L.expense],
        ...monthlyData.dailyTrends.map(trend => [trend.date, trend.income, trend.expense]),
      ]);
      xlsx.utils.book_append_sheet(workbook, ws, L.sheetTrends);
    } else {
      // Custom report
      const customData = reportData as CustomReport;
      const rows: CustomReportExportRow[] = [];
      customData.groups.forEach(group => {
        group.transactions.forEach(t => {
          rows.push({
            group: group.label,
            date: t.date,
            counterparty: t.counterparty,
            amount: t.amount,
            category: t.category || '',
            branch: t.branch || '',
            wallet: t.wallet || '',
          });
        });
      });
      const ws = xlsx.utils.aoa_to_sheet([
        [L.group, L.date, L.counterparty, L.amount, L.category, L.branch, L.wallet],
        ...rows.map(r => [
          r.group,
          r.date,
          r.counterparty,
          r.amount,
          r.category,
          r.branch,
          r.wallet,
        ]),
      ]);
      xlsx.utils.book_append_sheet(workbook, ws, L.sheetReport);
    }

    xlsx.writeFile(workbook, filePath);
  }

  private async exportToCSV(
    reportData: DailyReport | MonthlyReport | CustomReport,
    filePath: string,
    locale?: string,
  ): Promise<void> {
    let csvContent = '';
    const L = renderReportLabels(locale);

    if ('date' in reportData) {
      // Daily report
      const dailyData = reportData as DailyReport;
      csvContent = `${L.type},${L.amount},${L.count}\n`;
      csvContent += `${L.income},${dailyData.income.totalAmount},${dailyData.income.transactionCount}\n`;
      csvContent += `${L.expense},${dailyData.expense.totalAmount},${dailyData.expense.transactionCount}\n`;
      csvContent += `${L.difference},${dailyData.summary.difference},\n`;
    } else if ('month' in reportData) {
      // Monthly report
      const monthlyData = reportData as MonthlyReport;
      csvContent = `${L.date},${L.income},${L.expense}\n`;
      monthlyData.dailyTrends.forEach(trend => {
        csvContent += `${trend.date},${trend.income},${trend.expense}\n`;
      });
    } else {
      // Custom report
      const customData = reportData as CustomReport;
      csvContent = `${L.group},${L.date},${L.counterparty},${L.amount},${L.category},${L.branch},${L.wallet}\n`;
      customData.groups.forEach(group => {
        group.transactions.forEach(t => {
          csvContent += `${group.label},${t.date},${t.counterparty},${t.amount},${t.category || ''},${t.branch || ''},${t.wallet || ''}\n`;
        });
      });
    }

    fs.writeFileSync(filePath, csvContent, 'utf-8');
  }

  /**
   * Log report generation to audit log
   */
  private async logReportGeneration(
    workspaceId: string,
    reportType: string,
    reportDate: string,
  ): Promise<void> {
    // Audit: record report exports for traceability.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.SYSTEM,
      actorId: null,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.EXPORT,
      meta: {
        reportType,
        reportDate,
      },
    });
  }

  async getStatementsSummary(
    workspaceId: string,
    days = 30,
    viewerMemberId: string | null = null,
  ): Promise<StatementsSummaryResponse> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : 30;
    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const transactions = await this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .andWhere('transaction.transactionDate >= :since', { since })
      .orderBy('transaction.updatedAt', 'DESC')
      .take(2000)
      .getMany();
    redactPrivateRows(transactions, viewerMemberId);

    const totals = { income: 0, expense: 0, net: 0, rows: transactions.length };
    const timeseriesMap = new Map<string, { income: number; expense: number }>();
    const categoryMap = new Map<string, { amount: number; rows: number }>();
    const counterpartyMap = new Map<string, { amount: number; rows: number }>();

    const recent = transactions
      .slice(0, 50)
      .map(t => {
        const amount = Number(t.amount || 0);
        const abs = Math.abs(amount);
        const signedAmount = t.transactionType === TransactionType.INCOME ? abs : -abs;
        return {
          id: t.id,
          amount: signedAmount,
          category: t.category?.name || null,
          counterparty: t.counterpartyName || null,
          updatedAt: (t.updatedAt || t.createdAt).toISOString(),
        };
      })
      .slice(0, 20);

    transactions.forEach(t => {
      const amount = Number(t.amount || 0);
      const abs = Math.abs(amount);
      const dateKey = this.toDateKey(t.transactionDate);
      const ts = timeseriesMap.get(dateKey) || { income: 0, expense: 0 };

      if (t.transactionType === TransactionType.INCOME) {
        ts.income += abs;
        const counterparty = (t.counterpartyName || 'Без названия').trim() || 'Без названия';
        const existing = counterpartyMap.get(counterparty) || { amount: 0, rows: 0 };
        counterpartyMap.set(counterparty, {
          amount: existing.amount + abs,
          rows: existing.rows + 1,
        });
        totals.income += abs;
      } else {
        ts.expense += abs;
        const category =
          (t.category?.name || UNCATEGORIZED_CATEGORY_NAME).trim() || UNCATEGORIZED_CATEGORY_NAME;
        const existing = categoryMap.get(category) || { amount: 0, rows: 0 };
        categoryMap.set(category, { amount: existing.amount + abs, rows: existing.rows + 1 });
        totals.expense += abs;
      }

      timeseriesMap.set(dateKey, ts);
    });

    totals.net = totals.income - totals.expense;

    const timeseries = Array.from(timeseriesMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, amount: data.amount, rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const counterparties = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, amount: data.amount, rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return { totals, timeseries, categories, counterparties, recent };
  }

  async getTopCategoriesReport(
    workspaceId: string,
    query: TopCategoriesQuery,
    selfMemberId: string | null = null,
  ): Promise<TopCategoriesReport> {
    const safeLimit = Number.isFinite(query.limit)
      ? Math.min(Math.max(query.limit || 20, 1), 100)
      : 20;
    const now = new Date();
    const to = query.dateTo ? new Date(query.dateTo) : now;
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(new Date(to).setDate(to.getDate() - 30));

    const qb = this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.statement', 'statement')
      .andWhere('transaction.transactionDate >= :from', { from })
      .andWhere('transaction.transactionDate <= :to', { to });

    if (query.type === 'income') {
      qb.andWhere('transaction.transactionType = :transactionType', {
        transactionType: TransactionType.INCOME,
      });
    } else if (query.type === 'expense') {
      qb.andWhere('transaction.transactionType = :transactionType', {
        transactionType: TransactionType.EXPENSE,
      });
    }

    if (query.bankName) {
      qb.andWhere('statement.bankName = :bankName', { bankName: query.bankName });
    }

    applyOwnerFilter(qb, 'transaction', parseOwnerFilter(query.owner, selfMemberId));

    if (query.counterparties) {
      const counterparties = query.counterparties
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (counterparties.length > 0) {
        // Matched as the viewer reads it: a merchant filter must not answer
        // yes or no about another member's private row.
        qb.andWhere(
          `${redactedSql('transaction', 'transaction.counterparty_name')} IN (:...counterparties)`,
          { counterparties, [PRIVACY_VIEWER_PARAM]: selfMemberId },
        );
      }
    }

    if (query.statuses) {
      const statuses = query.statuses
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        qb.andWhere('statement.status IN (:...statuses)', { statuses });
      }
    }

    if (query.keywords) {
      const keyword = `%${query.keywords.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(${redactedSql('transaction', 'transaction.counterparty_name')}) LIKE :keyword OR LOWER(${redactedSql('transaction', 'transaction.payment_purpose')}) LIKE :keyword OR LOWER(statement.fileName) LIKE :keyword OR LOWER(CAST(statement.bankName AS text)) LIKE :keyword)`,
        { keyword, [PRIVACY_VIEWER_PARAM]: selfMemberId },
      );
    }

    if (Number.isFinite(query.amountMin)) {
      qb.andWhere('ABS(COALESCE(transaction.amount, 0)) >= :amountMin', {
        amountMin: query.amountMin,
      });
    }

    if (Number.isFinite(query.amountMax)) {
      qb.andWhere('ABS(COALESCE(transaction.amount, 0)) <= :amountMax', {
        amountMax: query.amountMax,
      });
    }

    if (query.currencies) {
      const currencies = query.currencies
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (currencies.length > 0) {
        qb.andWhere('transaction.currency IN (:...currencies)', { currencies });
      }
    }

    if (typeof query.billable === 'boolean') {
      if (query.billable) {
        qb.andWhere('ABS(COALESCE(transaction.amount, 0)) > 0');
      } else {
        qb.andWhere('ABS(COALESCE(transaction.amount, 0)) <= 0');
      }
    }

    if (typeof query.approved === 'boolean') {
      if (query.approved) {
        qb.andWhere('statement.status IN (:...approvedStatuses)', {
          approvedStatuses: ['validated', 'completed', 'parsed'],
        });
      } else {
        qb.andWhere('statement.status IN (:...notApprovedStatuses)', {
          notApprovedStatuses: ['uploaded', 'processing', 'error'],
        });
      }
    }

    if (query.has) {
      const hasTokens = query.has
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (hasTokens.includes('errors')) {
        qb.andWhere('(statement.status = :errorStatus OR statement.errorMessage IS NOT NULL)', {
          errorStatus: 'error',
        });
      }
      if (hasTokens.includes('transactions')) {
        qb.andWhere('COALESCE(statement.totalTransactions, 0) > 0');
      }
      if (hasTokens.includes('dateRange')) {
        qb.andWhere(
          '(statement.statementDateFrom IS NOT NULL OR statement.statementDateTo IS NOT NULL)',
        );
      }
      if (hasTokens.includes('currency')) {
        qb.andWhere('statement.currency IS NOT NULL');
      }
    }

    const transactions = redactPrivateRows(
      await qb.orderBy('transaction.updatedAt', 'DESC').take(5000).getMany(),
      selfMemberId,
    );

    const totals = {
      income: 0,
      expense: 0,
      net: 0,
      transactions: transactions.length,
    };

    const categoryMap = new Map<
      string,
      {
        id: string | null;
        name: string;
        amount: number;
        transactions: number;
        type: TransactionType;
        color?: string | null;
        icon?: string | null;
      }
    >();
    const bankMap = new Map<string, { bankName: string; amount: number; statements: number }>();
    const counterpartyMap = new Map<
      string,
      {
        name: string;
        amount: number;
        transactions: number;
        type: TransactionType;
      }
    >();

    transactions.forEach(transaction => {
      const amount = Math.abs(Number(transaction.amount || 0));
      if (!amount) {
        return;
      }

      if (transaction.transactionType === TransactionType.INCOME) {
        totals.income += amount;
      } else {
        totals.expense += amount;
      }

      const categoryKey = transaction.category?.id || 'without-category';
      const categoryName =
        (transaction.category?.name || UNCATEGORIZED_CATEGORY_NAME).trim() ||
        UNCATEGORIZED_CATEGORY_NAME;
      const categoryCurrent = categoryMap.get(categoryKey) || {
        id: transaction.category?.id || null,
        name: categoryName,
        amount: 0,
        transactions: 0,
        type: transaction.transactionType,
        color: transaction.category?.color,
        icon: transaction.category?.icon,
      };
      categoryCurrent.amount += amount;
      categoryCurrent.transactions += 1;
      categoryMap.set(categoryKey, categoryCurrent);

      const bankName = (transaction.statement?.bankName || 'Unknown').trim() || 'Unknown';
      const bankCurrent = bankMap.get(bankName) || {
        bankName,
        amount: 0,
        statements: 0,
      };
      bankCurrent.amount += amount;
      bankCurrent.statements += 1;
      bankMap.set(bankName, bankCurrent);

      const counterpartyName =
        (transaction.counterpartyName || 'Без названия').trim() || 'Без названия';
      const counterpartyCurrent = counterpartyMap.get(counterpartyName) || {
        name: counterpartyName,
        amount: 0,
        transactions: 0,
        type: transaction.transactionType,
      };
      counterpartyCurrent.amount += amount;
      counterpartyCurrent.transactions += 1;
      counterpartyMap.set(counterpartyName, counterpartyCurrent);
    });

    totals.net = totals.income - totals.expense;

    const totalFlow = totals.income + totals.expense;
    const categories = Array.from(categoryMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, safeLimit)
      .map(item => ({
        ...item,
        percentage: totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(2)) : 0,
      }));

    const banks = Array.from(bankMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, safeLimit)
      .map(item => ({
        ...item,
        percentage: totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(2)) : 0,
      }));

    const counterparties = Array.from(counterpartyMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, safeLimit)
      .map(item => ({
        ...item,
        percentage: totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(2)) : 0,
      }));

    return {
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
      totals,
      categories,
      banks,
      counterparties,
    };
  }

  async getSpendOverTimeReport(
    workspaceId: string,
    query: SpendOverTimeQuery,
    selfMemberId: string | null = null,
  ): Promise<{
    groupBy: string;
    dateFrom: string;
    dateTo: string;
    points: Array<{
      period: string;
      label: string;
      income: number;
      expense: number;
      net: number;
      count: number;
    }>;
    totals: {
      income: number;
      expense: number;
      net: number;
      count: number;
      avgPerPeriod: number;
    };
  }> {
    const now = new Date();
    const endDate = query.dateTo ? new Date(query.dateTo) : now;
    const startDate = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(new Date(endDate).setDate(endDate.getDate() - 30));
    const groupBy = query.groupBy || 'day';

    const from = this.toStartOfUtcDay(startDate);
    const to = this.toEndOfUtcDay(endDate);

    const qb = this.countedTransactions(workspaceId)
      // Rows without a statement (cash, approved receipts) are spending too.
      .leftJoin('transaction.statement', 'statement')
      .leftJoin('transaction.category', 'category')
      .andWhere('transaction.transactionDate >= :from', { from })
      .andWhere('transaction.transactionDate <= :to', { to });

    if (query.type === 'income') {
      qb.andWhere('transaction.transactionType = :transactionType', {
        transactionType: TransactionType.INCOME,
      });
    } else if (query.type === 'expense') {
      qb.andWhere('transaction.transactionType = :transactionType', {
        transactionType: TransactionType.EXPENSE,
      });
    }

    if (query.bankName) {
      qb.andWhere('statement.bankName = :bankName', { bankName: query.bankName });
    }

    applyOwnerFilter(qb, 'transaction', parseOwnerFilter(query.owner, selfMemberId));

    if (query.counterparties) {
      const counterparties = query.counterparties
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (counterparties.length > 0) {
        // Matched as the viewer reads it: a merchant filter must not answer
        // yes or no about another member's private row.
        qb.andWhere(
          `${redactedSql('transaction', 'transaction.counterparty_name')} IN (:...counterparties)`,
          { counterparties, [PRIVACY_VIEWER_PARAM]: selfMemberId },
        );
      }
    }

    if (query.statuses) {
      const statuses = query.statuses
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        qb.andWhere('statement.status IN (:...statuses)', { statuses });
      }
    }

    if (query.keywords) {
      const keyword = `%${query.keywords.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(${redactedSql('transaction', 'transaction.counterparty_name')}) LIKE :keyword OR LOWER(${redactedSql('transaction', 'transaction.payment_purpose')}) LIKE :keyword OR LOWER(statement.fileName) LIKE :keyword OR LOWER(CAST(statement.bankName AS text)) LIKE :keyword)`,
        { keyword, [PRIVACY_VIEWER_PARAM]: selfMemberId },
      );
    }

    if (Number.isFinite(query.amountMin)) {
      qb.andWhere('ABS(COALESCE(transaction.amount, 0)) >= :amountMin', {
        amountMin: query.amountMin,
      });
    }

    if (Number.isFinite(query.amountMax)) {
      qb.andWhere('ABS(COALESCE(transaction.amount, 0)) <= :amountMax', {
        amountMax: query.amountMax,
      });
    }

    if (query.currencies) {
      const currencies = query.currencies
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (currencies.length > 0) {
        qb.andWhere('transaction.currency IN (:...currencies)', { currencies });
      }
    }

    if (typeof query.billable === 'boolean') {
      if (query.billable) {
        qb.andWhere('ABS(COALESCE(transaction.amount, 0)) > 0');
      } else {
        qb.andWhere('ABS(COALESCE(transaction.amount, 0)) <= 0');
      }
    }

    if (typeof query.approved === 'boolean') {
      if (query.approved) {
        qb.andWhere('statement.status IN (:...approvedStatuses)', {
          approvedStatuses: ['validated', 'completed', 'parsed'],
        });
      } else {
        qb.andWhere('statement.status IN (:...notApprovedStatuses)', {
          notApprovedStatuses: ['uploaded', 'processing', 'error'],
        });
      }
    }

    if (typeof query.exported === 'boolean') {
      if (query.exported) {
        qb.andWhere('statement.processedAt IS NOT NULL');
      } else {
        qb.andWhere('statement.processedAt IS NULL');
      }
    }

    if (typeof query.paid === 'boolean') {
      if (query.paid) {
        qb.andWhere('statement.statementDateTo IS NOT NULL');
      } else {
        qb.andWhere('statement.statementDateTo IS NULL');
      }
    }

    const dayPeriodExpr = "TO_CHAR(transaction.transactionDate, 'YYYY-MM-DD')";
    const monthPeriodExpr = "TO_CHAR(transaction.transactionDate, 'YYYY-MM')";
    const weekPeriodExpr =
      "TO_CHAR(transaction.transactionDate, 'IYYY') || '-W' || TO_CHAR(transaction.transactionDate, 'IW')";
    const quarterPeriodExpr =
      "TO_CHAR(transaction.transactionDate, 'YYYY') || '-Q' || TO_CHAR(transaction.transactionDate, 'Q')";
    const yearPeriodExpr = "TO_CHAR(transaction.transactionDate, 'YYYY')";

    const periodExpr =
      groupBy === 'year'
        ? yearPeriodExpr
        : groupBy === 'quarter'
          ? quarterPeriodExpr
          : groupBy === 'month'
            ? monthPeriodExpr
            : groupBy === 'week'
              ? weekPeriodExpr
              : dayPeriodExpr;

    const rows = await qb
      .select(`${periodExpr}`, 'period')
      .addSelect(
        `SUM(CASE WHEN transaction.transactionType = '${TransactionType.INCOME}' THEN ABS(COALESCE(transaction.amount, 0)) ELSE 0 END)`,
        'income',
      )
      .addSelect(
        `SUM(CASE WHEN transaction.transactionType = '${TransactionType.EXPENSE}' THEN ABS(COALESCE(transaction.amount, 0)) ELSE 0 END)`,
        'expense',
      )
      .addSelect('COUNT(transaction.id)', 'count')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; income: string; expense: string; count: string }>();

    const valuesByPeriod = new Map<string, { income: number; expense: number; count: number }>();
    for (const row of rows) {
      valuesByPeriod.set(row.period, {
        income: Number(row.income || 0),
        expense: Number(row.expense || 0),
        count: Number(row.count || 0),
      });
    }

    const points: Array<{
      period: string;
      label: string;
      income: number;
      expense: number;
      net: number;
      count: number;
    }> = [];

    const cursor = this.toStartOfUtcDay(from);
    const endCursor = this.toStartOfUtcDay(to);
    const totals = { income: 0, expense: 0, net: 0, count: 0 };

    while (cursor <= endCursor) {
      let period = '';
      let label = '';

      if (groupBy === 'month') {
        period = this.formatMonthPeriod(cursor);
        label = this.formatMonthLabel(cursor);
      } else if (groupBy === 'quarter') {
        const year = cursor.getUTCFullYear();
        const quarter = Math.floor(cursor.getUTCMonth() / 3) + 1;
        period = `${year}-Q${quarter}`;
        label = `Q${quarter} ${year}`;
      } else if (groupBy === 'year') {
        period = `${cursor.getUTCFullYear()}`;
        label = period;
      } else if (groupBy === 'week') {
        const { year, week } = this.getIsoWeekInfo(cursor);
        const weekString = `${week}`.padStart(2, '0');
        period = `${year}-W${weekString}`;
        label = `Week ${weekString}`;
      } else {
        period = this.toDateKey(cursor);
        label = period;
      }

      const current = valuesByPeriod.get(period) || { income: 0, expense: 0, count: 0 };
      const net = current.income - current.expense;
      points.push({
        period,
        label,
        income: current.income,
        expense: current.expense,
        net,
        count: current.count,
      });

      totals.income += current.income;
      totals.expense += current.expense;
      totals.net += net;
      totals.count += current.count;

      if (groupBy === 'month') {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
      } else if (groupBy === 'quarter') {
        cursor.setUTCMonth(cursor.getUTCMonth() + 3, 1);
      } else if (groupBy === 'year') {
        cursor.setUTCFullYear(cursor.getUTCFullYear() + 1, 0, 1);
      } else if (groupBy === 'week') {
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      cursor.setUTCHours(0, 0, 0, 0);
    }

    const avgPerPeriod = points.length ? totals.net / points.length : 0;

    return {
      groupBy,
      dateFrom: from.toISOString().split('T')[0],
      dateTo: to.toISOString().split('T')[0],
      points,
      totals: {
        income: totals.income,
        expense: totals.expense,
        net: totals.net,
        count: totals.count,
        avgPerPeriod,
      },
    };
  }

  /** Display names persisted on report history rows. */
  private static readonly TEMPLATE_NAMES: Record<string, string> = {
    pnl: 'Profit & Loss (P&L)',
    'cash-flow': 'Cash Flow Statement',
    'expense-by-category': 'Expense by Category',
    'balance-sheet': 'Balance Sheet',
    'transaction-register': 'Transaction Register',
    'monthly-summary': 'Monthly Summary',
    'category-by-month': 'Categories by Month',
    'budget-vs-actual': 'Budget vs Actual',
    'investment-holdings': 'Investment Holdings',
  };

  /**
   * A month per column: past a year a PDF page cannot hold the table legibly,
   * and past three years a spreadsheet is the wrong place to read it too.
   */
  private static readonly MAX_MONTHS = { pdf: 12, other: 36 };

  /** The formats each template can be written in; the Balance Sheet has no CSV renderer. */
  private static readonly TEMPLATE_FORMATS: Record<string, readonly ReportFileFormat[]> = {
    'balance-sheet': ['pdf', 'excel'],
  };

  /**
   * Rejects a template or format the generator cannot produce. Schedules call
   * this when they are created, so a bad pair fails at once rather than on
   * its first run days later.
   */
  static assertTemplateFormat(templateId: string, format: string): void {
    if (!ReportsService.TEMPLATE_NAMES[templateId]) {
      throw new BadRequestException(`Unknown template: ${templateId}`);
    }
    const formats = ReportsService.TEMPLATE_FORMATS[templateId] ?? ['pdf', 'excel', 'csv'];
    if (!formats.includes(format as ReportFileFormat)) {
      throw new BadRequestException(
        `${ReportsService.TEMPLATE_NAMES[templateId]} supports only ${formats.join(' and ')}`,
      );
    }
  }

  /**
   * Generated reports live under uploads/ rather than the OS temp dir, because
   * report history rows keep pointing at them long after the download stream ends.
   * One directory per workspace, and every writer adds a random prefix to the
   * file: a name built from a template id and dates alone was shared by every
   * workspace, so one workspace's run overwrote the file another's history served.
   */
  private reportsDirOf(workspaceId: string): string {
    return path.join(resolveUploadsDir(), 'reports', workspaceId);
  }

  private resolveReportsDir(workspaceId: string): string {
    const dir = this.reportsDirOf(workspaceId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async generateFromTemplate(
    workspaceId: string,
    userId: string,
    dto: GenerateReportBody,
  ): Promise<ReportFile> {
    ReportsService.assertTemplateFormat(dto.templateId, dto.format);
    const templateName = ReportsService.TEMPLATE_NAMES[dto.templateId];

    const baseName = `${dto.templateId}-${dto.dateFrom}-${dto.dateTo}`;
    const file =
      dto.templateId === 'balance-sheet'
        ? await this.writeBalanceSheetFile(workspaceId, dto, baseName)
        : await writeReportFile(
            await this.buildTemplateDocument(workspaceId, dto),
            dto.format as ReportFileFormat,
            baseName,
            this.resolveReportsDir(workspaceId),
          );

    await this.reportHistoryRepo.save({
      workspaceId,
      userId,
      templateId: dto.templateId,
      templateName,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      format: dto.format,
      fileName: file.fileName,
      filePath: file.filePath,
      fileSize: fs.statSync(file.filePath).size,
    });

    return file;
  }

  /**
   * The document behind a report, without writing a file. Costs one query, so the
   * generator can show what it is about to download.
   */
  async previewTemplate(
    workspaceId: string,
    dto: GenerateReportBody,
    maxRowsPerSection = 20,
  ): Promise<ReportDocument & { truncated: boolean }> {
    if (!ReportsService.TEMPLATE_NAMES[dto.templateId]) {
      throw new BadRequestException(`Unknown template: ${dto.templateId}`);
    }
    if (dto.templateId === 'balance-sheet') {
      throw new BadRequestException('Balance Sheet has its own on-screen view');
    }

    const document = await this.buildTemplateDocument(workspaceId, dto);
    const truncated = document.sections.some(section => section.rows.length > maxRowsPerSection);

    return {
      ...document,
      truncated,
      sections: document.sections.map(section => ({
        ...section,
        rows: section.rows.slice(0, maxRowsPerSection),
      })),
    };
  }

  /**
   * Balance Sheet reuses BalanceService's own renderers, which localize account
   * names from the account tree — a generic table would lose that.
   */
  private async writeBalanceSheetFile(
    workspaceId: string,
    dto: GenerateReportBody,
    baseName: string,
  ): Promise<ReportFile> {
    // The chart of accounts is named in ru, en and kk only; any other reader
    // gets English rather than Russian account names under English headers.
    const locale = dto.locale === 'ru' || dto.locale === 'kk' ? dto.locale : 'en';
    const payload = await this.balanceService.exportBalanceSheet(
      workspaceId,
      { date: dto.dateTo, format: dto.format as BalanceExportFormat },
      locale,
    );

    const fileName = `${baseName}.${dto.format === 'pdf' ? 'pdf' : 'xlsx'}`;
    const filePath = path.join(this.resolveReportsDir(workspaceId), `${randomUUID()}-${fileName}`);
    fs.writeFileSync(filePath, payload.buffer);

    return { filePath, fileName, contentType: payload.contentType };
  }

  private async buildTemplateDocument(
    workspaceId: string,
    dto: GenerateReportBody,
  ): Promise<ReportDocument> {
    const labels = renderTemplateLabels(dto.locale);
    if (dto.templateId === 'category-by-month') {
      this.assertMonthColumns(dto);
    }
    if (dto.templateId === 'investment-holdings') {
      // A snapshot of today: positions have no history, so no rows and no period.
      const currency = await this.getWorkspaceCurrency(workspaceId);
      const { document, missingRates } = await this.holdingsSnapshotReport.build(
        workspaceId,
        labels,
        currency,
      );
      return this.withRateNote(document, labels, missingRates, currency);
    }

    const { currency, rows, missingRates } = await this.loadReportRows(workspaceId, dto);
    const subtitle = `${dto.dateFrom} — ${dto.dateTo} · ${currency}`;

    if (dto.templateId === 'budget-vs-actual') {
      const result = await this.budgetVsActualReport.build(
        workspaceId,
        dto,
        labels,
        subtitle,
        currency,
        rows,
      );
      const missing = Array.from(new Set([...missingRates, ...result.missingRates])).sort();
      return this.withRateNote(result.document, labels, missing, currency);
    }

    const document = this.buildTemplateBody(dto, labels, subtitle, currency, rows);
    return this.withRateNote(document, labels, missingRates, currency);
  }

  /**
   * Said once, at the top and before the template's own caveats: totals below
   * are short by whatever could not be converted, and the reader can see which
   * currencies those were.
   */
  private withRateNote(
    document: ReportDocument,
    labels: TemplateLabels,
    missingRates: string[],
    currency: string,
  ): ReportDocument {
    if (!missingRates.length) {
      return document;
    }
    const note = fillLabel(labels.missingRateNote, {
      currencies: missingRates.join(', '),
      currency,
    });
    return { ...document, notes: [note, ...(document.notes ?? [])] };
  }

  private assertMonthColumns(dto: GenerateReportBody): void {
    const months = this.monthKeys(dto.dateFrom, dto.dateTo).length;
    const limit =
      dto.format === 'pdf' ? ReportsService.MAX_MONTHS.pdf : ReportsService.MAX_MONTHS.other;
    if (months > limit) {
      throw new BadRequestException(
        dto.format === 'pdf'
          ? `Categories by Month fits ${limit} months on a PDF page; choose Excel or CSV for a longer period`
          : `Categories by Month covers at most ${limit} months`,
      );
    }
  }

  /** Every calendar month the period touches, as YYYY-MM, including empty ones. */
  private monthKeys(dateFrom: string, dateTo: string): string[] {
    const keys: string[] = [];
    let [year, month] = dateFrom.slice(0, 7).split('-').map(Number);
    const last = dateTo.slice(0, 7);
    for (;;) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (key > last) {
        return keys;
      }
      keys.push(key);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  private buildTemplateBody(
    dto: GenerateReportBody,
    text: TemplateLabels,
    subtitle: string,
    currency: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    if (dto.templateId === 'pnl') {
      return this.buildPnLDocument(text, subtitle, rows);
    }
    if (dto.templateId === 'cash-flow') {
      return this.buildCashFlowDocument(text, subtitle, rows, dto.groupBy || 'day');
    }
    if (dto.templateId === 'transaction-register') {
      return this.buildTransactionRegisterDocument(text, subtitle, currency, rows);
    }
    if (dto.templateId === 'monthly-summary') {
      return this.buildMonthlySummaryDocument(text, subtitle, rows);
    }
    if (dto.templateId === 'category-by-month') {
      return this.buildCategoryByMonthDocument(
        text,
        subtitle,
        rows,
        this.monthKeys(dto.dateFrom, dto.dateTo),
      );
    }
    return this.buildExpenseByCategoryDocument(text, subtitle, rows);
  }

  private normalizeCurrency(currency: string | null | undefined): string {
    return currencyCodeOrDefault(currency);
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    return this.normalizeCurrency(workspace?.currency);
  }

  /**
   * What a report, export or summary counts: confirmed rows (a row waiting in
   * Review is listed elsewhere, never summed) that are not suspected
   * duplicates, not transfers between the user's own accounts and not on a
   * trashed statement. The trash check is a subquery so callers can still join
   * the statement under their own alias.
   */
  private countedTransactions(workspaceId: string): SelectQueryBuilder<Transaction> {
    return onlyFlows(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    ).andWhere('transaction.transferPairId IS NULL');
  }

  private async loadReportRows(
    workspaceId: string,
    dto: GenerateReportBody,
  ): Promise<{ currency: string; rows: TemplateReportRow[]; missingRates: string[] }> {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);
    dateTo.setUTCHours(23, 59, 59, 999);

    // The same rows every other figure counts (transfers already left out).
    // Category group, account and tags are register columns of the templates.
    const query = this.countedTransactions(workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('category.parent', 'categoryParent')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect('transaction.tags', 'tags')
      .andWhere('transaction.transactionDate BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo });
    // An empty list would compile to `IN ()` and match nothing: an unset filter adds no condition.
    if (dto.walletIds?.length) {
      query.andWhere('transaction.walletId IN (:...walletIds)', { walletIds: dto.walletIds });
    }
    if (dto.categoryIds?.length) {
      query.andWhere('transaction.categoryId IN (:...categoryIds)', {
        categoryIds: dto.categoryIds,
      });
    }
    const [transactions, currency] = await Promise.all([
      query.getMany(),
      this.getWorkspaceCurrency(workspaceId),
    ]);
    // A generated report stays in the workspace's history and schedules e-mail
    // it, so it carries nobody's private details — its author's included, and
    // the preview shows what the file will.
    redactPrivateRows(transactions, null);

    // Each amount converts at its own day's rate, and a currency without one is
    // left out rather than counted 1:1 — a silent 1:1 would turn 1,000 USD into
    // 1,000 KZT in a document someone sends to their accountant.
    const rows: TemplateReportRow[] = transactions.map(transaction => {
      const categoryName = transaction.category?.name || UNCATEGORIZED_CATEGORY_NAME;
      return {
        id: transaction.id,
        date: this.toDateKey(transaction.transactionDate),
        categoryKey: transaction.categoryId ?? '',
        categoryName,
        groupName: transaction.category?.parent?.name ?? '',
        counterparty: transaction.counterpartyName || '',
        accountName: transaction.wallet?.name ?? '',
        comment: transaction.comments ?? '',
        tags: (transaction.tags ?? []).map(tag => tag.name),
        isIncome: transaction.transactionType === TransactionType.INCOME,
        amount: 0,
        originalAmount: Math.abs(Number(transaction.amount || 0)),
        originalCurrency: normalizeCurrencyCode(transaction.currency),
      };
    });

    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      rows.map(row => ({ currency: row.originalCurrency, date: row.date })),
      workspaceId,
    );
    for (const row of rows) {
      row.amount = converter.convert(row.originalAmount, row.originalCurrency, row.date);
    }

    return { currency, rows, missingRates: converter.missing };
  }

  /**
   * Totals per category, keyed by id: two categories may share a name under
   * different parents, and summing by name would fold them into one line.
   */
  private sumByCategory(rows: TemplateReportRow[]): CategoryTotal[] {
    const totals = new Map<string, CategoryTotal>();

    for (const row of rows) {
      const entry = totals.get(row.categoryKey) ?? {
        groupName: row.groupName,
        categoryName: row.categoryName,
        total: 0,
        count: 0,
      };
      entry.total += row.amount;
      entry.count += 1;
      totals.set(row.categoryKey, entry);
    }

    return Array.from(totals.values());
  }

  private buildPnLDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const income = byGroupThenAmount(this.sumByCategory(rows.filter(row => row.isIncome)));
    const expense = byGroupThenAmount(this.sumByCategory(rows.filter(row => !row.isIncome)));

    const totalRevenue = this.sumTotals(income);
    const totalExpenses = this.sumTotals(expense);
    const columns = [text.group, text.category, text.amount];

    return {
      title: text.titlePnl,
      subtitle,
      sections: [
        {
          title: text.revenue,
          columns,
          rows: this.toAmountRows(income),
          total: [text.totalRevenue, '', this.round2(totalRevenue)],
        },
        {
          title: text.expenses,
          columns,
          rows: this.toAmountRows(expense),
          total: [text.totalExpenses, '', this.round2(totalExpenses)],
        },
      ],
      footer: [[text.netIncome, this.round2(totalRevenue - totalExpenses)]],
    };
  }

  /**
   * Collapses an ISO date into its bucket. Weeks are keyed by their Monday, so
   * the key stays sortable as a plain string like the other two.
   */
  private toPeriodKey(dateKey: string, groupBy: 'day' | 'week' | 'month'): string {
    if (groupBy === 'month') {
      return dateKey.slice(0, 7);
    }
    if (groupBy === 'day') {
      return dateKey;
    }

    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const dayOfWeek = (date.getUTCDay() + 6) % 7; // Monday = 0
    date.setUTCDate(date.getUTCDate() - dayOfWeek);
    return date.toISOString().slice(0, 10);
  }

  private buildCashFlowDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
    groupBy: 'day' | 'week' | 'month',
  ): ReportDocument {
    const buckets = new Map<string, { income: number; expense: number }>();

    for (const row of rows) {
      const periodKey = this.toPeriodKey(row.date, groupBy);
      const bucket = buckets.get(periodKey) ?? { income: 0, expense: 0 };
      if (row.isIncome) {
        bucket.income += row.amount;
      } else {
        bucket.expense += row.amount;
      }
      buckets.set(periodKey, bucket);
    }

    const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
    const totalIncome = sorted.reduce((sum, [, bucket]) => sum + bucket.income, 0);
    const totalExpense = sorted.reduce((sum, [, bucket]) => sum + bucket.expense, 0);

    return {
      title: text.titleCashFlow,
      subtitle,
      sections: [
        {
          columns: [
            groupBy === 'day' ? text.date : groupBy === 'week' ? text.weekOf : text.month,
            text.income,
            text.expense,
            text.net,
          ],
          rows: sorted.map(([date, bucket]) => [
            date,
            this.round2(bucket.income),
            this.round2(bucket.expense),
            this.round2(bucket.income - bucket.expense),
          ]),
          total: [
            text.total,
            this.round2(totalIncome),
            this.round2(totalExpense),
            this.round2(totalIncome - totalExpense),
          ],
        },
      ],
    };
  }

  private buildExpenseByCategoryDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const byCategory = byGroupThenAmount(this.sumByCategory(rows.filter(row => !row.isIncome)));
    const totalExpenses = this.sumTotals(byCategory);
    const totalCount = byCategory.reduce((sum, entry) => sum + entry.count, 0);

    const categoryRows = byCategory.map(entry => [
      entry.groupName,
      entry.categoryName,
      this.round2(entry.total),
      entry.count,
      totalExpenses > 0 ? this.round2((entry.total / totalExpenses) * 100) : 0,
    ]);

    return {
      title: text.titleExpenseByCategory,
      subtitle,
      sections: [
        {
          columns: [
            text.group,
            text.category,
            text.totalAmount,
            text.transactionCount,
            text.percentOfTotal,
          ],
          rows: categoryRows,
          total: [
            text.total,
            '',
            this.round2(totalExpenses),
            totalCount,
            categoryRows.length ? 100 : 0,
          ],
        },
      ],
    };
  }

  /**
   * The one detail-level template: every transaction in the period, with both the
   * converted and the original amount so a foreign-currency line stays auditable,
   * and the id so a line can be traced back to the app.
   */
  private buildTransactionRegisterDocument(
    text: TemplateLabels,
    subtitle: string,
    currency: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const net = sorted.reduce((sum, row) => sum + (row.isIncome ? row.amount : -row.amount), 0);

    return {
      title: text.titleTransactionRegister,
      subtitle,
      sections: [
        {
          columns: [
            text.date,
            text.counterparty,
            text.group,
            text.category,
            text.type,
            fillLabel(text.amountInCurrency, { currency }),
            text.original,
            text.account,
            text.comment,
            text.tags,
            text.transactionId,
          ],
          rows: sorted.map(row => [
            row.date,
            row.counterparty,
            row.groupName,
            row.categoryName,
            row.isIncome ? text.income : text.expense,
            this.round2(row.isIncome ? row.amount : -row.amount),
            `${this.round2(row.originalAmount)} ${row.originalCurrency}`,
            row.accountName,
            row.comment,
            row.tags.join(', '),
            row.id,
          ]),
          total: [
            text.total,
            '',
            '',
            '',
            fillLabel(text.rowCount, { count: sorted.length }),
            this.round2(net),
            '',
            '',
            '',
            '',
            '',
          ],
        },
      ],
    };
  }

  /** P&L condensed to one screen: the headline numbers plus where the money went. */
  private buildMonthlySummaryDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const income = rows.filter(row => row.isIncome);
    const expense = rows.filter(row => !row.isIncome);
    const totalIncome = income.reduce((sum, row) => sum + row.amount, 0);
    const totalExpense = expense.reduce((sum, row) => sum + row.amount, 0);

    const topCategories = this.sumByCategory(expense)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(entry => [entry.categoryName, this.round2(entry.total)]);

    return {
      title: text.titleMonthlySummary,
      subtitle,
      sections: [
        {
          title: text.totals,
          columns: [text.metric, text.value],
          rows: [
            [text.income, this.round2(totalIncome)],
            [text.expenses, this.round2(totalExpense)],
            [text.transactions, rows.length],
            [
              text.savingsRate,
              totalIncome > 0 ? this.round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
            ],
          ],
        },
        {
          title: text.topExpenseCategories,
          columns: [text.category, text.amount],
          rows: topCategories,
        },
      ],
      footer: [[text.netTotal, this.round2(totalIncome - totalExpense)]],
    };
  }

  /**
   * Income and spending per category with a column per month, as YNAB's
   * Income v Expense lays it out: the table people build next year's budget
   * from. Empty months stay as zero columns so every row lines up.
   */
  private buildCategoryByMonthDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
    months: string[],
  ): ReportDocument {
    const column = new Map(months.map((month, index) => [month, index]));
    const net = months.map(() => 0);

    const section = (title: string, sectionRows: TemplateReportRow[], sign: 1 | -1) => {
      const byCategory = new Map<
        string,
        { groupName: string; categoryName: string; perMonth: number[]; total: number }
      >();
      const perMonthTotal = months.map(() => 0);
      for (const row of sectionRows) {
        const index = column.get(row.date.slice(0, 7));
        if (index === undefined) {
          continue;
        }
        const entry = byCategory.get(row.categoryKey) ?? {
          groupName: row.groupName,
          categoryName: row.categoryName,
          perMonth: months.map(() => 0),
          total: 0,
        };
        entry.perMonth[index] += row.amount;
        entry.total += row.amount;
        byCategory.set(row.categoryKey, entry);
        perMonthTotal[index] += row.amount;
        net[index] += sign * row.amount;
      }

      const entries = byGroupThenAmount(Array.from(byCategory.values()));
      const sectionTotal = perMonthTotal.reduce((sum, value) => sum + value, 0);
      return {
        title,
        columns: [text.group, text.category, ...months, text.totalColumn, text.averagePerMonth],
        rows: entries.map(entry => [
          entry.groupName,
          entry.categoryName,
          ...entry.perMonth.map(value => this.round2(value)),
          this.round2(entry.total),
          this.round2(entry.total / months.length),
        ]),
        total: [
          text.total,
          '',
          ...perMonthTotal.map(value => this.round2(value)),
          this.round2(sectionTotal),
          this.round2(sectionTotal / months.length),
        ],
      };
    };

    const income = section(
      text.revenue,
      rows.filter(row => row.isIncome),
      1,
    );
    const expenses = section(
      text.expenses,
      rows.filter(row => !row.isIncome),
      -1,
    );
    const netTotal = net.reduce((sum, value) => sum + value, 0);

    return {
      title: text.titleCategoryByMonth,
      subtitle,
      orientation: 'landscape',
      sections: [
        income,
        expenses,
        {
          title: text.net,
          columns: ['', '', ...months, text.totalColumn, text.averagePerMonth],
          rows: [
            [
              text.netTotal,
              '',
              ...net.map(value => this.round2(value)),
              this.round2(netTotal),
              this.round2(netTotal / months.length),
            ],
          ],
        },
      ],
      footer: [[text.netTotal, this.round2(netTotal)]],
    };
  }

  private sumTotals(entries: CategoryTotal[]): number {
    return entries.reduce((sum, entry) => sum + entry.total, 0);
  }

  private toAmountRows(entries: CategoryTotal[]): ReportCell[][] {
    return entries.map(entry => [entry.groupName, entry.categoryName, this.round2(entry.total)]);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async getReportHistory(workspaceId: string): Promise<ReportHistory[]> {
    return this.reportHistoryRepo.find({
      where: { workspaceId },
      order: { generatedAt: 'DESC' },
      take: 50,
      relations: {
        user: true,
      },
    });
  }

  async downloadHistoryReport(workspaceId: string, reportId: string): Promise<ReportFile> {
    const report = await this.reportHistoryRepo.findOne({
      where: { id: reportId, workspaceId },
    });

    // Only a file in this workspace's own directory is served. Rows written
    // before reports moved there point at a shared path that another workspace
    // may have overwritten since, so they read as missing.
    const filePath =
      report?.filePath &&
      resolveInUploadsDir(report.filePath, path.resolve(this.reportsDirOf(workspaceId)));
    if (!(filePath && report.fileName && fs.existsSync(filePath))) {
      throw new NotFoundException('Report file not found');
    }

    const format = String(report.format || '').toLowerCase();
    const contentType =
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : format === 'csv'
          ? 'text/csv'
          : 'application/pdf';

    return {
      filePath,
      fileName: report.fileName,
      contentType,
    };
  }
}

/**
 * The calendar day of a `date` column as YYYY-MM-DD. Postgres hands such a
 * column back as that string, not as the `Date` the entity declares, so
 * calling Date methods on it throws.
 */
function dayOf(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
