import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import { toEnum } from '../../common/effect/to-enum';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type {
  BalanceAccountNode,
  BalanceSheetResponse,
  CreateBalanceAccountBody,
  ExportBalanceQuery,
  UpdateAccountClassificationBody,
  UpdateBalanceSnapshotBody,
} from '../../contracts';
import {
  ActorType,
  AuditAction,
  BalanceAccount,
  BalanceAccountType,
  BalanceSnapshot,
  CapitalRole,
  EntityType,
  RiskLevel,
  Statement,
  StatementStatus,
  Transaction,
  Wallet,
  Workspace,
  WorkspaceMember,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import {
  addAmount,
  type CurrencyAmounts,
  CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { loadPdfMake } from '../reports/report-document.util';
import { balanceAccountName } from './balance-account-name';
import { DEFAULT_BALANCE_ACCOUNTS } from './balance-default-accounts';
import { BalanceExportFormat } from './dto/export-balance.dto';

/** The one line whose risk is fixed rather than chosen. */
export const CASH_ACCOUNT_CODE = 'ASSET_CASH';

const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly balanceAccountRepository: Repository<BalanceAccount>,
    @InjectRepository(BalanceSnapshot)
    private readonly balanceSnapshotRepository: Repository<BalanceSnapshot>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly auditService: AuditService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

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

  private resolveDate(date?: string): string {
    if (!date) {
      return new Date().toISOString().split('T')[0];
    }

    const asDate = new Date(date);
    if (Number.isNaN(asDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return asDate.toISOString().split('T')[0];
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatAmount(value: number, currency: string): string {
    return `${this.round(value).toFixed(2)} ${currency}`;
  }

  private resolveAccountName(node: BalanceAccountNode, locale?: string): string {
    return balanceAccountName(node, locale);
  }

  private localizeTree(nodes: BalanceAccountNode[], locale?: string): void {
    for (const node of nodes) {
      node.name = this.resolveAccountName(node, locale);
      if (node.children.length > 0) {
        this.localizeTree(node.children, locale);
      }
    }
  }

  private getExportLabels(locale?: string): Record<string, string> {
    const resolvedLocale = locale === 'en' || locale === 'kk' || locale === 'ru' ? locale : 'en';
    const labels = {
      ru: {
        balanceAsOf: 'Баланс на',
        assets: 'Активы',
        liabilities: 'Пассивы',
        total: 'Итого',
        difference: 'Разница',
        balanced: 'Сходится',
        yes: 'Да',
        no: 'Нет',
        notBalanced: 'не сходится',
      },
      en: {
        balanceAsOf: 'Balance sheet as of',
        assets: 'Assets',
        liabilities: 'Liabilities',
        total: 'Total',
        difference: 'Difference',
        balanced: 'Balanced',
        yes: 'Yes',
        no: 'No',
        notBalanced: 'not balanced',
      },
      kk: {
        balanceAsOf: 'Баланс',
        assets: 'Активтер',
        liabilities: 'Пассивтер',
        total: 'Барлығы',
        difference: 'Айырма',
        balanced: 'Сәйкес',
        yes: 'Иә',
        no: 'Жоқ',
        notBalanced: 'сәйкес емес',
      },
    };

    return labels[resolvedLocale];
  }

  private flattenForExport(
    accounts: BalanceAccountNode[],
    level = 0,
  ): Array<{ label: string; amount: number }> {
    const rows: Array<{ label: string; amount: number }> = [];

    for (const account of accounts) {
      rows.push({
        label: `${'  '.repeat(level)}${account.name}`,
        amount: this.round(account.amount),
      });

      if (account.children.length > 0) {
        rows.push(...this.flattenForExport(account.children, level + 1));
      }
    }

    return rows;
  }

  private async ensureSeeded(workspaceId: string): Promise<void> {
    const count = await this.balanceAccountRepository.count({ where: { workspaceId } });
    if (count > 0) {
      return;
    }

    await this.seedDefaultAccounts(workspaceId);
  }

  private async getLatestSnapshotMap(
    workspaceId: string,
    snapshotDate: string,
  ): Promise<Map<string, BalanceSnapshot>> {
    const snapshots = await this.balanceSnapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.workspaceId = :workspaceId', { workspaceId })
      .andWhere('snapshot.snapshotDate <= :snapshotDate', { snapshotDate })
      .orderBy('snapshot.accountId', 'ASC')
      .addOrderBy('snapshot.snapshotDate', 'DESC')
      .addOrderBy('snapshot.updatedAt', 'DESC')
      .getMany();

    const latestByAccount = new Map<string, BalanceSnapshot>();
    for (const snapshot of snapshots) {
      if (!latestByAccount.has(snapshot.accountId)) {
        latestByAccount.set(snapshot.accountId, snapshot);
      }
    }

    return latestByAccount;
  }

  private async getRetainedEarnings(workspaceId: string, date: string): Promise<CurrencyAmounts> {
    const rows = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.statement', 'statement')
        .select('transaction.currency', 'currency')
        .addSelect('COALESCE(SUM(transaction.credit), 0)', 'totalCredit')
        .addSelect('COALESCE(SUM(transaction.debit), 0)', 'totalDebit')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.transactionDate <= :date', { date })
      // Rows of a statement in the trash are not part of the books.
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .groupBy('transaction.currency')
      .getRawMany<{ currency: string; totalCredit: string; totalDebit: string }>();

    const earnings: CurrencyAmounts = new Map();
    for (const row of rows) {
      addAmount(
        earnings,
        normalizeCurrencyCode(row.currency),
        this.toNumber(row.totalCredit) - this.toNumber(row.totalDebit),
      );
    }
    return earnings;
  }

  private async getAutoComputedCashBalance(
    workspaceId: string,
    date: string,
  ): Promise<CurrencyAmounts> {
    const series = await this.getCashSeries(workspaceId, [date]);
    return series.get(date) ?? new Map();
  }

  /**
   * Cash at each of `dates` (ascending), per currency, in one pass instead of
   * one query per date. The balance sheet asks for one date, the net worth
   * chart for its sample points; both read the same rule from here:
   *
   * - with active wallets, their opening balances plus the movements booked
   *   to them;
   * - otherwise the closing balance of the latest statement of each bank
   *   account, summed over the accounts.
   *
   * Statements in the trash, and their rows, are left out.
   */
  async getCashSeries(workspaceId: string, dates: string[]): Promise<Map<string, CurrencyAmounts>> {
    const members = await this.workspaceMemberRepository.find({
      where: { workspaceId },
      select: {
        userId: true,
      },
    });

    const memberIds = [...new Set(members.map(member => member.userId))];

    // Обязательно фильтруем по workspaceId: участник может состоять в нескольких
    // воркспейсах, и без фильтра сюда утекали бы кошельки чужого тенанта.
    const wallets =
      memberIds.length > 0
        ? await this.walletRepository.find({
            where: { workspaceId, userId: In(memberIds), isActive: true },
            select: {
              id: true,
              initialBalance: true,
              currency: true,
            },
          })
        : [];

    return wallets.length > 0
      ? this.getWalletCashSeries(workspaceId, wallets, dates)
      : this.getStatementCashSeries(workspaceId, dates);
  }

  private async getWalletCashSeries(
    workspaceId: string,
    wallets: Array<Pick<Wallet, 'id' | 'initialBalance' | 'currency'>>,
    dates: string[],
  ): Promise<Map<string, CurrencyAmounts>> {
    const walletIds = wallets.map(wallet => wallet.id);
    const to = dates[dates.length - 1];

    const rows = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.statement', 'statement')
        .select('transaction.transactionDate', 'date')
        .addSelect('transaction.currency', 'currency')
        .addSelect('COALESCE(SUM(transaction.credit), 0)', 'credit')
        .addSelect('COALESCE(SUM(transaction.debit), 0)', 'debit')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.walletId IN (:...walletIds)', { walletIds })
      .andWhere('transaction.transactionDate <= :to', { to })
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .groupBy('transaction.transactionDate')
      .addGroupBy('transaction.currency')
      .orderBy('transaction.transactionDate', 'ASC')
      .getRawMany<{ date: string; currency: string; credit: string; debit: string }>();

    const running: CurrencyAmounts = new Map();
    for (const wallet of wallets) {
      addAmount(
        running,
        normalizeCurrencyCode(wallet.currency),
        this.toNumber(wallet.initialBalance),
      );
    }

    const series = new Map<string, CurrencyAmounts>();
    let index = 0;
    for (const date of dates) {
      while (index < rows.length && this.toDateOnly(rows[index].date) <= date) {
        const row = rows[index];
        addAmount(
          running,
          normalizeCurrencyCode(row.currency),
          this.toNumber(row.credit) - this.toNumber(row.debit),
        );
        index += 1;
      }
      series.set(date, new Map(running));
    }
    return series;
  }

  private async getStatementCashSeries(
    workspaceId: string,
    dates: string[],
  ): Promise<Map<string, CurrencyAmounts>> {
    // A statement without a closing date counts from the day it was uploaded.
    const rows = await this.statementRepository
      .createQueryBuilder('statement')
      .select('statement.bankName', 'bankName')
      .addSelect('statement.accountNumber', 'accountNumber')
      .addSelect('statement.currency', 'currency')
      .addSelect('statement.balanceEnd', 'balanceEnd')
      .addSelect('COALESCE(statement.statementDateTo, DATE(statement.createdAt))', 'date')
      .where('statement.workspaceId = :workspaceId', { workspaceId })
      .andWhere('statement.balanceEnd IS NOT NULL')
      .andWhere('statement.deletedAt IS NULL')
      .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
      .orderBy('date', 'ASC')
      .addOrderBy('statement.createdAt', 'ASC')
      .getRawMany<{
        bankName: string | null;
        accountNumber: string | null;
        currency: string | null;
        balanceEnd: string;
        date: string;
      }>();

    // The latest closing balance per bank account, then summed per currency.
    const latestByAccount = new Map<string, { currency: string; balance: number }>();
    const series = new Map<string, CurrencyAmounts>();
    let index = 0;
    for (const date of dates) {
      while (index < rows.length && this.toDateOnly(rows[index].date) <= date) {
        const row = rows[index];
        const currency = normalizeCurrencyCode(row.currency);
        latestByAccount.set(`${row.bankName ?? ''}|${row.accountNumber ?? ''}|${currency}`, {
          currency,
          balance: this.toNumber(row.balanceEnd),
        });
        index += 1;
      }
      const amounts: CurrencyAmounts = new Map();
      for (const { currency, balance } of latestByAccount.values()) {
        addAmount(amounts, currency, balance);
      }
      series.set(date, amounts);
    }
    return series;
  }

  private toDateOnly(value: string | Date): string {
    return new Date(value).toISOString().split('T')[0];
  }

  /**
   * Sets how a balance line behaves and how risky it is. Both are the user's
   * judgement, so this only records what they chose — nothing is inferred
   * from the account's type or sub-type.
   *
   * Cash is refused: it is the zero-risk anchor the allocation rule measures
   * everything else against, and letting it be labelled anything else would
   * make the rule meaningless.
   */
  async updateAccountClassification(
    userId: string,
    workspaceId: string,
    accountId: string,
    dto: UpdateAccountClassificationBody,
  ) {
    const account = await this.balanceAccountRepository.findOne({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      throw new NotFoundException('Balance account not found');
    }

    if (account.code === CASH_ACCOUNT_CODE) {
      throw new BadRequestException('Cash is always low risk and cannot be classified');
    }

    const before = { capitalRole: account.capitalRole, riskLevel: account.riskLevel };

    if (dto.capitalRole !== undefined) {
      account.capitalRole = toEnum(CapitalRole, dto.capitalRole);
    }
    if (dto.riskLevel !== undefined) {
      account.riskLevel = toEnum(RiskLevel, dto.riskLevel);
    }

    await this.balanceAccountRepository.save(account);

    // Risk classification decides whether the 80/20 warning fires, so a change
    // to it is audited the same way a snapshot edit is.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UPDATE,
      meta: {
        kind: 'balance_account_classification',
        accountId: account.id,
        accountCode: account.code,
      },
      diff: {
        before,
        after: { capitalRole: account.capitalRole, riskLevel: account.riskLevel },
      },
    });

    return {
      id: account.id,
      code: account.code,
      capitalRole: account.capitalRole,
      riskLevel: account.riskLevel,
    };
  }

  /**
   * Adds a custom line (e.g. a specific loan) under a section the user is
   * allowed to expand. Type/sub-type are inherited from the parent so the
   * new line lands on the correct side of the sheet automatically — only
   * `LIABILITY_BORROWED` is seeded as expandable today, which is what scopes
   * this to debts without hardcoding a debt-specific concept.
   */
  async createCustomAccount(userId: string, workspaceId: string, dto: CreateBalanceAccountBody) {
    const parent = await this.balanceAccountRepository.findOne({
      where: { id: dto.parentId, workspaceId },
    });

    if (!parent) {
      throw new NotFoundException('Balance account not found');
    }

    if (!parent.isExpandable) {
      throw new BadRequestException('This balance section does not accept custom accounts');
    }

    const siblingCount = await this.balanceAccountRepository.count({
      where: { workspaceId, parentId: parent.id },
    });

    const account = this.balanceAccountRepository.create({
      workspaceId,
      parentId: parent.id,
      code: `CUSTOM_${randomUUID()}`,
      name: dto.name,
      nameEn: dto.nameEn ?? null,
      nameKk: dto.nameKk ?? null,
      accountType: parent.accountType,
      subType: parent.subType,
      isEditable: true,
      isAutoComputed: false,
      isSystem: false,
      isExpandable: false,
      position: siblingCount,
    });

    const saved = await this.balanceAccountRepository.save(account);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.CREATE,
      meta: {
        kind: 'balance_account',
        accountId: saved.id,
        parentId: parent.id,
      },
      diff: { before: null, after: { name: saved.name, parentId: parent.id } },
    });

    return {
      id: saved.id,
      code: saved.code,
      name: saved.name,
      nameEn: saved.nameEn,
      nameKk: saved.nameKk,
      parentId: saved.parentId,
      accountType: saved.accountType,
      subType: saved.subType,
      position: saved.position,
    };
  }

  /** System accounts (the seeded sheet structure) can never be removed. */
  async deleteCustomAccount(userId: string, workspaceId: string, accountId: string): Promise<void> {
    const account = await this.balanceAccountRepository.findOne({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      return;
    }

    if (account.isSystem) {
      throw new BadRequestException('System accounts cannot be deleted');
    }

    await this.balanceAccountRepository.remove(account);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.DELETE,
      meta: {
        kind: 'balance_account',
        accountId,
      },
      diff: { before: { name: account.name, parentId: account.parentId }, after: null },
    });
  }

  async seedDefaultAccounts(workspaceId: string): Promise<void> {
    const existing = await this.balanceAccountRepository.count({ where: { workspaceId } });
    if (existing > 0) {
      return;
    }

    // Сидим в одной транзакции: два одновременных первых захода в новый воркспейс
    // оба проходили count===0, и проигравший падал на UQ_balance_accounts_workspace_code
    // посреди цикла, оставляя дерево счетов навсегда неполным.
    try {
      await this.balanceAccountRepository.manager.transaction(async manager => {
        const accounts = manager.getRepository(BalanceAccount);
        const parentByCode = new Map<string, BalanceAccount>();

        for (const definition of DEFAULT_BALANCE_ACCOUNTS) {
          const parentId = definition.parentCode
            ? (parentByCode.get(definition.parentCode)?.id ?? null)
            : null;

          const account = accounts.create({
            workspaceId,
            parentId,
            code: definition.code,
            name: definition.name,
            nameEn: definition.nameEn,
            nameKk: definition.nameKk,
            accountType: definition.accountType,
            subType: definition.subType,
            isEditable: definition.isEditable ?? true,
            isAutoComputed: definition.isAutoComputed ?? false,
            autoSource: definition.autoSource ?? null,
            position: definition.position,
            isSystem: true,
            isExpandable: definition.isExpandable ?? false,
          });

          const saved = await accounts.save(account);
          parentByCode.set(definition.code, saved);
        }
      });
    } catch (error) {
      // Unique violation — параллельный запрос уже засеял: это успех, не ошибка.
      const code =
        (error as { driverError?: { code?: string }; code?: string })?.driverError?.code ??
        (error as { code?: string })?.code;
      if (code === '23505') {
        return;
      }
      throw error;
    }
  }

  async getBalanceSheet(
    workspaceId: string,
    date?: string,
    locale?: string,
  ): Promise<BalanceSheetResponse> {
    await this.ensureSeeded(workspaceId);

    const snapshotDate = this.resolveDate(date);

    const [accounts, snapshotsMap, cash, retainedEarnings, currency] = await Promise.all([
      this.balanceAccountRepository.find({
        where: { workspaceId },
        order: {
          position: 'ASC',
          createdAt: 'ASC',
        },
      }),
      this.getLatestSnapshotMap(workspaceId, snapshotDate),
      this.getAutoComputedCashBalance(workspaceId, snapshotDate),
      this.getRetainedEarnings(workspaceId, snapshotDate),
      this.getWorkspaceCurrency(workspaceId),
    ]);

    const snapshotCurrency = (snapshot: BalanceSnapshot) =>
      normalizeCurrencyCode(snapshot.currency || currency);
    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      [
        ...cash.keys(),
        ...retainedEarnings.keys(),
        ...[...snapshotsMap.values()].map(snapshotCurrency),
      ].map(code => ({ currency: code, date: snapshotDate })),
      workspaceId,
    );

    const autoAmountsByCode = new Map<string, number>([
      ['ASSET_CASH', converter.convertAll(cash, snapshotDate)],
      ['EQUITY_RETAINED_EARNINGS', converter.convertAll(retainedEarnings, snapshotDate)],
    ]);

    const nodesById = new Map<string, BalanceAccountNode>();
    for (const account of accounts) {
      nodesById.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        nameEn: account.nameEn,
        nameKk: account.nameKk,
        accountType: account.accountType,
        isEditable: account.isEditable,
        isAutoComputed: account.isAutoComputed,
        isExpandable: account.isExpandable,
        amount: 0,
        children: [],
        position: account.position,
      });
    }

    const roots: BalanceAccountNode[] = [];
    for (const account of accounts) {
      const node = nodesById.get(account.id);
      if (!node) {
        continue;
      }

      if (account.parentId && nodesById.has(account.parentId)) {
        nodesById.get(account.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const computeAmount = (node: BalanceAccountNode): number => {
      const childrenTotal =
        node.children.length > 0
          ? node.children
              .sort((a, b) => a.position - b.position)
              .reduce((acc, child) => acc + computeAmount(child), 0)
          : 0;

      let amount = childrenTotal;

      if (node.children.length === 0) {
        if (node.isAutoComputed) {
          amount = autoAmountsByCode.get(node.code) ?? 0;
        } else {
          const snapshot = snapshotsMap.get(node.id);
          amount = snapshot
            ? converter.convert(
                this.toNumber(snapshot.amount),
                snapshotCurrency(snapshot),
                snapshotDate,
              )
            : 0;
        }
      }

      node.amount = this.round(amount);
      return node.amount;
    };

    for (const root of roots) {
      computeAmount(root);
    }

    const sortedRoots = roots.sort((a, b) => a.position - b.position);
    const assets = sortedRoots.filter(section => section.accountType === BalanceAccountType.ASSET);
    const liabilities = sortedRoots.filter(
      section =>
        section.accountType === BalanceAccountType.LIABILITY ||
        section.accountType === BalanceAccountType.EQUITY,
    );

    this.localizeTree(assets, locale);
    this.localizeTree(liabilities, locale);

    const assetsTotal = this.round(assets.reduce((acc, section) => acc + section.amount, 0));
    const liabilitiesTotal = this.round(
      liabilities.reduce((acc, section) => acc + section.amount, 0),
    );
    const difference = this.round(assetsTotal - liabilitiesTotal);

    return {
      date: snapshotDate,
      currency,
      assets: {
        total: assetsTotal,
        sections: assets,
      },
      liabilities: {
        total: liabilitiesTotal,
        sections: liabilities,
      },
      difference,
      isBalanced: Math.abs(difference) < 0.01,
      missingRates: converter.missing,
    };
  }

  async getAccountsTree(workspaceId: string, date?: string, locale?: string) {
    const sheet = await this.getBalanceSheet(workspaceId, date, locale);

    return {
      assets: sheet.assets.sections,
      liabilities: sheet.liabilities.sections,
      date: sheet.date,
    };
  }

  async updateSnapshot(userId: string, workspaceId: string, dto: UpdateBalanceSnapshotBody) {
    const snapshotDate = this.resolveDate(dto.date ?? undefined);
    const account = await this.balanceAccountRepository.findOne({
      where: {
        id: dto.accountId,
        workspaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Balance account not found');
    }

    if (!account.isEditable) {
      throw new BadRequestException('This balance line is auto-calculated and cannot be edited');
    }

    const amount = this.round(dto.amount);
    const currency = dto.currency || (await this.getWorkspaceCurrency(workspaceId));

    const existingSnapshot = await this.balanceSnapshotRepository.findOne({
      where: {
        workspaceId,
        accountId: account.id,
        snapshotDate,
      },
    });

    const beforeAmount = existingSnapshot ? this.toNumber(existingSnapshot.amount) : null;

    if (existingSnapshot) {
      existingSnapshot.amount = amount;
      existingSnapshot.currency = currency;
      existingSnapshot.createdBy = userId;
      await this.balanceSnapshotRepository.save(existingSnapshot);
    } else {
      const created = this.balanceSnapshotRepository.create({
        workspaceId,
        accountId: account.id,
        snapshotDate,
        amount,
        currency,
        createdBy: userId,
      });
      await this.balanceSnapshotRepository.save(created);
    }

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UPDATE,
      meta: {
        kind: 'balance_snapshot',
        accountId: account.id,
        accountCode: account.code,
        snapshotDate,
      },
      diff: {
        before: beforeAmount === null ? null : { amount: beforeAmount },
        after: { amount },
      },
    });

    return {
      accountId: account.id,
      snapshotDate,
      amount,
      currency,
    };
  }

  private async exportAsExcel(data: BalanceSheetResponse, locale?: string): Promise<Buffer> {
    const labels = this.getExportLabels(locale);
    const leftRows = this.flattenForExport(data.assets.sections);
    const rightRows = this.flattenForExport(data.liabilities.sections);
    const maxRows = Math.max(leftRows.length, rightRows.length);

    const rows: Array<Array<string | number>> = [
      [`${labels.balanceAsOf} ${data.date}`, '', '', ''],
      ['', '', '', ''],
      [
        `${labels.assets} (${this.formatAmount(data.assets.total, data.currency)})`,
        '',
        `${labels.liabilities} (${this.formatAmount(data.liabilities.total, data.currency)})`,
        '',
      ],
      ['', '', '', ''],
    ];

    for (let i = 0; i < maxRows; i++) {
      const left = leftRows[i];
      const right = rightRows[i];
      rows.push([
        left?.label || '',
        left ? this.round(left.amount) : '',
        right?.label || '',
        right ? this.round(right.amount) : '',
      ]);
    }

    rows.push(['', '', '', '']);
    rows.push([
      labels.total,
      this.round(data.assets.total),
      labels.total,
      this.round(data.liabilities.total),
    ]);
    rows.push([
      labels.difference,
      this.round(data.difference),
      labels.balanced,
      data.isBalanced ? labels.yes : labels.no,
    ]);

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 46 }, { wch: 16 }, { wch: 46 }, { wch: 16 }];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Balance');

    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Rendered with pdfmake rather than pdf-lib: pdf-lib's standard fonts are
   * WinAnsi-encoded and throw on Cyrillic, which broke every ru/kk export.
   * pdfmake's bundled Roboto covers those alphabets and paginates on its own,
   * so long sheets are no longer silently cut off at one page.
   */
  private async exportAsPdf(data: BalanceSheetResponse, locale?: string): Promise<Buffer> {
    const labels = this.getExportLabels(locale);
    const leftRows = this.flattenForExport(data.assets.sections);
    const rightRows = this.flattenForExport(data.liabilities.sections);
    const maxRows = Math.max(leftRows.length, rightRows.length);

    const body: unknown[][] = [
      [
        { text: labels.assets, style: 'th' },
        { text: this.formatAmount(data.assets.total, data.currency), style: 'thAmount' },
        { text: labels.liabilities, style: 'th' },
        { text: this.formatAmount(data.liabilities.total, data.currency), style: 'thAmount' },
      ],
    ];

    for (let i = 0; i < maxRows; i++) {
      const left = leftRows[i];
      const right = rightRows[i];
      body.push([
        { text: left?.label ?? '' },
        { text: left ? this.formatAmount(left.amount, data.currency) : '', alignment: 'right' },
        { text: right?.label ?? '' },
        { text: right ? this.formatAmount(right.amount, data.currency) : '', alignment: 'right' },
      ]);
    }

    const pdfMake = await loadPdfMake();
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: `${labels.balanceAsOf} ${data.date}`, style: 'title' },
        {
          table: { headerRows: 1, widths: ['*', 'auto', '*', 'auto'], body },
          layout: 'lightHorizontalLines',
        },
        {
          text: `${labels.difference}: ${this.formatAmount(data.difference, data.currency)} (${
            data.isBalanced ? labels.balanced : labels.notBalanced
          })`,
          color: data.isBalanced ? '#1f8033' : '#b33333',
          bold: true,
          margin: [0, 16, 0, 0],
        },
      ],
      styles: {
        title: { bold: true, fontSize: 16, margin: [0, 0, 0, 14] },
        th: { bold: true, fontSize: 11 },
        thAmount: { bold: true, fontSize: 11, alignment: 'right' },
      },
      defaultStyle: { font: 'Roboto', fontSize: 9 },
    };

    return new Promise<Buffer>(resolve => {
      pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
        resolve(Buffer.from(buffer));
      });
    });
  }

  async exportBalanceSheet(
    workspaceId: string,
    dto: ExportBalanceQuery,
    locale?: string,
  ): Promise<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const effectiveLocale = dto.locale || locale;
    const balanceSheet = await this.getBalanceSheet(workspaceId, dto.date, effectiveLocale);
    const dateKey = balanceSheet.date;

    if (dto.format === BalanceExportFormat.PDF) {
      const buffer = await this.exportAsPdf(balanceSheet, effectiveLocale);
      return {
        fileName: `balance-sheet-${dateKey}.pdf`,
        contentType: 'application/pdf',
        buffer,
      };
    }

    const buffer = await this.exportAsExcel(balanceSheet, effectiveLocale);
    return {
      fileName: `balance-sheet-${dateKey}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }
}
