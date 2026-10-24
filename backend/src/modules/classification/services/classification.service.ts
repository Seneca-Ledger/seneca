import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, type Repository } from 'typeorm';
import { payeeKeyOf } from '../../../common/utils/payee-key.util';
import { OWNER_SHARED } from '../../../common/utils/transaction-owner.util';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
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
import { Payee } from '../../../entities/payee.entity';
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
import { hasDecidedCategory } from '../engine/category-decision';
import { decidePayeeCategory } from '../engine/payee-category.matcher';
import { onlyPayeeEvidence } from '../engine/payee-evidence';
import {
  type ClassificationCondition,
  type ClassificationRule,
} from '../interfaces/classification-rule.interface';

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
/** How many of a workspace's most recent rows a rule preview or apply looks at. */
const RULE_SCAN_LIMIT = 5000;
/** How many matching rows the preview hands back as examples. */
const RULE_PREVIEW_MATCHES = 20;

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
    return conditions.every(condition => this.conditionHolds(transaction, condition));
  }

  /** The conditions a matching row satisfied, worded for the rule preview. */
  explainMatch(transaction: Transaction, conditions: ClassificationCondition[]): string {
    return conditions
      .filter(condition => this.conditionHolds(transaction, condition))
      .map(condition => `${condition.field} ${condition.operator} "${condition.value}"`)
      .join(' AND ');
  }

  private conditionHolds(transaction: Transaction, condition: ClassificationCondition): boolean {
    return this.evaluateCondition(this.getFieldValue(transaction, condition.field), condition);
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

  /**
   * The workspace's rows a rule would be tried on, newest first: not duplicates,
   * not split parts, not in a trashed statement. `transactionIds` narrows it to
   * those rows. One row more than the limit is read to tell a full page from
   * a truncated one.
   */
  private async rowsForRule(
    workspaceId: string,
    transactionIds?: readonly string[],
  ): Promise<{ rows: Transaction[]; truncated: boolean }> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.isDuplicate = false')
      .andWhere('transaction.splitGroupId IS NULL')
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = transaction.statementId AND trashed.deleted_at IS NOT NULL)',
      )
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .take(RULE_SCAN_LIMIT + 1);
    if (transactionIds) {
      query.andWhere('transaction.id IN (:...transactionIds)', { transactionIds });
    }
    const rows = await query.getMany();
    return { rows: rows.slice(0, RULE_SCAN_LIMIT), truncated: rows.length > RULE_SCAN_LIMIT };
  }

  /**
   * What a rule would match, as the caller sees the rows: another member's
   * private row is left out entirely, since even its amount would answer a
   * question about it.
   */
  async previewRule(input: {
    workspaceId: string;
    viewerMemberId: string | null;
    conditions: ClassificationCondition[];
    transactionIds?: readonly string[];
  }) {
    const { rows, truncated } = await this.rowsForRule(input.workspaceId, input.transactionIds);
    const readable = rows.filter(row => canReadPrivate(row, input.viewerMemberId));
    const matches = readable.filter(row => this.matchesRule(row, input.conditions));
    return {
      totalTransactions: readable.length,
      matchedTransactions: matches.length,
      overridable: matches.filter(row => !hasDecidedCategory(row)).length,
      truncated,
      matches: matches.slice(0, RULE_PREVIEW_MATCHES).map(row => ({
        id: row.id,
        date: row.transactionDate ? String(row.transactionDate) : null,
        amount: row.debit || row.credit || row.amount,
        counterparty: row.counterpartyName,
        purpose: row.paymentPurpose,
        matchReason: this.explainMatch(row, input.conditions),
      })),
    };
  }

  /**
   * Files the workspace's existing matches under the rule's category. Only rows
   * nobody decided: a category picked by hand, or put there by a rule, stays.
   * Wallet and owner are not touched on old rows: moving a row between
   * accounts changes balances, and that is not what "apply" promises.
   */
  async applyRuleToExisting(input: {
    rule: CategorizationRule;
    userId: string;
    viewerMemberId: string | null;
  }): Promise<{ applied: number; skippedManual: number }> {
    const { rule, userId, viewerMemberId } = input;
    const categoryId = rule.result.categoryId;
    if (!categoryId) {
      return { applied: 0, skippedManual: 0 };
    }
    const { rows } = await this.rowsForRule(rule.workspaceId);
    const matches = rows.filter(
      row => canReadPrivate(row, viewerMemberId) && this.matchesRule(row, rule.conditions),
    );
    const open = matches.filter(row => !hasDecidedCategory(row));
    if (open.length > 0) {
      await this.transactionRepository.update(
        { id: In(open.map(row => row.id)), workspaceId: rule.workspaceId },
        { categoryId, categorySource: TransactionCategorySource.RULE, categoryReason: rule.name },
      );
      await this.auditService.createBatchEvents(
        open.map(row => ({
          workspaceId: rule.workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.TRANSACTION,
          entityId: row.id,
          action: AuditAction.APPLY_RULE,
          diff: {
            before: { categoryId: row.categoryId, categorySource: row.categorySource },
            after: { categoryId, categorySource: TransactionCategorySource.RULE },
          },
          meta: { ruleId: rule.id, ruleName: rule.name, confidence: 1 },
        })),
      );
      await this.recordRuleMatch(rule.id, rule.workspaceId, open.length);
      await this.cacheManager.set(`reports:version:${rule.workspaceId}`, Date.now().toString(), 0);
    }
    return { applied: open.length, skippedManual: matches.length - open.length };
  }

  /** Keeps the "matched N times, last on …" line on the rules page true. */
  async recordRuleMatch(ruleId: string | undefined, workspaceId: string | null, count = 1) {
    if (!ruleId || !workspaceId || count < 1) {
      return;
    }
    await this.categorizationRuleRepository.update(
      { id: ruleId, workspaceId },
      { matchCount: () => `match_count + ${Math.trunc(count)}`, lastMatchedAt: new Date() },
    );
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
   * What this row's payee was filed as before. The payee is the one the row
   * already has, or, for a row not booked yet, the one its descriptor is an
   * alias of. A descriptor never seen before has no payee and no history.
   */
  private async matchByPayeeHistory(
    transaction: Transaction,
    workspaceId: string,
  ): Promise<AutoCategoryMatch | undefined> {
    let payeeId = transaction.payeeId ?? null;
    if (!payeeId) {
      const payeeKey = payeeKeyOf(transaction);
      const alias = payeeKey
        ? await this.payeeAliasRepository.findOne({ where: { workspaceId, payeeKey } })
        : null;
      payeeId = alias?.payeeId ?? null;
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
    const settings = await this.getProcessingSettings(workspaceId);
    if (!settings.merchantLearning) {
      return undefined;
    }

    const payee = await this.payeeRepository.findOne({ where: { id: payeeId, workspaceId } });
    if (!payee) {
      return undefined;
    }

    const newestFirst = await this.payeeHistoryQuery(workspaceId, payeeId).getMany();
    const decision = decidePayeeCategory({
      // The matcher replays history forward; the query hands back the newest first.
      history: [...newestFirst].reverse().map(row => ({ categoryId: row.categoryId as string })),
      override: { mode: payee.mode, categoryId: payee.categoryId },
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
      reason: payee.name,
    };
  }

  private payeeHistoryQuery(workspaceId: string, payeeId: string) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .select(['transaction.id', 'transaction.categoryId'])
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.payeeId = :payeeId', { payeeId });
    return onlyPayeeEvidence(query, 'transaction')
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .take(PAYEE_HISTORY_DEPTH);
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

  async getClassificationRules(workspaceId: string | null): Promise<ClassificationRule[]> {
    // Without a workspace there is nothing to scope by, and an empty `where`
    // would read every workspace's rules.
    if (!workspaceId) {
      return [];
    }
    const userRules = await this.categorizationRuleRepository.find({
      where: { workspaceId, isActive: true },
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
