import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { TaxRateKind } from '../../entities/tax-jurisdiction-rate.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditService } from '../audit/audit.service';
import { JurisdictionsService, toDateOnly } from './jurisdictions.service';

export interface AdoptionResult {
  jurisdictionCode: string;
  /** Rate versions created or refreshed from the statutory catalogue. */
  adopted: number;
  /** Rates of a previous jurisdiction closed off as of the switch date. */
  retired: number;
  effectiveFrom: string;
}

/** The day before `date`, as 'YYYY-MM-DD'. */
function previousDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return toDateOnly(parsed);
}

/**
 * Copies a jurisdiction's statutory rates into a workspace's own rate set.
 *
 * Switching jurisdiction never deletes anything. Old rates are closed off with
 * a `validTo` so that transactions already taxed under them keep resolving,
 * which is the whole reason the rate set is versioned.
 */
@Injectable()
export class JurisdictionAdoptionService {
  private readonly logger = new Logger(JurisdictionAdoptionService.name);

  constructor(
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly jurisdictionsService: JurisdictionsService,
    private readonly auditService: AuditService,
  ) {}

  /** The jurisdiction a workspace currently files in, or null if unconfigured. */
  async getCurrentJurisdiction(workspaceId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });

    return workspace?.taxJurisdiction ?? null;
  }

  async adopt(
    workspaceId: string,
    jurisdictionCode: string,
    effectiveFrom: string = toDateOnly(new Date()),
    userId?: string,
  ): Promise<AdoptionResult> {
    const jurisdiction = await this.jurisdictionsService.findByCode(jurisdictionCode);
    const reference = await this.jurisdictionsService.findAllRates(jurisdiction.id);
    const previous = await this.getCurrentJurisdiction(workspaceId);

    const result = await this.taxRateRepository.manager.transaction(async manager => {
      const retired = await this.retirePreviousJurisdiction(
        manager,
        workspaceId,
        jurisdiction.id,
        effectiveFrom,
      );

      // Exactly one rate may be the default on any given date. A hand-made rate
      // that was the default before must yield, or resolution becomes a coin flip.
      await manager
        .createQueryBuilder()
        .update(TaxRate)
        .set({ isDefault: false })
        .where('workspace_id = :workspaceId', { workspaceId })
        .andWhere('is_default = true')
        .andWhere('(jurisdiction_id IS NULL OR jurisdiction_id != :jurisdictionId)', {
          jurisdictionId: jurisdiction.id,
        })
        .andWhere('(valid_to IS NULL OR valid_to >= :effectiveFrom)', { effectiveFrom })
        .execute();

      let adopted = 0;
      for (const source of reference) {
        const existing = await manager.findOne(TaxRate, {
          where: { workspaceId, code: source.code, validFrom: source.validFrom },
        });

        const fields = {
          workspaceId,
          jurisdictionId: jurisdiction.id,
          code: source.code,
          name: source.name,
          rate: source.rate,
          kind: source.kind,
          isDefault: source.isDefault,
          validFrom: source.validFrom,
          validTo: source.validTo,
          // Statutory rates are quoted on the net amount, but every amount we
          // hold comes from a gross document, so we extract rather than add on.
          isInclusive: true,
          isReverseCharge: false,
          isEnabled: true,
        };

        // A copy: save() writes the new id back into the object it is given,
        // and `fields` is reused for the reverse-charge twin below.
        await manager.save(
          TaxRate,
          existing ? manager.merge(TaxRate, existing, { ...fields }) : { ...fields },
        );
        adopted++;

        // Inside the EU, a supply to a VAT-registered business in another
        // member state is invoiced without VAT. A reverse-charge twin of the
        // standard rate is what an invoice line or a purchase picks for it;
        // its rate still gives the notional figure the return reports.
        if (jurisdiction.isEu && source.kind === TaxRateKind.STANDARD) {
          const code = `${source.code}_RC`;
          const twin = await manager.findOne(TaxRate, {
            where: { workspaceId, code, validFrom: source.validFrom },
          });
          const twinFields = {
            ...fields,
            code,
            name: `${source.name} — reverse charge`,
            isDefault: false,
            isReverseCharge: true,
          };
          await manager.save(TaxRate, twin ? manager.merge(TaxRate, twin, twinFields) : twinFields);
          adopted++;
        }
      }

      await manager.update(Workspace, { id: workspaceId }, { taxJurisdictionId: jurisdiction.id });

      this.logger.log(
        `Adopted ${adopted} rate versions from ${jurisdiction.code} for workspace ${workspaceId} ` +
          `(effective ${effectiveFrom}, retired ${retired})`,
      );

      return { jurisdictionCode: jurisdiction.code, adopted, retired, effectiveFrom };
    });

    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId ?? null,
        entityType: EntityType.WORKSPACE,
        entityId: workspaceId,
        action: AuditAction.UPDATE,
        diff: {
          before: { taxJurisdiction: previous?.code ?? null },
          after: { taxJurisdiction: jurisdiction.code },
        },
        meta: { effectiveFrom, adopted: result.adopted, retired: result.retired },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for workspace ${workspaceId} jurisdiction: ${message}`);
    }

    return result;
  }

  /**
   * Closes off rates belonging to a jurisdiction the workspace is leaving.
   *
   * Hand-made rates (jurisdiction_id NULL) are left untouched: the user created
   * them deliberately and a country change is no reason to revoke them.
   */
  private async retirePreviousJurisdiction(
    manager: EntityManager,
    workspaceId: string,
    keepJurisdictionId: string,
    effectiveFrom: string,
  ): Promise<number> {
    // In force at the switch date: give them an end date of the day before, so
    // history stays resolvable and the new set takes over cleanly.
    const closed = await manager
      .createQueryBuilder()
      .update(TaxRate)
      .set({ validTo: previousDay(effectiveFrom) })
      .where('workspace_id = :workspaceId', { workspaceId })
      .andWhere('jurisdiction_id IS NOT NULL')
      .andWhere('jurisdiction_id != :keepJurisdictionId', { keepJurisdictionId })
      .andWhere('valid_from < :effectiveFrom', { effectiveFrom })
      .andWhere('(valid_to IS NULL OR valid_to >= :effectiveFrom)', { effectiveFrom })
      .execute();

    // Not yet in force: these never applied to a single transaction here, but
    // they cannot be deleted because a future-dated one may still be
    // referenced. Disabling takes them out of resolution and keeps the FK sound.
    const disabled = await manager
      .createQueryBuilder()
      .update(TaxRate)
      .set({ isEnabled: false, isDefault: false })
      .where('workspace_id = :workspaceId', { workspaceId })
      .andWhere('jurisdiction_id IS NOT NULL')
      .andWhere('jurisdiction_id != :keepJurisdictionId', { keepJurisdictionId })
      .andWhere('valid_from >= :effectiveFrom', { effectiveFrom })
      .execute();

    return (closed.affected ?? 0) + (disabled.affected ?? 0);
  }
}
