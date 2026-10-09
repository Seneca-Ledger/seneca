import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { onlyCounted } from '../../../common/utils/counted-transactions.util';
import { payeeKeyOf } from '../../../common/utils/payee-key.util';
import { OWNER_SHARED } from '../../../common/utils/transaction-owner.util';
import {
  DEFAULT_PROCESSING_SETTINGS,
  readProcessingSettings,
  type WorkspaceProcessingSettings,
} from '../../../common/utils/workspace-processing.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Branch } from '../../../entities/branch.entity';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import { PayeeOverride } from '../../../entities/payee-override.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../../entities/transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { Workspace } from '../../../entities/workspace.entity';
import { ApplicationSettingsService } from '../../application-settings/application-settings.service';
import { AuditService } from '../../audit/audit.service';
import { CategoriesService } from '../../categories/categories.service';
import {
  isUncategorizedName,
  UNCATEGORIZED_CATEGORY_NAME,
} from '../../categories/uncategorized-category';
import { decidePayeeCategory } from '../engine/payee-category.matcher';
import {
  AiCategoryClassifier,
  type AiCategoryMatch,
} from '../helpers/ai-category-classifier.helper';
import {
  type ClassificationCondition,
  type ClassificationRule,
} from '../interfaces/classification-rule.interface';
import type { TransactionEnrichment } from '../interfaces/transaction-enrichment.interface';

type BatchTransactionClassificationInput = {
  index: number;
  counterpartyName: string;
  paymentPurpose: string;
  transactionType: TransactionType;
};

/** A category plus the step that found it and the payload the UI shows as "why". */
type AutoCategoryMatch = {
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
  private readonly aiCategoryClassifier = new AiCategoryClassifier();

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PayeeOverride)
    private payeeOverrideRepository: Repository<PayeeOverride>,
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
    private readonly categoriesService: CategoriesService,
    @Optional()
    private readonly applicationSettingsService?: ApplicationSettingsService,
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

    // Get classification rules for user
    const rules = (await this.getClassificationRules(userId, workspaceId)) ?? [];

    // Apply rules in priority order
    for (const rule of rules.sort((a, b) => b.priority - a.priority)) {
      if (this.matchesRule(transaction, rule.conditions)) {
        matchedRule = rule;
        // Apply rule result
        if (rule.result.categoryId) {
          classification.categoryId = rule.result.categoryId;
          classification.categorySource = TransactionCategorySource.RULE;
          classification.categoryReason = rule.name;
        }
        if (rule.result.branchId) {
          classification.branchId = rule.result.branchId;
        }
        if (rule.result.walletId) {
          classification.walletId = rule.result.walletId;
        }
        if (rule.result.ownerMemberId !== undefined) {
          classification.ownerMemberId = rule.result.ownerMemberId;
          ruleSetOwner = true;
        }
        if (rule.result.article) {
          classification.article = rule.result.article;
        }
        if (rule.result.activityType) {
          classification.activityType = rule.result.activityType;
        }

        // Stop at first matching rule (highest priority)
        break;
      }
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

    // Auto-determine wallet if not set
    if (!classification.walletId) {
      classification.walletId = await this.autoDetermineWallet(transaction, userId, workspaceId);
    }

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
      classification.ownerMemberId = await this.walletOwnerMemberId(classification.walletId);
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
          ruleId: matchedRule.id ?? null,
          ruleName: matchedRule.name,
          confidence: 1,
        },
        batchId: batchId ?? null,
      });
    }

    return classification;
  }

  matchesRule(transaction: Transaction, conditions: ClassificationCondition[]): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(transaction, condition.field);
      return this.evaluateCondition(fieldValue, condition);
    });
  }

  private getFieldValue(transaction: Transaction, field: string): string | number | null {
    switch (field) {
      case 'counterparty_name':
        return transaction.counterpartyName;
      case 'payment_purpose':
        return transaction.paymentPurpose;
      case 'amount':
        return transaction.amount || transaction.debit || transaction.credit || 0;
      case 'counterparty_bin':
        return transaction.counterpartyBin || null;
      case 'document_number':
        return transaction.documentNumber || null;
      // `shared` rather than null: the condition evaluator treats null as "no
      // value" and refuses to match, so a rule about shared rows needs a word.
      case 'owner':
        return transaction.ownerMemberId ?? OWNER_SHARED;
      default:
        return null;
    }
  }

  private evaluateCondition(
    fieldValue: string | number | null,
    condition: ClassificationCondition,
  ): boolean {
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    const conditionValue = condition.value;
    const fieldStr = String(fieldValue).toLowerCase();
    const conditionStr = String(conditionValue).toLowerCase();

    switch (condition.operator) {
      case 'contains':
        return fieldStr.includes(conditionStr);
      case 'equals':
        return fieldStr === conditionStr;
      case 'starts_with':
        return fieldStr.startsWith(conditionStr);
      case 'ends_with':
        return fieldStr.endsWith(conditionStr);
      case 'regex':
        try {
          const regex = new RegExp(conditionValue as string, 'i');
          return regex.test(fieldStr);
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      default:
        return false;
    }
  }

  private async autoClassifyCategory(
    transaction: Transaction,
    userId: string,
    transactionType: TransactionType,
    workspaceId: string | null = null,
  ): Promise<AutoCategoryMatch | undefined> {
    // No category is ever guessed from the text of a descriptor. A bank string
    // contains a category name by accident often enough ("ENTERPRISE RENT-A-CAR"
    // -> Rent, "TRAVELODGE" -> Travel) that the guess is wrong more often than
    // it is right, and a wrong category reaches budgets and fires a false
    // overspend alert. What the user taught about this payee decides instead.

    const payeeMatch = workspaceId
      ? await this.matchByPayeeHistory(transaction, workspaceId)
      : undefined;
    if (payeeMatch) {
      return payeeMatch;
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
   * What this payee was filed as before. Only rows a person confirmed are read:
   * an auto-assigned category must never become the evidence for the next
   * auto-assignment, or one wrong guess reinforces itself forever.
   */
  private async matchByPayeeHistory(
    transaction: Transaction,
    workspaceId: string,
  ): Promise<AutoCategoryMatch | undefined> {
    const settings = await this.getProcessingSettings(workspaceId);
    if (!settings.merchantLearning) {
      return undefined;
    }

    const payeeKey = payeeKeyOf(transaction);
    if (!payeeKey) {
      return undefined;
    }

    const override = await this.payeeOverrideRepository.findOne({
      where: { workspaceId, payeeKey },
    });

    const newestFirst = await this.payeeHistoryQuery(workspaceId, payeeKey).getMany();
    const decision = decidePayeeCategory({
      // The matcher replays history forward; the query hands back the newest first.
      history: [...newestFirst].reverse().map(row => ({ categoryId: row.categoryId as string })),
      override: override ? { mode: override.mode, categoryId: override.categoryId } : undefined,
    });

    if (!decision) {
      return undefined;
    }

    return {
      categoryId: decision.categoryId,
      source:
        decision.basis === 'payee-pinned'
          ? TransactionCategorySource.LEARNED
          : TransactionCategorySource.HISTORY,
      reason: override?.displayName ?? transaction.counterpartyName ?? payeeKey,
    };
  }

  private payeeHistoryQuery(workspaceId: string, payeeKey: string) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .select(['transaction.id', 'transaction.categoryId'])
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.payeeKey = :payeeKey', { payeeKey })
      .andWhere('transaction.categoryId IS NOT NULL');
    return onlyCounted(query, 'transaction')
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .take(PAYEE_HISTORY_DEPTH);
  }

  private ownerScope(userId: string, workspaceId: string | null) {
    return workspaceId ? { workspaceId } : { userId };
  }

  /** Who owns the wallet, or null when it is shared. */
  private async walletOwnerMemberId(walletId: string): Promise<string | null> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
      select: ['ownerMemberId'],
    });
    return wallet?.ownerMemberId ?? null;
  }

  private async autoDetermineWallet(
    transaction: Transaction,
    userId: string,
    workspaceId: string | null,
  ): Promise<string | undefined> {
    const scope = this.ownerScope(userId, workspaceId);
    // Try to match by account number if available
    if (transaction.counterpartyAccount) {
      const wallet = await this.walletRepository.findOne({
        where: {
          ...scope,
          accountNumber: transaction.counterpartyAccount,
        },
      });

      if (wallet) {
        return wallet.id;
      }
    }

    // Match by wallet name presence in purpose/counterparty
    const wallets = await this.walletRepository.find({ where: scope });
    const searchText =
      `${transaction.counterpartyName} ${transaction.paymentPurpose}`.toLowerCase();
    const walletMatch = wallets.find(w => searchText.includes((w.name || '').toLowerCase()));
    if (walletMatch) {
      return walletMatch.id;
    }

    // Get default wallet for user
    const defaultWallet = await this.walletRepository.findOne({
      where: scope,
      order: { createdAt: 'ASC' },
    });

    return defaultWallet?.id;
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

  private async getClassificationRules(
    userId: string,
    workspaceId: string | null = null,
  ): Promise<ClassificationRule[]> {
    // Load user-defined categorization rules from database
    const userRules = await this.categorizationRuleRepository.find({
      where: {
        userId,
        ...(workspaceId ? { workspaceId } : {}),
        isActive: true,
      },
      order: {
        priority: 'DESC',
      },
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

    // No built-in rule templates. The ones that used to live here matched
    // Russian wording of Kazakh bank statements and created their categories by
    // name ("Платежи Kaspi Red", "Аренда"), so the first import seeded a German
    // or Spanish workspace with Russian categories. Bank-specific wording
    // belongs to the bank profile, not to every workspace in the product.
    return dbRules.sort((a, b) => b.priority - a.priority);
  }

  async classifyTransactionsBatch(
    transactions: BatchTransactionClassificationInput[],
    workspaceId: string,
  ): Promise<Map<number, { categoryId: string; enrichment?: TransactionEnrichment }>> {
    const resultByIndex = new Map<
      number,
      { categoryId: string; enrichment?: TransactionEnrichment }
    >();

    if (!(transactions.length && workspaceId)) {
      return resultByIndex;
    }

    const processing = await this.getProcessingSettings(workspaceId);
    if (!processing.aiCategorization) {
      return resultByIndex;
    }

    const aiSettings =
      await this.applicationSettingsService?.getAiSettingsForWorkspaceId(workspaceId);
    if (aiSettings) {
      this.aiCategoryClassifier.configureAiClient(aiSettings);
    }
    if (!this.aiCategoryClassifier.isAvailable()) {
      return resultByIndex;
    }

    const incomeTransactions = transactions.filter(
      tx => tx.transactionType === TransactionType.INCOME,
    );
    const expenseTransactions = transactions.filter(
      tx => tx.transactionType === TransactionType.EXPENSE,
    );

    const [incomeCategories, expenseCategories] = await Promise.all([
      this.getAiCategoryOptions(workspaceId, CategoryType.INCOME),
      this.getAiCategoryOptions(workspaceId, CategoryType.EXPENSE),
    ]);

    const [incomeResult, expenseResult] = await Promise.all([
      this.classifyTransactionGroupWithAi(incomeTransactions, incomeCategories),
      this.classifyTransactionGroupWithAi(expenseTransactions, expenseCategories),
    ]);

    const matches = [...incomeResult, ...expenseResult];

    for (const match of matches) {
      const enrichment: TransactionEnrichment = {
        vendorNormalized: processing.aiMerchantNormalization ? match.vendorNormalized : undefined,
        categoryHint: match.categoryHint,
        taxMentioned: match.taxMentioned,
        taxRate: match.taxRate,
        transactionNature: match.transactionNature,
        confidence: match.confidence,
      };
      resultByIndex.set(match.index, { categoryId: match.categoryId, enrichment });
    }

    return resultByIndex;
  }

  private async classifyTransactionGroupWithAi(
    transactions: BatchTransactionClassificationInput[],
    categories: Array<{ id: string; name: string }>,
  ): Promise<AiCategoryMatch[]> {
    if (!(transactions.length && categories.length)) {
      return [];
    }

    const result = await this.aiCategoryClassifier.classifyBatch(
      transactions.map(tx => ({
        index: tx.index,
        counterpartyName: tx.counterpartyName,
        paymentPurpose: tx.paymentPurpose,
      })),
      categories,
    );

    return result.matches;
  }

  private async getAiCategoryOptions(
    workspaceId: string,
    type: CategoryType,
  ): Promise<Array<{ id: string; name: string }>> {
    const categories = await this.categoriesService.findAll(workspaceId, type);
    return categories
      .filter(category => category.isEnabled !== false)
      .filter(category => !isUncategorizedName(category.name))
      .map(category => ({ id: category.id, name: category.name }));
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
        workspaceId,
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

  /**
   * Determine majority category for a statement based on parsed transactions.
   * Returns existing category if found, otherwise creates one with generated color.
   */
  async determineMajorityCategory(
    transactions: Array<{
      debit?: number | null;
      credit?: number | null;
      paymentPurpose?: string;
      counterpartyName?: string;
    }>,
    userId: string,
    workspaceId: string | null = null,
  ): Promise<{ categoryId?: string; type: CategoryType }> {
    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit ?? 0), 0);
    const totalCredit = transactions.reduce((sum, t) => sum + (t.credit ?? 0), 0);
    const type = totalDebit >= totalCredit ? CategoryType.EXPENSE : CategoryType.INCOME;

    const relevant = transactions.filter(t =>
      type === CategoryType.EXPENSE ? (t.debit ?? 0) > 0 : (t.credit ?? 0) > 0,
    );

    const keyword = this.extractDominantKeyword(relevant);
    const name =
      keyword && keyword.length > 0
        ? `${type === CategoryType.EXPENSE ? 'Расходы' : 'Доходы'}: ${keyword}`
        : type === CategoryType.EXPENSE
          ? 'Расходы'
          : 'Доходы';

    const color = this.pickColor(name);
    const categoryId = await this.ensureCategory(userId, name, type, color, workspaceId);
    return { categoryId, type };
  }

  private async invalidateWorkspaceCategoriesCache(workspaceId: string): Promise<void> {
    await this.cacheManager.del(`categories:${workspaceId}:all`);
    await this.cacheManager.del(`categories:${workspaceId}:${CategoryType.INCOME}`);
    await this.cacheManager.del(`categories:${workspaceId}:${CategoryType.EXPENSE}`);
  }

  private extractDominantKeyword(
    transactions: Array<{ paymentPurpose?: string; counterpartyName?: string }>,
  ): string {
    const text = transactions
      .map(t =>
        `${t.paymentPurpose || ''} ${t.counterpartyName || ''}`
          .replace(/[.,;:()/\\\-\d]+/g, ' ')
          .toLowerCase(),
      )
      .join(' ');

    const stopWords = new Set([
      'оплата',
      'платеж',
      'платежа',
      'перевод',
      'перечисление',
      'за',
      'и',
      'в',
      'на',
      'по',
      'заказ',
      'товар',
      'услуга',
      'услуг',
      'казахстан',
      'тариф',
      'счета',
      'счет',
      'номер',
      'период',
      'месяц',
      'год',
      'указано',
      'указан',
      'указана',
    ]);

    const words = text.split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    const top = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!top) {
      return '';
    }
    return top[0].charAt(0).toUpperCase() + top[0].slice(1);
  }

  private pickColor(key: string): string {
    const palette = [
      '#4F46E5', // indigo
      '#0EA5E9', // sky
      '#10B981', // emerald
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // violet
      '#EC4899', // pink
      '#22C55E', // green
      '#F97316', // orange
      '#14B8A6', // teal
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return palette[hash % palette.length];
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
      select: ['id', 'settings'],
    });
    const settings = readProcessingSettings(workspace);

    await this.cacheManager.set(cacheKey, settings, PROCESSING_SETTINGS_TTL_MS);
    return settings;
  }
}
