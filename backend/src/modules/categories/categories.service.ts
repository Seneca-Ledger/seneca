import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { withoutNulls } from '../../common/effect/without-nulls';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import type { CreateCategoryBody, UpdateCategoryBody } from '../../contracts';
import { Statement, Transaction, User, WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Category, CategorySource, CategoryType, StoicClass } from '../../entities/category.entity';
import { AuditService } from '../audit/audit.service';
import type { CategoryChangedEvent } from '../notifications/events/notification-events';

const DEFAULT_SYSTEM_CATEGORIES: ReadonlyArray<{
  name: string;
  type: CategoryType;
}> = [
  // Seeded in English; clients resolve the display name through the
  // systemCategories dictionary, keyed on the stored name.
  { name: 'Sales', type: CategoryType.INCOME },
  { name: 'Services', type: CategoryType.INCOME },
  { name: 'Interest income', type: CategoryType.INCOME },
  { name: 'Other income', type: CategoryType.INCOME },
  { name: 'Advertising', type: CategoryType.EXPENSE },
  { name: 'Benefits and compensation', type: CategoryType.EXPENSE },
  { name: 'Vehicle expenses', type: CategoryType.EXPENSE },
  { name: 'Equipment', type: CategoryType.EXPENSE },
  { name: 'Fees and charges', type: CategoryType.EXPENSE },
  { name: 'Home office', type: CategoryType.EXPENSE },
  { name: 'Insurance', type: CategoryType.EXPENSE },
  { name: 'Interest', type: CategoryType.EXPENSE },
  { name: 'Payroll', type: CategoryType.EXPENSE },
  { name: 'Maintenance and repairs', type: CategoryType.EXPENSE },
  { name: 'Materials', type: CategoryType.EXPENSE },
  { name: 'Meals and entertainment', type: CategoryType.EXPENSE },
  { name: 'Office supplies', type: CategoryType.EXPENSE },
  { name: 'Other expenses', type: CategoryType.EXPENSE },
  { name: 'Professional services', type: CategoryType.EXPENSE },
  { name: 'Rent', type: CategoryType.EXPENSE },
  { name: 'Taxes', type: CategoryType.EXPENSE },
  { name: 'Travel', type: CategoryType.EXPENSE },
  { name: 'Utilities', type: CategoryType.EXPENSE },
];

/** Columns an update may not empty: a null sent for them leaves them as they are. */
const REQUIRED_CATEGORY_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'type',
  'isEnabled',
  'taxRelevant',
]);

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  private snapshotCategory(category: Category) {
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      workspaceId: category.workspaceId,
      userId: category.userId,
      parentId: category.parentId,
      isSystem: category.isSystem,
      source: category.source,
      isEnabled: category.isEnabled,
      taxRelevant: category.taxRelevant,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private async resolveActorName(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        name: true,
        email: true,
      },
    });
    return user?.name || user?.email || 'User';
  }

  private async ensureCanEditCategories(workspaceId: string, userId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditCategories',
      'CATEGORIES_EDIT_FORBIDDEN',
    );
  }

  async create(
    workspaceId: string,
    userId: string,
    createDto: CreateCategoryBody,
  ): Promise<Category> {
    await this.ensureCanEditCategories(workspaceId, userId);
    const type = toEnum(CategoryType, createDto.type);
    // Check for duplicate name
    const existing = await this.categoryRepository.findOne({
      where: { workspaceId, name: createDto.name, type },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }
    await this.assertParentInWorkspace(workspaceId, createDto.parentId);

    const category = this.categoryRepository.create({
      workspaceId,
      userId,
      ...withoutNulls(createDto),
      type,
      stoicClass: toEnum(StoicClass, createDto.stoicClass),
      isSystem: false,
      source: CategorySource.USER,
      isEnabled: createDto.isEnabled ?? true,
    });

    const saved = await this.categoryRepository.save(category);
    await this.invalidateCache(workspaceId);

    // Audit: track category creation.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.CATEGORY,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: saved },
      meta: {
        parentId: saved.parentId ?? null,
      },
    });

    this.eventEmitter?.emit('category.changed', {
      workspaceId,
      actorId: userId,
      actorName: await this.resolveActorName(userId),
      action: 'created',
      categoryId: saved.id,
      categoryName: saved.name,
    } satisfies CategoryChangedEvent);

    return saved;
  }

  async findAll(workspaceId: string, type?: CategoryType): Promise<Category[]> {
    const where: FindOptionsWhere<Category> = { workspaceId };
    if (type) {
      where.type = type;
    }

    const cacheKey = `categories:${workspaceId}:${type || 'all'}`;
    const cached = await this.cacheManager.get<Category[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      where,
      relations: {
        children: true,
        parent: true,
      },
      order: { name: 'ASC' },
    });

    await this.cacheManager.set(cacheKey, categories, 3600000); // 1 hour
    return categories;
  }

  /** The parent comes from the request: another workspace's category is "not found". */
  private async assertParentInWorkspace(
    workspaceId: string,
    parentId: string | null | undefined,
  ): Promise<void> {
    if (!parentId) return;
    const parent = await this.categoryRepository.findOne({ where: { id: parentId, workspaceId } });
    if (!parent) throw new NotFoundException('Parent category not found');
  }

  async findOne(id: string, workspaceId: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id, workspaceId },
      relations: {
        children: true,
        parent: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async getWorkspaceCategoryUsageCounts(
    workspaceId: string,
  ): Promise<Record<string, { transactions: number; statements: number; total: number }>> {
    const [transactionsRaw, statementsRaw] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.categoryId', 'categoryId')
        .addSelect('COUNT(transaction.id)', 'count')
        // Every row of the workspace, a receipt's or a cash payment's too.
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.categoryId IS NOT NULL')
        .groupBy('transaction.categoryId')
        .getRawMany(),
      this.statementRepository
        .createQueryBuilder('statement')
        .select('statement.categoryId', 'categoryId')
        .addSelect('COUNT(statement.id)', 'count')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .andWhere('statement.categoryId IS NOT NULL')
        .groupBy('statement.categoryId')
        .getRawMany(),
    ]);

    const result: Record<string, { transactions: number; statements: number; total: number }> = {};

    for (const row of transactionsRaw) {
      const catId = row.categoryId;
      result[catId] = { transactions: Number(row.count), statements: 0, total: Number(row.count) };
    }

    for (const row of statementsRaw) {
      const catId = row.categoryId;
      if (!result[catId]) {
        result[catId] = {
          transactions: 0,
          statements: Number(row.count),
          total: Number(row.count),
        };
      } else {
        result[catId].statements = Number(row.count);
        result[catId].total += Number(row.count);
      }
    }

    return result;
  }

  async getCategoryUsageCount(
    categoryId: string,
    workspaceId: string,
  ): Promise<{ transactions: number; statements: number; total: number }> {
    await this.findOne(categoryId, workspaceId);

    const [transactions, statements] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.categoryId = :categoryId', { categoryId })
        .andWhere('transaction.workspaceId = :workspaceId', { workspaceId })
        .getCount(),
      this.statementRepository.count({
        where: { categoryId, workspaceId },
      }),
    ]);

    return {
      transactions,
      statements,
      total: transactions + statements,
    };
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    updateDto: UpdateCategoryBody,
  ): Promise<Category> {
    await this.ensureCanEditCategories(workspaceId, userId);
    const category = await this.findOne(id, workspaceId);
    const before = this.snapshotCategory(category);

    if (category.isSystem) {
      // A system category's name and shape are fixed, but whether it is on and
      // how the user judges its spending are theirs to decide.
      const nonToggleUpdates = Object.entries(updateDto).filter(
        ([key, value]) =>
          key !== 'isEnabled' &&
          key !== 'stoicClass' &&
          key !== 'helpsOthers' &&
          key !== 'taxRelevant' &&
          value !== undefined,
      );

      if (nonToggleUpdates.length > 0) {
        throw new ForbiddenException('Cannot modify system category');
      }
    }

    // Check for duplicate name if name is being changed
    if (updateDto.name && updateDto.name !== category.name) {
      const existing = await this.categoryRepository.findOne({
        where: { workspaceId, name: updateDto.name, type: category.type },
      });

      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    // null clears what may be empty (parent, colour, icon, the judgements); on a
    // required column it can only mean "leave it", and saving it failed NOT NULL.
    const changes = Object.fromEntries(
      Object.entries(updateDto).filter(
        ([key, value]) => !(value === null && REQUIRED_CATEGORY_FIELDS.has(key)),
      ),
    ) as UpdateCategoryBody;

    if (changes.parentId) {
      if (changes.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.assertParentInWorkspace(workspaceId, changes.parentId);
    }

    // A save that changes nothing (the editor re-submitting unchanged fields) is not an
    // event: logging it filled the audit log with identical "updated" rows.
    const changed = Object.entries(changes).some(
      ([key, value]) =>
        value !== undefined &&
        JSON.stringify(value) !== JSON.stringify(category[key as keyof Category] ?? null),
    );
    Object.assign(category, changes);
    const saved = await this.categoryRepository.save(category);
    await this.invalidateCache(workspaceId);
    const after = this.snapshotCategory(saved);

    const parentChanged = before.parentId !== saved.parentId;
    // Audit: track category updates with before/after diff.
    try {
      if (changed) {
        await this.auditService.createEvent({
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.CATEGORY,
          entityId: saved.id,
          action: AuditAction.UPDATE,
          diff: { before, after },
          meta: parentChanged
            ? { parentChange: { from: before.parentId ?? null, to: saved.parentId ?? null } }
            : undefined,
          isUndoable: true,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for category ${saved.id}: ${message}`);
    }

    this.eventEmitter?.emit('category.changed', {
      workspaceId,
      actorId: userId,
      actorName: await this.resolveActorName(userId),
      action: 'updated',
      categoryId: saved.id,
      categoryName: saved.name,
    } satisfies CategoryChangedEvent);

    return saved;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.ensureCanEditCategories(workspaceId, userId);
    const category = await this.findOne(id, workspaceId);

    if (category.isSystem) {
      throw new ForbiddenException('Cannot delete system category');
    }
    // Deleting the category would clear it on rows a filed return was built from.
    await assertNoTaxLockedTransactions(this.transactionRepository, {
      categoryId: category.id,
      workspaceId,
    });

    await this.categoryRepository.remove(category);
    await this.invalidateCache(workspaceId);

    // Audit: track category deletion for potential rollback.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.CATEGORY,
      entityId: category.id,
      action: AuditAction.DELETE,
      diff: { before: category, after: null },
      meta: {
        parentId: category.parentId ?? null,
      },
      isUndoable: true,
    });

    this.eventEmitter?.emit('category.changed', {
      workspaceId,
      actorId: userId,
      actorName: await this.resolveActorName(userId),
      action: 'deleted',
      categoryId: category.id,
      categoryName: category.name,
    } satisfies CategoryChangedEvent);
  }

  async createSystemCategories(workspaceId: string, userId?: string): Promise<void> {
    for (const catData of DEFAULT_SYSTEM_CATEGORIES) {
      const existing = await this.categoryRepository.findOne({
        where: { workspaceId, name: catData.name },
      });

      if (!existing) {
        const category = this.categoryRepository.create({
          workspaceId,
          userId,
          isSystem: true,
          source: CategorySource.SYSTEM,
          isEnabled: true,
          ...catData,
        });
        await this.categoryRepository.save(category);
      }
    }
    await this.invalidateCache(workspaceId);
  }

  private async invalidateCache(workspaceId: string): Promise<void> {
    await this.cacheManager.del(`categories:${workspaceId}:all`);
    await this.cacheManager.del(`categories:${workspaceId}:${CategoryType.INCOME}`);
    await this.cacheManager.del(`categories:${workspaceId}:${CategoryType.EXPENSE}`);
  }
}
