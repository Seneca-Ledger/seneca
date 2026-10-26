import { Controller, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import {
  ApplyOfficialRateBody,
  DismissOfficialRateBody,
  JurisdictionAdoption,
  OfficialRatesCheck,
  ReassessTaxBody,
  SetJurisdictionBody,
  SetTaxReserveBody,
  SetVatFilingBody,
  SetVatStatusBody,
  TaxRateList,
  TaxRatesOnDateQuery,
  TaxReassessment,
  TaxReserve,
  TaxReserveSettings,
  TaxThresholdStatus,
  VatFilingSettings,
  VatStatusChange,
  WorkspaceTaxSettings,
} from '../../contracts';
import { TaxFilingPeriod } from '../../entities/tax-jurisdiction.entity';
import type { User } from '../../entities/user.entity';
import { VatStatus } from '../../entities/workspace.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JurisdictionAdoptionService } from './jurisdiction-adoption.service';
import { OfficialVatRatesService } from './official-vat-rates.service';
import { TaxAssignmentService } from './tax-assignment.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxReserveService } from './tax-reserve.service';
import { TaxThresholdService } from './tax-threshold.service';
import { WorkspaceTaxSettingsService } from './workspace-tax-settings.service';

/**
 * A workspace's own tax configuration, as opposed to the global catalogue
 * served by JurisdictionsController.
 */
@Controller('tax/settings')
export class WorkspaceTaxController {
  constructor(
    private readonly adoptionService: JurisdictionAdoptionService,
    private readonly taxRatesService: TaxRatesService,
    private readonly taxThresholdService: TaxThresholdService,
    private readonly settingsService: WorkspaceTaxSettingsService,
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly taxReserveService: TaxReserveService,
    private readonly officialRatesService: OfficialVatRatesService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(WorkspaceTaxSettings)
  async getSettings(@WorkspaceId() workspaceId: string) {
    const [jurisdiction, vatStatus] = await Promise.all([
      this.adoptionService.getCurrentJurisdiction(workspaceId),
      this.settingsService.getVatStatus(workspaceId),
    ]);
    return { jurisdiction, vatStatus };
  }

  /**
   * Whether the workspace charges VAT. Every row not on a filed return is
   * assessed again under the new status, so the change shows at once.
   */
  @Put('vat-status')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(VatStatusChange)
  async setVatStatus(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SetVatStatusBody) dto: SetVatStatusBody,
    @CurrentUser() user: User,
  ) {
    return this.settingsService.setVatStatus(workspaceId, toEnum(VatStatus, dto.status), user.id);
  }

  /**
   * Applies the current rates, rules and payee details to rows already
   * booked — after a rule was added, say. Rows on a filed return stay as filed.
   */
  @Post('reassess')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxReassessment)
  async reassess(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ReassessTaxBody) dto: ReassessTaxBody,
  ) {
    return {
      reassessed: await this.taxAssignmentService.reassess(workspaceId, {
        from: dto.from ?? undefined,
      }),
    };
  }

  /** How often the workspace files VAT returns: drives the period presets and the reminders. */
  @Get('vat-filing')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(VatFilingSettings)
  async getVatFiling(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getVatFiling(workspaceId);
  }

  @Put('vat-filing')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(VatFilingSettings)
  async setVatFiling(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SetVatFilingBody) dto: SetVatFilingBody,
    @CurrentUser() user: User,
  ) {
    return this.settingsService.setVatFiling(
      workspaceId,
      { frequency: toEnum(TaxFilingPeriod, dto.frequency), extension: dto.extension },
      user.id,
    );
  }

  @Get('reserve')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxReserveSettings)
  async getReserveSettings(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getReserveSettings(workspaceId);
  }

  @Put('reserve')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxReserveSettings)
  async setReserveSettings(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SetTaxReserveBody) dto: SetTaxReserveBody,
    @CurrentUser() user: User,
  ) {
    return this.settingsService.setReserveSettings(workspaceId, dto, user.id);
  }

  /** How much of the money held is really owed as tax, by the workspace's own rule. */
  @Get('reserve/amount')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(TaxReserve)
  async getReserve(@WorkspaceId() workspaceId: string) {
    return this.taxReserveService.getReserve(workspaceId);
  }

  /**
   * Rates the workspace can actually apply on a given day, default today.
   * The date matters: a rate set changes over time, and the UI should show
   * what applies to the document being entered, not what applies now.
   */
  @Get('rates')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxRateList)
  async getRatesInForce(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(TaxRatesOnDateQuery) query: TaxRatesOnDateQuery,
  ) {
    return this.taxRatesService.findEnabledForDate(workspaceId, query.date ?? new Date());
  }

  /**
   * Turnover against the registration threshold for the current window.
   * Null when the workspace has no jurisdiction, or its jurisdiction
   * publishes no threshold we track.
   */
  @Get('threshold')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxThresholdStatus)
  async getThreshold(@WorkspaceId() workspaceId: string) {
    return this.taxThresholdService.getStatus(workspaceId);
  }

  /**
   * The workspace's VAT rates against the ones its member state reports to
   * the European Commission (TEDB), including changes already announced.
   */
  @Get('official-rates')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(OfficialRatesCheck)
  async getOfficialRates(@WorkspaceId() workspaceId: string) {
    return this.officialRatesService.check(workspaceId);
  }

  /** Asks TEDB again now rather than using the answer kept from the last check. */
  @Post('official-rates/refresh')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(OfficialRatesCheck)
  async refreshOfficialRates(@WorkspaceId() workspaceId: string) {
    return this.officialRatesService.check(workspaceId, { refresh: true });
  }

  /**
   * Takes over an official rate: a new version of the standard rate from the
   * date it changes (unfiled rows from then on are assessed again), or a
   * reduced rate the workspace lacks.
   */
  @Post('official-rates/apply')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(OfficialRatesCheck)
  async applyOfficialRate(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ApplyOfficialRateBody) dto: ApplyOfficialRateBody,
    @CurrentUser() user: User,
  ) {
    return this.officialRatesService.apply(workspaceId, dto.key, user.id);
  }

  @Put('official-rates/dismissed')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(OfficialRatesCheck)
  async dismissOfficialRate(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(DismissOfficialRateBody) dto: DismissOfficialRateBody,
  ) {
    await this.officialRatesService.dismiss(workspaceId, dto.key, dto.dismissed);
    return this.officialRatesService.check(workspaceId);
  }

  /**
   * Picks the workspace's country and copies that jurisdiction's statutory
   * rates in. Guarded by settings management rather than category permissions:
   * this changes how money is taxed, not how it is labelled.
   */
  @Put('jurisdiction')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(JurisdictionAdoption)
  async setJurisdiction(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SetJurisdictionBody) dto: SetJurisdictionBody,
    @CurrentUser() user: User,
  ) {
    return this.adoptionService.adopt(
      workspaceId,
      dto.code,
      dto.effectiveFrom ?? undefined,
      user.id,
    );
  }
}
