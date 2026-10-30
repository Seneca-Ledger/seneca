import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, type Repository } from 'typeorm';
import { payeeKeyOf } from '../../../common/utils/payee-key.util';
import {
  DEFAULT_PROCESSING_SETTINGS,
  readProcessingSettings,
  type WorkspaceProcessingSettings,
} from '../../../common/utils/workspace-processing.util';
import { workspaceOwnsRefs } from '../../../common/utils/workspace-refs.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Branch } from '../../../entities/branch.entity';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import { Payee, PayeeMode } from '../../../entities/payee.entity';
import { PayeeAlias } from '../../../entities/payee-alias.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../../entities/transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { Workspace } from '../../../entities/workspace.entity';
import { AuditService } from '../../audit/audit.service';
import { UNCATEGORIZED_CATEGORY_NAME } from '../../categories/uncategorized-category';
import { decidePayeeCategory } from '../engine/payee-category.matcher';
import { onlyPayeeEvidence } from '../engine/payee-evidence';
import { matchesConditions } from '../engine/rule-conditions';
import { applyRuleResult } from '../engine/rule-result';
import { ruleTags } from '../engine/rule-tags';
import {
  type ClassificationCondition,
  type ClassificationRule,
} from '../interfaces/classification-rule.interface';
import { newestHistoryByPayee, payeeIdOf, suggestCategory } from './auto-category';

/** A category plus the step that found it and the payload the UI shows as "why". */
export type AutoCategoryMatch = {
  categoryId: string;
  source: TransactionCategorySource;
  reason: string | null;
};

/**
 * How many of a payee's most recent transactions are replayed to work out its
 * default category. The rule itself looks at three at a time; a longer tail is
 * read so that an established category survives a run of one-offs.
 */
const PAYEE_HISTORY_DEPTH = 12;
const PROCESSING_SETTINGS_TTL_MS = 60_000;

@Injectable()
export class ClassificationService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Payee)
    private payeeRepository: Repository<Payee>,
    @InjectRepository(PayeeAlias)
    private payeeAliasRepository: Repository<PayeeAlias>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(CategorizationRule)
    private categorizationRuleRepository: Repository<CategorizationRule>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
  ) {}

  async classifyTransaction(
    transaction: Transaction,
    userId: string,
    batchId?: string | null,
    options: { bypassCache?: boolean } = {},
  ): Promise<Partial<Transaction>> {
    const classification: Partial<Transaction> = {};
    const workspaceId = transaction.workspaceId || null;
    let matchedRule: ClassificationRule | null = null;

    // Determine transaction type (income/expense)
    if (transaction.debit && transaction.debit > 0) {
      classification.transactionType = TransactionType.EXPENSE;
    } else if (transaction.credit && transaction.credit > 0) {
      classification.transactionType = TransactionType.INCOME;
    }

    // The payee key travels with the row: everything the engine learns later is
    // keyed on it, and recomputing it per query would be a scan.
    classification.payeeKey = payeeKeyOf(transaction);

    // Check cache first
    const cacheKey = transaction.id ? `classification:${transaction.id}` : null;
    if (cacheKey && !options.bypassCache) {
      const cached = await this.cacheManager.get<Partial<Transaction>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // A rule naming the owner is an explicit instruction; the wallet is only a
    // default, so it must not overwrite one.
    let ruleSetOwner = false;

    // The workspace's rules, whoever wrote them: a rule is a decision about the
    // workspace's money, so it applies to every member's imports.
    const rules = await this.getClassificationRules(workspaceId);
    const rule = await this.firstApplicableRule(rules, transaction, workspaceId);
    if (rule) {
      matchedRule = rule;
      ({ ruleSetOwner } = applyRuleResult(rule, classification));
      // A relation for a new row; callers updating an existing row add them instead.
      const tags = await ruleTags(this.walletRepository.manager, workspaceId, rule.result.tagIds);
      if (tags) classification.tags = tags;
      await this.recordRuleMatch(rule.id, workspaceId);
    }

    // Auto-classify category if not set
    if (!classification.categoryId) {
      const match = await this.autoClassifyCategory(
        transaction,
        userId,
        classification.transactionType || TransactionType.EXPENSE,
        workspaceId,
      );
      classification.categoryId = match?.categoryId;
      classification.categorySource = match?.source ?? null;
      classification.categoryReason = match?.reason ?? null;
    }

    // No guessing of the account: a row lands in one only through a rule, its
    // statement's account or the user's own choice. A fallback to "the oldest
    // wallet" put every row of every bank into the first account created.

    // Auto-determine branch if not set
    if (!classification.branchId) {
      classification.branchId = await this.autoDetermineBranch(transaction, userId, workspaceId);
    }

    // A new row belongs to whoever owns the account it landed in; NULL means the
    // household shares it. The owner is inherited once, at classification time:
    // moving a row to another wallet later does not reassign it behind the
    // user's back.
    //
    // One primary-key lookup per transaction, and the whole classification is
    // cached below, so it does not add a query per row of a re-imported file.
    if (classification.walletId && !ruleSetOwner) {
      classification.ownerMemberId = await this.walletOwnerMemberId(
        classification.walletId,
        workspaceId,
      );
    }

    // Cache result for 5 minutes
    if (cacheKey) {
      await this.cacheManager.set(cacheKey, classification, 300000); // 5 minutes in ms
    }

    if (matchedRule) {
      // Audit: record rule application for categorization transparency.
      await this.auditService.createEvent({
        workspaceId: transaction.workspaceId ?? null,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.TRANSACTION,
        entityId: transaction.id,
        action: AuditAction.APPLY_RULE,
        meta: {
          ruleId: matchedRule.id,
          ruleName: matchedRule.name,
          confidence: 1,
        },
        batchId: batchId ?? null,
      });
    }

    return classification;
  }

  /**
   * The category for one payee outside a statement import: a scanned receipt,
   * an emailed invoice. The same steps a bank row goes through: a rule the user
   * wrote, then what this payee was filed as before. `null` means "leave it for
   * the user", never the Uncategorized fallback.
   */
  async suggestForPayee(input: {
    workspaceId: string;
    userId: string;
    counterpartyName: string;
    paymentPurpose?: string | null;
    transactionType: TransactionType;
    amount?: number | null;
  }): Promise<AutoCategoryMatch | null> {
    const transaction = {
      workspaceId: input.workspaceId,
      counterpartyName: input.counterpartyName,
      paymentPurpose: input.paymentPurpose ?? input.counterpartyName,
      transactionType: input.transactionType,
      amount: input.amount ?? null,
      debit: input.transactionType === TransactionType.EXPENSE ? (input.amount ?? null) : null,
      credit: input.transactionType === TransactionType.INCOME ? (input.amount ?? null) : null,
    } as Transaction;

    const rules = await this.getClassificationRules(input.workspaceId);
    const rule = await this.firstApplicableRule(rules, transaction, input.workspaceId);
    if (rule?.result.categoryId) {
      await this.recordRuleMatch(rule.id, input.workspaceId);
      return {
        categoryId: rule.result.categoryId,
        source: TransactionCategorySource.RULE,
        reason: rule.name,
      };
    }

    return (await this.matchByPayeeHistory(transaction, input.workspaceId)) ?? null;
  }

  matchesRule(transaction: Transaction, conditions: ClassificationCondition[]): boolean {
    return matchesConditions(transaction, conditions);
  }

  /**
   * The highest-priority rule that matches and names only this workspace's
   * category, branch and wallet. A rule saved before its targets were checked
   * may still name another workspace's: it is passed over, not applied.
   */
  private async firstApplicableRule(
    rules: ClassificationRule[],
    transaction: Transaction,
    workspaceId: string | null,
  ): Promise<ClassificationRule | null> {
    for (const rule of [...rules].sort((a, b) => b.priority - a.priority)) {
      if (!this.matchesRule(transaction, rule.conditions)) {
        continue;
      }
      if (
        workspaceId &&
        !(await workspaceOwnsRefs(this.walletRepository.manager, workspaceId, rule.result))
      ) {
        continue;
      }
      return rule;
    }
    return null;
  }

  /** Keeps the "matched N times, last on …" line on the rules page true. */
  async recordRuleMatch(ruleId: string | undefined, workspaceId: string | null, count = 1) {
    if (!(ruleId && workspaceId) || count < 1) {
      return;
    }
    await this.categorizationRuleRepository.update(
      { id: ruleId, workspaceId },
      { matchCount: () => `match_count + ${Math.trunc(count)}`, lastMatchedAt: new Date() },
    );
  }

  private async autoClassifyCategory(
    transaction: Transaction,
    userId: string,
    transactionType: TransactionType,
    workspaceId: string | null = null,
  ): Promise<AutoCategoryMatch | undefined> {
    // A category name is never matched against a descriptor's text: a bank
    // string contains one by accident often enough ("ENTERPRISE RENT-A-CAR" ->
    // Rent, "TRAVELODGE" -> Travel). What the user taught about this payee
    // decides first. After it only a suggestion (suggestions/): the bank's own
    // fees and interest, or the kind of the operation. A suggestion stays
    // unconfirmed until a person accepts it, so it reaches no budget and fires
    // no overspend alert on its own (onlyCounted).
    // null: the payee is set to "never", so no suggestion either.
    const fromPayee = workspaceId ? await this.matchByPayeeHistory(transaction, workspaceId) : null;
    const match =
      fromPayee === undefined && workspaceId
        ? await suggestCategory(this.categoryRepository, transaction, transactionType, workspaceId)
        : fromPayee;
    if (match) {
      return match;
    }

    // FALLBACK: Create "Uncategorized" to ensure transaction is categorized
    const fallbackId = await this.ensureCategory(
      userId,
      UNCATEGORIZED_CATEGORY_NAME,
      transactionType === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE,
      undefined,
      workspaceId,
    );
    return fallbackId
      ? { categoryId: fallbackId, source: TransactionCategorySource.DEFAULT, reason: null }
      : undefined;
  }

  /**
   * What this row's payee was filed as before. The payee is the one the row
   * already has, or, for a row not booked yet, the one its descriptor is an
   * alias of. A descriptor never seen before has no payee and no history.
   */
  private async matchByPayeeHistory(
    transaction: Transaction,
    workspaceId: string,
  ): Promise<AutoCategoryMatch | null | undefined> {
    const payeeId = await payeeIdOf(this.payeeAliasRepository, transaction, workspaceId);
    const payee =
      payeeId && (await this.payeeRepository.findOne({ where: { id: payeeId, workspaceId } }));
    if (payee && payee.mode === PayeeMode.NEVER) {
      return null;
    }
    return payeeId ? this.categoryForPayee(workspaceId, payeeId) : undefined;
  }

  /**
   * The category a payee defaults to: its pin when the user said "always",
   * nothing when they said "never", otherwise its history by the YNAB rule.
   * Only rows a person decided are read (`onlyPayeeEvidence`), so an
   * auto-assigned category never becomes the evidence for the next one.
   */
  async categoryForPayee(
    workspaceId: string,
    payeeId: string,
  ): Promise<AutoCategoryMatch | undefined> {
    return (await this.categoriesForPayees(workspaceId, [payeeId])).get(payeeId);
  }

  /**
   * `categoryForPayee` for a page of payees at once: the settings, the payees
   * and their recent decided rows in three queries instead of three per payee.
   */
  async categoriesForPayees(
    workspaceId: string,
    payeeIds: readonly string[],
  ): Promise<Map<string, AutoCategoryMatch>> {
    const result = new Map<string, AutoCategoryMatch>();
    if (payeeIds.length === 0) {
      return result;
    }
    const settings = await this.getProcessingSettings(workspaceId);
    if (!settings.merchantLearning) {
      return result;
    }

    const ids = [...new Set(payeeIds)];
    const [payees, evidence] = await Promise.all([
      this.payeeRepository.find({ where: { id: In(ids), workspaceId } }),
      onlyPayeeEvidence(
        this.transactionRepository
          .createQueryBuilder('transaction')
          .select(['transaction.id', 'transaction.payeeId', 'transaction.categoryId'])
          .where('transaction.workspaceId = :workspaceId', { workspaceId })
          .andWhere('transaction.payeeId IN (:...ids)', { ids }),
        'transaction',
      )
        .orderBy('transaction.transactionDate', 'DESC')
        .addOrderBy('transaction.createdAt', 'DESC')
        .getMany(),
    ]);

    const historyOf = newestHistoryByPayee(evidence, PAYEE_HISTORY_DEPTH);

    for (const payee of payees) {
      const decision = decidePayeeCategory({
        // The matcher replays history forward; the query hands back the newest first.
        history: [...(historyOf.get(payee.id) ?? [])].reverse(),
        override: { mode: payee.mode, categoryId: payee.categoryId },
      });
      if (decision) {
        result.set(payee.id, {
          categoryId: decision.categoryId,
          source:
            decision.basis === 'payee-pinned'
              ? TransactionCategorySource.LEARNED
              : TransactionCategorySource.HISTORY,
          reason: payee.name,
        });
      }
    }
    return result;
  }

  private ownerScope(userId: string, workspaceId: string | null) {
    return workspaceId ? { workspaceId } : { userId };
  }

  /**
   * Who owns the wallet, or null when it is shared. Looked up in the row's own
   * workspace: a member of another one is never copied onto it.
   */
  private async walletOwnerMemberId(
    walletId: string,
    workspaceId: string | null,
  ): Promise<string | null> {
    if (!workspaceId) {
      return null;
    }
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId, workspaceId },
      select: {
        ownerMemberId: true,
      },
    });
    return wallet?.ownerMemberId ?? null;
  }

  private async autoDetermineBranch(
    transaction: Transaction,
    userId: string,
    workspaceId: string | null,
  ): Promise<string | undefined> {
    const branches = await this.branchRepository.find({
      where: this.ownerScope(userId, workspaceId),
      order: { createdAt: 'ASC' },
    });

    const searchText =
      `${transaction.counterpartyName} ${transaction.paymentPurpose}`.toLowerCase();
    const matched = branches.find(b => searchText.includes((b.name || '').toLowerCase()));
    return (matched || branches[0])?.id;
  }

  async getClassificationRules(workspaceId: string | null): Promise<ClassificationRule[]> {
    // Without a workspace there is nothing to scope by, and an empty `where`
    // would read every workspace's rules.
    if (!workspaceId) {
      return [];
    }
    const userRules = await this.categorizationRuleRepository.find({
      where: { workspaceId, isActive: true },
      // Equal priorities: the newer rule first, as on the rules page.
      order: { priority: 'DESC', createdAt: 'DESC' },
    });

    // Convert database rules to ClassificationRule format
    const dbRules: ClassificationRule[] = userRules.map(rule => ({
      id: rule.id,
      name: rule.name,
      type: 'category',
      conditions: rule.conditions,
      result: rule.result,
      priority: rule.priority,
      isActive: rule.isActive,
    }));

    // No built-in rule templates here. The ones that used to live here matched
    // Russian wording of Kazakh bank statements and created their categories by
    // name ("Платежи Kaspi Red", "Аренда"), so the first import seeded a German
    // or Spanish workspace with Russian categories. Bank-specific wording
    // belongs to the bank profile. The only built-in matches left are a bank's
    // own fees and interest (engine/builtin-rules), which run after history and
    // only ever pick an existing system category.
    return dbRules.sort((a, b) => b.priority - a.priority);
  }

  async ensureCategory(
    userId: string,
    categoryName: string,
    type: CategoryType = CategoryType.EXPENSE,
    color?: string,
    workspaceId: string | null = null,
  ): Promise<string | undefined> {
    if (workspaceId) {
      const workspaceCategory = await this.categoryRepository.findOne({
        where: { workspaceId, name: categoryName, type },
      });

      if (workspaceCategory) {
        if (!workspaceCategory.color && color) {
          workspaceCategory.color = color;
          await this.categoryRepository.save(workspaceCategory);
        }

        return workspaceCategory.id;
      }
    }

    let category = await this.categoryRepository.findOne({
      where: { userId, name: categoryName, type },
    });

    if (workspaceId && category && category.workspaceId !== workspaceId) {
      category = null;
    }

    if (!category) {
      category = this.categoryRepository.create({
        userId,
        workspaceId: workspaceId ?? undefined,
        name: categoryName,
        type,
        isSystem: false,
        source: workspaceId ? CategorySource.PARSING : CategorySource.USER,
        color,
      });
      try {
        category = await this.categoryRepository.save(category);
      } catch (error) {
        // A parallel import created the same fallback first (UQ_categories_uncategorized).
        if (!(workspaceId && (error as { code?: string }).code === '23505')) throw error;
        const created = await this.categoryRepository.findOne({
          where: { workspaceId, name: categoryName, type },
        });
        if (!created) throw error;
        return created.id;
      }
      if (workspaceId) {
        await this.invalidateWorkspaceCategoriesCache(workspaceId);
      }
    } else if (!category.color && color) {
      if (workspaceId && category.source !== CategorySource.PARSING) {
        category.source = CategorySource.PARSING;
      }
      category.color = color;
      await this.categoryRepository.save(category);
    } else if (workspaceId && category.source !== CategorySource.PARSING) {
      category.source = CategorySource.PARSING;
      await this.categoryRepository.save(category);
    }

    return category?.id;
  }

  private async invalidateWorkspaceCategoriesCache(workspaceId: string): Promise<void> {
    await this.cacheManager.del(`categories:${workspaceId}:all`);
    await this.cacheManager.del(`categories:${workspaceId}:${CategoryType.INCOME}`);
    await this.cacheManager.del(`categories:${workspaceId}:${CategoryType.EXPENSE}`);
  }

  /**
   * Record a user correction for ML learning
   */
  /**
   * Remembers a manual category pick for the payee. A single correction does
   * not flip a payee with an established pattern (a one-off gift bought at the
   * grocery store stays a one-off); the second correction for the same payee
   * does, and demotes what it replaces.
   */
  private async getProcessingSettings(
    workspaceId: string | null,
  ): Promise<WorkspaceProcessingSettings> {
    if (!workspaceId) {
      return DEFAULT_PROCESSING_SETTINGS;
    }

    const cacheKey = `workspace:${workspaceId}:processing-settings`;
    const cached = await this.cacheManager.get<WorkspaceProcessingSettings>(cacheKey);
    if (cached && typeof cached === 'object') {
      return cached;
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        id: true,
        settings: true,
      },
    });
    const settings = readProcessingSettings(workspace);

    await this.cacheManager.set(cacheKey, settings, PROCESSING_SETTINGS_TTL_MS);
    return settings;
  }
}
