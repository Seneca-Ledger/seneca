import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { SetJurisdictionBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  DismissOfficialRateDto,
  OfficialRateDifferenceDto,
  ReassessTaxDto,
  SetTaxReserveDto,
  SetVatFilingDto,
  SetVatStatusDto,
} from './dto/tax-settings.dto';
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
  async setVatStatus(
    @WorkspaceId() workspaceId: string,
    @Body() dto: SetVatStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.settingsService.setVatStatus(workspaceId, dto.status, user.id);
  }

  /**
   * Applies the current rates, rules and payee details to rows already
   * booked — after a rule was added, say. Rows on a filed return stay as filed.
   */
  @Post('reassess')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async reassess(@WorkspaceId() workspaceId: string, @Body() dto: ReassessTaxDto) {
    return {
      reassessed: await this.taxAssignmentService.reassess(workspaceId, { from: dto.from }),
    };
  }

  /** How often the workspace files VAT returns: drives the period presets and the reminders. */
  @Get('vat-filing')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async getVatFiling(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getVatFiling(workspaceId);
  }

  @Put('vat-filing')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async setVatFiling(
    @WorkspaceId() workspaceId: string,
    @Body() dto: SetVatFilingDto,
    @CurrentUser() user: User,
  ) {
    return this.settingsService.setVatFiling(workspaceId, dto, user.id);
  }

  @Get('reserve')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async getReserveSettings(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getReserveSettings(workspaceId);
  }

  @Put('reserve')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async setReserveSettings(
    @WorkspaceId() workspaceId: string,
    @Body() dto: SetTaxReserveDto,
    @CurrentUser() user: User,
  ) {
    return this.settingsService.setReserveSettings(workspaceId, dto, user.id);
  }

  /** How much of the money held is really owed as tax, by the workspace's own rule. */
  @Get('reserve/amount')
  @WorkspaceAuth(Permission.REPORT_VIEW)
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
  async getRatesInForce(@WorkspaceId() workspaceId: string, @Query('date') date?: string) {
    return this.taxRatesService.findEnabledForDate(workspaceId, date ?? new Date());
  }

  /**
   * Turnover against the registration threshold for the current window.
   * Null when the workspace has no jurisdiction, or its jurisdiction
   * publishes no threshold we track.
   */
  @Get('threshold')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async getThreshold(@WorkspaceId() workspaceId: string) {
    return this.taxThresholdService.getStatus(workspaceId);
  }

  /**
   * The workspace's VAT rates against the ones its member state reports to
   * the European Commission (TEDB), including changes already announced.
   */
  @Get('official-rates')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async getOfficialRates(@WorkspaceId() workspaceId: string) {
    return this.officialRatesService.check(workspaceId);
  }

  /** Asks TEDB again now rather than using the answer kept from the last check. */
  @Post('official-rates/refresh')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
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
  async applyOfficialRate(
    @WorkspaceId() workspaceId: string,
    @Body() dto: OfficialRateDifferenceDto,
    @CurrentUser() user: User,
  ) {
    return this.officialRatesService.apply(workspaceId, dto.key, user.id);
  }

  @Put('official-rates/dismissed')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async dismissOfficialRate(
    @WorkspaceId() workspaceId: string,
    @Body() dto: DismissOfficialRateDto,
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
