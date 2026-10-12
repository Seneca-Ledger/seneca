import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { type DataSource, In, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import type {
  MergePayeesBody,
  PayeePendingReview,
  PayeesPage,
  SetTransactionPayeeBody,
  UpdatePayeeBody,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Category } from '../../entities/category.entity';
import { Payee, PayeeMode } from '../../entities/payee.entity';
import { Transaction, TransactionCategorySource } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { hasDecidedCategory } from '../classification/engine/category-decision';
import { ClassificationService } from '../classification/services/classification.service';
import type { PayeesQueryDto } from './dto/payees.dto';

type CategoryRef = { id: string; name: string };

export type PayeeView = {
  id: string;
  name: string;
  mode: PayeeMode;
  /** The pinned category, when `mode` is `always`. */
  category: CategoryRef | null;
  /** What a new row of this payee would be filed as now, and why. */
  defaultCategory: (CategoryRef & { source: TransactionCategorySource }) | null;
  transactionCount: number;
  lastSeen: string | null;
};

const DEFAULT_LIMIT = 50;

/** Escapes LIKE wildcards so a search for "50%" means the text "50%". */
const likePattern = (search: string) => `%${search.replace(/[\\%_]/g, char => `\\${char}`)}%`;

/**
 * Payees as the user manages them in YNAB's "Manage Payees": rename, merge,
 * choose how each is categorised, and move a transaction to another payee so
 * the next import of the same descriptor follows.
 */
@Injectable()
export class PayeesService {
  constructor(
    @InjectRepository(Payee)
    private readonly payeeRepository: Repository<Payee>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly classificationService: ClassificationService,
    private readonly auditService: AuditService,
  ) {}

  async list(workspaceId: string, query: PayeesQueryDto): Promise<PayeesPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const search = query.search?.trim() ?? '';

    const filtered = this.payeeRepository
      .createQueryBuilder('payee')
      .where('payee.workspaceId = :workspaceId', { workspaceId });
    if (search) {
      filtered.andWhere("payee.name ILIKE :pattern ESCAPE '\\'", { pattern: likePattern(search) });
    }

    const [total, rows] = await Promise.all([
      filtered.clone().getCount(),
      filtered
        .clone()
        .leftJoin(
          Transaction,
          'transaction',
          'transaction.payeeId = payee.id AND transaction.workspaceId = payee.workspaceId',
        )
        .select([
          'payee.id AS id',
          'payee.name AS name',
          'payee.mode AS mode',
          'payee.categoryId AS "categoryId"',
          'COUNT(transaction.id)::int AS "transactionCount"',
          'MAX(transaction.transactionDate) AS "lastSeen"',
        ])
        .groupBy('payee.id')
        .orderBy('"lastSeen"', 'DESC', 'NULLS LAST')
        .addOrderBy('payee.name', 'ASC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<{
          id: string;
          name: string;
          mode: PayeeMode;
          categoryId: string | null;
          transactionCount: number;
          lastSeen: Date | string | null;
        }>(),
    ]);

    const defaults = await Promise.all(
      rows.map(row => this.classificationService.categoryForPayee(workspaceId, row.id)),
    );
    const categoryIds = [
      ...new Set(
        [...rows.map(row => row.categoryId), ...defaults.map(match => match?.categoryId)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const categories = categoryIds.length
      ? await this.categoryRepository.find({
          where: { id: In(categoryIds), workspaceId },
          select: ['id', 'name'],
        })
      : [];
    const nameOf = new Map(categories.map(category => [category.id, category.name]));

    const data = rows.map((row, index) => {
      const match = defaults[index];
      return {
        id: row.id,
        name: row.name,
        mode: row.mode,
        category:
          row.categoryId && nameOf.has(row.categoryId)
            ? { id: row.categoryId, name: nameOf.get(row.categoryId) as string }
            : null,
        defaultCategory:
          match && nameOf.has(match.categoryId)
            ? {
                id: match.categoryId,
                name: nameOf.get(match.categoryId) as string,
                source: match.source,
              }
            : null,
        transactionCount: Number(row.transactionCount),
        lastSeen: row.lastSeen ? new Date(row.lastSeen).toISOString().slice(0, 10) : null,
      };
    });

    return { data, total, page, limit };
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdatePayeeBody,
  ): Promise<Payee> {
    const payee = await this.findPayee(workspaceId, id);
    const before = { name: payee.name, mode: payee.mode, categoryId: payee.categoryId };

    if (dto.name != null) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('A payee needs a name');
      }
      const taken = await this.payeeRepository
        .createQueryBuilder('payee')
        .where('payee.workspaceId = :workspaceId', { workspaceId })
        .andWhere('LOWER(payee.name) = LOWER(:name)', { name })
        .andWhere('payee.id <> :id', { id })
        .getOne();
      if (taken) {
        // Two payees with one name are one payee: the client offers a merge.
        throw new ConflictException({
          code: 'PAYEE_NAME_TAKEN',
          message: 'Another payee already has this name',
          payeeId: taken.id,
        });
      }
      payee.name = name;
    }

    if (dto.categoryId) {
      await this.findCategory(workspaceId, dto.categoryId);
    }
    const mode = toEnum(PayeeMode, dto.mode) ?? payee.mode;
    const categoryId = dto.categoryId !== undefined ? dto.categoryId : payee.categoryId;
    if (mode === PayeeMode.ALWAYS && !categoryId) {
      throw new BadRequestException('Pick the category this payee always gets');
    }
    payee.mode = mode;
    // A pin means nothing outside "always"; keeping it would resurface later.
    payee.categoryId = mode === PayeeMode.ALWAYS ? categoryId : null;

    const saved = await this.payeeRepository.save(payee);
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.PAYEE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: {
        before,
        after: { name: saved.name, mode: saved.mode, categoryId: saved.categoryId },
      },
    });
    return saved;
  }

  /**
   * Folds other payees into this one: their rows, their descriptors and so
   * their history. Repeating the call after it succeeded changes nothing.
   */
  async merge(
    workspaceId: string,
    userId: string,
    targetId: string,
    dto: MergePayeesBody,
  ): Promise<{ payee: Payee; merged: number }> {
    return this.dataSource.transaction(async manager => {
      const target = await manager.findOne(Payee, { where: { id: targetId, workspaceId } });
      if (!target) {
        throw new NotFoundException('Payee not found');
      }
      const sources = await manager.find(Payee, {
        where: { id: In(dto.sourceIds.filter(sourceId => sourceId !== targetId)), workspaceId },
        select: ['id', 'name'],
      });
      if (!sources.length) {
        return { payee: target, merged: 0 };
      }
      const sourceIds = sources.map(source => source.id);

      await manager.query(
        'UPDATE transactions SET payee_id = $1 WHERE workspace_id = $2 AND payee_id = ANY($3::uuid[])',
        [target.id, workspaceId, sourceIds],
      );
      await manager.query(
        'UPDATE payee_aliases SET payee_id = $1 WHERE workspace_id = $2 AND payee_id = ANY($3::uuid[])',
        [target.id, workspaceId, sourceIds],
      );
      await manager.delete(Payee, { id: In(sourceIds), workspaceId });

      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.PAYEE,
        entityId: target.id,
        action: AuditAction.UPDATE,
        meta: { mergedPayees: sources.map(source => ({ id: source.id, name: source.name })) },
      });
      return { payee: target, merged: sources.length };
    });
  }

  /**
   * Moves one row to another payee, the way changing the payee of an imported
   * transaction works in YNAB: the row's descriptor now means that payee, so
   * the next import of it lands there too. A category nobody chose follows
   * the new payee's default.
   */
  async setTransactionPayee(
    workspaceId: string,
    userId: string,
    transactionId: string,
    dto: SetTransactionPayeeBody,
  ): Promise<{
    id: string;
    payee: { id: string; name: string };
    categoryId: string | null;
    categorySource: TransactionCategorySource | null;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    const payee = dto.payeeId
      ? await this.findPayee(workspaceId, dto.payeeId)
      : await this.findOrCreateByName(workspaceId, dto.name as string);

    const updates: Partial<
      Pick<Transaction, 'payeeId' | 'categoryId' | 'categorySource' | 'categoryReason'>
    > = { payeeId: payee.id };
    if (!hasDecidedCategory(transaction)) {
      const match = await this.classificationService.categoryForPayee(workspaceId, payee.id);
      if (match) {
        updates.categoryId = match.categoryId;
        updates.categorySource = match.source;
        updates.categoryReason = match.reason;
      }
    }

    await this.dataSource.transaction(async manager => {
      if (transaction.payeeKey) {
        await manager.query(
          `INSERT INTO payee_aliases (workspace_id, payee_key, payee_id) VALUES ($1, $2, $3)
           ON CONFLICT (workspace_id, payee_key) DO UPDATE SET payee_id = EXCLUDED.payee_id`,
          [workspaceId, transaction.payeeKey, payee.id],
        );
      }
      // update(), not save(): the subscriber would re-derive the payee from the descriptor.
      await manager.update(Transaction, { id: transaction.id, workspaceId }, updates);
    });

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: transaction.id,
      action: AuditAction.UPDATE,
      diff: {
        before: { payeeId: transaction.payeeId, categoryId: transaction.categoryId },
        after: { payeeId: payee.id, categoryId: updates.categoryId ?? transaction.categoryId },
      },
    });

    return {
      id: transaction.id,
      payee: { id: payee.id, name: payee.name },
      categoryId: updates.categoryId ?? transaction.categoryId,
      categorySource: updates.categorySource ?? transaction.categorySource,
    };
  }

  /**
   * Rows of this payee still waiting in Review whose category nobody chose:
   * the ones a category just picked for the payee could be applied to.
   */
  async pendingReview(
    workspaceId: string,
    payeeId: string,
    excludeTransactionId?: string,
  ): Promise<PayeePendingReview> {
    await this.findPayee(workspaceId, payeeId);
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.id', 'id')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.payeeId = :payeeId', { payeeId })
      .andWhere('transaction.isVerified = false')
      .andWhere('transaction.isDuplicate = false')
      .andWhere('transaction.splitGroupId IS NULL')
      .andWhere(
        `(transaction.categoryId IS NULL OR transaction.categorySource IN (:...undecided))`,
        {
          undecided: [
            TransactionCategorySource.DEFAULT,
            TransactionCategorySource.AI,
            TransactionCategorySource.HISTORY,
            TransactionCategorySource.LEARNED,
            TransactionCategorySource.KEYWORD,
          ],
        },
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = transaction.statementId AND trashed.deleted_at IS NOT NULL)',
      )
      .orderBy('transaction.transactionDate', 'DESC')
      .limit(500);
    if (excludeTransactionId) {
      query.andWhere('transaction.id <> :excludeTransactionId', { excludeTransactionId });
    }
    const rows = await query.getRawMany<{ id: string }>();
    return { transactionIds: rows.map(row => row.id) };
  }

  private async findPayee(workspaceId: string, id: string): Promise<Payee> {
    const payee = await this.payeeRepository.findOne({ where: { id, workspaceId } });
    if (!payee) {
      throw new NotFoundException('Payee not found');
    }
    return payee;
  }

  private async findCategory(workspaceId: string, id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id, workspaceId } });
    if (!category) {
      throw new BadRequestException('Category not found in this workspace');
    }
    return category;
  }

  private async findOrCreateByName(workspaceId: string, raw: string): Promise<Payee> {
    const name = raw.trim();
    if (!name) {
      throw new BadRequestException('A payee needs a name');
    }
    const existing = await this.payeeRepository
      .createQueryBuilder('payee')
      .where('payee.workspaceId = :workspaceId', { workspaceId })
      .andWhere('LOWER(payee.name) = LOWER(:name)', { name })
      .getOne();
    return (
      existing ?? this.payeeRepository.save(this.payeeRepository.create({ workspaceId, name }))
    );
  }
}
