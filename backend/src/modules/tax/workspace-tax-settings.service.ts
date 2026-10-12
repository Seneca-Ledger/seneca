import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Category } from '../../entities/category.entity';
import { TaxFilingPeriod } from '../../entities/tax-jurisdiction.entity';
import { VatStatus, Workspace } from '../../entities/workspace.entity';
import {
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities/workspace-service-settings.entity';
import { AuditService } from '../audit/audit.service';
import { TaxAssignmentService } from './tax-assignment.service';
import { taxPaymentsCategoryId } from './tax-payments-category';
import { VAT_DEADLINE_RULES } from './vat-deadlines';

export interface VatFilingSettings {
  /** How often the workspace files; the jurisdiction's usual frequency until chosen. */
  frequency: TaxFilingPeriod | null;
  /** Whether that frequency was chosen, rather than taken from the jurisdiction. */
  isDefault: boolean;
  /** A standing extension is held (Germany's Dauerfristverlängerung). */
  extension: boolean;
  /** The extension the country offers, if any; NULL hides the switch. */
  extensionName: string | null;
  /** Whether deadlines for this country were verified, so reminders can be sent. */
  deadlinesKnown: boolean;
  /** The frequencies the verified rule covers. */
  knownFrequencies: TaxFilingPeriod[];
}

export interface TaxReserveSettings {
  /** Share of income to set aside for income tax, 0–100. NULL means off. */
  percent: number | null;
  /** Expense category tax payments are booked to; they are what the reserve is paid from. */
  paymentsCategoryId: string | null;
}

/**
 * A workspace's own tax switches: whether it charges VAT, and how much of its
 * income it sets aside for tax. Changing the VAT status re-assesses every row
 * not on a filed return, so the figures follow the switch at once.
 */
@Injectable()
export class WorkspaceTaxSettingsService {
  private readonly logger = new Logger(WorkspaceTaxSettingsService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly auditService: AuditService,
  ) {}

  async getVatStatus(workspaceId: string): Promise<VatStatus> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, vatStatus: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace.vatStatus;
  }

  async setVatStatus(
    workspaceId: string,
    status: VatStatus,
    userId?: string,
  ): Promise<{ vatStatus: VatStatus; reassessed: number }> {
    const previous = await this.getVatStatus(workspaceId);
    if (previous === status) {
      return { vatStatus: status, reassessed: 0 };
    }

    await this.workspaceRepository.update({ id: workspaceId }, { vatStatus: status });
    const reassessed = await this.taxAssignmentService.reassess(workspaceId);

    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId ?? null,
        entityType: EntityType.WORKSPACE,
        entityId: workspaceId,
        action: AuditAction.UPDATE,
        diff: { before: { vatStatus: previous }, after: { vatStatus: status } },
        meta: { reassessed },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for workspace ${workspaceId} VAT status: ${message}`);
    }

    return { vatStatus: status, reassessed };
  }

  async getVatFiling(workspaceId: string): Promise<VatFilingSettings> {
    const [row, workspace] = await Promise.all([
      this.settingsRepository.findOne({
        where: { workspaceId, key: WorkspaceServiceSettingsKey.VAT_FILING },
      }),
      this.workspaceRepository.findOne({
        where: { id: workspaceId },
        relations: { taxJurisdiction: true },
      }),
    ]);
    const config = (row?.config ?? {}) as { frequency?: TaxFilingPeriod; extension?: boolean };
    const chosen = Object.values(TaxFilingPeriod).includes(config.frequency as TaxFilingPeriod)
      ? (config.frequency as TaxFilingPeriod)
      : null;
    const rule = workspace?.taxJurisdiction
      ? VAT_DEADLINE_RULES[workspace.taxJurisdiction.code.toUpperCase()]
      : undefined;
    return {
      frequency: chosen ?? workspace?.taxJurisdiction?.filingPeriod ?? null,
      isDefault: chosen === null,
      extension: config.extension === true && Boolean(rule?.extension),
      extensionName: rule?.extension?.name ?? null,
      deadlinesKnown: Boolean(rule),
      knownFrequencies: rule ? (Object.keys(rule.frequencies) as TaxFilingPeriod[]) : [],
    };
  }

  async setVatFiling(
    workspaceId: string,
    settings: { frequency: TaxFilingPeriod | null; extension: boolean },
    userId?: string,
  ): Promise<VatFilingSettings> {
    const existing = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.VAT_FILING },
    });
    await this.settingsRepository.save({
      ...(existing ?? {}),
      workspaceId,
      key: WorkspaceServiceSettingsKey.VAT_FILING,
      config: { frequency: settings.frequency, extension: settings.extension },
      updatedByUserId: userId ?? null,
    });
    return this.getVatFiling(workspaceId);
  }

  async getReserveSettings(workspaceId: string): Promise<TaxReserveSettings> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.TAX_RESERVE },
    });
    const config = (row?.config ?? {}) as Partial<TaxReserveSettings>;
    const percent = typeof config.percent === 'number' ? config.percent : null;
    // Until the user picks one, payments are read from the seeded "Taxes" category.
    const paymentsCategoryId =
      config.paymentsCategoryId !== undefined
        ? config.paymentsCategoryId
        : await taxPaymentsCategoryId(this.categoryRepository.manager, workspaceId);
    return { percent, paymentsCategoryId: paymentsCategoryId ?? null };
  }

  async setReserveSettings(
    workspaceId: string,
    settings: TaxReserveSettings,
    userId?: string,
  ): Promise<TaxReserveSettings> {
    if (settings.percent !== null && !(settings.percent >= 0 && settings.percent <= 100)) {
      throw new BadRequestException('The share to set aside must be between 0 and 100');
    }
    if (settings.paymentsCategoryId) {
      const owned = await this.categoryRepository.count({
        where: { id: settings.paymentsCategoryId, workspaceId },
      });
      if (!owned) {
        throw new BadRequestException(
          'The tax payments category does not belong to this workspace',
        );
      }
    }

    const existing = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.TAX_RESERVE },
    });
    await this.settingsRepository.save({
      ...(existing ?? {}),
      workspaceId,
      key: WorkspaceServiceSettingsKey.TAX_RESERVE,
      config: { percent: settings.percent, paymentsCategoryId: settings.paymentsCategoryId },
      updatedByUserId: userId ?? null,
    });
    // Rows in the tax payments category carry no VAT, so moving that category
    // moves rows in and out of assessment.
    const before = existing?.config as Partial<TaxReserveSettings> | undefined;
    if (before?.paymentsCategoryId !== settings.paymentsCategoryId) {
      await this.taxAssignmentService.reassess(workspaceId);
    }
    return this.getReserveSettings(workspaceId);
  }
}
