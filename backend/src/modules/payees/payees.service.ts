import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { type DataSource, In, IsNull, LessThan, Not, Or, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type {
  MergePayeesBody,
  PayeePendingReview,
  PayeesPage,
  PayeesQuery,
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
import { ViesService } from '../reference-data/vies.service';
import { TaxAssignmentService } from '../tax/tax-assignment.service';

type CategoryRef = { id: string; name: string };

export type PayeeView = {
  id: string;
  name: string;
  mode: PayeeMode;
  /** The pinned category, when `mode` is `always`. */
  category: CategoryRef | null;
  /** What a new row of this payee would be filed as now, and why. */
  defaultCategory: (CategoryRef & { source: TransactionCategorySource }) | null;
  /** Seat and VAT number: what decides reverse charge on purchases from this payee. */
  countryCode: string | null;
  vatId: string | null;
  /** What VIES said about `vatId`; NULL when not asked or it could not answer. */
  vatIdStatus: 'valid' | 'invalid' | null;
  /** The name the number is registered to, when VIES gave one. */
  vatIdName: string | null;
  vatIdCheckedAt: string | null;
  /** Goods or services, for the line of the VAT return a reverse charge goes on. */
  supplyType: 'goods' | 'services' | null;
  transactionCount: number;
  lastSeen: string | null;
};

/** Numbers VIES could not answer for are asked again after this long. */
const VIES_RETRY_AFTER_MS = 20 * 60 * 60 * 1000;
const VIES_RETRY_BATCH = 100;

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
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly viesService: ViesService,
  ) {}

  private readonly logger = new Logger(PayeesService.name);

  async list(
    workspaceId: string,
    query: PayeesQuery,
    viewerMemberId: string | null = null,
  ): Promise<PayeesPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const search = query.search?.trim() ?? '';
    const { data, total } = await this.views(workspaceId, { search }, page, limit, viewerMemberId);
    return { data, total, page, limit };
  }

  /** One payee as the list shows it. */
  async get(
    workspaceId: string,
    id: string,
    viewerMemberId: string | null = null,
  ): Promise<PayeeView> {
    const { data } = await this.views(workspaceId, { id }, 1, 1, viewerMemberId);
    if (!data[0]) {
      throw new NotFoundException('Payee not found');
    }
    return data[0];
  }

  private async views(
    workspaceId: string,
    filter: { search?: string; id?: string },
    page: number,
    limit: number,
    viewerMemberId: string | null,
  ): Promise<{ data: PayeeView[]; total: number }> {
    const filtered = this.payeeRepository
      .createQueryBuilder('payee')
      .where('payee.workspaceId = :workspaceId', { workspaceId });
    if (filter.search) {
      filtered.andWhere("payee.name ILIKE :pattern ESCAPE '\\'", {
        pattern: likePattern(filter.search),
      });
    }
    if (filter.id) {
      filtered.andWhere('payee.id = :id', { id: filter.id });
    }

    const [total, rows] = await Promise.all([
      filtered.clone().getCount(),
      filtered
        .clone()
        .leftJoin(
          Transaction,
          'transaction',
          // Another member's private row is not counted: "seen on <date>" would
          // tie the merchant to a row whose merchant is hidden.
          `transaction.payeeId = payee.id AND transaction.workspaceId = payee.workspaceId AND ${readablePrivateSql('transaction')}`,
          { [PRIVACY_VIEWER_PARAM]: viewerMemberId },
        )
        .select([
          'payee.id AS id',
          'payee.name AS name',
          'payee.mode AS mode',
          'payee.categoryId AS "categoryId"',
          'payee.countryCode AS "countryCode"',
          'payee.vatId AS "vatId"',
          'payee.vatIdStatus AS "vatIdStatus"',
          'payee.vatIdName AS "vatIdName"',
          'payee.vatIdCheckedAt AS "vatIdCheckedAt"',
          'payee.supplyType AS "supplyType"',
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
          countryCode: string | null;
          vatId: string | null;
          vatIdStatus: 'valid' | 'invalid' | null;
          vatIdName: string | null;
          vatIdCheckedAt: Date | string | null;
          supplyType: 'goods' | 'services' | null;
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
          select: {
            id: true,
            name: true,
          },
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
        countryCode: row.countryCode,
        vatId: row.vatId,
        vatIdStatus: row.vatIdStatus,
        vatIdName: row.vatIdName,
        vatIdCheckedAt: row.vatIdCheckedAt ? new Date(row.vatIdCheckedAt).toISOString() : null,
        supplyType: row.supplyType,
        transactionCount: Number(row.transactionCount),
        lastSeen: row.lastSeen ? new Date(row.lastSeen).toISOString().slice(0, 10) : null,
      };
    });

    return { data, total };
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdatePayeeBody,
  ): Promise<Payee> {
    const payee = await this.findPayee(workspaceId, id);
    const before = {
      name: payee.name,
      mode: payee.mode,
      categoryId: payee.categoryId,
      countryCode: payee.countryCode,
      vatId: payee.vatId,
      supplyType: payee.supplyType,
    };

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
    if (dto.countryCode !== undefined) {
      payee.countryCode = dto.countryCode ? dto.countryCode.toUpperCase() : null;
    }
    if (dto.vatId !== undefined) {
      payee.vatId = dto.vatId?.trim() || null;
    }
    if (dto.supplyType !== undefined) {
      payee.supplyType = dto.supplyType;
    }

    const vatChanged = payee.countryCode !== before.countryCode || payee.vatId !== before.vatId;
    if (vatChanged) {
      await this.checkVatId(payee);
    }
    const saved = await this.payeeRepository.save(payee);
    // Who the supplier is decides whether its purchases are reverse-charged,
    // so every unfiled row of this payee is assessed again.
    if (vatChanged) {
      await this.taxAssignmentService.reassess(workspaceId, { payeeId: saved.id });
    }
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.PAYEE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: {
        before,
        after: {
          name: saved.name,
          mode: saved.mode,
          categoryId: saved.categoryId,
          countryCode: saved.countryCode,
          vatId: saved.vatId,
          supplyType: saved.supplyType,
        },
      },
    });
    return saved;
  }

  /**
   * Asks VIES about the payee's VAT number and keeps the answer on the
   * payee. An invalid number stops its purchases being reverse-charged; an
   * unanswered one (the register is down) is treated as before, unverified.
   */
  private async checkVatId(payee: Payee): Promise<void> {
    if (!(payee.vatId && payee.countryCode && this.viesService.covers(payee.countryCode))) {
      payee.vatIdStatus = null;
      payee.vatIdName = null;
      payee.vatIdCheckedAt = null;
      return;
    }
    const result = await this.viesService.check(payee.countryCode, payee.vatId);
    payee.vatIdStatus = result.status === 'unavailable' ? null : result.status;
    payee.vatIdName = result.status === 'valid' ? result.name : null;
    payee.vatIdCheckedAt = result.checkedAt;
  }

  /** Checks the payee's VAT number again now; its rows are reassessed when the answer changed. */
  async recheckVatId(workspaceId: string, id: string): Promise<Payee> {
    const payee = await this.findPayee(workspaceId, id);
    const before = payee.vatIdStatus;
    await this.checkVatId(payee);
    const saved = await this.payeeRepository.save(payee);
    if (saved.vatIdStatus !== before) {
      await this.taxAssignmentService.reassess(workspaceId, { payeeId: saved.id });
    }
    return saved;
  }

  /**
   * Asks again about numbers VIES could not answer for: a member state's
   * register is often down for hours, and until it answers an invalid
   * number would go on being reverse-charged.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async recheckUnansweredVatIds(now: Date = new Date()): Promise<number> {
    const payees = await this.payeeRepository.find({
      where: {
        vatId: Not(IsNull()),
        countryCode: Not(IsNull()),
        vatIdStatus: IsNull(),
        vatIdCheckedAt: Or(IsNull(), LessThan(new Date(now.getTime() - VIES_RETRY_AFTER_MS))),
        // A past version keeps the answers it was copied with.
        workspace: STANDARD_WORKSPACE,
      },
      order: { vatIdCheckedAt: { direction: 'ASC', nulls: 'FIRST' } },
      take: VIES_RETRY_BATCH,
    });
    let answered = 0;
    for (const payee of payees) {
      try {
        const saved = await this.recheckVatId(payee.workspaceId, payee.id);
        if (saved.vatIdStatus !== null) {
          answered++;
        }
      } catch (error) {
        this.logger.warn(`VIES re-check failed for payee ${payee.id}: ${(error as Error).message}`);
      }
    }
    return answered;
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
        select: {
          id: true,
          name: true,
        },
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
    // A row on a filed tax return keeps its category; only its payee moves.
    if (!(hasDecidedCategory(transaction) || transaction.taxLocked)) {
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
    // Written with update(), so the tax subscriber did not see the new payee or category.
    await this.taxAssignmentService.reassess(workspaceId, { ids: [transaction.id] });

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
        '(transaction.categoryId IS NULL OR transaction.categorySource IN (:...undecided))',
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
