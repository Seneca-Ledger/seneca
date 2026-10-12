import { BadRequestException, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { SaveIncomeTaxMappingsBody, UpdateIncomeTaxProfileBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { parseTaxYear } from './dto/income-tax.dto';
import { IncomeTaxDisclaimerService } from './income-tax-disclaimer.service';
import { IncomeTaxDraftService } from './income-tax-draft.service';
import { IncomeTaxReturnsService } from './income-tax-returns.service';

/**
 * Income-tax declaration drafts.
 *
 * Reading follows the report permission. Anything that changes how the year is
 * declared — the profile, line assignments, finalizing — sits behind settings
 * management, like filing a VAT return.
 */
@Controller('income-tax')
export class IncomeTaxController {
  constructor(
    private readonly draftService: IncomeTaxDraftService,
    private readonly returnsService: IncomeTaxReturnsService,
    private readonly disclaimerService: IncomeTaxDisclaimerService,
  ) {}

  @Get('disclaimer')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getDisclaimer(@CurrentUser() user: User) {
    return this.disclaimerService.getStatus(user.id);
  }

  /** Personal acknowledgement, so anyone who may read drafts may give it. */
  @Post('disclaimer')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async acceptDisclaimer(@CurrentUser() user: User) {
    return this.disclaimerService.accept(user.id);
  }

  @Get('profile')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getProfile(@WorkspaceId() workspaceId: string, @Query('taxYear') taxYear: string) {
    return this.draftService.getProfileOverview(workspaceId, parseTaxYear(taxYear));
  }

  @Put('profile')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async saveProfile(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @SchemaBody(UpdateIncomeTaxProfileBody) dto: UpdateIncomeTaxProfileBody,
  ) {
    return this.draftService.saveProfile(
      workspaceId,
      parseTaxYear(dto.taxYear),
      dto.taxpayerType,
      dto.details ?? {},
      user.id,
    );
  }

  @Get('mappings')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getMappings(@WorkspaceId() workspaceId: string, @Query('taxYear') taxYear: string) {
    return this.draftService.getMappings(workspaceId, parseTaxYear(taxYear));
  }

  @Put('mappings')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async saveMappings(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @SchemaBody(SaveIncomeTaxMappingsBody) dto: SaveIncomeTaxMappingsBody,
  ) {
    return this.draftService.saveMappings(
      workspaceId,
      user.id,
      parseTaxYear(dto.taxYear),
      dto.entries,
    );
  }

  @Get('returns/:taxYear')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getDraft(@WorkspaceId() workspaceId: string, @Param('taxYear') taxYear: string) {
    return this.returnsService.getDraft(workspaceId, parseTaxYear(taxYear));
  }

  @Post('returns/:taxYear/finalize')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async finalize(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @Param('taxYear') taxYear: string,
  ) {
    return this.returnsService.finalize(workspaceId, user.id, parseTaxYear(taxYear));
  }

  @Post('returns/:taxYear/reopen')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async reopen(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @Param('taxYear') taxYear: string,
  ) {
    return this.returnsService.reopen(workspaceId, parseTaxYear(taxYear), user.id);
  }

  @Get('returns/:taxYear/export')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async export(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @Param('taxYear') taxYear: string,
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    if (format !== 'pdf' && format !== 'xlsx') {
      throw new BadRequestException("Format must be 'pdf' or 'xlsx'");
    }

    const { buffer, fileName, contentType } = await this.returnsService.export(
      workspaceId,
      user.id,
      parseTaxYear(taxYear),
      format,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(buffer);
  }
}
