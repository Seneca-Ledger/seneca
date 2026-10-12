import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import { CreateTaxRateBody, UpdateTaxRateBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaxRatesService } from './tax-rates.service';

@Controller('tax-rates')
export class TaxRatesController {
  constructor(private readonly taxRatesService: TaxRatesService) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.taxRatesService.findAll(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.taxRatesService.findOne(id, workspaceId);
  }

  @Post()
  @WorkspaceAuth(Permission.CATEGORY_CREATE)
  async create(
    @SchemaBody(CreateTaxRateBody) createDto: CreateTaxRateBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.taxRatesService.create(workspaceId, createDto, user.id);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  async update(
    @Param('id') id: string,
    @SchemaBody(UpdateTaxRateBody) updateDto: UpdateTaxRateBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.taxRatesService.update(id, workspaceId, updateDto, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.CATEGORY_DELETE)
  async remove(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.taxRatesService.remove(id, workspaceId, user.id);
    return deletedResponse('Tax rate');
  }
}
