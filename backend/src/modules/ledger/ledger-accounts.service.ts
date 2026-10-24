import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import type { CreateLedgerAccountBody, UpdateLedgerAccountBody } from '../../contracts';
import {
  Category,
  CategoryType,
  JournalLine,
  LedgerAccount,
  LedgerAccountType,
  NormalBalance,
  normalBalanceFor,
} from '../../entities';
import { LedgerAccountResponseDto } from './dto/ledger-account-response.dto';
import {
  categoryAccountCode,
  DEFAULT_LEDGER_ACCOUNTS,
  LEDGER_ACCOUNT_CODES,
} from './ledger-default-accounts';

const UNIQUE_VIOLATION = '23505';

/** Categories nest shallowly; the bound only stops a corrupt cycle from spinning. */
const MAX_CATEGORY_DEPTH = 10;

/** A statement account's key: a hash, so the full account number is not copied again. */
export function statementCashKey(
  bankName: string,
  accountNumber: string | null,
  currency: string,
): string {
  const identity = [
    bankName,
    accountNumber?.replace(/\s+/g, '') ?? '',
    currency.toUpperCase(),
  ].join('|');
  return `statement:${createHash('sha256').update(identity).digest('hex')}`;
}

/** Display name with the account number masked to its last four digits. */
function statementCashName(
  bankName: string,
  accountNumber: string | null,
  currency: string,
): string {
  const bank = bankName.charAt(0).toUpperCase() + bankName.slice(1).replace(/_/g, ' ');
  const digits = accountNumber?.replace(/\s+/g, '') ?? '';
  const masked = digits ? ` ····${digits.slice(-4)}` : '';
  return `${bank}${masked} · ${currency.toUpperCase()}`;
}

function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { driverError?: { code?: string }; code?: string })?.driverError?.code ??
    (error as { code?: string })?.code;
  return code === UNIQUE_VIOLATION;
}

@Injectable()
export class LedgerAccountsService {
  constructor(
    @InjectRepository(LedgerAccount)
    private readonly accountRepository: Repository<LedgerAccount>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(JournalLine)
    private readonly lineRepository: Repository<JournalLine>,
  ) {}

  /**
   * Brings the workspace's chart up to date: the default accounts, plus one
   * income or expense account for every root category that has none yet.
   * Runs on read, so categories created later get their account without any
   * hook in the categories module. Idempotent; a concurrent run that loses the
   * race on a unique code is treated as success, since the winner committed
   * the same accounts.
   */
  async ensureChart(workspaceId: string): Promise<void> {
    const [accounts, unlinkedRoots] = await Promise.all([
      this.accountRepository.find({ where: { workspaceId } }),
      this.categoryRepository.find({
        where: { workspaceId, parentId: IsNull(), ledgerAccountId: IsNull() },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const byCode = new Map(accounts.map(account => [account.code, account]));
    const missingDefaults = DEFAULT_LEDGER_ACCOUNTS.filter(
      definition => !byCode.has(definition.code),
    );
    if (missingDefaults.length === 0 && unlinkedRoots.length === 0) {
      return;
    }

    try {
      await this.accountRepository.manager.transaction(async manager => {
        const repo = manager.getRepository(LedgerAccount);

        for (const definition of missingDefaults) {
          const parent = definition.parentCode ? byCode.get(definition.parentCode) : undefined;
          const saved = await repo.save(
            repo.create({
              workspaceId,
              parentId: parent?.id ?? null,
              code: definition.code,
              name: definition.name,
              accountType: definition.accountType,
              normalBalance: normalBalanceFor(definition.accountType),
              isPostable: definition.isPostable,
              isSystem: true,
              position: definition.position,
            }),
          );
          byCode.set(saved.code, saved);
        }

        await this.linkCategories(manager, workspaceId, unlinkedRoots, byCode);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  }

  private async linkCategories(
    manager: EntityManager,
    workspaceId: string,
    categories: Category[],
    byCode: Map<string, LedgerAccount>,
  ): Promise<void> {
    const repo = manager.getRepository(LedgerAccount);
    const nextPosition = {
      [CategoryType.INCOME]: this.childCount(byCode, LEDGER_ACCOUNT_CODES.INCOME),
      [CategoryType.EXPENSE]: this.childCount(byCode, LEDGER_ACCOUNT_CODES.EXPENSES),
    };

    for (const category of categories) {
      const isIncome = category.type === CategoryType.INCOME;
      const accountType = isIncome ? LedgerAccountType.INCOME : LedgerAccountType.EXPENSE;
      const code = categoryAccountCode(category.type, category.id);

      // Already there when the link was lost but the account was not.
      let account = byCode.get(code);
      if (!account) {
        const header = byCode.get(
          isIncome ? LEDGER_ACCOUNT_CODES.INCOME : LEDGER_ACCOUNT_CODES.EXPENSES,
        );
        account = await repo.save(
          repo.create({
            workspaceId,
            parentId: header?.id ?? null,
            code,
            name: category.name,
            accountType,
            normalBalance: normalBalanceFor(accountType),
            isPostable: true,
            isSystem: false,
            position: nextPosition[category.type]++,
          }),
        );
        byCode.set(code, account);
      }

      await manager
        .getRepository(Category)
        .update({ id: category.id, workspaceId }, { ledgerAccountId: account.id });
    }
  }

  private childCount(byCode: Map<string, LedgerAccount>, parentCode: string): number {
    const parentId = byCode.get(parentCode)?.id;
    return [...byCode.values()].filter(account => account.parentId === parentId).length;
  }

  async list(workspaceId: string): Promise<LedgerAccountResponseDto[]> {
    await this.ensureChart(workspaceId);
    const accounts = await this.accountRepository.find({
      where: { workspaceId },
      order: { position: 'ASC', code: 'ASC' },
    });
    return accounts.map(LedgerAccountResponseDto.from);
  }

  async create(
    workspaceId: string,
    dto: CreateLedgerAccountBody,
  ): Promise<LedgerAccountResponseDto> {
    await this.ensureChart(workspaceId);
    if (dto.parentId) {
      await this.findHeader(workspaceId, dto.parentId, toEnum(LedgerAccountType, dto.accountType));
    }

    const account = this.accountRepository.create({
      workspaceId,
      parentId: dto.parentId ?? null,
      code: dto.code.toUpperCase(),
      name: dto.name.trim(),
      accountType: toEnum(LedgerAccountType, dto.accountType),
      normalBalance: normalBalanceFor(toEnum(LedgerAccountType, dto.accountType)),
      currency: dto.currency?.toUpperCase() ?? null,
      isPostable: dto.isPostable ?? true,
      isSystem: false,
      position: dto.position ?? 0,
    });

    return LedgerAccountResponseDto.from(await this.saveUnique(account));
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateLedgerAccountBody,
  ): Promise<LedgerAccountResponseDto> {
    const account = await this.findOne(workspaceId, id);

    if (account.isSystem && (dto.code !== undefined || dto.parentId !== undefined)) {
      // The posting rules find system accounts by code and place.
      throw new BadRequestException(appError('LEDGER_ACCOUNT_SYSTEM_LOCKED'));
    }

    if (dto.parentId !== undefined && dto.parentId !== account.parentId) {
      if (dto.parentId !== null) {
        await this.findHeader(workspaceId, dto.parentId, account.accountType);
        await this.assertNotDescendant(workspaceId, account.id, dto.parentId);
      }
      account.parentId = dto.parentId;
    }
    if (dto.code != null) {
      account.code = dto.code.toUpperCase();
    }
    if (dto.name != null) {
      account.name = dto.name.trim();
    }
    if (dto.position != null) {
      account.position = dto.position;
    }

    return LedgerAccountResponseDto.from(await this.saveUnique(account));
  }

  /**
   * Soft delete, and only for an account nothing depends on: no children, no
   * journal lines (a booked amount must stay visible in every report), and no
   * category booking to it — otherwise the next read would quietly open a
   * fresh account for that category.
   */
  async remove(workspaceId: string, id: string): Promise<void> {
    const account = await this.findOne(workspaceId, id);

    if (account.isSystem) {
      throw new BadRequestException(appError('LEDGER_ACCOUNT_SYSTEM_LOCKED'));
    }

    const [children, lines, categories] = await Promise.all([
      this.accountRepository.count({ where: { workspaceId, parentId: id } }),
      this.lineRepository.count({ where: { accountId: id } }),
      this.categoryRepository.count({ where: { workspaceId, ledgerAccountId: id } }),
    ]);

    if (children > 0) {
      throw new ConflictException(appError('LEDGER_ACCOUNT_HAS_CHILDREN'));
    }
    if (lines > 0) {
      throw new ConflictException(appError('LEDGER_ACCOUNT_HAS_LINES'));
    }
    if (categories > 0) {
      throw new ConflictException(appError('LEDGER_ACCOUNT_HAS_CATEGORIES'));
    }

    await this.accountRepository.softDelete({ id, workspaceId });
  }

  private async findOne(workspaceId: string, id: string): Promise<LedgerAccount> {
    const account = await this.accountRepository.findOne({ where: { id, workspaceId } });
    if (!account) {
      throw new NotFoundException(appError('LEDGER_ACCOUNT_NOT_FOUND'));
    }
    return account;
  }

  /** A parent must be a section header of the same type in the same workspace. */
  private async findHeader(
    workspaceId: string,
    parentId: string,
    accountType: LedgerAccountType,
  ): Promise<LedgerAccount> {
    const parent = await this.accountRepository.findOne({ where: { id: parentId, workspaceId } });
    if (!parent) {
      throw new BadRequestException(appError('LEDGER_ACCOUNT_PARENT_NOT_FOUND'));
    }
    if (parent.accountType !== accountType) {
      throw new BadRequestException(appError('LEDGER_ACCOUNT_PARENT_TYPE'));
    }
    if (parent.isPostable) {
      throw new BadRequestException(appError('LEDGER_ACCOUNT_PARENT_NOT_HEADER'));
    }
    return parent;
  }

  private async assertNotDescendant(
    workspaceId: string,
    accountId: string,
    newParentId: string,
  ): Promise<void> {
    const accounts = await this.accountRepository.find({
      where: { workspaceId },
      select: {
        id: true,
        parentId: true,
      },
    });
    const parentOf = new Map(accounts.map(account => [account.id, account.parentId]));

    let cursor: string | null = newParentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === accountId) {
        throw new BadRequestException(appError('LEDGER_ACCOUNT_CYCLE'));
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  /** Ids of the system accounts, by code. Seeds the chart first. */
  async systemAccountIds(workspaceId: string): Promise<Record<string, string>> {
    await this.ensureChart(workspaceId);
    const accounts = await this.accountRepository.find({
      where: { workspaceId, isSystem: true },
      select: {
        id: true,
        code: true,
      },
    });
    return Object.fromEntries(accounts.map(account => [account.code, account.id]));
  }

  /**
   * The postable account a category books to: its own link, else the nearest
   * ancestor's. A root created since the chart was last seeded gets its
   * account opened here. Null when the chain leads nowhere postable — the
   * caller books to SUSPENSE.
   */
  async categoryAccountId(workspaceId: string, categoryId: string): Promise<string | null> {
    let currentId: string | null = categoryId;
    let seeded = false;
    let depth = 0;

    while (currentId && depth < MAX_CATEGORY_DEPTH) {
      const category = await this.categoryRepository.findOne({
        where: { id: currentId, workspaceId },
        select: {
          id: true,
          parentId: true,
          ledgerAccountId: true,
        },
      });
      if (!category) {
        return null;
      }
      if (category.ledgerAccountId) {
        const account = await this.accountRepository.findOne({
          where: { id: category.ledgerAccountId, workspaceId, isPostable: true },
          select: {
            id: true,
          },
        });
        return account?.id ?? null;
      }
      if (category.parentId) {
        currentId = category.parentId;
        depth++;
      } else if (!seeded) {
        // Re-read the same root once the chart has opened its account.
        await this.ensureChart(workspaceId);
        seeded = true;
      } else {
        return null;
      }
    }
    return null;
  }

  /**
   * The cash account of a bank account seen on statements, opened on first
   * use under ASSET_CASH. Keyed by bank, account number and currency; with no
   * account number, by bank and currency alone.
   */
  async statementCashAccountId(
    workspaceId: string,
    bankName: string,
    accountNumber: string | null,
    currency: string,
  ): Promise<string> {
    const key = statementCashKey(bankName, accountNumber, currency);
    return this.upsertCashAccount(
      workspaceId,
      { statementAccountKey: key },
      `CASH_${key.slice('statement:'.length, 'statement:'.length + 8).toUpperCase()}`,
      statementCashName(bankName, accountNumber, currency),
      currency,
    );
  }

  /** A wallet's cash account, or null when the wallet holds another currency. */
  async walletCashAccountId(
    workspaceId: string,
    wallet: { id: string; name: string; currency: string },
    currency: string,
  ): Promise<string | null> {
    if (wallet.currency.toUpperCase() !== currency.toUpperCase()) {
      return null;
    }
    return this.upsertCashAccount(
      workspaceId,
      { walletId: wallet.id },
      `CASH_W_${wallet.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      `${wallet.name} · ${currency.toUpperCase()}`,
      currency,
    );
  }

  /**
   * A crypto wallet's account, under ASSET_CRYPTO. It holds the fiat value
   * each transfer was recorded at, not coins, so it takes no fixed currency.
   */
  async cryptoAccountId(
    workspaceId: string,
    cryptoWallet: { id: string; label: string | null; address: string },
  ): Promise<string> {
    const address = cryptoWallet.address;
    const name = cryptoWallet.label || `${address.slice(0, 6)}…${address.slice(-4)}`;
    return this.upsertCashAccount(
      workspaceId,
      { cryptoWalletId: cryptoWallet.id },
      `CRYPTO_${cryptoWallet.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      `${name} · crypto`,
      null,
      LEDGER_ACCOUNT_CODES.CRYPTO,
    );
  }

  /**
   * Insert-if-absent, safe under concurrency: ON CONFLICT DO NOTHING covers
   * the partial unique indexes on the key and the code, and the row is read
   * back whichever request created it.
   */
  private async upsertCashAccount(
    workspaceId: string,
    match: { statementAccountKey: string } | { walletId: string } | { cryptoWalletId: string },
    code: string,
    name: string,
    currency: string | null,
    parentCode: string = LEDGER_ACCOUNT_CODES.CASH,
  ): Promise<string> {
    const cashHeader = (await this.systemAccountIds(workspaceId))[parentCode];
    const existing = await this.accountRepository.findOne({
      where: { workspaceId, ...match },
      select: {
        id: true,
      },
    });
    if (existing) {
      return existing.id;
    }

    await this.accountRepository
      .createQueryBuilder()
      .insert()
      .into(LedgerAccount)
      .values({
        workspaceId,
        parentId: cashHeader ?? null,
        code,
        name: name.slice(0, 255),
        accountType: LedgerAccountType.ASSET,
        normalBalance: NormalBalance.DEBIT,
        currency: currency?.toUpperCase() ?? null,
        isPostable: true,
        isSystem: false,
        ...match,
      })
      .orIgnore()
      .execute();

    const created = await this.accountRepository.findOne({
      where: { workspaceId, ...match },
      select: {
        id: true,
      },
    });
    if (!created) {
      // Only reachable if another account already holds the derived code.
      throw new ConflictException(`Cash account code ${code} is taken by another account`);
    }
    return created.id;
  }

  private async saveUnique(account: LedgerAccount): Promise<LedgerAccount> {
    try {
      return await this.accountRepository.save(account);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(appError('LEDGER_ACCOUNT_CODE_TAKEN', { code: account.code }));
      }
      throw error;
    }
  }
}
