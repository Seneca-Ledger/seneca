import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsOrder } from 'typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import type { CreateTaxRateBody, UpdateTaxRateBody } from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import { AuditService } from '../audit/audit.service';
import { toDateOnly } from './jurisdictions.service';

/** Stands in for "no end date" when comparing periods in SQL. */
const FOREVER = '9999-12-31';

@Injectable()
export class TaxRatesService extends WorkspaceCrudBaseService<TaxRate> {
  private readonly logger = new Logger(TaxRatesService.name);

  constructor(
    @InjectRepository(TaxRate)
    repository: Repository<TaxRate>,
    private readonly auditService: AuditService,
  ) {
    super(repository, 'Tax rate');
  }

  private snapshotTaxRate(taxRate: TaxRate) {
    return {
      id: taxRate.id,
      name: taxRate.name,
      code: taxRate.code ?? null,
      rate: taxRate.rate,
      isDefault: taxRate.isDefault,
      isEnabled: taxRate.isEnabled,
      validFrom: taxRate.validFrom,
      validTo: taxRate.validTo ?? null,
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
        entityType: EntityType.TAX_RATE,
        entityId,
        action,
        diff: { before, after },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for tax rate ${entityId}: ${message}`);
    }
  }

  protected getDefaultOrder(): FindOptionsOrder<TaxRate> {
    return { isDefault: 'DESC', rate: 'ASC', name: 'ASC' };
  }

  /**
   * Rates a workspace can apply on a given day.
   *
   * Always pass the transaction's own date. Resolving with "today" would tax a
   * 2025 purchase at the 2026 rate the moment the law changed.
   */
  async findEnabledForDate(workspaceId: string, date: Date | string): Promise<TaxRate[]> {
    const on = toDateOnly(date);

    return this.repository.find({
      where: [
        { workspaceId, isEnabled: true, validFrom: LessThanOrEqual(on), validTo: IsNull() },
        {
          workspaceId,
          isEnabled: true,
          validFrom: LessThanOrEqual(on),
          validTo: MoreThanOrEqual(on),
        },
      ],
      order: { isDefault: 'DESC', rate: 'ASC', name: 'ASC' },
    });
  }

  /** The workspace's default rate on a given day, or null if none applies. */
  async findDefaultForDate(workspaceId: string, date: Date | string): Promise<TaxRate | null> {
    const inForce = await this.findEnabledForDate(workspaceId, date);
    return inForce.find(rate => rate.isDefault) ?? null;
  }

  /**
   * Resolves a stable rate code to the version in force on a given day.
   *
   * This is what lets a rule outlive a change in the law: the rule stores
   * 'KZ_STANDARD', and a 2025 transaction still gets 12% after the 2026 row
   * exists.
   */
  async findByCodeForDate(
    workspaceId: string,
    code: string,
    date: Date | string,
  ): Promise<TaxRate | null> {
    const inForce = await this.findEnabledForDate(workspaceId, date);
    return inForce.find(rate => rate.code === code) ?? null;
  }

  /**
   * Strips the default flag from rates whose validity period overlaps the one
   * given, so that exactly one default is ever in force at a time.
   *
   * Scoped by period rather than blanket-cleared: the KZ 12% and 16% rows are
   * both defaults, and clearing one must not disturb the other.
   */
  private async clearOverlappingDefaults(
    workspaceId: string,
    validFrom: string,
    validTo: string | null,
    exceptId?: string,
  ): Promise<void> {
    const query = this.repository
      .createQueryBuilder()
      .update(TaxRate)
      .set({ isDefault: false })
      .where('workspace_id = :workspaceId', { workspaceId })
      .andWhere('is_default = true')
      .andWhere('valid_from <= :newTo', { newTo: validTo ?? FOREVER })
      .andWhere('COALESCE(valid_to, :forever) >= :newFrom', {
        forever: FOREVER,
        newFrom: validFrom,
      });

    if (exceptId) {
      query.andWhere('id != :exceptId', { exceptId });
    }

    await query.execute();
  }

  async create(
    workspaceId: string,
    createDto: CreateTaxRateBody,
    userId?: string,
  ): Promise<TaxRate> {
    const name = createDto.name.trim();
    if (!name) {
      throw new BadRequestException('Tax rate name is required');
    }

    const duplicate = await this.repository.findOne({
      where: { workspaceId, name } as any,
    });

    if (duplicate) {
      throw new BadRequestException('Tax rate with this name already exists');
    }

    // Hand-made rates carry no statutory lineage, so they span the whole
    // timeline. The UI can narrow this once rate periods are editable.
    const validFrom = '1900-01-01';
    const validTo = null;

    const shouldBeDefault = createDto.isDefault === true;
    if (shouldBeDefault) {
      await this.clearOverlappingDefaults(workspaceId, validFrom, validTo);
    }

    const taxRate = this.repository.create({
      workspaceId,
      name,
      rate: createDto.rate,
      isDefault: shouldBeDefault,
      isEnabled: createDto.isEnabled ?? true,
      validFrom,
      validTo,
    });

    const saved = await this.repository.save(taxRate);
    await this.recordAudit(
      workspaceId,
      userId,
      saved.id,
      AuditAction.CREATE,
      null,
      this.snapshotTaxRate(saved),
    );
    return saved;
  }

  async update(
    id: string,
    workspaceId: string,
    updateDto: UpdateTaxRateBody,
    userId?: string,
  ): Promise<TaxRate> {
    const taxRate = await this.findOne(id, workspaceId);
    const before = this.snapshotTaxRate(taxRate);

    if (updateDto.name != null) {
      const normalizedName = updateDto.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Tax rate name is required');
      }

      const duplicate = await this.repository.findOne({
        where: { workspaceId, name: normalizedName } as any,
      });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Tax rate with this name already exists');
      }

      taxRate.name = normalizedName;
    }

    if (updateDto.rate != null) {
      taxRate.rate = updateDto.rate;
    }

    if (updateDto.isEnabled != null) {
      taxRate.isEnabled = updateDto.isEnabled;
    }

    if (updateDto.isDefault != null) {
      if (updateDto.isDefault) {
        await this.clearOverlappingDefaults(workspaceId, taxRate.validFrom, taxRate.validTo, id);
      }
      taxRate.isDefault = updateDto.isDefault;
    }

    const saved = await this.repository.save(taxRate);
    await this.recordAudit(
      workspaceId,
      userId,
      saved.id,
      AuditAction.UPDATE,
      before,
      this.snapshotTaxRate(saved),
    );
    return saved;
  }

  async remove(id: string, workspaceId: string, userId?: string): Promise<void> {
    const taxRate = await this.findOne(id, workspaceId);
    const before = this.snapshotTaxRate(taxRate);
    await this.repository.remove(taxRate);
    await this.recordAudit(workspaceId, userId, id, AuditAction.DELETE, before, null);
  }

  /**
   * Seeds a brand-new workspace with a rate set.
   *
   * Without a jurisdiction there is nothing statutory to seed, so we fall back
   * to a single zero rate: it keeps the "every workspace has a default" promise
   * that the manual-expense path relies on, without inventing a tax nobody
   * chose. Picking a country later replaces this via the adoption service.
   */
  async createDefaultTaxRates(workspaceId: string): Promise<void> {
    const existingCount = await this.repository.count({ where: { workspaceId } as any });
    if (existingCount > 0) {
      return;
    }

    const defaultRate = this.repository.create({
      workspaceId,
      name: 'Tax exempt (0%)',
      rate: 0,
      isDefault: true,
      isEnabled: true,
      validFrom: '1900-01-01',
      validTo: null,
    });

    await this.repository.save(defaultRate);
  }
}
