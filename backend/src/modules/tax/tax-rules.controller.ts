import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CreateTaxRuleBody,
  MessageResult,
  TaxRecordParams,
  TaxRuleItem,
  TaxRuleList,
  UpdateTaxRuleBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaxRulesService } from './tax-rules.service';

@Controller('tax/rules')
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxRuleList)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.taxRulesService.findAll(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxRuleItem)
  async findOne(
    @SchemaParams(TaxRecordParams) { id }: TaxRecordParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.taxRulesService.findOne(id, workspaceId);
  }

  // Rules decide how money is taxed, not how it is labelled, so they sit
  // behind settings management rather than category permissions.
  @Post()
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxRuleItem)
  async create(
    @SchemaBody(CreateTaxRuleBody) dto: CreateTaxRuleBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.taxRulesService.create(workspaceId, dto, user.id);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxRuleItem)
  async update(
    @SchemaParams(TaxRecordParams) { id }: TaxRecordParams,
    @SchemaBody(UpdateTaxRuleBody) dto: UpdateTaxRuleBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.taxRulesService.update(id, workspaceId, dto, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(TaxRecordParams) { id }: TaxRecordParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.taxRulesService.remove(id, workspaceId, user.id);
    return deletedResponse('Tax rule');
  }
}
