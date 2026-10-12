import { Controller, Get, Put, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { SetJurisdictionBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JurisdictionAdoptionService } from './jurisdiction-adoption.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxThresholdService } from './tax-threshold.service';

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
  ) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async getSettings(@WorkspaceId() workspaceId: string) {
    return {
      jurisdiction: await this.adoptionService.getCurrentJurisdiction(workspaceId),
    };
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
