import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsOrder } from 'typeorm';
import { Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import type { CreateTaxRuleBody, UpdateTaxRuleBody } from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import { TaxRule, TaxRuleDirection } from '../../entities/tax-rule.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TaxRulesService extends WorkspaceCrudBaseService<TaxRule> {
  private readonly logger = new Logger(TaxRulesService.name);

  constructor(
    @InjectRepository(TaxRule)
    repository: Repository<TaxRule>,
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
    private readonly auditService: AuditService,
  ) {
    super(repository, 'Tax rule');
  }

  private snapshotTaxRule(rule: TaxRule) {
    return {
      id: rule.id,
      categoryId: rule.categoryId ?? null,
      taxRateCode: rule.taxRateCode,
      priority: rule.priority,
      direction: rule.direction,
      isEnabled: rule.isEnabled,
    };
  }

  /** Audit failure is logged, never allowed to fail the change it describes. */
  private async recordAudit(
    workspaceId: string,
    userId: string | undefined,
    entityId: string,
    action: AuditAction,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId ?? null,
        entityType: EntityType.TAX_RULE,
        entityId,
        action,
        diff: { before, after },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for tax rule ${entityId}: ${message}`);
    }
  }

  protected getDefaultOrder(): FindOptionsOrder<TaxRule> {
    return { priority: 'DESC', createdAt: 'ASC' };
  }

  /**
   * A rule may only name a code the workspace actually holds.
   *
   * Without this a typo produces a rule that silently never matches, and the
   * transactions it was meant to cover quietly fall through to the default
   * rate instead.
   */
  private async assertCodeExists(workspaceId: string, code: string): Promise<void> {
    const exists = await this.taxRateRepository.findOne({
      where: { workspaceId, code } as any,
    });

    if (!exists) {
      throw new BadRequestException(
        `No tax rate with code '${code}' in this workspace. Pick a country first, or use a code from GET /tax/settings/rates.`,
      );
    }
  }

  async create(workspaceId: string, dto: CreateTaxRuleBody, userId?: string): Promise<TaxRule> {
    const code = dto.taxRateCode.trim();
    await this.assertCodeExists(workspaceId, code);

    const direction = toEnum(TaxRuleDirection, dto.direction) ?? TaxRuleDirection.BOTH;
    const categoryId = dto.categoryId ?? null;

    const duplicate = await this.repository.findOne({
      where: { workspaceId, categoryId, direction } as any,
    });

    if (duplicate) {
      throw new BadRequestException(
        'A rule for this category and direction already exists. Edit it instead.',
      );
    }

    const saved = await this.repository.save(
      this.repository.create({
        workspaceId,
        categoryId,
        taxRateCode: code,
        priority: dto.priority ?? 0,
        direction,
        isEnabled: dto.isEnabled ?? true,
      }),
    );
    await this.recordAudit(
      workspaceId,
      userId,
      saved.id,
      AuditAction.CREATE,
      null,
      this.snapshotTaxRule(saved),
    );
    return saved;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTaxRuleBody,
    userId?: string,
  ): Promise<TaxRule> {
    const rule = await this.findOne(id, workspaceId);
    const before = this.snapshotTaxRule(rule);

    if (dto.taxRateCode != null) {
      const code = dto.taxRateCode.trim();
      await this.assertCodeExists(workspaceId, code);
      rule.taxRateCode = code;
    }

    if (dto.priority != null) {
      rule.priority = dto.priority;
    }

    if (dto.isEnabled != null) {
      rule.isEnabled = dto.isEnabled;
    }

    // Category and direction together form the rule's identity, so changing
    // either has to re-check for a clash with an existing rule.
    const nextCategoryId =
      dto.categoryId !== undefined ? (dto.categoryId ?? null) : rule.categoryId;
    const nextDirection = toEnum(TaxRuleDirection, dto.direction) ?? rule.direction;

    if (nextCategoryId !== rule.categoryId || nextDirection !== rule.direction) {
      const clash = await this.repository.findOne({
        where: { workspaceId, categoryId: nextCategoryId, direction: nextDirection } as any,
      });

      if (clash && clash.id !== id) {
        throw new BadRequestException(
          'A rule for this category and direction already exists. Edit it instead.',
        );
      }

      rule.categoryId = nextCategoryId;
      rule.direction = nextDirection;
    }

    const saved = await this.repository.save(rule);
    await this.recordAudit(
      workspaceId,
      userId,
      saved.id,
      AuditAction.UPDATE,
      before,
      this.snapshotTaxRule(saved),
    );
    return saved;
  }

  async remove(id: string, workspaceId: string, userId?: string): Promise<void> {
    const rule = await this.findOne(id, workspaceId);
    const before = this.snapshotTaxRule(rule);
    await this.repository.remove(rule);
    await this.recordAudit(workspaceId, userId, id, AuditAction.DELETE, before, null);
  }
}
